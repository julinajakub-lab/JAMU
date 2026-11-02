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
const testSource = source.replace('\nstart();', '\nwindow.mapTest = { state: () => S, render, load, mount: () => memoryHost, locateTrip, geocodePlace, hasCoordinates };\nstart();');
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
 const server=http.createServer((req,res)=>{const file=path.join(root,new URL(req.url,'http://localhost').pathname);fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end();}res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const base=`http://127.0.0.1:${server.address().port}/index.html#map`;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try {
 const context=await browser.newContext({viewport:{width:1440,height:1000}});context.setDefaultTimeout(8000);await prepare(context);
 const page=await context.newPage();const mapRequests=[];page.on('request',r=>{if(/tile.openstreetmap|cartocdn|leaflet|world-atlas/.test(r.url()))mapRequests.push(r.url());});
 await page.goto(base);await page.locator('.memory-point').first().waitFor();
 assert.equal(await page.title(),'Mapa · Společenstvo Inscenace');assert.equal(await page.locator('.memory-point').count(),2);
 assert.equal(await page.locator('.memory-home').count(),3);assert.equal(await page.locator('.memory-home[data-memory-member="iva"]').count(),0);
 await page.locator('[data-memory-trip="past"]').hover();await page.getByRole('link',{name:'Otevřít výlet →'}).waitFor();
 await page.locator('.memory-card').hover();await page.waitForTimeout(350);assert(await page.locator('.memory-card').isVisible());
 await page.keyboard.press('Escape');assert(await page.locator('.memory-card').isHidden());
 await page.locator('[data-memory-row="past"] a').hover();assert(await page.locator('[data-memory-trip="past"]').evaluate(el=>el.classList.contains('is-active')));
 await page.getByRole('button',{name:'Kde bydlíme',exact:true}).click();assert.equal(await page.locator('[data-memory-trip="past"]').evaluate(el=>el.inert),true);
 await page.getByRole('button',{name:'Vše',exact:true}).click();await page.locator('[data-memory-trip="past"]').focus();await page.keyboard.press('Enter');await page.waitForURL(/#trip-past$/);
 await page.goto(base.replace('#map','#gang'));await page.locator('[data-action="edit-home"][data-member="jakub"]').click();await confirmTown(page,'Vienna');
 assert.equal(requests.length,2);assert(requests.every(r=>r.town));
 await page.goto(base);await page.evaluate(()=>{const w=window.JAMU_RELICS[0];const d={...w.prepared,id:'dyje',collection:'trips'};localStorage.setItem('jamu-demo-v5',JSON.stringify([d,{id:'unknown',collection:'trips',title:'Neznámé místo',organiser:'jakub',status:'done',start:'2021-01-01'}]));});await page.reload();
 await page.locator('[data-memory-trip="dyje"]').waitFor();assert.equal(await page.locator('.memory-route').count(),1);
 await page.locator('[data-memory-trip="dyje"]').hover();assert.equal(await page.locator('.memory-cover').getAttribute('src'),'https://drive.google.com/thumbnail?id=1HJ7g-xpC9B8oyoVyhtkGe3KnUFqL_qYL&sz=w640');
 assert.equal(await page.locator('.memory-crew .av').count(),7);assert((await page.locator('.memory-card blockquote').innerText()).includes('Synu'));
 assert.equal(await page.locator('[data-memory-row]').count(),2);assert.equal(await page.getByRole('button',{name:'Kde to bylo?'}).count(),1);
 await page.screenshot({path:path.join(root,'.qa','memory-desktop.png'),fullPage:true});
 await page.evaluate(()=>localStorage.setItem('jamu-demo-v5','[]'));await page.reload();await page.getByText('Mapa se zaplní, jakmile přidáme místa výletů a svá města.').waitFor();await page.getByRole('button',{name:'Přidat své město'}).click();await page.locator('[data-k="town"]').waitFor();
 await context.close();
 const phoneContext=await browser.newContext({viewport:{width:375,height:812},hasTouch:true,isMobile:true,colorScheme:'dark',reducedMotion:'reduce'});await prepare(phoneContext);const phone=await phoneContext.newPage();await phone.goto(base);await phone.locator('[data-memory-trip="next"]').tap();assert(await phone.locator('.memory-card').isVisible());assert(await phone.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await phone.screenshot({path:path.join(root,'.qa','memory-mobile.png'),fullPage:true});await phoneContext.close();
 const relicWindow={};require('node:vm').runInNewContext(fs.readFileSync(path.join(root,'relics.js'),'utf8'),{window:relicWindow});
 liveRows=[tripRow('dyje',{...relicWindow.JAMU_RELICS[0].prepared,geocode_query:'["","dyje, ze znojma do hevlína"]',geocode_status:'missing'}),tripRow('other',{title:'Jiný výlet',place:'Brno',status:'done'})];
 const live=await browser.newContext();await prepare(live,true);const livePage=await live.newPage();await livePage.goto(base);await livePage.waitForFunction(()=>mapTest.state().trips.find(t=>t.id==='other')?.lat!=null);assert.equal(liveRows.find(r=>r.id==='dyje').data.route.length,4);const count=requests.length;await livePage.reload();await livePage.locator('.memory-point').first().waitFor();await livePage.waitForTimeout(1300);assert.equal(requests.length,count);await live.close();
 assert.deepEqual(mapRequests,[]);assert.deepEqual(errors,[]);console.log('PASS: static outline, points, hover bridge, Esc, list linking, keyboard navigation, home save/confirmation, Dyje route/photo/crew/quote, unknown and empty states, 375px touch/dark/reduced motion, live route persistence/backfill/cache, no tile/library requests or browser errors.');
 } finally {await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exit(1)});
