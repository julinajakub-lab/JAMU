/* node tests/map.cjs; install Playwright separately or set JAMU_PLAYWRIGHT.
 * All geocoding and live database requests are fixtures. No group data is changed.
 * CDN fixtures are downloaded to ignored .qa/ once (see MAP.md).
 */
const { chromium } = require(process.env.JAMU_PLAYWRIGHT || 'playwright');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { createHash } = require('node:crypto');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
const testSource = source.replace('\nstart();', '\nwindow.mapTest = { state: () => S, render, load, mount: () => leafletMap, locateTrip, geocodePlace, hasCoordinates };\nstart();');
const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=', 'base64');
const seed = [
  { id: 'past', collection: 'trips', created_at: '2020-01-01', title: 'Naše Brno', place: 'Brno', start: '2020-06-01', end: '2020-06-03', status: 'done', organiser: 'jakub', lat: 49.195, lng: 16.607 },
  { id: 'next', collection: 'trips', created_at: '2026-01-01', title: 'Spolu v Bratislavě', place: 'Bratislava', start: '2027-06-01', end: '2027-06-03', status: 'planning', organiser: 'jakub', lat: 48.1486, lng: 17.1077 },
  { id: 'home-old', collection: 'homes', created_at: '2024-01-01', member: 'michaela', town: 'Praha', lat: 50.08, lng: 14.42 },
  ...['michaela', 'adam', 'julia'].map((member, i) => ({ id: 'home-' + i, collection: 'homes', created_at: '2026-01-01', member, town: 'Brno', lat: 49.195, lng: 16.607 })),
  { id: 'ghost-home', collection: 'homes', created_at: '2026-01-01', member: 'iva', town: 'Olomouc', lat: 49.59, lng: 17.25 }
];
const requests = [], errors = [], checks = [];
let liveRows = [], changedDuringLookup = false;
const tripRow = (id, data) => ({ id, collection: 'trips', created_at: '2020-01-01', data });
function dbQuery(q) {
  const matches = row => q.filters.every(([op, key, value]) => {
    let actual = key.startsWith('data->>') ? row.data[key.slice(7)] : row[key];
    if (key === 'data') return JSON.stringify(actual) === value;
    return op === 'lt' ? actual < value : actual === value;
  });
  let rows = liveRows.filter(matches);
  if (q.op === 'insert') {
    const value = { ...q.values, id: q.values.id || crypto.randomUUID(), created_at: new Date().toISOString() };
    if (liveRows.some(r => r.id === value.id)) return { error: { code: '23505' } };
    liveRows.push(value); rows = [value];
  } else if (q.op === 'delete') liveRows = liveRows.filter(row => !matches(row));
  else if (q.op === 'update') rows.forEach(row => Object.assign(row, q.values));
  if (q.order) rows.sort((a, b) => String(a[q.order.key]).localeCompare(String(b[q.order.key])) * (q.order.asc ? 1 : -1));
  if (q.limit) rows = rows.slice(0, q.limit);
  return { data: q.single ? rows[0] || null : rows, error: null };
}
const mockSupabase = `window.supabase = {createClient: () => ({
 auth: { getSession: async () => ({data: {session: {user: {id:'test'}}}}), signOut: async () => ({}) },
 storage: {from: () => ({createSignedUrls: async () => ({data: []})})},
 from: table => {
  const q = {table, op:'select', filters:[]};
  const chain = {select(){return chain},insert(values){q.op='insert';q.values=values;return chain},update(values){q.op='update';q.values=values;return chain},delete(){q.op='delete';return chain},eq(k,v){q.filters.push(['eq',k,v]);return chain},lt(k,v){q.filters.push(['lt',k,v]);return chain},order(key,opts){q.order={key,asc:opts?.ascending!==false};return chain},limit(n){q.limit=n;return chain},single(){q.single=true;return chain},maybeSingle(){q.single=true;return chain},then(resolve,reject){return window.dbQuery(q).then(resolve,reject)}};
  return chain;
 }
})};`;
async function prepare(context, live = false) {
  await context.exposeFunction('dbQuery', dbQuery);
  await context.addInitScript(({ seed }) => {
    if (!['http:', 'https:', 'file:'].includes(location.protocol)) return;
    localStorage.setItem('jamu-auth', '1'); localStorage.setItem('jamu-me', 'jakub');
    if (!localStorage.getItem('jamu-demo-v5')) localStorage.setItem('jamu-demo-v5', JSON.stringify(seed));
  }, { seed });
  await context.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.hostname === 'nominatim.openstreetmap.org') {
      const query = url.searchParams.get('q') || url.searchParams.get('city');
      requests.push({ query, at: Date.now(), country: url.searchParams.get('countrycodes'), town: url.searchParams.has('city') });
      if (query === 'Offline') return route.fulfill({ status: 503, body: 'unavailable' });
      if (query === 'Concurrent') {
        const row = liveRows.find(r => r.id === 'concurrent');
        if (row) { row.data.story = 'Concurrent story'; changedDuringLookup = true; }
      }
      const found = query === 'Unknown' || (query === 'Vienna' && url.searchParams.has('countrycodes')) ? [] : [{ lat: query === 'Vienna' ? '48.208' : '49.195', lon: query === 'Vienna' ? '16.373' : '16.607', display_name: query + ', testovací kraj, Česko' }];
      return route.fulfill({ json: found });
    }
    if (url.hostname === 'cdnjs.cloudflare.com') {
      const file = path.join(root, '.qa', path.basename(url.pathname));
      return route.fulfill({ body: fs.readFileSync(file), contentType: url.pathname.endsWith('.css') ? 'text/css' : 'application/javascript' });
    }
    if (/basemaps|tile.openstreetmap/.test(url.hostname)) return route.fulfill({ body: pixel, contentType: 'image/png' });
    if (url.pathname.endsWith('/app.js')) return route.fulfill({ body: testSource, contentType: 'application/javascript' });
    if (url.pathname.endsWith('/config.js')) return route.fulfill({ body: 'window.JAMU_CONFIG = ' + JSON.stringify(live ? { supabaseUrl: 'https://test.invalid', supabaseAnonKey: 'test-fixture' } : {}) + ';', contentType: 'application/javascript' });
    if (url.hostname === 'cdn.jsdelivr.net') return route.fulfill({ body: live ? mockSupabase : 'window.supabase = {};', contentType: 'application/javascript' });
    if (url.hostname === 'fonts.googleapis.com') return route.fulfill({ body: '', contentType: 'text/css' });
    return route.continue();
  });
  context.on('page', page => page.on('pageerror', error => errors.push(error.message)));
}
async function confirmTown(page, name) {
  await page.locator('[data-k="town"]').fill(name);
  await page.locator('.sh-foot [type="submit"]').click();
  await page.locator('.map-location-preview').filter({ hasText: 'Nalezené místo:' }).waitFor();
  await page.getByRole('button', { name: 'Uložit tohle místo', exact: false }).click();
  await page.locator('.sheet-win').waitFor({ state: 'detached' });
}
(async () => {
  fs.mkdirSync(path.join(root, '.qa'), { recursive: true });
  const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const [, url, integrity] of index.matchAll(/(?:href|src)="(https:\/\/cdnjs\.cloudflare\.com\/[^"\s]+)" integrity="([^"]+)"/g)) {
    const file = path.join(root, '.qa', path.basename(new URL(url).pathname));
    if (!fs.existsSync(file)) {
      const response = await fetch(url);
      assert(response.ok, 'Could not download test fixture: ' + url);
      fs.writeFileSync(file, Buffer.from(await response.arrayBuffer()));
    }
    assert.equal('sha384-' + createHash('sha384').update(fs.readFileSync(file)).digest('base64'), integrity);
  }
  const server = http.createServer((req, res) => {
    const file = path.resolve(root, '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname));
    if (!file.startsWith(root + path.sep)) { res.writeHead(403); return res.end(); }
    fs.readFile(file, (err, data) => { if (err) { res.writeHead(404); return res.end(); } res.setHeader('Content-Type', file.endsWith('.js') ? 'application/javascript' : file.endsWith('.css') ? 'text/css' : 'text/html'); res.end(data); });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = `http://127.0.0.1:${server.address().port}/index.html`;
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1100 } });
    context.setDefaultTimeout(10000);
    await prepare(context);
    const page = await context.newPage();
    await page.goto(base + '#map');
    await page.locator('.leaflet-container').waitFor();
    assert.equal(await page.title(), 'Mapa · Společenstvo Inscenace');
    assert.equal(requests.length, 0);
    assert.deepEqual(await page.locator('nav a').allTextContents(), ['Domů', 'Parta', 'Časová osa', 'Mapa', 'Další výlet', 'Archiv']);
    assert(await page.evaluate(() => mapTest.mount().getZoom() <= 7));
    assert.equal(await page.evaluate(() => mapTest.mount().scrollWheelZoom.enabled()), false);
    await page.locator('#memory-map').click({ position: { x: 400, y: 200 } });
    assert.equal(await page.evaluate(() => mapTest.mount().scrollWheelZoom.enabled()), true);
    await page.mouse.move(1, 1);
    assert.equal(await page.evaluate(() => mapTest.mount().scrollWheelZoom.enabled()), false);
    await page.getByRole('button', { name: 'Výlety', exact: true }).click();
    const tripMarker = page.locator('.memory-trip.upcoming');
    await tripMarker.focus(); await page.keyboard.press('Enter');
    await page.getByRole('link', { name: 'Otevřít výlet' }).waitFor();
    await page.keyboard.press('Escape');
    await page.locator('.leaflet-popup').waitFor({ state: 'detached' });
    await page.getByRole('button', { name: 'Kde bydlíme', exact: true }).click();
    assert.equal(await page.locator('.memory-cluster.homes').innerText(), '3');
    await page.evaluate(() => mapTest.mount().setView([49.195, 16.607], 19, { animate: false }));
    await page.waitForTimeout(700);
    await page.locator('.memory-cluster.homes').click();
    await page.locator('.memory-home[title="Míša · Brno"]').waitFor();
    assert.equal(await page.locator('.memory-home[title*="Iva"]').count(), 0);
    checks.push('menu, Czech page title, initial zoom, wheel gating, keyboard popup/Esc, clustered newest homes, ghost excluded');
    await page.goto(base + '#gang');
    await page.locator('[data-action="edit-home"][data-member="jakub"]').click();
    await confirmTown(page, 'Vienna');
    assert.equal(await page.locator('.toast').innerText(), 'Uloženo. Teď už jsi na mapě.');
    assert(requests.some(r => r.query === 'Vienna' && r.country === 'cz,sk' && r.town));
    assert(requests.some(r => r.query === 'Vienna' && r.country === null));
    const beforeCache = requests.length;
    await page.locator('[data-action="edit-home"][data-member="adam"]').click();
    await confirmTown(page, 'Vienna');
    assert.equal(requests.length, beforeCache);
    checks.push('home town confirmation, country fallback, persistent lookup cache');
    await page.goto(base + '#trip-past');
    await page.locator('[data-action="edit-trip"]').first().click();
    await page.locator('[data-k="address"]').fill('Unknown');
    await page.locator('[data-k="place"]').fill('Olomouc');
    await page.locator('.sh-foot [type="submit"]').click();
    await page.locator('.map-location-preview').filter({ hasText: 'Nalezené místo:' }).waitFor();
    await page.getByRole('button', { name: 'Uložit tohle místo', exact: false }).click();
    await page.locator('.sheet-win').waitFor({ state: 'detached' });
    const savedTrip = await page.evaluate(() => mapTest.state().trips.find(t => t.id === 'past'));
    assert.equal(savedTrip.address, 'Unknown'); assert.equal(savedTrip.place, 'Olomouc'); assert.equal(savedTrip.lat, 49.195);
    assert.deepEqual(requests.slice(-2).map(r => r.query), ['Unknown', 'Olomouc']);
    await page.locator('[data-action="edit-trip"]').first().click();
    await page.locator('[data-k="address"]').fill('Unknown'); await page.locator('[data-k="place"]').fill('Unknown');
    await page.locator('.sh-foot [type="submit"]').click();
    await page.getByRole('button', { name: 'Uložit bez bodu na mapě', exact: false }).click();
    await page.locator('.sheet-win').waitFor({ state: 'detached' });
    assert.equal(await page.evaluate(() => mapTest.state().trips.find(t => t.id === 'past').lat), null);
    checks.push('archive trip save, address-to-place fallback, stale coordinates cleared on missing place');
    await page.goto(base + '#map');
    await page.locator('h1').filter({ hasText: 'Mapa' }).waitFor();
    assert(await page.getByText('Na mapě se nám nepodařilo najít:').isVisible());
    await page.getByRole('button', { name: 'Upravit místo' }).click();
    await page.locator('[data-k="address"]').fill('Offline');
    await page.locator('.sh-foot [type="submit"]').click();
    await page.getByText('Vyhledávání míst teď není dostupné. Zkus to prosím znovu.').waitFor();
    assert.equal(await page.locator('[data-k="address"]').inputValue(), 'Offline');
    assert(await page.locator('.sheet-win').isVisible());
    checks.push('organiser fix action, failed network lookup preserves the sheet');
    await page.keyboard.press('Escape');
    await page.goto(base + '#map');
    await page.locator('.leaflet-container').waitFor();
    await page.screenshot({ path: path.join(root, '.qa', 'desktop.png'), fullPage: true });
    await context.close();

    const mobile = await browser.newContext({ viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true, colorScheme: 'dark' });
    await prepare(mobile); const phone = await mobile.newPage(); await phone.goto(base + '#map');
    await phone.locator('.leaflet-container').waitFor();
    assert(await phone.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.equal(await phone.evaluate(() => mapTest.mount().dragging.enabled()), false);
    assert.equal(await phone.evaluate(() => mapTest.mount().scrollWheelZoom.enabled()), false);
    assert.notEqual(await phone.locator('.leaflet-tile-pane').evaluate(el => getComputedStyle(el).filter), 'none');
    await phone.screenshot({ path: path.join(root, '.qa', 'mobile-dark.png'), fullPage: true });
    checks.push('375px layout, touch scrolling preserved, dark theme');
    await mobile.close();

    // A real file:// open must select demo even with Supabase settings present.
    const local = await browser.newContext(); await prepare(local, true);
    const localPage = await local.newPage();
    await localPage.goto(require('node:url').pathToFileURL(path.join(root, 'index.html')).href + '#map');
    await localPage.locator('.leaflet-container').waitFor();
    assert(await localPage.evaluate(() => mapTest.state().trips.some(t => t.id === 'past')));
    await localPage.evaluate(() => { mapTest.render(); mapTest.render(); });
    assert.equal(await localPage.locator('.leaflet-container').count(), 1);
    checks.push('real file:// demo with configured Supabase, clean map removal on repeated render');
    await local.close();

    liveRows = [tripRow('missing', { title: 'Brno bez souřadnic', place: 'Brno', organiser: 'jakub', status: 'done' }), tripRow('unfindable', { title: 'Neznámá chata', place: 'Unknown', organiser: 'jakub', status: 'done' }), tripRow('concurrent', { title: 'Současná úprava', place: 'Concurrent', organiser: 'jakub', status: 'done' })];
    const live = await browser.newContext(); await prepare(live, true); const livePage = await live.newPage();
    const twin = await browser.newContext(); await prepare(twin, true); const twinPage = await twin.newPage();
    await Promise.all([livePage.goto(base + '#map'), twinPage.goto(base + '#map')]);
    await livePage.waitForFunction(() => mapTest.state().trips.find(t => t.id === 'concurrent')?.lat != null, null, { timeout: 15000 });
    await twinPage.waitForFunction(() => mapTest.state().trips.find(t => t.id === 'concurrent')?.lat != null, null, { timeout: 15000 });
    assert(changedDuringLookup);
    assert.equal(liveRows.find(r => r.id === 'concurrent').data.story, 'Concurrent story');
    assert.equal(liveRows.find(r => r.id === 'unfindable').data.geocode_status, 'missing');
    const calls = requests.length;
    await livePage.evaluate(() => { mapTest.render(); mapTest.render(); });
    await livePage.waitForTimeout(1300);
    assert.equal(requests.length, calls);
    await livePage.reload(); await livePage.locator('.leaflet-container').waitFor(); await livePage.waitForTimeout(1300);
    assert.equal(requests.length, calls);
    checks.push('live backfill, persisted unsuccessful searches, rerender/reload avoids geocoding, concurrent story preserved');
    // The query queue spaces actual requests and respects application-wide leases.
    const rateCalls = requests.filter(r => !['Offline'].includes(r.query));
    for (let i = 1; i < rateCalls.length; i++) {
      if (rateCalls[i].at - rateCalls[i - 1].at < 1000) throw new Error('Geocoding exceeded one request per second');
    }
    await live.close(); await twin.close();
    assert.deepEqual(errors, []);
    checks.push('no uncaught browser errors; request intervals >= 1 second across two independent live clients');
    fs.writeFileSync(path.join(root, '.qa', 'result.json'), JSON.stringify({ checks, requests, errors }, null, 2));
    console.log(JSON.stringify({ checks, errors }, null, 2));
  } finally { await browser.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
