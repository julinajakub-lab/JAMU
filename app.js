(() => {
'use strict';

const C = window.JAMU_CONFIG || {};
const MEMBERS = window.JAMU_MEMBERS;
const GHOST = window.JAMU_GHOST;
const byId = Object.fromEntries(MEMBERS.map((m, i) => [m.id, { ...m, hue: (i * 37 + 340) % 360 }]));
const LIVE = !!(C.supabaseUrl && C.supabaseAnonKey && window.supabase);
const sb = LIVE ? window.supabase.createClient(C.supabaseUrl, C.supabaseAnonKey) : null;
const app = document.getElementById('app');

/* ---------------- small helpers ---------------- */
const ls = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } }
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const member = id => byId[id];
const nameOf = id => byId[id]?.short || '—';
const kc = n => new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 0 }).format(Math.round(n)) + ' Kč';
const safeUrl = u => /^https?:\/\//i.test(u || '') ? u : '';

function parseDate(s) { if (!s) return null; const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
function fmtRange(a, b) {
  const s = parseDate(a), e = parseDate(b);
  if (!s) return tr('Date not set');
  if (!e || a === b) return fmtDate(a);
  const dm = d => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${s.getDate()}.–${fmtDate(b)}`;
  if (s.getFullYear() === e.getFullYear()) return `${dm(s)} – ${fmtDate(b)}`;
  return `${fmtDate(a)} – ${fmtDate(b)}`;
}
function daysUntil(s) { const d = parseDate(s); if (!d) return null; const t = new Date(); t.setHours(0, 0, 0, 0); return Math.round((d - t) / 864e5); }

function avatar(id, size = '') {
  const m = member(id);
  if (!m) return `<span class="av ${size}" style="--h:0">?</span>`;
  const ini = m.name.split(' ').map(w => w[0]).join('').slice(0, 2);
  const pic = profilePhoto(id);
  return `<span class="av ${size}${pic ? ' has-pic' : ''}" style="--h:${m.hue}" title="${esc(m.name)}" aria-hidden="true">${pic ? `<img data-photo="${esc(pic)}" alt="">` : esc(ini)}</span>`;
}
function profilePhoto(id) {
  const list = (S.profiles || []).filter(p => p.member === id).sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  return list[0]?.path || '';
}

let toastTimer;
// toast('Saved') or toast('Added', { label: 'Undo', run: async () => … })
function toast(msg, action) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/></svg><span></span>`;
  $('span', t).textContent = tr(msg);
  if (action) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = tr(action.label);
    b.addEventListener('click', async () => { t.hidden = true; try { await action.run(); } catch (e) { console.error(e); } });
    t.appendChild(b);
  }
  t.hidden = false; t.classList.remove('in'); void t.offsetWidth; t.classList.add('in');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, action ? 6000 : 3600);
}

/* ---------------- languages ---------------- */
// The site is Czech only. Copy is written in English here and translated after rendering; Czech texts live in i18n-cs.js.
// {sk|cz} in a translation shows the Slovak word with a small ⓘ that reveals the Czech one.
const I18N = window.JAMU_I18N || {};
const lang = () => (I18N.cs ? 'cs' : 'en');
function trRaw(s) {
  const d = lang() === 'en' ? null : I18N[lang()];
  if (!d || !s) return null;
  if (Object.prototype.hasOwnProperty.call(d.exact, s)) return d.exact[s];
  for (const [re, rep] of d.patterns) if (re.test(s)) return s.replace(re, rep);
  return null;
}
const SK = /\{([^|{}]+)\|([^{}]+)\}/g;
const plainSk = s => s.replace(SK, '$1');
const tr = s => plainSk(trRaw(s) ?? s);
function translateDOM(root) {
  if (lang() === 'en' || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: n => (n.parentElement && /^(SCRIPT|STYLE|TEXTAREA)$/.test(n.parentElement.tagName)) || n.parentElement?.closest('[data-notr]') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT
  });
  const nodes = []; while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const v = n.nodeValue, key = v.replace(/\s+/g, ' ').trim();
    if (!key) continue;
    const t = trRaw(key); if (t == null) continue;
    const lead = v.match(/^\s*/)[0], trail = v.match(/\s*$/)[0];
    if (!SK.test(t)) { n.nodeValue = lead + t + trail; continue; }
    SK.lastIndex = 0;
    const span = document.createElement('span');
    span.innerHTML = esc(lead + t + trail).replace(SK, (m, sk, cz) => `<span class="sk" tabindex="0" data-cz="${cz}">${sk}</span>`);
    n.replaceWith(...span.childNodes);
  }
  SK.lastIndex = 0;
  $$('[placeholder],[title],[aria-label],[alt]', root).forEach(el => {
    for (const a of ['placeholder', 'title', 'aria-label', 'alt']) {
      const v = el.getAttribute(a); if (v) { const t = trRaw(v.trim()); if (t != null) el.setAttribute(a, plainSk(t)); }
    }
  });
}

/* ---------------- data layer ---------------- */
// One table "records": { id, collection, data (json), created_at }.
let demo = null;
function demoData() {
  if (demo) return demo;
  try { demo = JSON.parse(ls.get('jamu-demo')); } catch { demo = null; }
  if (!Array.isArray(demo)) { demo = seedDemo(); saveDemo(); }
  return demo;
}
function saveDemo() { ls.set('jamu-demo', JSON.stringify(demo)); }
function seedDemo() {
  // Example content so the demo isn't empty. The real database starts empty.
  const now = new Date().toISOString();
  const t = uid();
  const y = new Date().getFullYear();
  const fri = (mo, d) => `${y + 1}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const o1 = uid(), o2 = uid(), o3 = uid();
  return [
    { id: t, collection: 'trips', created_at: now, status: 'planning', title: 'Spring cottage weekend (example)', organiser: 'julia',
      place: 'Chata u Lesa (example)', address: 'Hlubočky 123, 783 61 Hlubočky', notes: 'Bring: slippers, a towel, a dish to share.\nKeys are under the gnome.', rsvp: { ladislav: 'yes', julia: 'yes', jakub: 'yes', nikol: 'love', sylvie: 'maybe', michaela: 'yes' } },
    { id: o1, collection: 'date_options', created_at: now, trip_id: t, start: fri(4, 17), end: fri(4, 19), votes: { ladislav: 'yes', julia: 'yes', jakub: 'maybe', nikol: 'yes', michaela: 'yes' } },
    { id: o2, collection: 'date_options', created_at: now, trip_id: t, start: fri(4, 24), end: fri(4, 26), votes: { ladislav: 'yes', julia: 'no', jakub: 'yes', sylvie: 'yes', adam: 'yes', viktoria: 'yes' } },
    { id: o3, collection: 'date_options', created_at: now, trip_id: t, start: fri(5, 8), end: fri(5, 10), votes: { ladislav: 'maybe', alzbeta: 'yes' } },
    { id: uid(), collection: 'milestones', created_at: now, date: `${y - 1}-06-12`, who: ['michaela'], kind: 'baby', title: 'Míša’s baby is born (example)', label: 'First baby of the gang', note: 'Replace this example with the real date.' },
    ...((window.JAMU_RELICS || []).filter(r => r.prepared).map(r => ({ id: uid(), collection: 'trips', created_at: now, status: 'done', ...r.prepared }))),
    { id: uid(), collection: 'milestones', created_at: now, date: '2019-06-20', who: [], kind: 'school', title: 'We survive JAMU (example)', label: '', note: 'State exams done. Nobody cried. (Everybody cried.)' }
  ];
}

const DB = {
  async all() {
    if (!LIVE) return demoData().map(r => ({ ...r }));
    const { data, error } = await sb.from('records').select('*').order('created_at');
    if (error) throw error;
    return data.map(r => ({ ...(r.data || {}), id: r.id, collection: r.collection, created_at: r.created_at }));
  },
  async add(collection, data) {
    if (!LIVE) { const r = { ...data, id: uid(), collection, created_at: new Date().toISOString() }; demoData().push(r); saveDemo(); return r; }
    const { data: row, error } = await sb.from('records').insert({ collection, data }).select().single();
    if (error) throw error;
    return { ...row.data, id: row.id, collection };
  },
  async update(rec, patch) {
    const next = { ...strip(rec), ...patch };
    if (!LIVE) { const arr = demoData(); const i = arr.findIndex(x => x.id === rec.id); if (i >= 0) arr[i] = { ...arr[i], ...patch }; saveDemo(); return; }
    const { error } = await sb.from('records').update({ data: next }).eq('id', rec.id);
    if (error) throw error;
  },
  async remove(rec) {
    if (!LIVE) { demo = demoData().filter(x => x.id !== rec.id); saveDemo(); return; }
    const { error } = await sb.from('records').delete().eq('id', rec.id);
    if (error) throw error;
  }
};
function strip(r) { const { id, collection, created_at, ...d } = r; return d; }

let S = { trips: [], options: [], expenses: [], settings: null, profiles: [], photos: [], milestones: [], suggestions: [] };
async function load() {
  const all = await DB.all();
  S = {
    trips: all.filter(r => r.collection === 'trips'),
    options: all.filter(r => r.collection === 'date_options'),
    expenses: all.filter(r => r.collection === 'expenses'),
    milestones: all.filter(r => r.collection === 'milestones'),
    suggestions: all.filter(r => r.collection === 'suggestions'),
    photos: all.filter(r => r.collection === 'photos'),
    profiles: all.filter(r => r.collection === 'profiles'),
    settings: all.find(r => r.collection === 'settings') || null
  };
}
const court = () => ({ ...window.JAMU_DEFAULT_COURT, ...(S.settings ? strip(S.settings) : {}) });
async function saveCourt(patch) {
  if (S.settings) await DB.update(S.settings, patch);
  else await DB.add('settings', { ...court(), ...patch });
}
const planning = () => S.trips.find(t => t.status === 'planning');
const tripSortKey = t => t.start || t.done_at || t.created_at || '';
const doneTrips = () => S.trips.filter(t => t.status === 'done').sort((a, b) => tripSortKey(b).localeCompare(tripSortKey(a)));
// A trip's life: planning → wrapped up (heir crowned, money still open) → archived (its king or queen closed the books).
// Trips added to the archive by hand are archived from the start: no money talk.
const isOpen = t => t.status === 'done' && !!t.done_at && !t.settled_at;
const openTrip = () => doneTrips().filter(isOpen).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || ''))[0];

/* ---------------- the chronicle duty ----------------
   Whoever organised a trip writes its archive page: dates, place, photos and the story.
   Past monarchs add their old trips themselves; from now on every wrapped-up trip lands on its organiser. */
const PAST_RULERS = window.JAMU_PAST_RULERS || [];
const LAST_TRIP = window.JAMU_LAST_TRIP || {};
function chronicleGaps(t) {
  const gaps = [];
  if (!t.start) gaps.push('dates');
  if (!t.place) gaps.push('place');
  if (!safeUrl(t.photos_url) && !S.photos.some(p => p.trip_id === t.id)) gaps.push('photos');
  if (!(t.story || '').trim()) gaps.push('story');
  return gaps;
}
const tripsBy = id => doneTrips().filter(t => t.organiser === id);
const chroniclesClosed = () => court().chronicles || {};
function chronicleState(id) {
  const mine = tripsBy(id);
  const open = mine.filter(t => chronicleGaps(t).length);
  const owesOld = PAST_RULERS.includes(id) && !chroniclesClosed()[id];
  if (!mine.length && owesOld) return 'todo';
  if (open.length || owesOld) return 'writing';
  return mine.length ? 'done' : 'none';
}
const gapChips = t => chronicleGaps(t).map(g => `<span class="chip">${g}</span>`).join(' ');

async function act(fn, okMsg) {
  try { await fn(); await load(); render(); if (okMsg) toast(okMsg); }
  catch (e) { console.error(e); toast('That didn’t save: ' + (e.message || 'unknown error') + '. Try again?'); }
}

/* ---------------- auth & identity ---------------- */
async function isLoggedIn() {
  if (!LIVE) return ls.get('jamu-auth') === '1';
  const { data } = await sb.auth.getSession();
  return !!data.session;
}
const WRONG = [
  'Wrong password. Iva, is that you?',
  'Nope. Nikol has it saved in a perfectly labelled file. Ask her.',
  'Still wrong. Even the study department gave us more attempts than this. (It didn’t.)',
  'Wrong again. Ask the current king, he knows.'
];
let wrongCount = 0;
function renderLogin() {
  document.title = 'Společenstvo Inscenace';
  app.innerHTML = `
  <div class="login">
    <div class="box">
      <div class="mark" aria-hidden="true">SI</div>
      <div class="stack" style="gap:4px">
        <h1 style="font-size:1.5rem">Společenstvo Inscenace</h1>
        <p class="muted small">JAMU, class of 2016. Members only. Iva, if you’re reading this: the door is still open.</p>
      </div>
      <form id="login-form">
        <label>Group password<input id="pw" type="password" autocomplete="current-password" required></label>
        <button class="btn primary" type="submit">Log in</button>
        <p class="err" id="login-err" role="alert"></p>
        ${LIVE ? '' : `<p class="small muted">Demo mode: the password is <b class="mono">${esc(C.demoPassword || 'jamu2016')}</b></p>`}
      </form>
    </div>
  </div>`;
  document.documentElement.lang = lang();
  translateDOM(app);
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#pw').value;
    let ok = false;
    if (LIVE) {
      let error;
      try { ({ error } = await sb.auth.signInWithPassword({ email: C.groupEmail, password: pw })); }
      catch (e) { error = e; }
      ok = !error;
      // Anything other than a plain wrong password: show the real reason, so it can be fixed.
      if (error && !/invalid login credentials/i.test(error.message || '')) {
        $('#login-err').textContent = 'Login problem (not your password): ' + (error.message || error);
        return;
      }
    } else ok = pw === (C.demoPassword || 'jamu2016');
    if (ok) { ls.set('jamu-auth', '1'); start(); }
    else { $('#login-err').textContent = tr(WRONG[wrongCount++ % WRONG.length]); $('#pw').select(); }
  });
}
async function logout() {
  if (LIVE) await sb.auth.signOut();
  ls.del('jamu-auth');
  renderLogin();
}
const me = () => (byId[ls.get('jamu-me')] ? ls.get('jamu-me') : null);

function pickMe(force = false) {
  if (me() && !force) return;
  openModal(`
    <div class="stack">
      <p class="eyebrow">One quick question</p>
      <h2>Who are you?</h2>
      <p class="muted">So your votes and payments go under your name. This is remembered on this device.</p>
      <div class="checks">
        ${MEMBERS.map(m => `<button class="check" type="button" data-pick="${m.id}">${avatar(m.id, 'xs')} ${esc(m.short)}</button>`).join('')}
        <button class="check" type="button" data-pick="iva" style="opacity:.6">🕯️ ${esc(GHOST.name)}</button>
      </div>
      <p class="muted small" id="pick-msg" role="status"></p>
    </div>`, null, modal => {
    modal.addEventListener('click', e => {
      const b = e.target.closest('[data-pick]'); if (!b) return;
      if (b.dataset.pick === 'iva') { $('#pick-msg').textContent = tr('Iva is no longer with us. 🕯️ (Please pick someone who actually shows up.)'); return; }
      ls.set('jamu-me', b.dataset.pick); closeModal(); render();
      if (b.dataset.pick === 'nikol') toast('Nikol! You actually arrived! We’re so happy. 💌');
      else toast('Welcome back, ' + nameOf(b.dataset.pick) + '!');
    });
  });
}

/* ---------------- modal ---------------- */
function openModal(html, onSubmit, setup) {
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'modal-bg';
  bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true">${html}</div>`;
  document.body.appendChild(bg);
  const modal = $('.modal', bg);
  bg.addEventListener('click', e => { if (e.target === bg && me()) closeModal(); });
  $$('[data-close]', modal).forEach(b => b.addEventListener('click', closeModal));
  const form = $('form', modal);
  if (form && onSubmit) form.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button[type=submit]', form); if (btn) btn.disabled = true;
    try { await onSubmit(new FormData(form), form); closeModal(); }
    catch (err) { console.error(err); toast('That didn’t save: ' + (err.message || 'unknown error')); if (btn) btn.disabled = false; }
  });
  translateDOM(modal);
  if (setup) setup(modal);
  const first = $('input, select, textarea, button', modal); if (first) first.focus();
}
function closeModal() { $$('.modal-bg').forEach(m => m.remove()); sheetCtx = null; document.body.classList.remove('has-sheet'); }
document.addEventListener('keydown', e => { if (e.key !== 'Escape') return; if (sheetCtx) closeSheet(); else if (me()) closeModal(); });

/* ---------------- layout ---------------- */
const NAV = [['home', 'Home'], ['gang', 'The Gang'], ['timeline', 'Timeline'], ['next', 'Next Trip'], ['archive', 'Archive'], ['after', 'After the Trip']];
const PAGE_NAMES = { home: 'Home', gang: 'The Gang', timeline: 'Timeline', next: 'Next Trip', archive: 'Archive', after: 'After the Trip', ideas: 'Suggestions' };
function route() { const h = (location.hash || '#home').slice(1); return h || 'home'; }

function shell(active, content) {
  const m = me();
  return `
  <header class="top">
    <div class="wrap">
      <a class="logo" href="#home"><span class="mark" aria-hidden="true">SI</span><span class="name">Společenstvo Inscenace</span></a>
      <nav class="nav" aria-label="Main">${NAV.map(([k, l]) => `<a href="#${k}" class="${active === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <button class="me" type="button" data-action="switch-me" title="Change who you are">${m ? avatar(m, 'xs') + ' ' + esc(nameOf(m)) : 'Who are you?'}</button>
    </div>
  </header>
  ${LIVE ? '' : `<div class="demo-banner"><div class="wrap">Demo mode: changes are saved only in this browser. Once the database is connected, the whole gang shares everything.</div></div>`}
  <main><div class="wrap">${content}</div></main>
  <footer><div class="wrap">
    <span>Est. 2016 at JAMU, Brno. Survived together, friends ever since.</span>
    <span class="row" style="gap:4px 12px"><a href="#ideas">Suggestions${openIdeas() ? ` (${openIdeas()} open)` : ''}</a><span>In memory of ${esc(GHOST.name)}</span><button class="btn ghost sm" type="button" data-action="logout">Log out</button></span>
  </div></footer>
  <button class="suggest-fab" type="button" data-action="suggest">✎ Suggest an edit</button>`;
}

/* ---------------- views ---------------- */
const FALLBACK_QUOTES = [
  '“Iva is no longer with us.”',
  '“Is Nikol here yet?” Nobody has asked this since 2017.',
  '“If we survived SETKÁNÍ/ENCOUNTER, we can survive one weekend in a cottage.”',
  '“Deadline? We don’t do deadlines anymore. We do dinner.”',
  '“Whatever JAMU did to us, one cottage weekend undoes it.”',
  '“Who brought the bottle opener?” — every trip, ever'
];
function allQuotes() {
  const q = [];
  S.trips.forEach(t => (t.quotes || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(s => q.push({ text: s, trip: t })));
  return q;
}

function todoBlock() {
  const m = me();
  const plan = planning();
  const last = openTrip();
  const items = [];
  const add = (text, btn) => items.push(`<li class="todo"><span>${text}</span>${btn}</li>`);
  if (!m) add('First, tell the site who you are, so your votes and photos get your name.', `<button class="btn primary sm" type="button" data-action="switch-me">Pick my name</button>`);
  if (m) {
    const mine = tripsBy(m);
    mine.filter(t => chronicleGaps(t).length).forEach(t =>
      add(`♛ You organised <b>${esc(t.title || 'Untitled trip')}</b>, so its archive page is yours to finish. Still missing: ${gapChips(t)}`,
        `<button class="btn primary sm" type="button" data-action="edit-trip" data-trip="${t.id}">Finish the page</button>`));
    if (PAST_RULERS.includes(m) && !chroniclesClosed()[m]) {
      const ready = preparedFor(m);
      if (ready) add(`♛ Your trip <b>${esc(ready.prepared.title)}</b> is written up from the old emails and the Drive. Check it, fix what’s wrong and add it to the archive.`,
        `<button class="btn primary sm" type="button" data-action="add-prepared" data-relic="${esc(ready.id)}">Check and add</button>`);
      else if (LAST_TRIP.organiser === m && !mine.some(t => (t.start || '') >= LAST_TRIP.year)) add(`♛ ${LAST_TRIP.title} just ended and you led it, so its archive page is yours to write: when, where, the photos and the story. ${nameOf(LAST_TRIP.crowned)} already wears the crown.`,
        `<button class="btn primary sm" type="button" data-action="add-my-trip">Write it up</button>`);
      else if (!mine.length) add('♛ You’ve worn the crown before, so the chronicle of your reign is yours to write. Add the trip you organised: when, where, the photos and what happened.',
        `<button class="btn primary sm" type="button" data-action="add-my-trip">Add my trip</button>`);
      else add('♛ Did you organise any other trip before this website existed? Add it too, or tell us that was all.',
        `<span class="row" style="gap:6px"><button class="btn sm" type="button" data-action="add-my-trip">Add another trip</button><button class="btn sm ghost" type="button" data-action="chronicle-done">That was all of them</button></span>`);
    }
  }
  if (plan) {
    const opts = S.options.filter(o => o.trip_id === plan.id);
    if (!plan.start && opts.length && m && !opts.some(o => (o.votes || {})[m])) add(`We’re choosing dates for <b>${esc(plan.title)}</b>. Which weekends work for you?`, `<a class="btn primary sm" href="#next">Vote on dates</a>`);
    if (m && !(plan.rsvp || {})[m]) add(`Are you coming to <b>${esc(plan.title)}</b>?`, `<a class="btn primary sm" href="#next">Answer</a>`);
    if (m && goingTo(plan).includes(m) && !tasksOf(plan).some(x => x.who.includes(m))) add(`Take a task for <b>${esc(plan.title)}</b>: food, cars or board games.`, `<a class="btn primary sm" href="#roles" data-action="scroll-roles">Pick a task</a>`);
    if (m && m === plan.organiser) {
      const nextStep = crownSteps(plan).find(x => !x.done && !x.later);
      if (nextStep) add(`♛ You’re leading <b>${esc(plan.title)}</b>. Next step:`, `<a class="btn primary sm" href="#next">${nextStep.text}</a>`);
    }
  } else if (m && m === court().ruler) {
    add('You’re the reigning monarch, so the next trip is yours to plan. Start with the cottage and a few date options.', `<button class="btn primary sm" type="button" data-action="new-plan">Plan the next trip</button>`);
  }
  if (last) {
    add(`Do you have nice photos from <b>${esc(last.title)}</b>? Share them with everyone.`, `<button class="btn primary sm" type="button" data-action="share-photos" data-trip="${last.id}">Share photos</button>`);
    add(`Did you pay for something on <b>${esc(last.title)}</b>? Add it and the page works out who owes whom.`, `<button class="btn sm" type="button" data-action="add-exp" data-trip="${esc(last.id)}">Add an expense</button>`);
    if (m && m === last.organiser) add(`♛ Once everyone has paid up for <b>${esc(last.title)}</b>, close the books and the trip moves to the archive.`, `<a class="btn sm" href="#after">Settle up</a>`);
  } else if (!(m && PAST_RULERS.includes(m) && !chroniclesClosed()[m])) {
    add('Remember one of our past trips? Add it to the archive, with photos and the best quotes.', `<button class="btn primary sm" type="button" data-action="add-past">Add a past trip</button>`);
  }
  add('Spotted a mistake, or have an idea for the site?', `<button class="btn sm" type="button" data-action="suggest">Suggest an edit</button>`);
  return `
    <section class="stack" style="gap:10px">
      <div><p class="eyebrow">Start here</p><h2>What you can do right now</h2></div>
      <ul class="todos">${items.join('')}</ul>
    </section>`;
}

function viewHome() {
  const c = court();
  const plan = planning();
  const done = doneTrips();
  const years = new Date().getFullYear() - 2019; // graduated through ENCOUNTER 2019
  const together = new Date().getFullYear() - 2016;
  const nikolCame = Math.max(1, done.filter(t => (t.attendees || []).includes('nikol')).length); // she came once, around 2021
  const quotes = allQuotes();
  const q = quotes.length ? quotes[Math.floor(Math.random() * quotes.length)] : { text: FALLBACK_QUOTES[Math.floor(Math.random() * FALLBACK_QUOTES.length)] };
  let nextBlock;
  if (plan) {
    const d = plan.start ? daysUntil(plan.start) : null;
    nextBlock = `
      <div class="panel stack">
        <div class="spread">
          <div class="stack" style="gap:4px">
            <p class="eyebrow">Next trip</p>
            <h2>${esc(plan.title || 'Untitled trip')}</h2>
            <p class="muted">${plan.place ? esc(plan.place) + ' · ' : ''}organised by ♛ ${esc(nameOf(plan.organiser))}</p>
          </div>
          ${d !== null ? `<div style="text-align:right"><div class="countdown num">${d > 0 ? d : d === 0 ? 'Today' : '—'}</div><p class="muted small">${d > 0 ? (d === 1 ? 'day to go' : 'days to go') : d === 0 ? '' : 'already started'}</p></div>` : ''}
        </div>
        <p>${plan.start ? esc(fmtRange(plan.start, plan.end)) : 'The date is still being voted on. Have you voted yet?'}</p>
        <div class="row"><a class="btn primary" href="#next">Open the trip plan</a></div>
      </div>`;
  } else {
    nextBlock = `
      <div class="empty">
        <div class="big">🏕️</div>
        <h3>No trip planned yet</h3>
        <p class="muted">${esc(nameOf(c.ruler))}, your people are waiting.</p>
        <a class="btn primary" href="#next">Start planning</a>
      </div>`;
  }
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Est. 2016 · JAMU, Brno</p>
      <h1>Společenstvo Inscenace</h1>
      <p>Ten people who met studying theatre management at JAMU (plus one we adopted from JevTech). Twice a year we leave everyday life behind for a cottage in the woods, where we cook, walk and talk late into the night about our lives and the world.</p>
    </section>

    <div class="home-intro">
    <section class="letter">
      <p class="eyebrow">A letter to start with</p>
      <div class="letter-body">
        <p class="greeting">Hi, friends,</p>
        <p>we met at JAMU in 2016. Deadlines, long nights over schoolwork and one whole international festival brought us together. Ten years later, classmates have become family. We are there for each other’s new jobs and new homes, babies and worries, big questions about the world and small ones about dinner.</p>
        <p>I love you very much, and I know we all love each other, even when we only manage to meet a few times a year.</p>
        <p class="letter-sep" aria-hidden="true">· · ·</p>
        <p>So why this page? So our trips are easier to plan and nothing from them gets lost. Until now everything was scattered across chats, spreadsheets and Drive folders. Now it’s all in one place:</p>
        <ul class="letter-list">
          <li><a href="#next"><b>Plan the next trip.</b></a> Vote on dates, say if you’re coming, and find the cottage with one tap.</li>
          <li><a href="#archive"><b>Remember the old ones.</b></a> Every trip with its photos, stories and the quotes we’ll never live down.</li>
          <li><a href="#after"><b>Settle up without awkward messages.</b></a> Log who paid for what and the page works out who owes whom.</li>
        </ul>
        <p>It’s ours, so make it better. If something is missing or wrong, press “Suggest an edit” in the corner.</p>
        <p class="signature">Built for us with <svg class="heart" viewBox="0 0 24 24" aria-label="love" role="img"><path d="M12 21s-7.5-4.6-9.6-9.3C.9 8.2 3 4.5 6.7 4.5c2.1 0 3.6 1.1 5.3 3 1.7-1.9 3.2-3 5.3-3 3.7 0 5.8 3.7 4.3 7.2C19.5 16.4 12 21 12 21z"/></svg><br><span>Jakub (Honza Peniz)</span></p>
      </div>
    </section>

    ${todoBlock()}
    </div>

    <section class="court" aria-label="The royal court">
      <div class="throne reign">
        ${avatar(c.ruler, 'lg')}
        <div class="who"><span class="eyebrow"><span class="crown">♛</span> Reigning monarch</span><span class="name">${esc(member(c.ruler)?.name || '—')}</span><span class="muted small">${esc(member(c.ruler)?.nick || '')} · plans the next trip</span></div>
      </div>
      <div class="throne">
        ${c.heir ? avatar(c.heir, 'lg') : '<span class="av lg" style="--h:0">?</span>'}
        <div class="who"><span class="eyebrow">Heir to the throne</span><span class="name">${esc(member(c.heir)?.name || 'Not decided')}</span><span class="muted small">${c.heir ? 'to be crowned at the end of the next trip' : 'to be decided at the next trip'}</span></div>
      </div>
    </section>

    ${nextBlock}

    <section>
      <div class="section-head"><h2>By the numbers</h2></div>
      <div class="kpis">
        <div class="kpi"><b>${done.length}</b><span class="muted small">trips in the archive</span></div>
        <div class="kpi"><b>${together}</b><span class="muted small">years since we met at JAMU</span></div>
        <div class="kpi"><b>${years}</b><span class="muted small">years since we survived JAMU (graduation after ENCOUNTER 2019)</span></div>
        <div class="kpi"><b>${nikolCame}×</b><span class="muted small">Nikol arrived. About five years ago, and nobody remembers which trip.</span></div>
      </div>
    </section>

    <section class="stack quote-block" style="gap:8px">
      <p class="eyebrow">From our memories</p>
      <p class="quote">${esc(q.text)}</p>
      ${q.trip ? `<p class="muted small">from <a href="#trip-${esc(q.trip.id)}">${esc(q.trip.title)}</a></p>` : ''}
    </section>
  </div>`;
}

function viewGang() {
  const c = court();
  const done = doneTrips();
  const cards = MEMBERS.map(m => {
    const trips = done.filter(t => (t.attendees || []).includes(m.id)).length;
    const crowns = done.filter(t => t.organiser === m.id).length;
    const badge = m.id === c.ruler ? '<p class="member-tag crown">♛ Reigning</p>' : m.id === c.heir ? '<p class="member-tag">Heir to the throne</p>' : '';
    return `
      <article class="panel member">
        <label class="av-edit" title="Add or change ${esc(m.short)}’s photo">
          ${avatar(m.id, 'lg')}
          <input type="file" accept="image/*" class="avatar-input" data-member="${m.id}" aria-label="Photo of ${esc(m.short)}">
          <span class="av-edit-label">${profilePhoto(m.id) ? 'Change' : '+ Photo'}</span>
        </label>
        <div style="min-width:0">
          ${badge}
          <h3>${esc(m.name)}</h3>
          <p class="nick ${m.nick ? '' : 'unset'}">${m.nick ? esc(m.nick) : 'nickname not set yet'}</p>
          <p class="small" style="margin-top:6px">${esc(m.line)}</p>
          ${(m.links || []).length ? `<ul class="member-links">${m.links.map(l => `<li><a target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.title)} ↗</a></li>`).join('')}</ul>` : ''}
          ${m.honour ? `<p class="honour small"><span class="crown">★</span> <span>${esc(m.honour.text)}</span>${m.honour.url ? ` <a target="_blank" rel="noopener" href="${esc(m.honour.url)}"><span>${esc(m.honour.link || 'Open')}</span> ↗</a>` : ''}</p>` : ''}
          <div class="tally num"><span>${trips} ${trips === 1 ? 'trip' : 'trips'}</span><span>${crowns} organised</span>${m.id === 'nikol' ? '<span>arrivals: pending</span>' : ''}</div>
        </div>
      </article>`;
  }).join('');
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">10 active members · 1 no longer with us</p>
      <h1>The Gang</h1>
      <p>Met at JAMU in 2016. It started with getting through school together. Today we know each other’s lives, and we keep showing up for them.</p>
    </section>
    <section class="gang">
      ${cards}
      <article class="panel ghost-card">
        <span class="candle" aria-hidden="true">🕯️</span>
        <h3>${esc(GHOST.name)}</h3>
        <p class="eyebrow">In memoriam</p>
      </article>
    </section>
  </div>`;
}

const ANSWERS = [['yes', 'Yes'], ['maybe', 'Maybe'], ['no', 'No']];
const RSVP = [['yes', 'Coming'], ['maybe', 'Maybe'], ['no', 'Can’t'], ['love', '💌 Sends love']];

/* ---------------- who does what while a trip is being prepared ----------------
   The king or queen runs the preparations; everyone else votes, answers and takes a task.
   Tasks live on the planning trip as tasks: [{ id, label, who: [] }]. Until someone touches them, the defaults below apply. */
const DEFAULT_TASKS = [
  { id: 'food', label: 'Food' },
  { id: 'cars', label: 'Cars & lifts' },
  { id: 'games', label: 'Board games' }
];
const tasksOf = t => (Array.isArray(t.tasks) ? t.tasks : DEFAULT_TASKS).map(x => ({ ...x, who: x.who || [] }));
const goingTo = t => MEMBERS.filter(m => ['yes', 'maybe'].includes((t.rsvp || {})[m.id])).map(m => m.id);
function crownSteps(t) {
  const opts = S.options.filter(o => o.trip_id === t.id);
  const tasks = tasksOf(t);
  return [
    { text: 'Propose a few weekends to vote on', done: !!(opts.length || t.start) },
    { text: 'Pick the final date', done: !!t.start },
    { text: 'Book the cottage and add the address', done: !!t.address },
    { text: 'Write what to bring and how to get in under “Good to know”', done: !!(t.notes || '').trim() },
    { text: 'Make sure every task below has someone', done: tasks.length > 0 && tasks.every(x => x.who.length) },
    { text: 'After the trip: crown the heir and close the books', later: true }
  ];
}
function gangSteps(t) {
  const opts = S.options.filter(o => o.trip_id === t.id);
  const rsvp = t.rsvp || {};
  const tasks = tasksOf(t);
  const voted = id => opts.some(o => (o.votes || {})[id]);
  const steps = [];
  if (!t.start) steps.push({ text: 'Vote on the weekends', missing: opts.length ? MEMBERS.filter(m => !voted(m.id)).map(m => m.id) : null, wait: !opts.length && 'Waiting for the dates.' });
  steps.push({ text: 'Say if you’re coming', missing: MEMBERS.filter(m => !rsvp[m.id]).map(m => m.id) });
  steps.push({ text: 'If you’re coming, take a task', missing: goingTo(t).filter(id => !tasks.some(x => x.who.includes(id))) });
  steps.push({ text: 'After the trip: add what you paid for', later: true });
  return steps;
}
function stepRow(s) {
  const state = s.later ? 'later' : s.done || (s.missing && !s.missing.length) ? 'done' : 'open';
  const mark = state === 'done' ? '✓' : state === 'later' ? '·' : '';
  const who = s.wait ? `<span class="muted small">${s.wait}</span>`
    : s.missing && s.missing.length ? `<span class="small"><span class="muted">Still waiting for:</span> ${s.missing.map(id => `<span class="chip">${esc(nameOf(id))}</span>`).join(' ')}</span>`
    : s.missing ? '<span class="muted small">Everyone’s done.</span>' : '';
  return `<li class="duty ${state}"><span class="tick" aria-hidden="true">${mark}</span><span class="stack" style="gap:4px"><span>${s.text}</span>${who}</span></li>`;
}
function rolesPanel(t) {
  const m = me();
  const isCrown = m && m === t.organiser;
  const tasks = tasksOf(t);
  const rows = tasks.map(x => {
    const mine = m && x.who.includes(m);
    return `
      <div class="task ${x.who.length ? '' : 'free'}">
        <div class="stack" style="gap:6px;min-width:0">
          <b>${esc(x.label)}</b>
          <span class="row" style="gap:6px">${x.who.length ? x.who.map(id => `<span class="person-chip">${avatar(id, 'xs')}${esc(nameOf(id))}</span>`).join('') : '<span class="muted small">Nobody yet</span>'}</span>
        </div>
        <span class="row" style="gap:6px">
          ${m ? `<button class="btn sm ${mine ? 'ghost' : 'primary'}" type="button" data-action="task-claim" data-task="${esc(x.id)}">${mine ? 'Drop it' : 'I’ll do it'}</button>` : ''}
          ${isCrown ? `<button class="btn sm ghost danger" type="button" data-action="task-del" data-task="${esc(x.id)}" aria-label="Remove this task">Remove</button>` : ''}
        </span>
      </div>`;
  }).join('');
  return `
    <section class="stack" id="roles">
      <div><p class="eyebrow">Who does what</p><h2>Preparing the trip together</h2></div>
      <div class="two-col">
        <section class="panel stack duties crown-duties">
          <div><p class="eyebrow"><span class="crown">♛</span> The king or queen</p><h3>${esc(nameOf(t.organiser))}</h3><p class="muted small">Leads the preparations. If something’s unclear, ask here first.</p></div>
          <ul class="duty-list">${crownSteps(t).map(stepRow).join('')}</ul>
        </section>
        <section class="panel stack duties">
          <div><p class="eyebrow">Everyone else</p><h3>The whole gang</h3><p class="muted small">Each of us does this for ourselves. The king or queen sees who’s still missing.</p></div>
          <ul class="duty-list">${gangSteps(t).map(stepRow).join('')}</ul>
        </section>
      </div>
      <section class="panel stack">
        <div class="spread"><div><p class="eyebrow">Tasks</p><h3>Who takes care of what</h3></div><p class="muted small">Tap to take a task. Two people can share one.</p></div>
        ${!m ? '<p class="muted small">Tell us who you are (top right) to take a task.</p>' : ''}
        <div class="tasks">${rows || '<p class="muted">No tasks yet.</p>'}</div>
        <form id="task-form" class="row" style="align-items:end">
          <label style="flex:1 1 220px">New task<input name="label" maxlength="60" placeholder="e.g. Firewood" required></label>
          <button class="btn" type="submit">Add task</button>
        </form>
      </section>
    </section>`;
}

function viewNext() {
  const plan = planning();
  const c = court();
  if (!plan) return `
    <div class="stack-lg">
      <section class="hero"><p class="eyebrow">Next trip</p><h1>Nothing planned yet</h1></section>
      <div class="empty">
        <div class="big">♛</div>
        <h3>${esc(nameOf(c.ruler))}, the stage is yours.</h3>
        <p class="muted">Start a plan: add the cottage, then propose dates for everyone to vote on.</p>
        <button class="btn primary" type="button" data-action="new-plan">Start planning the next trip</button>
      </div>
    </div>`;

  const opts = S.options.filter(o => o.trip_id === plan.id).sort((a, b) => (a.start || '').localeCompare(b.start || ''));
  const score = o => Object.values(o.votes || {}).reduce((s, v) => s + (v === 'yes' ? 1 : v === 'maybe' ? .5 : 0), 0);
  const best = opts.length > 1 ? opts.reduce((a, b) => score(b) > score(a) ? b : a) : null;
  const meId = me();
  const addr = plan.address || '';
  const optsHtml = opts.map(o => {
    const v = o.votes || {};
    const chosen = plan.start === o.start && plan.end === o.end;
    const counts = { yes: 0, maybe: 0, no: 0 };
    Object.values(v).forEach(x => { if (counts[x] !== undefined) counts[x]++; });
    return `
      <div class="opt ${best && best.id === o.id && score(o) > 0 ? 'best' : ''} ${chosen ? 'chosen' : ''}">
        <div class="spread">
          <span class="opt-date">${esc(fmtRange(o.start, o.end))}${chosen ? ' ✅' : ''}${best && best.id === o.id && score(o) > 0 ? ' <span class="best-tag">Most votes</span>' : ''}</span>
          <span class="row small num"><span class="chip yes">✓ ${counts.yes}</span><span class="chip maybe">? ${counts.maybe}</span><span class="chip no">✕ ${counts.no}</span></span>
        </div>
        <div class="row">${Object.entries(v).map(([id, a]) => `<span class="chip ${a}">${esc(nameOf(id))}</span>`).join('') || '<span class="muted small">No votes yet.</span>'}</div>
        <div class="spread">
          ${meId ? `<span class="row small"><span class="muted">${esc(nameOf(meId))}:</span><span class="seg">${ANSWERS.map(([k, l]) => `<button type="button" class="${k} ${v[meId] === k ? 'on' : ''}" data-action="vote" data-opt="${o.id}" data-val="${k}">${l}</button>`).join('')}</span></span>` : '<span></span>'}
          <span class="row">
            ${chosen ? '' : `<button class="btn sm" type="button" data-action="choose-date" data-opt="${o.id}">Pick this date</button>`}
            <button class="btn sm ghost danger" type="button" data-action="del-opt" data-opt="${o.id}" aria-label="Remove this date">Remove</button>
          </span>
        </div>
      </div>`;
  }).join('');

  const rsvp = plan.rsvp || {};
  const tally = { yes: 0, maybe: 0, no: 0, love: 0 };
  Object.values(rsvp).forEach(x => { if (tally[x] !== undefined) tally[x]++; });

  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Next trip · organised by ♛ ${esc(nameOf(plan.organiser))}</p>
      <h1>${esc(plan.title || 'Untitled trip')}</h1>
      <p>${plan.start ? esc(fmtRange(plan.start, plan.end)) : 'Date not decided yet. Vote below.'}</p>
      <div class="row"><button class="btn sm" type="button" data-action="edit-trip" data-trip="${plan.id}">Edit trip details</button></div>
    </section>

    <ol class="howto" aria-label="How this page works">
      <li><b>Vote on dates</b><span>Pick Yes, Maybe or No for each weekend. The organiser then picks the winner.</span></li>
      <li><b>Say if you\u2019re coming</b><span>One tap next to your name. You can change it any time.</span></li>
      <li><b>Take a task</b><span>Food, cars or board games. Each of us takes at least one.</span></li>
      <li><b>Get there</b><span>On the day, tap \u201cNavigate\u201d and your phone takes you to the cottage.</span></li>
      <li><b>Wrap it up</b><span>Back home, press the button at the bottom to crown the next monarch and share photos.</span></li>
    </ol>

    ${rolesPanel(plan)}

    <div class="two-col">
      <section class="panel stack">
        <p class="eyebrow">The cottage</p>
        <h2>${esc(plan.place || 'Place not set yet')}</h2>
        ${addr ? `<p class="addr">${esc(addr)}</p>
          <div class="row">
            <a class="btn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}">Navigate in Google Maps ↗</a>
            <a class="btn" target="_blank" rel="noopener" href="https://mapy.cz/zakladni?q=${encodeURIComponent(addr)}">Mapy.cz ↗</a>
            <button class="btn" type="button" data-action="copy" data-text="${esc(addr)}">Copy address</button>
          </div>` : `<p class="muted">No address yet. <button class="btn sm" type="button" data-action="edit-trip" data-trip="${plan.id}">Add the address</button></p>`}
        ${plan.notes ? `<div class="stack" style="gap:4px"><p class="eyebrow">Good to know</p><p class="story">${esc(plan.notes)}</p></div>` : ''}
      </section>

      <section class="panel stack">
        <div class="spread"><div><p class="eyebrow">Date voting</p><h2>When can you come?</h2></div></div>
        ${!meId ? '<p class="muted small">Tell us who you are (top right) to vote.</p>' : ''}
        <div>${optsHtml || '<p class="muted">No dates proposed yet. Add the first option below.</p>'}</div>
        <form id="opt-form" class="grid2" style="align-items:end">
          <label>From<input type="date" name="start" id="opt-start" required></label>
          <label>To<input type="date" name="end" id="opt-end"></label>
          <button class="btn" type="submit">Propose these dates</button>
        </form>
      </section>
    </div>

    <section class="panel stack">
      <div class="spread">
        <div><p class="eyebrow">Who’s coming</p><h2 class="num">${tally.yes} coming · ${tally.maybe} maybe</h2></div>
        <p class="muted small">Answer for yourself. (Nikol, we’ll believe it when we see you.)</p>
      </div>
      <div>
        ${MEMBERS.map(m => `
          <div class="rsvp">
            <div class="person">${avatar(m.id, 'xs')}<span><b>${esc(m.short)}</b> <span class="muted small">${esc(m.nick)}</span></span></div>
            <span class="seg">${RSVP.map(([k, l]) => `<button type="button" class="${k} ${rsvp[m.id] === k ? 'on' : ''}" data-action="rsvp" data-who="${m.id}" data-val="${k}">${l}</button>`).join('')}</span>
          </div>`).join('')}
      </div>
    </section>

    <section class="panel spread">
      <div class="stack" style="gap:4px"><h3>Back home already?</h3><p class="muted small">Wrap up the trip: confirm who came, crown the next monarch, then add photos and expenses.</p></div>
      <button class="btn gold" type="button" data-action="wrap-up" data-trip="${plan.id}">♛ Wrap up &amp; crown the next ruler</button>
    </section>
  </div>`;
}

function viewArchive() {
  const done = doneTrips();
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Every weekend we’ve shared</p><h1>The Archive</h1>
      <p>Every trip we\u2019ve taken. Open one to see its photos, stories and who came. Remember a trip that isn\u2019t here yet? Add it.</p>
      <div class="row"><button class="btn primary" type="button" data-action="add-past">+ Add a past trip</button></div>
    </section>
    ${done.length ? `<div class="table-wrap"><table class="sheet">
      <thead><tr><th>Date</th><th>Trip</th><th>Organiser</th><th>Who came</th><th>Photos</th></tr></thead>
      <tbody>${done.map((t, i) => tripRow(t)).join('')}</tbody></table></div>` : `
      <div class="empty">
        <div class="big">🎟️</div>
        <h3>The archive is empty</h3>
        <p class="muted">Our memory is worse than our project documentation. Add the trips you remember, one row at a time.</p>
        <button class="btn primary" type="button" data-action="add-past">+ Add the first trip</button>
      </div>`}
    ${chroniclePanel()}
  </div>`;
}
function chroniclePanel() {
  const owers = MEMBERS.filter(m => PAST_RULERS.includes(m.id) || tripsBy(m.id).length);
  const written = owers.filter(m => chronicleState(m.id) === 'done').length;
  const STATE = { todo: ['Not started yet', 'no'], writing: ['Writing', 'maybe'], done: ['Written ✓', 'yes'] };
  const rows = owers.map(m => {
    const [label, cls] = STATE[chronicleState(m.id)] || STATE.todo;
    const n = tripsBy(m.id).length;
    return `<li class="chron"><span class="row" style="gap:8px">${avatar(m.id, 'xs')}<b>${esc(m.short)}</b>${n ? `<span class="muted small num">${n} ${n === 1 ? 'trip' : 'trips'}</span>` : ''}</span><span class="chip ${cls}">${label}</span></li>`;
  });
  const waiting = MEMBERS.filter(m => !owers.includes(m)).map(m => {
    const note = m.id === court().ruler ? (m.id === 'julia' ? 'Reigns now. Her chronicle comes after the next trip. (SETKÁNÍ 2019 doesn’t count. Or does it?)' : 'Reigns now. The chronicle comes after the next trip.')
      : m.id === 'dalibor' ? 'Hasn’t reigned yet. The crown is waiting for him.' : 'Hasn’t reigned yet.';
    return `<li class="chron"><span class="row" style="gap:8px">${avatar(m.id, 'xs')}<b>${esc(m.short)}</b></span><span class="muted small">${note}</span></li>`;
  });
  return `
    <section class="panel stack">
      <div class="spread">
        <div><p class="eyebrow">The chronicle of crowns</p><h2 class="num">${written} of ${owers.length} chronicles written</h2></div>
      </div>
      <p class="muted small">Whoever organised a trip writes its page here: when, where, the photos and the story. Everyone who has worn the crown adds their own trips. From now on, each trip’s organiser finishes its page after the crowning.</p>
      <ul class="chrons">${rows.join('')}${waiting.join('')}</ul>
    </section>`;
}
function tripRow(t) {
  const href = '#trip-' + esc(t.id);
  return `
  <tr data-href="${href}">
    <td class="date">${esc(fmtRange(t.start, t.end))}</td>
    <td><a class="trip-link" href="${isOpen(t) ? '#after' : href}">${esc(t.title || 'Untitled trip')}</a>${isOpen(t) ? ' <span class="chip maybe">Settling up</span>' : ''}${t.place ? `<br><span class="muted small">${esc(t.place)}</span>` : ''}</td>
    <td class="small"><span class="crown">♛</span> ${esc(nameOf(t.organiser))}${t.crowned ? ` <span class="muted">→ ${esc(nameOf(t.crowned))}</span>` : ''}</td>
    <td><div class="row" style="gap:6px"><div class="av-row">${(t.attendees || []).map(id => avatar(id, 'xs')).join('')}</div>${(t.attendees || []).includes('nikol') ? '<span class="badge">Nikol arrived!</span>' : ''}</div></td>
    <td class="small">${(() => { const n = S.photos.filter(p => p.trip_id === t.id).length; return n ? `${n} ${n === 1 ? 'photo' : 'photos'}` : safeUrl(t.photos_url) ? 'Album' : '<span class="muted">—</span>'; })()}</td>
  </tr>`;
}

const driveImg = (id, w = 900) => `https://drive.google.com/thumbnail?id=${encodeURIComponent(id)}&sz=w${w}`;
function picksHtml(picks) {
  return `<div class="picks">${picks.map((p, i) => `
    <a class="pick${i === 0 ? ' big' : ''}" href="https://drive.google.com/file/d/${encodeURIComponent(p.id)}/view" target="_blank" rel="noopener">
      <img src="${driveImg(p.id, i === 0 ? 1400 : 800)}" alt="${esc(p.caption || '')}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='https://lh3.googleusercontent.com/d/${esc(p.id)}=w1000'">
      ${p.caption ? `<span class="pick-cap" data-notr>${esc(p.caption)}</span>` : ''}
    </a>`).join('')}</div>`;
}
function photosSection(t, albumUrl) {
  const pics = S.photos.filter(p => p.trip_id === t.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  const picks = relicFor(t)?.picks || [];
  return `
  <section class="panel stack" id="photos">
    <div class="spread">
      <div><p class="eyebrow">Photos</p><h2>${pics.length ? `${pics.length} ${pics.length === 1 ? 'photo' : 'photos'}` : picks.length ? 'The captain’s picks' : 'No photos yet'}</h2></div>
      ${albumUrl ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(albumUrl)}">Full album ↗</a>` : ''}
    </div>
    ${picks.length ? picksHtml(picks) : ''}
    <label class="dropzone" for="photo-input" data-trip="${t.id}">
      <input type="file" id="photo-input" accept="image/*" multiple data-trip="${t.id}">
      <span class="dz-title">Add photos</span>
      <span class="muted small">Tap to pick from your phone, or drop files here. Several at once is fine.</span>
      <span class="dz-progress small" id="photo-progress" role="status"></span>
    </label>
    ${pics.length ? `<div class="gallery">${pics.map((p, i) => `
      <button type="button" class="ph" data-action="view-photo" data-trip="${t.id}" data-i="${i}" aria-label="Open photo ${i + 1}">
        <img data-photo="${esc(p.path)}" alt="" loading="lazy">
        ${p.by ? `<span class="ph-by">${esc(nameOf(p.by))}</span>` : ''}
      </button>`).join('')}</div>` : ''}
    <div class="row album-row">${albumUrl ? `<span class="muted small">Shared album linked.</span>` : `<span class="muted small">Have a Google Drive or Photos album with everything?</span>`}<button class="btn sm" type="button" data-action="album-link" data-trip="${t.id}">${albumUrl ? 'Change album link' : 'Link the album'}</button></div>
  </section>`;
}

/* ---------------- photo storage ---------------- */
// Live: private Supabase Storage bucket "photos" (signed URLs). Demo: small data URLs in the browser.
const signed = new Map();
async function hydratePhotos() {
  const imgs = $$('img[data-photo]');
  if (!imgs.length) return;
  const need = [...new Set(imgs.map(i => i.dataset.photo))].filter(p => !p.startsWith('data:') && !signed.has(p));
  if (need.length && LIVE) {
    const { data } = await sb.storage.from('photos').createSignedUrls(need, 60 * 60 * 6);
    (data || []).forEach(d => { if (d.signedUrl) signed.set(d.path, d.signedUrl); });
  }
  imgs.forEach(i => { const p = i.dataset.photo; i.src = p.startsWith('data:') ? p : (signed.get(p) || ''); });
}
function shrink(file, maxSide, quality) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read this image')), 'image/jpeg', quality);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read ' + file.name)); };
    img.src = url;
  });
}
function squareCrop(file, side) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const n = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = c.height = side;
      c.getContext('2d').drawImage(img, (img.naturalWidth - n) / 2, (img.naturalHeight - n) / 2, n, n, 0, 0, side, side);
      URL.revokeObjectURL(url);
      c.toBlob(b => b ? resolve(b) : reject(new Error('Could not read this image')), 'image/jpeg', 0.85);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read ' + file.name)); };
    img.src = url;
  });
}
async function uploadAvatar(memberId, file) {
  toast('Uploading photo…');
  try {
    const blob = await squareCrop(file, LIVE ? 480 : 240);
    let path;
    if (LIVE) {
      path = `avatars/${memberId}-${uid()}.jpg`;
      const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
      if (error) throw error;
    } else path = await blobToDataUrl(blob);
    const old = S.profiles.filter(p => p.member === memberId);
    await DB.add('profiles', { member: memberId, path, by: me() || '' });
    for (const o of old) { if (LIVE && !o.path.startsWith('data:')) await sb.storage.from('photos').remove([o.path]); await DB.remove(o); }
    await load(); render();
    toast(memberId === 'nikol' ? 'Photo saved. Finally, proof that Nikol exists. 📸' : `Looking good, ${nameOf(memberId)}!`);
  } catch (e) { console.error(e); toast('The photo didn’t upload: ' + (e.message || 'unknown error')); }
}
const blobToDataUrl = b => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
async function uploadPhotos(tripId, files) {
  files = [...files].filter(f => f.type.startsWith('image/'));
  if (!files.length) return;
  const prog = $('#photo-progress');
  let ok = 0;
  for (let i = 0; i < files.length; i++) {
    if (prog) prog.textContent = `Uploading ${i + 1} of ${files.length}…`;
    try {
      let path;
      if (LIVE) {
        const blob = await shrink(files[i], 2000, 0.85);
        path = `${tripId}/${uid()}.jpg`;
        const { error } = await sb.storage.from('photos').upload(path, blob, { contentType: 'image/jpeg' });
        if (error) throw error;
      } else {
        path = await blobToDataUrl(await shrink(files[i], 900, 0.7));
      }
      await DB.add('photos', { trip_id: tripId, path, by: me() || '' });
      ok++;
    } catch (e) { console.error(e); toast(e.message || 'One photo failed to upload'); }
  }
  await load(); render();
  toast(ok ? `${ok} ${ok === 1 ? 'photo' : 'photos'} added` : 'No photos were added');
}
document.addEventListener('change', e => {
  if (e.target.id === 'photo-input') uploadPhotos(e.target.dataset.trip, e.target.files);
  if (e.target.classList.contains('avatar-input') && e.target.files[0]) uploadAvatar(e.target.dataset.member, e.target.files[0]);
});
document.addEventListener('dragover', e => { const z = e.target.closest('.dropzone'); if (z) { e.preventDefault(); z.classList.add('over'); } });
document.addEventListener('dragleave', e => { const z = e.target.closest('.dropzone'); if (z) z.classList.remove('over'); });
document.addEventListener('drop', e => { const z = e.target.closest('.dropzone'); if (!z) return; e.preventDefault(); z.classList.remove('over'); uploadPhotos(z.dataset.trip, e.dataTransfer.files); });

function openViewer(tripId, i) {
  const pics = S.photos.filter(p => p.trip_id === tripId).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  if (!pics.length) return;
  i = (i + pics.length) % pics.length;
  const p = pics[i];
  closeModal();
  const bg = document.createElement('div');
  bg.className = 'viewer';
  bg.innerHTML = `
    <img data-photo="${esc(p.path)}" alt="Photo ${i + 1} of ${pics.length}">
    <div class="viewer-bar">
      <span class="small">${i + 1} / ${pics.length}${p.by ? ' · by ' + esc(nameOf(p.by)) : ''}</span>
      <span class="row">
        <button class="btn sm" type="button" data-v="prev" aria-label="Previous">←</button>
        <button class="btn sm" type="button" data-v="next" aria-label="Next">→</button>
        <button class="btn sm danger" type="button" data-v="del">Delete</button>
        <button class="btn sm" type="button" data-v="close">Close</button>
      </span>
    </div>`;
  document.body.appendChild(bg);
  translateDOM(bg);
  hydratePhotos();
  let armed = false;
  bg.addEventListener('click', async e => {
    const v = e.target.closest('[data-v]')?.dataset.v;
    if (!v && e.target === bg) return bg.remove();
    if (v === 'close') bg.remove();
    if (v === 'prev') { bg.remove(); openViewer(tripId, i - 1); }
    if (v === 'next') { bg.remove(); openViewer(tripId, i + 1); }
    if (v === 'del') {
      if (!armed) { armed = true; e.target.textContent = tr('Sure? Click again'); return; }
      bg.remove();
      if (LIVE && !p.path.startsWith('data:')) await sb.storage.from('photos').remove([p.path]);
      act(() => DB.remove(p), 'Photo deleted');
    }
  });
}
document.addEventListener('keydown', e => {
  const v = $('.viewer'); if (!v) return;
  const map = { ArrowLeft: 'prev', ArrowRight: 'next', Escape: 'close' };
  if (map[e.key]) $(`[data-v="${map[e.key]}"]`, v)?.click();
});

/* ---------------- timeline ---------------- */
const KINDS = {
  baby: ['Baby', '👶'], love: ['Love & weddings', '💍'], home: ['New home', '🏡'], work: ['Work', '💼'],
  school: ['School', '🎓'], gang: ['The gang', '♛'], other: ['Other', '✦']
};
function viewTimeline() {
  const items = [
    { date: '2016-09-01', approx: true, kind: 'gang', title: 'We meet at JAMU', label: 'Where it all began', note: 'Theatre management, class of 2016. Dalibor joins from JevTech and gets adopted. Nobody knows yet what they signed up for.', fixed: true },
    { date: '2017-04-01', approx: true, kind: 'encounter', title: 'The 27th SETKÁNÍ/ENCOUNTER', label: 'First festival', note: 'Freshmen. We run errands, carry things, sleep very little and learn what an international theatre festival really costs (sleep, mostly).', fixed: true,
      links: [{ title: 'The 2017 Off-program application form (jamu.cz, PDF)', url: 'https://www.jamu.cz/documents/aktuality/ENC17_offprogram_prihlaska_vs02.pdf' }] },
    { date: '2018-04-01', approx: true, kind: 'encounter', title: 'The 28th SETKÁNÍ/ENCOUNTER', label: 'Second year', note: 'More responsibility, same amount of sleep. We watch the older years and quietly think: next year it\u2019s us.', fixed: true },
    { date: '2019-04-02', approx: true, kind: 'encounter', title: 'We run the 29th SETKÁNÍ/ENCOUNTER', label: 'Our masterpiece', who: ['julia', 'michaela', 'sylvie'], note: 'Our year as the main organisers, with Júlia as head of the festival. Theatre schools from all over Europe in Brno, and a team that came out of it as a family.', fixed: true,
      links: [
        { title: 'The official 2019 festival listing (ENCATC)', url: 'https://encatc.org/en/events/detail/the-international-festival-of-theatre-schools-setkani-encounter-2019/' },
        { title: 'Our press conference, 17 March 2019 (Visegrad Fund)', url: 'https://www.visegradfund.org/events/press-conference-3' },
        { title: 'Míša’s thesis: Head of Off-program 2019', url: 'https://theses.cz/id/29ozgh?lang=en' },
        { title: 'Sylvie’s thesis: Head of Jury, Ensembles & Guests 2019', url: 'https://theses.cz/id/d0w4t7?lang=en' }
      ] },
    ...S.milestones,
    ...doneTrips().filter(t => t.start).map(t => ({ date: t.start, kind: 'trip', title: t.title, note: t.place, trip: t, who: t.attendees || [] }))
  ].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  let lastYear = null;
  const rows = items.map(m => {
    const y = (m.date || '').slice(0, 4);
    const yearHead = y !== lastYear ? `<li class="tl-year"><span>${esc(y)}</span></li>` : '';
    lastYear = y;
    const k = m.kind === 'trip' ? ['Trip', '🏕️'] : m.kind === 'encounter' ? ['SETKÁNÍ/ENCOUNTER', '🎭'] : (KINDS[m.kind] || KINDS.other);
    return `${yearHead}
      <li class="tl-item ${m.kind === 'trip' ? 'is-trip' : ''}">
        <span class="tl-dot" aria-hidden="true">${k[1]}</span>
        <div class="tl-card">
          <p class="small muted">${esc(m.approx ? (parseDate(m.date)?.toLocaleDateString('cs-CZ', { month: 'long', year: 'numeric' }) || '') : fmtDate(m.date))} · ${esc(k[0])}</p>
          <h3>${m.trip ? `<a href="#trip-${esc(m.trip.id)}">${esc(m.title)}</a>` : esc(m.title)}</h3>
          ${m.label ? `<span class="badge">${esc(m.label)}</span>` : ''}
          ${m.note ? `<p class="small">${esc(m.note)}</p>` : ''}
          ${(m.who || []).length ? `<div class="av-row">${m.who.map(id => avatar(id, 'xs')).join('')}</div>` : ''}
          ${(m.links || []).filter(l => safeUrl(l.url)).length ? `<div class="artifacts"><p class="eyebrow">Found online</p><ul>${m.links.filter(l => safeUrl(l.url)).map(l => `<li><a target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.title || hostOf(l.url))} ↗</a></li>`).join('')}</ul></div>` : ''}
          ${!m.fixed && !m.trip ? `<div class="row tl-actions"><button class="btn sm ghost" type="button" data-action="edit-ms" data-ms="${m.id}">Edit</button><button class="btn sm ghost danger" type="button" data-action="del-ms" data-ms="${m.id}">Delete</button></div>` : ''}
        </div>
      </li>`;
  }).join('');
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Our life, together</p>
      <h1>Timeline</h1>
      <p>From surviving JAMU to babies, weddings and new homes. Trips from the archive appear here automatically.</p>
      <div class="row"><button class="btn primary" type="button" data-action="add-ms">+ Add a milestone</button></div>
    </section>
    <ol class="timeline">${rows}</ol>
  </div>`;
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const parseLinks = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const i = l.lastIndexOf('|');
  const url = (i >= 0 ? l.slice(i + 1) : l).trim(), title = i >= 0 ? l.slice(0, i).trim() : '';
  return { title, url };
}).filter(l => safeUrl(l.url));

/* ---------------- suggestions ---------------- */
const openIdeas = () => S.suggestions.filter(s => !s.done).length;
function viewIdeas() {
  const list = [...S.suggestions].sort((a, b) => (a.done === b.done ? (b.created_at || '').localeCompare(a.created_at || '') : a.done ? 1 : -1));
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Make it better</p><h1>Suggestions</h1>
      <p>Ideas and fixes from the gang. Mark them done once they’re in. (Feedback here is kinder than at a JAMU evaluation, promise.)</p>
      <div class="row"><button class="btn primary" type="button" data-action="suggest">+ New suggestion</button></div>
    </section>
    ${list.length ? `<div class="stack">${list.map(s => `
      <article class="panel idea ${s.done ? 'done' : ''}">
        <div class="spread">
          <span class="row small muted">${s.by ? avatar(s.by, 'xs') + ' ' + esc(nameOf(s.by)) : 'Someone'} · ${esc(s.page || '')} · ${esc(fmtDate((s.created_at || '').slice(0, 10)))}</span>
          <span class="chip ${s.done ? 'yes' : 'maybe'}">${s.done ? 'Done' : 'Open'}</span>
        </div>
        <p class="story">${esc(s.text)}</p>
        <div class="row">
          <button class="btn sm" type="button" data-action="toggle-idea" data-idea="${s.id}">${s.done ? 'Reopen' : 'Mark as done'}</button>
          <button class="btn sm ghost danger" type="button" data-action="del-idea" data-idea="${s.id}">Delete</button>
        </div>
      </article>`).join('')}</div>` : `
      <div class="empty"><div class="big">✎</div><h3>No suggestions yet</h3><p class="muted">Either the site is perfect, or nobody has looked closely yet.</p></div>`}
  </div>`;
}

function viewTrip(t, { after = false } = {}) {
  if (!t) return `<div class="empty"><div class="big">🕯️</div><h3>This trip is no longer with us</h3><p class="muted">It may have been deleted.</p><a class="btn" href="#archive">Back to the archive</a></div>`;
  const ex = S.expenses.filter(e => e.trip_id === t.id);
  const att = t.attendees && t.attendees.length ? t.attendees : MEMBERS.map(m => m.id);
  const total = ex.reduce((s, e) => s + Number(e.amount || 0), 0);
  const transfers = settle(ex);
  // Money only while the trip is open. Archived trips (books closed, or added by hand) don't talk about money.
  const showMoney = isOpen(t);
  after = after && showMoney;
  const photos = safeUrl(t.photos_url);
  const quotes = (t.quotes || '').split('\n').map(s => s.trim()).filter(Boolean);
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">${after ? 'Just got back from' : 'From the archive'}</p>
      <h1>${esc(t.title || 'Untitled trip')}</h1>
      <p>${esc(fmtRange(t.start, t.end))}${t.place ? ' · ' + esc(t.place) : ''}</p>
      <p class="small"><span class="crown">♛</span> Organised by <b>${esc(member(t.organiser)?.name || '—')}</b>${t.crowned ? ` · crowned at the end: <b>${esc(member(t.crowned)?.name)}</b>` : ''}</p>
      <div class="row"><button class="btn sm" type="button" data-action="edit-trip" data-trip="${t.id}">Edit</button>${after ? `<a class="btn sm ghost" href="#trip-${esc(t.id)}">Permalink</a>` : ''}</div>
      ${chronicleGaps(t).length ? `<p class="hint">${esc(nameOf(t.organiser))} organised this one, so the page is theirs to finish. Still missing: ${gapChips(t)}</p>` : ''}
      ${after ? `<p class="hint">Just got back? Two things to do: <button class="linkish" type="button" data-action="share-photos" data-trip="${t.id}">share your photos</button> and <button class="linkish" type="button" data-action="add-exp" data-trip="${t.id}">add what you paid for</button>. The page works out who owes whom.</p>` : ''}
    </section>

    ${photosSection(t, photos)}

    <section class="panel stack">
      <div class="spread"><div><p class="eyebrow">Who was there</p><h3 class="num">${(t.attendees || []).length} survivors</h3></div>${(t.attendees || []).includes('nikol') ? '<span class="badge">Nikol actually arrived</span>' : ''}</div>
      <div class="row">${(t.attendees || []).map(id => `<span class="row" style="gap:6px">${avatar(id, 'xs')}<span class="small">${esc(nameOf(id))}</span></span>`).join('') || '<span class="muted small">Not filled in. Use Edit to add who came.</span>'}</div>
    </section>

    ${showMoney ? `
    <div class="two-col">
      <section class="panel stack">
        <div class="spread"><div><p class="eyebrow">Who paid for what</p><h2 class="num">${kc(total)}</h2></div>${att.length ? `<span class="muted small num">≈ ${kc(total / att.length)} per person</span>` : ''}</div>
        <div>${ex.map(e => `
          <div class="exp">
            <div style="min-width:0"><b>${esc(e.what || 'Something')}</b><br><span class="muted small">${esc(nameOf(e.payer))} paid · split ${(e.split || []).length} ways</span></div>
            <span class="amount">${kc(e.amount)}</span>
            <button class="btn sm ghost danger" type="button" data-action="del-exp" data-exp="${e.id}" aria-label="Delete expense">✕</button>
          </div>`).join('') || '<p class="muted small">No expenses yet. Who bought the beer? (This budget, unlike the festival one, will actually balance.)</p>'}</div>
        <div><button class="btn primary sm" type="button" data-action="add-exp" data-trip="${t.id}">+ Add expense</button></div>
      </section>

      <section class="panel stack">
        <p class="eyebrow">Settle up</p>
        <h2>Who sends money to whom</h2>
        ${transfers.length ? transfers.map(x => `
          <div class="transfer">${avatar(x.from, 'xs')}<b>${esc(nameOf(x.from))}</b><span class="muted">pays</span>${avatar(x.to, 'xs')}<b>${esc(nameOf(x.to))}</b><span class="amount" style="margin-left:auto">${kc(x.amount)}</span></div>`).join('')
          : `<p class="muted">${ex.length ? 'Everyone is square. Cleaner than any festival budget we ever handed in.' : 'Add expenses and the fewest possible payments will appear here.'}</p>`}
      </section>
    </div>
    <section class="panel spread">
      <div class="stack" style="gap:4px"><h3>All paid up?</h3><p class="muted small">When every payment above has been sent, ${esc(nameOf(t.organiser))} closes the books. The trip then moves to the archive, and the money talk ends.</p></div>
      ${me() === t.organiser ? `<button class="btn gold" type="button" data-action="close-books" data-trip="${t.id}">♛ Close the books &amp; archive</button>` : `<span class="muted small">Only the trip’s king or queen can close the books.</span>`}
    </section>
    ` : ''}

    <section class="panel stack">
      <p class="eyebrow">Stories &amp; quotes</p>
      ${t.story ? `<p class="story">${esc(t.story)}</p>` : '<p class="muted">No story yet. What happened at the cottage? (What happens at the cottage stays on this website.)</p>'}
      ${quotes.length ? `<ul class="quotes">${quotes.map(q => `<li class="quote">${esc(q)}</li>`).join('')}</ul>` : ''}
      <div><button class="btn sm" type="button" data-action="edit-trip" data-trip="${t.id}">Add story or quotes</button></div>
    </section>

    ${relicsSection(t)}

    <section class="row"><button class="btn sm ghost danger" type="button" data-action="del-trip" data-trip="${t.id}">Delete this trip</button></section>
  </div>`;
}

/* ---------------- from the captain's drawer ----------------
   Bits of the old organising docs (relics.js), shown verbatim on the trip they belong to. */
const RELICS = window.JAMU_RELICS || [];
const relicFor = t => RELICS.find(r => r.match(t));
const preparedFor = id => RELICS.find(r => r.prepared && r.prepared.organiser === id && !S.trips.some(t => r.match(t)));
const said = (who, text, cls = '') => `<figure class="said ${cls}">${who ? avatar(who, 'xs') : '<span class="av xs anon" aria-hidden="true">?</span>'}<blockquote data-notr>${esc(text)}</blockquote>${who ? `<figcaption class="muted small" data-notr>${esc(nameOf(who))}</figcaption>` : ''}</figure>`;
function relicsSection(t) {
  const r = relicFor(t); if (!r) return '';
  const L = r.letter, P = r.poll, B = r.budget, V = r.voices, G = r.guide, R = r.route;
  const panes = [];
  if (L) panes.push(['letter', 'The letter', `
    <article class="letter">
      <p class="letter-meta"><span data-notr>${esc(L.subject)}</span><span class="muted">${esc(fmtDate(L.date))}</span></p>
      <div class="letter-body" data-notr>
        ${L.lead.map(x => `<p>${esc(x)}</p>`).join('')}
        <p class="named">${esc(L.named)}</p>
      </div>
      <p class="letter-aside small">This is where our name comes from.</p>
      <details class="letter-more"><summary>Read the rest of the letter</summary>
        <div class="letter-body" data-notr>
          ${L.rest.map(([h, x]) => `<p><b>${esc(h)}</b><br>${esc(x)}</p>`).join('')}
          <p class="sign">${esc(L.sign)}</p>
          ${L.ps.map(x => `<p class="small">${esc(x)}</p>`).join('')}
        </div>
      </details>
    </article>
    ${L.reply ? `<div class="stack" style="gap:8px"><p class="eyebrow">The first reply, the same afternoon</p>${said(L.reply.from, L.reply.text)}</div>` : ''}`]);
  if (P) {
    const best = Math.max(...P.rows.map(([, v]) => v.reduce((a, b) => a + b, 0)));
    panes.push(['poll', 'The date poll', `
      <p class="muted small">Ten people, nine windows in July and August. Only one person could do every single one.</p>
      <div class="poll-wrap"><table class="poll">
        <thead><tr><th></th>${P.people.map(id => `<th title="${esc(nameOf(id))}">${avatar(id, 'xs')}</th>`).join('')}<th></th></tr></thead>
        <tbody>${P.rows.map(([d, v]) => { const n = v.reduce((a, b) => a + b, 0); const win = d === P.winner; return `
          <tr class="${win ? 'win' : ''}"><th class="num" data-notr>${esc(d)}</th>${v.map((x, i) => `<td><span class="pd ${x ? 'on' : ''}${x && P.people[i] === 'jakub' ? ' cap' : ''}" aria-label="${x ? 'yes' : 'no'}"></span></td>`).join('')}<td class="small num">${win ? '<span class="chip yes">We went</span>' : n === best ? '' : `<span class="muted">${n}/10</span>`}</td></tr>`; }).join('')}</tbody>
      </table></div>
      <p class="small"><span class="crown">♛</span> <b>El Capitano Kubko</b> <span class="muted">could do all of them.</span></p>
      <p class="small muted" data-notr>${esc(P.deadline)}</p>
      <div class="said-list">${P.notes.map(n => said(n.who, n.text)).join('')}</div>`]);
  }
  if (B) panes.push(['budget', 'The budget', `
    <div class="two-col">
      <div class="receipt">
        <p class="receipt-head">Budget 2020</p>
        ${B.lines.map(([k, v]) => `<p class="rl"><span data-notr>${esc(k)}</span><span class="num">${kc(v)}</span></p>`).join('')}
        <p class="rl total"><span>Per person</span><span class="num">${kc(B.total)}</span></p>
        <p class="small muted" data-notr>${esc(B.note)}</p>
      </div>
      <div class="stack">
        <p class="eyebrow">The first estimate, in the letter</p>
        <p class="relic-q" data-notr>${esc(B.estimate)}</p>
        <p class="eyebrow">The fleet</p>
        <ul class="fleet">${B.fleet.map(([d, x]) => `<li><span class="muted small num" data-notr>${esc(d)}</span><span data-notr>${esc(x)}</span></li>`).join('')}</ul>
      </div>
    </div>`]);
  if (V) panes.push(['voices', 'What we said', `
    <p class="eyebrow" data-notr>${esc(V.question)}</p>
    <p class="small"><span class="chip yes">Yes ${V.tally.yes.length}</span> <span class="chip no">No ${V.tally.no.length}</span> <span class="chip">Don’t care ${V.tally.meh.length}</span> <span class="muted">A perfect draw. Very us.</span></p>
    <div class="said-list">${V.quotes.map(q => said(q.who, q.text)).join('')}</div>`]);
  if (G) panes.push(['guide', 'How to do a river', `
    <p class="muted" data-notr>${esc(G.intro)}</p>
    <ol class="guide" data-notr>${G.steps.map(x => `<li>${esc(x)}</li>`).join('')}</ol>
    <div class="two-col">
      <div class="stack" style="gap:8px"><p class="eyebrow">What you need for sure</p>
        <ul class="must" data-notr>${G.must.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        <p class="small muted" data-notr>${esc(G.rule)}</p></div>
      <figure class="quote-block stack" style="gap:8px;margin:0"><p class="quote" data-notr>„${esc(G.quote.text)}“</p><figcaption class="muted small" data-notr>${esc(G.quote.by)}</figcaption></figure>
    </div>
    <p class="small muted">And a joke, so you’d remember the email:</p>
    <p class="relic-q small" data-notr>${esc(G.joke)}</p>`]);
  if (R) {
    const km = R.stops.reduce((a, x) => a + (x.km || 0), 0);
    panes.push(['route', 'The route', `
      <ol class="route">${R.stops.map(x => `
        <li>${x.km ? `<span class="leg num">${x.km} km</span>` : ''}<span class="stop"><b data-notr>${esc(x.name)}</b><span class="muted small num" data-notr>${esc(x.night)}</span></span>${x.text ? `<span class="small muted" data-notr>${esc(x.text)}</span>` : ''}</li>`).join('')}
      </ol>
      <p class="small"><b class="num">${km} km</b> <span class="muted">on the water, four nights in camps.</span></p>
      <div class="hint stack" style="gap:6px"><p class="small"><b>Meeting point</b> · <span data-notr>${esc(R.start.name)}</span> · <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(R.start.gps)}" target="_blank" rel="noopener">Open in Maps</a></p><p class="small" data-notr>${esc(R.start.note)}</p></div>`]);
  }
  if (!panes.length) return '';
  let pick = null; try { pick = ls.get('jamu-drawer'); } catch {}
  if (!panes.some(p => p[0] === pick)) pick = panes[0][0];
  return `
    <section class="panel stack drawer">
      <div><p class="eyebrow">From the captain’s drawer</p><h2>The old Drive, exactly as we wrote it</h2></div>
      <div class="tabs" role="tablist">${panes.map(([k, l]) => `<button type="button" role="tab" class="tab" data-action="relic-tab" data-pane="${k}" aria-selected="${k === pick}">${l}</button>`).join('')}</div>
      ${panes.map(([k, , h]) => `<div class="drawer-pane stack" role="tabpanel" data-pane="${k}" ${k === pick ? '' : 'hidden'}>${h}</div>`).join('')}
    </section>`;
}

function viewAfter() {
  const t = openTrip();
  if (!t) return `
    <div class="stack-lg">
      <section class="hero"><p class="eyebrow">After the trip</p><h1>Nothing to settle yet</h1></section>
      <div class="empty">
        <div class="big">🧾</div>
        <h3>No trip waiting to be settled</h3>
        <p class="muted">When you get back from a trip, press “Wrap up” on the Next Trip page. Its photos and expenses show up here until its king or queen closes the books.</p>
        <a class="btn primary" href="#next">Go to Next Trip</a>
      </div>
    </div>`;
  return viewTrip(t, { after: true });
}

/* ---------------- settle up ---------------- */
function settle(expenses) {
  const bal = {};
  expenses.forEach(e => {
    const amt = Number(e.amount) || 0;
    const split = (e.split && e.split.length) ? e.split : [e.payer];
    bal[e.payer] = (bal[e.payer] || 0) + amt;
    split.forEach(id => { bal[id] = (bal[id] || 0) - amt / split.length; });
  });
  const cred = Object.entries(bal).filter(([, v]) => v > 0.5).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const debt = Object.entries(bal).filter(([, v]) => v < -0.5).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0, j = 0;
  while (i < debt.length && j < cred.length) {
    const amt = Math.min(debt[i].v, cred[j].v);
    if (amt >= 1) out.push({ from: debt[i].id, to: cred[j].id, amount: Math.round(amt) });
    debt[i].v -= amt; cred[j].v -= amt;
    if (debt[i].v < 0.5) i++;
    if (cred[j].v < 0.5) j++;
  }
  return out;
}

/* ---------------- the add & edit window ----------------
   One window for everything people add or change: trips, past trips, the crowning, milestones,
   expenses, photo albums and suggestions. Only the title is required. Every change saves a draft
   in this browser, so closing never loses work. Esc closes, Ctrl/⌘+Enter saves. */
const ICONS = {
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 20c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  cal: '<rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  pin: '<path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/>',
  route: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3.5 3.5 0 0 0 0-7H9a3.5 3.5 0 0 1 0-7h6.5"/>',
  people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.6 3.6-5.5 6.5-5.5s5.5 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
  text: '<path d="M4 6h16M4 11h16M4 16h10"/>',
  quote: '<path d="M7 7h4v4c0 3-1.5 5-4 6M14 7h4v4c0 3-1.5 5-4 6"/>',
  image: '<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m20.5 16-5-5-8 8"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  money: '<rect x="2.5" y="6" width="19" height="12" rx="2.5"/><circle cx="12" cy="12" r="2.5"/>',
  crown: '<path d="M3 8l4.5 4L12 5l4.5 7L21 8l-2 11H5z"/>',
  tag: '<path d="M3 12V4h8l10 10-8 8z"/><circle cx="7.5" cy="8.5" r="1.3"/>',
  page: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  alert: '<circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16h.01"/>',
  done: '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.8 2.8L16 10"/>'
};
const ic = (k, s = 16, w = 1.7) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[k]}</svg>`;
const IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
const SAVE_KEY = IS_MAC ? '⌘↵' : 'Ctrl ↵';
const NEXT_KEY = IS_MAC ? '⇧⌘↵' : 'Ctrl ⇧ ↵';
const LINK_RX = /^https?:\/\/\S+\.\S+/i;
const nights = n => `${n} ${n === 1 ? 'night' : 'nights'}`;
const people = (o = {}) => MEMBERS.map(m => ({ v: m.id, l: m.short })).filter(x => !o.except || x.v !== o.except);
const personOptions = ({ blank } = {}) => (blank ? [{ v: '', l: blank }] : []).concat(people());

// The Trip Terms & Conditions. Jakub's legal department; add new paragraphs at the end.
const TERMS = [
  'Whoever writes “sure, I’m coming” is coming. Exceptions require a general assembly. Nikol holds a permanent exception.',
  'Photos are shared with “Anyone with the link”. Ignorance of sharing settings is no excuse.',
  'The crown may also be accepted by letter (precedent: Júlia, autumn 2026).',
  'Receipts go in within 7 days. After that, you paid for it yourself and were happy to.',
  'What happens at the cottage stays at the cottage, except for the photos, see § 2.',
  'Whoever survived JAMU together will survive a weekend in the woods too. No appeal is possible.'
];
const termsHtml = () => `
  <div class="sh-terms">By creating a trip you accept the <button type="button" class="linkish" data-sh="terms" aria-expanded="false">Trip Terms &amp; Conditions</button>.
    <div class="terms-doc" hidden>
      <h3>Trip Terms &amp; Conditions of the Společenstvo Inscenace</h3>
      <p class="sub">Drafted by Jakub Julina, legal department. Nobody has read them. Binding all the same.</p>
      <ol>${TERMS.map((t, i) => `<li><b>§ ${i + 1}</b><span>${esc(t)}</span></li>`).join('')}</ol>
      <p class="sign">Brno, 1 November 2026 · J. J., legal dept.</p>
    </div>
  </div>`;

function fieldHtml(f) {
  const id = 'sh-' + f.key;
  const ph = f.placeholder ? ` placeholder="${esc(f.placeholder)}"` : '';
  let ctl = '';
  if (f.type === 'select') {
    ctl = `<select class="in" id="${id}" data-k="${f.key}">${f.options.map(o => `<option value="${esc(o.v)}" ${String(o.v) === String(f.value ?? '') ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
  } else if (f.type === 'area') {
    ctl = `<textarea class="in" id="${id}" data-k="${f.key}" rows="${f.rows || 3}"${ph}>${esc(f.value)}</textarea>`;
  } else if (f.type === 'date') {
    ctl = `<input class="in in-date" type="date" id="${id}" data-k="${f.key}" value="${esc(f.value)}">`;
  } else if (f.type === 'money') {
    ctl = `<div class="affix"><input class="in" id="${id}" data-k="${f.key}" inputmode="decimal" autocomplete="off" value="${esc(f.value)}" placeholder="0"><span>Kč</span></div>`;
  } else if (f.type === 'dates') {
    const v = f.value || {};
    ctl = `<div class="dates" ${v.vote ? 'hidden' : ''}>
        <input class="in" type="date" id="${id}" data-k="${f.key}" data-part="start" value="${esc(v.start)}" aria-label="From">
        <span class="dash" aria-hidden="true">–</span>
        <input class="in" type="date" data-k="${f.key}" data-part="end" value="${esc(v.end)}" aria-label="To">
      </div>
      ${f.vote ? `<p class="vote-note" ${v.vote ? '' : 'hidden'}>A date poll opens on the trip page. Everyone votes, you pick the winner.</p>
      <button type="button" class="switch-row" role="switch" aria-checked="${v.vote ? 'true' : 'false'}" data-k="${f.key}" data-part="vote"><span class="switch"><span class="knob"></span></span>Let the gang vote on the date</button>` : ''}`;
  } else if (f.type === 'people') {
    const sel = f.value || [];
    ctl = `<div class="pchips" role="group" aria-label="${esc(f.label)}" id="${id}" data-k="${f.key}">${MEMBERS.map(m => `
        <button type="button" class="pchip" data-id="${m.id}" aria-pressed="${sel.includes(m.id)}">${avatar(m.id, 'xs')}<span>${esc(m.short)}</span></button>`).join('')}</div>
      <div class="pchips-meta"><span class="num" data-count></span><button type="button" class="linkish" data-sh="all" data-k="${f.key}"></button></div>`;
  } else {
    const url = f.type === 'link';
    ctl = `<input class="in" id="${id}" data-k="${f.key}" type="${url ? 'url' : 'text'}" ${url ? 'inputmode="url"' : ''} autocomplete="off" value="${esc(f.value)}"${ph}>`;
  }
  return `
    <div class="prop" data-field="${f.key}">
      <label class="p-label" for="${id}">${ic(f.icon || 'text')}<span>${esc(f.label)}</span></label>
      <div class="p-val">${ctl}<p class="msg" data-msg="${f.key}" hidden></p></div>
    </div>`;
}

let sheetCtx = null;
function openSheet(cfg) {
  closeModal();
  const key = cfg.draft ? 'jamu-draft:' + cfg.draft : null;
  let draft = null;
  if (key && !cfg.fresh) { try { draft = JSON.parse(ls.get(key) || 'null'); } catch { draft = null; } }
  const fields = cfg.fields.map(f => ({ ...f, value: draft && f.key in draft ? draft[f.key] : f.value }));
  const titleVal = draft && 'title' in draft ? draft.title : (cfg.title || '');

  const bg = document.createElement('div');
  bg.className = 'modal-bg sheet-bg';
  bg.innerHTML = `
  <div class="sheet-win" role="dialog" aria-modal="true" aria-labelledby="sh-title" tabindex="-1">
    <div class="grab" aria-hidden="true"></div>
    <div class="sh-head">
      <span class="sh-kind"><span class="sh-kind-ic">${ic(cfg.kindIcon || 'plus', 12, 2.4)}</span><span>${esc(cfg.eyebrow)}</span></span>
      <span class="sh-status" aria-live="polite"><span class="dot"></span><span data-status></span></span>
      <button type="button" class="icon-btn" data-sh="close" aria-label="Close">${ic('x', 16, 2)}</button>
    </div>
    <form class="sh-form" novalidate>
      <div class="sh-title">
        ${cfg.heading
          ? `<h2 id="sh-title" class="t-static">${esc(cfg.heading)}</h2>`
          : `<input id="sh-title" class="t-in" data-k="title" autocomplete="off" value="${esc(titleVal)}" placeholder="${esc(cfg.titlePh)}" aria-label="${esc(cfg.titlePh)}">`}
        <p class="msg" data-msg="title" hidden></p>
        ${cfg.lead ? `<p class="sh-lead">${esc(cfg.lead)}</p>` : ''}
        <div class="orn" aria-hidden="true"><span></span><i></i><span></span></div>
      </div>
      ${cfg.flash ? `<p class="sh-flash">${ic('check', 14, 2.2)}<span>${esc(cfg.flash)}</span></p>` : ''}
      <div class="sh-body">${fields.map(fieldHtml).join('')}${cfg.terms ? termsHtml() : ''}</div>
      <div class="sh-foot">
        <div class="keys"><span><kbd>Esc</kbd> close</span></div>
        <div class="fix" hidden></div>
        <button type="button" class="btn ghost" data-sh="close">Cancel</button>
        ${cfg.next ? `<button type="button" class="btn" data-sh="next" title="${NEXT_KEY}">${esc(cfg.next)}</button>` : ''}
        <button type="submit" class="btn primary${cfg.gold ? ' gold' : ''}">${esc(cfg.primary)}<kbd>${SAVE_KEY}</kbd></button>
      </div>
    </form>
  </div>`;
  document.body.appendChild(bg);
  document.body.classList.add('has-sheet');
  const sheet = $('.sheet-win', bg), form = $('form', bg);
  const ctx = sheetCtx = { cfg, key, fields, bg, sheet, form, timer: null, busy: false };
  const fieldEl = k => $(`[data-field="${k}"]`, form);

  const read = () => {
    const v = {};
    if (!cfg.heading) v.title = $('#sh-title', form).value.trim();
    for (const f of fields) {
      const el = fieldEl(f.key);
      if (f.type === 'people') v[f.key] = $$('.pchip[aria-pressed="true"]', el).map(b => b.dataset.id);
      else if (f.type === 'dates') {
        const vote = $('[data-part="vote"]', el)?.getAttribute('aria-checked') === 'true';
        v[f.key] = { start: vote ? '' : $('[data-part="start"]', el).value, end: vote ? '' : $('[data-part="end"]', el).value, vote };
      } else v[f.key] = $('[data-k]', el).value.trim();
    }
    return v;
  };
  ctx.read = read;
  const initial = JSON.stringify((() => { const v = read(); return v; })());
  ctx.dirty = () => JSON.stringify(read()) !== initial || !!draft;

  const setStatus = (s) => {
    const map = { new: ['Not saved yet', ''], saving: ['Saving draft…', 'saving'], saved: ['Draft saved', 'saved'], restored: ['Draft restored', 'saved'], sending: ['Saving…', 'saving'] };
    const [t, cls] = map[s] || map.new;
    $('[data-status]', bg).textContent = tr(t);
    $('.sh-status .dot', bg).className = 'dot ' + cls;
  };
  setStatus(draft ? 'restored' : 'new');

  const setMsg = (k, kind, text) => {
    const p = $(`[data-msg="${k}"]`, form); if (!p) return;
    const wrap = k === 'title' ? $('.sh-title', form) : fieldEl(k);
    wrap.classList.toggle('has-err', kind === 'err');
    if (!text) { p.hidden = true; p.innerHTML = ''; return; }
    p.hidden = false; p.className = 'msg' + (kind === 'err' ? ' err' : kind === 'ok' ? ' ok' : '');
    p.innerHTML = (kind === 'err' ? ic('alert', 14, 2) : kind === 'ok' ? ic('check', 14, 2.2) : '') + `<span>${esc(tr(text))}</span>`;
  };
  const errors = {};
  const check = (f, v) => (f.check ? f.check(v[f.key], v) : '') || '';
  const refresh = (k) => {
    const v = read();
    for (const f of fields) {
      if (k && f.key !== k && !(f.watch || []).includes(k)) continue;
      const el = fieldEl(f.key);
      if (f.type === 'people') {
        const n = v[f.key].length;
        $('[data-count]', el).textContent = tr(`${n} of ${MEMBERS.length}`);
        $('[data-sh="all"]', el).textContent = tr(n === MEMBERS.length ? 'Clear' : 'Select everyone');
      }
      if (f.type === 'dates') {
        const vote = v[f.key].vote;
        $('.dates', el).hidden = vote;
        const note = $('.vote-note', el); if (note) note.hidden = !vote;
      }
      if (errors[f.key]) { setMsg(f.key, 'err', errors[f.key]); continue; }
      const live = f.live ? f.live(v[f.key], v) : null;
      if (live && live.ok) setMsg(f.key, 'ok', live.ok);
      else setMsg(f.key, '', (live && live.hint) || f.hint || '');
    }
    const n = Object.keys(errors).length;
    const fix = $('.fix', form); fix.hidden = !n; $('.keys', form).hidden = !!n;
    fix.textContent = tr(n === 1 ? '1 thing to fix' : `${n} things to fix`);
  };
  refresh();

  const touch = (k) => {
    if (k && errors[k]) { delete errors[k]; }
    refresh(k);
    if (!key) return;
    setStatus('saving');
    clearTimeout(ctx.timer);
    ctx.timer = setTimeout(() => { ls.set(key, JSON.stringify(read())); setStatus('saved'); }, 600);
  };
  const validate = (k) => {
    const v = read();
    for (const f of fields) {
      if (k && f.key !== k) continue;
      const e = check(f, v); if (e) errors[f.key] = e; else delete errors[f.key];
    }
    refresh(k);
  };

  form.addEventListener('input', e => { const k = e.target.closest('[data-field]')?.dataset.field || (e.target.id === 'sh-title' ? 'title' : null); if (k === 'title') setMsg('title', '', ''); touch(k); });
  form.addEventListener('change', e => { const k = e.target.closest('[data-field]')?.dataset.field; if (k) touch(k); });
  form.addEventListener('focusout', e => {
    const k = e.target.closest('[data-field]')?.dataset.field; if (!k) return;
    const f = fields.find(x => x.key === k);
    if (f && f.type !== 'people' && e.target.matches('input')) {
      const v = read(); const val = v[k];
      const empty = f.type === 'dates' ? !(val.start || val.end) : !val;
      if (!empty) validate(k);
    }
  });
  bg.addEventListener('click', e => {
    if (e.target === bg) return closeSheet();
    const chip = e.target.closest('.pchip');
    if (chip) { chip.setAttribute('aria-pressed', chip.getAttribute('aria-pressed') === 'true' ? 'false' : 'true'); return touch(chip.closest('[data-field]').dataset.field); }
    const b = e.target.closest('[data-sh], [data-part="vote"]'); if (!b) return;
    if (b.dataset.part === 'vote') { b.setAttribute('aria-checked', b.getAttribute('aria-checked') === 'true' ? 'false' : 'true'); return touch(b.dataset.k); }
    const a = b.dataset.sh;
    if (a === 'close') return closeSheet();
    if (a === 'next') return submitSheet(true);
    if (a === 'all') {
      const el = fieldEl(b.dataset.k); const chips = $$('.pchip', el);
      const all = chips.every(c => c.getAttribute('aria-pressed') === 'true');
      chips.forEach(c => c.setAttribute('aria-pressed', all ? 'false' : 'true'));
      return touch(b.dataset.k);
    }
    if (a === 'terms') {
      const doc = $('.terms-doc', form); doc.hidden = !doc.hidden; b.setAttribute('aria-expanded', String(!doc.hidden));
      if (!doc.hidden) doc.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });
  bg.addEventListener('keydown', e => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); return closeSheet(); }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); return submitSheet(!!(e.shiftKey && cfg.next)); }
  });
  form.addEventListener('submit', e => { e.preventDefault(); submitSheet(false); });

  ctx.submit = async (next) => {
    if (ctx.busy) return;
    const v = read();
    for (const k of Object.keys(errors)) delete errors[k];
    if (!cfg.heading && cfg.titleRequired !== false && !v.title) { setMsg('title', 'err', cfg.titleErr || 'Give it a name first.'); errors.title = 1; }
    else setMsg('title', '', '');
    for (const f of fields) { const er = check(f, v); if (er) errors[f.key] = er; }
    refresh();
    if (Object.keys(errors).length) {
      const first = errors.title ? $('#sh-title', form) : $('[data-field].has-err input, [data-field].has-err select, [data-field].has-err textarea, [data-field].has-err button', form);
      first?.focus();
      return;
    }
    ctx.busy = true; setStatus('sending');
    $$('.sh-foot .btn', form).forEach(b => { b.disabled = true; });
    try {
      clearTimeout(ctx.timer);
      await cfg.onSave(v, { next });
      if (key) ls.del(key);
      if (next) {
        const keep = {}; (cfg.keepOnNext || []).forEach(k => { keep[k] = v[k]; });
        openSheet({ ...cfg, fresh: true, title: '', fields: cfg.fields.map(f => (f.key in keep ? { ...f, value: keep[f.key] } : f)), flash: 'Added. Next one?' });
        $('#sh-title')?.focus();
        return;
      }
      removeSheet();
    } catch (err) {
      console.error(err);
      toast('That didn’t save: ' + (err.message || 'unknown error') + '. Try again?');
      ctx.busy = false; setStatus(key ? 'saved' : 'new');
      $$('.sh-foot .btn', form).forEach(b => { b.disabled = false; });
    }
  };

  translateDOM(bg);
  const focusEl = cfg.heading ? $('input, select, textarea', form) : $('#sh-title', form);
  (focusEl || sheet).focus({ preventScroll: true });
  if (focusEl && focusEl.setSelectionRange && focusEl.value) { const n = focusEl.value.length; try { focusEl.setSelectionRange(n, n); } catch { /* date inputs */ } }
}
function submitSheet(next) { if (sheetCtx) sheetCtx.submit(next); }
function removeSheet() {
  if (!sheetCtx) return;
  clearTimeout(sheetCtx.timer);
  sheetCtx.bg.remove(); sheetCtx = null;
  document.body.classList.remove('has-sheet');
}
function closeSheet() {
  const ctx = sheetCtx; if (!ctx) return;
  const dirty = ctx.key && ctx.dirty();
  if (ctx.key) { if (dirty) ls.set(ctx.key, JSON.stringify(ctx.read())); else ls.del(ctx.key); }
  removeSheet();
  if (dirty) toast('Draft kept. Carry on from the same button any time.');
}

/* ---- field checks shared by several windows ---- */
const chk = {
  dates: (required) => (v) => {
    if (v.vote) return '';
    if (required && !v.start) return 'Pick at least the first day.';
    if (v.start && v.end && v.end < v.start) return 'The trip ends before it starts. So far only Nikol has managed that.';
    return '';
  },
  link: (required) => (v) => (!v ? (required ? 'Paste the link first.' : '') : LINK_RX.test(v) ? '' : 'That doesn’t look like a link yet. It should start with https://'),
  money: (v) => (!v ? 'How much was it?' : /^\d+([.,]\d{1,2})?$/.test(v.replace(/\s/g, '')) && parseFloat(v.replace(/\s/g, '').replace(',', '.')) > 0 ? '' : 'Just the number, e.g. 1250.'),
  someone: (v) => (v && v.length ? '' : 'Pick at least one person.'),
  required: (msg) => (v) => (v ? '' : msg)
};
const live = {
  dates: (v) => {
    if (v.vote || !v.start || !v.end || v.end < v.start) return null;
    const n = Math.round((parseDate(v.end) - parseDate(v.start)) / 864e5);
    return { hint: `${fmtRange(v.start, v.end)} · ${tr(nights(n))}` };
  },
  link: (v) => (!v || !LINK_RX.test(v) ? null
    : /drive\.google\./i.test(v) ? { ok: 'Google Drive folder. One click and everyone sees the photos.' }
    : /photos\.(app\.goo\.gl|google\.)/i.test(v) ? { ok: 'Google Photos album. One click and everyone sees the photos.' }
    : { ok: 'Link looks good.' }),
  coming: (v) => (!v.length ? { hint: 'A trip with nobody on it. Bold.' } : v.includes('nikol') ? { hint: 'Nikol came? Then this also belongs on the timeline as a milestone.' } : null)
};
const SHARE_HINT = 'I’m sure I don’t have to tell you, but… is the folder shared with “Anyone with the link”? 😉';

/* ---- the windows ---- */
function tripSheet(t0, mode, preset = {}) {
  const past = mode === 'past';
  const t = t0 || (preset.title ? preset : null);
  const fields = [
    { key: 'organiser', type: 'select', icon: 'person', label: 'Organiser', options: personOptions(), value: t?.organiser || preset.organiser || court().ruler, hint: !t && !past ? 'Defaults to whoever wears the crown.' : '' },
    { key: 'when', type: 'dates', icon: 'cal', label: 'When', vote: !past && !t, value: { start: t?.start || '', end: t?.end || '', vote: !past && !t }, check: chk.dates(past), live: live.dates },
    { key: 'place', type: 'text', icon: 'pin', label: 'Where', value: t?.place || '', placeholder: 'Name of the cottage' }
  ];
  if (!past) fields.push(
    { key: 'address', type: 'text', icon: 'route', label: 'Address', value: t?.address || '', placeholder: 'Street, number, town', hint: 'We add the car route and a Maps link for you.' },
    { key: 'notes', type: 'area', icon: 'text', label: 'Good to know', value: t?.notes || '', placeholder: 'What to bring, who drives, keys, check-in…' });
  else fields.push(
    { key: 'crowned', type: 'select', icon: 'crown', label: 'Crowned at the end', options: personOptions({ blank: 'Not decided' }), value: t?.crowned || '' },
    { key: 'attendees', type: 'people', icon: 'people', label: 'Who came', value: t?.attendees || MEMBERS.map(m => m.id), live: live.coming },
    { key: 'photos_url', type: 'link', icon: 'image', label: 'Photos', value: t?.photos_url || '', placeholder: 'Paste a Google Drive or Google Photos link', hint: SHARE_HINT, check: chk.link(false), live: live.link },
    { key: 'story', type: 'area', icon: 'text', label: 'The story', value: t?.story || '', placeholder: 'A few sentences. What will we still laugh about in ten years?' },
    { key: 'quotes', type: 'area', icon: 'quote', label: 'Quotes', rows: 2, value: t?.quotes || '', placeholder: 'One per line. “Has anyone seen Nikol?”' });
  return {
    eyebrow: t0 ? 'Edit trip' : past ? 'Past trip for the archive' : 'New trip file',
    kindIcon: t0 ? 'text' : 'plus',
    titlePh: past ? 'Which trip was it?' : 'Name the trip', title: t?.title || '',
    primary: t0 ? 'Save changes' : past ? 'Add to archive' : 'Create trip file',
    terms: !t && !past,
    draft: t0 ? 'trip-' + t0.id : preset.relics ? 'prepared-' + preset.relics : past ? 'past-trip' : 'new-trip',
    fields,
    toTrip: v => {
      const d = { title: v.title, organiser: v.organiser, place: v.place, start: v.when.start, end: v.when.end || v.when.start };
      if (!d.start) d.end = '';
      if (past) Object.assign(d, { crowned: v.crowned, attendees: v.attendees, photos_url: v.photos_url, story: v.story, quotes: v.quotes });
      if (!t0 && preset.relics) d.relics = preset.relics;
      else Object.assign(d, { address: v.address, notes: v.notes });
      return d;
    }
  };
}

function wrapSheet(t) {
  const c = court();
  const coming = Object.entries(t.rsvp || {}).filter(([, v]) => v === 'yes').map(([k]) => k);
  return {
    eyebrow: 'The crowning ceremony', kindIcon: 'crown', heading: t.title || 'Untitled trip',
    lead: `This moves “${t.title}” to the archive and hands over the crown. Photos and expenses come next.`,
    primary: 'Long live the new monarch!', gold: true, draft: 'wrap-' + t.id,
    fields: [
      { key: 'when', type: 'dates', icon: 'cal', label: 'When', value: { start: t.start || '', end: t.end || '' }, check: chk.dates(true), live: live.dates },
      { key: 'attendees', type: 'people', icon: 'people', label: 'Who actually came', value: coming, live: live.coming },
      { key: 'crowned', type: 'select', icon: 'crown', label: 'New monarch', options: personOptions({ blank: 'Choose…' }), value: c.heir && c.heir !== t.organiser ? c.heir : '', hint: 'Plans the next trip.', check: chk.required('Someone has to wear the crown.') },
      { key: 'heir', type: 'select', icon: 'person', label: 'Heir after them', options: personOptions({ blank: 'Not decided' }), value: '' }
    ]
  };
}

function msSheet(m) {
  return {
    eyebrow: m ? 'Edit milestone' : 'New milestone', kindIcon: m ? 'text' : 'plus',
    titlePh: 'What happened?', title: m?.title || '', primary: m ? 'Save changes' : 'Add milestone',
    draft: m ? 'ms-' + m.id : 'new-ms',
    fields: [
      { key: 'date', type: 'date', icon: 'cal', label: 'Date', value: m?.date || new Date().toISOString().slice(0, 10), check: chk.required('When did it happen?') },
      { key: 'kind', type: 'select', icon: 'tag', label: 'Type', options: Object.entries(KINDS).map(([k, [l, i]]) => ({ v: k, l: `${i} ${tr(l)}` })), value: m?.kind || 'other' },
      { key: 'who', type: 'people', icon: 'people', label: 'Who', value: m?.who || [] },
      { key: 'label', type: 'text', icon: 'crown', label: 'Special label', value: m?.label || '', placeholder: 'First baby of the gang' },
      { key: 'note', type: 'area', icon: 'text', label: 'A few words', value: m?.note || '', placeholder: 'A line or two for the chronicle.' },
      { key: 'links', type: 'area', icon: 'link', label: 'Found online', rows: 2, value: (m?.links || []).map(l => (l.title ? l.title + ' | ' : '') + l.url).join('\n'), placeholder: 'Title | https://…', hint: 'One per line. Theses, articles, festival pages…' }
    ],
    toMs: v => ({ title: v.title, date: v.date, kind: v.kind, label: v.label, note: v.note, who: v.who, links: parseLinks(v.links) })
  };
}

function expSheet(t) {
  const att = t.attendees && t.attendees.length ? t.attendees : MEMBERS.map(m => m.id);
  const split = (v, all) => {
    const amt = parseFloat(String(v || '').replace(/\s/g, '').replace(',', '.'));
    const k = (all.split || []).length;
    return amt > 0 && k ? { hint: `${kc(amt / k)} each, split ${k} ways` } : null;
  };
  return {
    eyebrow: 'New expense', titlePh: 'What was it for?', titleErr: 'What was it for?',
    primary: 'Add expense', next: 'Add & next', keepOnNext: ['payer', 'split'], draft: 'exp-' + t.id,
    fields: [
      { key: 'amount', type: 'money', icon: 'money', label: 'Amount', value: '', check: chk.money, live: split, watch: ['split'] },
      { key: 'payer', type: 'select', icon: 'person', label: 'Paid by', options: personOptions(), value: me() || att[0] },
      { key: 'split', type: 'people', icon: 'people', label: 'Split between', value: att, check: chk.someone }
    ]
  };
}

function albumSheet(t) {
  return {
    eyebrow: 'Shared photo album', kindIcon: 'image', heading: t.title || 'Untitled trip',
    primary: 'Save link', draft: 'album-' + t.id,
    fields: [{ key: 'url', type: 'link', icon: 'link', label: 'Link', value: safeUrl(t.photos_url), placeholder: 'Paste a Google Drive or Google Photos link', hint: SHARE_HINT, check: chk.link(true), live: live.link }]
  };
}

function suggestSheet() {
  const here = route().startsWith('trip-') ? 'Archive' : (PAGE_NAMES[route()] || 'Home');
  return {
    eyebrow: 'Suggest an edit', kindIcon: 'text', heading: 'What should change?',
    lead: 'A typo, a wrong date, a missing joke or a new idea. Jakub sees every suggestion.',
    primary: 'Send suggestion', draft: 'suggest',
    fields: [
      { key: 'page', type: 'select', icon: 'page', label: 'Which page', options: Object.values(PAGE_NAMES).concat('Whole site / new idea').map(p => ({ v: p, l: tr(p) })), value: here },
      { key: 'text', type: 'area', icon: 'text', label: 'Your suggestion', rows: 4, value: '', placeholder: 'e.g. My nickname is spelled wrong. It should be…', check: chk.required('Write a few words first.') }
    ]
  };
}

const undo = rec => ({ label: 'Undo', run: async () => { await DB.remove(rec); await load(); render(); toast('Undone'); } });

/* ---------------- events ---------------- */
let pendingDelete = null;
document.addEventListener('click', async e => {
  const row = e.target.closest('tr[data-href]');
  if (row && !e.target.closest('a')) { location.hash = row.dataset.href; return; }
  const b = e.target.closest('[data-action]');
  if (!b) return;
  const a = b.dataset.action;
  const trip = id => S.trips.find(t => t.id === id);
  const opt = id => S.options.find(o => o.id === id);

  if (a === 'switch-me') return pickMe(true);
  if (a === 'logout') return logout();
  if (a === 'copy') {
    try { await navigator.clipboard.writeText(b.dataset.text); toast('Address copied'); }
    catch { const r = document.createRange(); const el = $('.addr'); if (el) { r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); } toast('Address selected. Press Ctrl+C to copy.'); }
    return;
  }
  if (a === 'new-plan') {
    const cfg = tripSheet(null, 'plan');
    return openSheet({ ...cfg, onSave: async v => {
      const rec = await DB.add('trips', { ...cfg.toTrip(v), status: 'planning', rsvp: {} });
      if (route() !== 'next') location.hash = '#next';
      await load(); render(); toast(v.when.vote ? 'Trip file created. Now propose some dates!' : 'Trip file created. The gang can see it now.', undo(rec));
    } });
  }
  if (a === 'add-past' || a === 'add-my-trip') {
    const m = me(); if (a === 'add-my-trip' && !m) return pickMe(true);
    const fresh = a === 'add-my-trip' && LAST_TRIP.organiser === m && !tripsBy(m).some(t => (t.start || '') >= LAST_TRIP.year);
    const cfg = tripSheet(null, 'past', fresh ? { title: LAST_TRIP.title, organiser: m, crowned: LAST_TRIP.crowned, start: '', end: LAST_TRIP.end, attendees: MEMBERS.map(x => x.id).filter(id => id !== LAST_TRIP.crowned) } : a === 'add-my-trip' ? { organiser: m } : {});
    return openSheet({ ...cfg, onSave: async v => {
      const rec = await DB.add('trips', { ...cfg.toTrip(v), status: 'done' });
      await load(); render(); toast(a === 'add-my-trip' ? 'Your reign is in the chronicle ♛' : 'Added to the archive.', undo(rec));
    } });
  }
  if (a === 'add-prepared') {
    const r = RELICS.find(x => x.id === b.dataset.relic); if (!r) return;
    const cfg = tripSheet(null, 'past', r.prepared);
    return openSheet({ ...cfg, flash: 'Filled in from the old emails and the Drive. Check who came and who got crowned.', onSave: async v => {
      const rec = await DB.add('trips', { ...cfg.toTrip(v), status: 'done' });
      await load(); render(); toast('Your reign is in the chronicle ♛', undo(rec));
    } });
  }
  if (a === 'relic-tab') {
    const box = b.closest('.drawer'); if (!box) return;
    $$('[data-action="relic-tab"]', box).forEach(x => x.setAttribute('aria-selected', String(x === b)));
    $$('.drawer-pane', box).forEach(x => { x.hidden = x.dataset.pane !== b.dataset.pane; });
    try { ls.set('jamu-drawer', b.dataset.pane); } catch {}
    return;
  }
  if (a === 'close-books') {
    const t = trip(b.dataset.trip); if (!t || me() !== t.organiser) return;
    const left = settle(S.expenses.filter(e => e.trip_id === t.id)).length;
    if (left && !b.dataset.sure) { b.dataset.sure = '1'; b.textContent = tr('Payments still open. Close anyway?'); return; }
    return act(async () => { await DB.update(t, { settled_at: new Date().toISOString() }); location.hash = '#trip-' + t.id; }, 'Books closed. The trip is in the archive ♛');
  }
  if (a === 'chronicle-done') {
    const m = me(); if (!m) return;
    return act(() => saveCourt({ chronicles: { ...chroniclesClosed(), [m]: true } }), 'Thank you. The chronicle is grateful ♛');
  }
  if (a === 'edit-trip') {
    const t = trip(b.dataset.trip); if (!t) return;
    const past = t.status === 'done';
    const cfg = tripSheet(t, past ? 'past' : 'plan');
    return openSheet({ ...cfg, onSave: async v => { await DB.update(t, cfg.toTrip(v)); await load(); render(); toast('Saved'); } });
  }
  if (a === 'vote') {
    const o = opt(b.dataset.opt); const m = me(); if (!o || !m) return;
    const votes = { ...(o.votes || {}) };
    if (votes[m] === b.dataset.val) delete votes[m]; else votes[m] = b.dataset.val;
    return act(() => DB.update(o, { votes }));
  }
  if (a === 'choose-date') {
    const o = opt(b.dataset.opt); const t = planning(); if (!o || !t) return;
    return act(() => DB.update(t, { start: o.start, end: o.end }), 'Date picked! The countdown has begun.');
  }
  if (a === 'del-opt') {
    const o = opt(b.dataset.opt); if (!o) return;
    if (pendingDelete !== o.id) { pendingDelete = o.id; b.textContent = tr('Sure?'); return; }
    pendingDelete = null;
    return act(() => DB.remove(o), 'Date removed');
  }
  if (a === 'scroll-roles') {
    e.preventDefault();
    if (route() !== 'next') { location.hash = '#next'; setTimeout(() => document.getElementById('roles')?.scrollIntoView({ behavior: 'smooth' }), 120); }
    else document.getElementById('roles')?.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  if (a === 'task-claim' || a === 'task-del') {
    const t = planning(); const m = me(); if (!t || !m) return;
    let tasks = tasksOf(t);
    const x = tasks.find(k => k.id === b.dataset.task); if (!x) return;
    if (a === 'task-del') {
      if (m !== t.organiser) return;
      if (pendingDelete !== x.id) { pendingDelete = x.id; b.textContent = tr('Sure?'); return; }
      pendingDelete = null;
      tasks = tasks.filter(k => k.id !== x.id);
      return act(() => DB.update(t, { tasks }), 'Task removed');
    }
    const taking = !x.who.includes(m);
    x.who = taking ? [...x.who, m] : x.who.filter(id => id !== m);
    return act(() => DB.update(t, { tasks }), taking ? 'It’s yours. Thank you!' : 'Task dropped. Someone else can take it.');
  }
  if (a === 'rsvp') {
    const t = planning(); if (!t) return;
    const rsvp = { ...(t.rsvp || {}) };
    const who = b.dataset.who, val = b.dataset.val;
    if (rsvp[who] === val) delete rsvp[who]; else rsvp[who] = val;
    const msg = who === 'nikol' && rsvp[who] === 'yes' ? 'Nikol says she’s coming. Bets are open on whether she arrives. 📸'
      : who === 'nikol' && rsvp[who] === 'love' ? 'As expected. We love you too, Nikol. 💌'
      : rsvp[who] === 'love' ? 'Love received. Absence noted. 💌' : null;
    return act(() => DB.update(t, { rsvp }), msg);
  }
  if (a === 'wrap-up') {
    const t = trip(b.dataset.trip); if (!t) return;
    return openSheet({ ...wrapSheet(t), onSave: async v => {
      const crowned = v.crowned, start = v.when.start;
      let end = v.when.end; if (!end || end < start) end = start;
      await DB.update(t, { status: 'done', start, end, attendees: v.attendees, crowned, done_at: new Date().toISOString() });
      await saveCourt({ ruler: crowned, heir: v.heir || '' });
      await load(); location.hash = '#after'; render();
      toast(`Long live ${member(crowned)?.name}! 👑`);
    } });
  }
  if (a === 'del-exp') {
    const x = S.expenses.find(z => z.id === b.dataset.exp); if (!x) return;
    return act(() => DB.remove(x), 'Expense deleted');
  }
  if (a === 'suggest') return openSheet({ ...suggestSheet(), onSave: async v => {
    await DB.add('suggestions', { page: v.page, text: v.text, by: me() || '', done: false });
    await load(); render(); toast('Thanks! Your suggestion is in.');
  } });
  if (a === 'add-exp') {
    const t = trip(b.dataset.trip); if (!t) return;
    return openSheet({ ...expSheet(t), onSave: async (v, { next }) => {
      const rec = await DB.add('expenses', { trip_id: t.id, what: v.title, amount: parseFloat(v.amount.replace(/\s/g, '').replace(',', '.')), payer: v.payer, split: v.split });
      await load(); render(); if (!next) toast('Expense added.', undo(rec));
    } });
  }
  if (a === 'album-link') {
    const t = trip(b.dataset.trip); if (!t) return;
    return openSheet({ ...albumSheet(t), onSave: async v => { await DB.update(t, { photos_url: v.url }); await load(); render(); toast('Photo link saved 📸'); } });
  }
  if (a === 'toggle-idea') {
    const s = S.suggestions.find(x => x.id === b.dataset.idea); if (!s) return;
    return act(() => DB.update(s, { done: !s.done }), s.done ? 'Reopened' : 'Marked as done');
  }
  if (a === 'del-idea') {
    const s = S.suggestions.find(x => x.id === b.dataset.idea); if (!s) return;
    if (pendingDelete !== s.id) { pendingDelete = s.id; b.textContent = tr('Sure?'); return; }
    pendingDelete = null;
    return act(() => DB.remove(s), 'Suggestion deleted');
  }
  if (a === 'add-ms') {
    const cfg = msSheet(null);
    return openSheet({ ...cfg, onSave: async v => {
      const rec = await DB.add('milestones', cfg.toMs(v));
      if (route() !== 'timeline') location.hash = '#timeline';
      await load(); render(); toast('Added to the timeline', undo(rec));
    } });
  }
  if (a === 'edit-ms') {
    const m = S.milestones.find(x => x.id === b.dataset.ms); if (!m) return;
    const cfg = msSheet(m);
    return openSheet({ ...cfg, onSave: async v => { await DB.update(m, cfg.toMs(v)); await load(); render(); toast('Saved'); } });
  }
  if (a === 'del-ms') {
    const m = S.milestones.find(x => x.id === b.dataset.ms); if (!m) return;
    if (pendingDelete !== m.id) { pendingDelete = m.id; b.textContent = tr('Sure?'); return; }
    pendingDelete = null;
    return act(() => DB.remove(m), 'Milestone deleted');
  }
  if (a === 'scroll') { const el = document.getElementById(b.dataset.to); el?.scrollIntoView({ behavior: 'smooth', block: 'center' }); el?.querySelector('input')?.focus({ preventScroll: true }); return; }
  if (a === 'view-photo') return openViewer(b.dataset.trip, Number(b.dataset.i));
  if (a === 'share-photos') {
    // Jump to the trip and open the photo picker straight away (still inside the tap).
    history.replaceState(null, '', '#trip-' + b.dataset.trip);
    render();
    $('#photos')?.scrollIntoView({ block: 'start' });
    $('#photo-input')?.click();
    return;
  }
  if (a === 'del-trip') {
    const t = trip(b.dataset.trip); if (!t) return;
    if (pendingDelete !== t.id) { pendingDelete = t.id; b.textContent = tr('Click again to delete it for good'); return; }
    pendingDelete = null;
    const kids = [...S.options, ...S.expenses, ...S.photos].filter(o => o.trip_id === t.id);
    if (LIVE) { const paths = S.photos.filter(p => p.trip_id === t.id).map(p => p.path); if (paths.length) await sb.storage.from('photos').remove(paths); }
    return act(async () => { for (const k of kids) await DB.remove(k); await DB.remove(t); location.hash = '#archive'; }, 'Trip deleted. It is no longer with us. 🕯️');
  }
});

document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id === 'opt-form') {
    e.preventDefault();
    const t = planning(); if (!t) return;
    const fd = new FormData(f);
    const start = String(fd.get('start')); let end = String(fd.get('end') || '');
    if (!end || end < start) end = start;
    return act(() => DB.add('date_options', { trip_id: t.id, start, end, votes: me() ? { [me()]: 'yes' } : {} }), 'Dates proposed');
  }
  if (f.id === 'task-form') {
    e.preventDefault();
    const t = planning(); if (!t) return;
    const label = String(new FormData(f).get('label') || '').trim(); if (!label) return;
    const tasks = [...tasksOf(t), { id: uid(), label, who: [] }];
    return act(() => DB.update(t, { tasks }), 'Task added');
  }
});

/* ---------------- render ---------------- */
function render() {
  const r = route();
  let active = r, html;
  if (r.startsWith('trip-')) { active = 'archive'; html = viewTrip(S.trips.find(t => t.id === r.slice(5))); }
  else if (r === 'gang') html = viewGang();
  else if (r === 'next') html = viewNext();
  else if (r === 'archive') html = viewArchive();
  else if (r === 'after') html = viewAfter();
  else if (r === 'timeline') html = viewTimeline();
  else if (r === 'ideas') html = viewIdeas();
  else { active = 'home'; html = viewHome(); }
  document.title = tr((PAGE_NAMES[active] && active !== 'home' ? PAGE_NAMES[active] + ' · ' : '') + 'Společenstvo Inscenace');
  document.documentElement.lang = lang();
  app.innerHTML = shell(active, html);
  translateDOM(app);
  hydratePhotos().catch(e => console.error(e));
}
window.addEventListener('hashchange', () => { pendingDelete = null; if ($('.top')) { render(); window.scrollTo(0, 0); } });

async function start() {
  if (!(await isLoggedIn())) return renderLogin();
  app.innerHTML = '<div class="loading">Loading… (still faster than the JAMU information system)</div>';
  translateDOM(app);
  try { await load(); }
  catch (e) {
    console.error(e);
    app.innerHTML = `<div class="wrap loading"><p>Couldn’t reach the database: ${esc(e.message)}</p><p><button class="btn" type="button" data-action="logout">Log out and try again</button></p></div>`;
    translateDOM(app);
    return;
  }
  render();
  pickMe();
}
start();
})();
