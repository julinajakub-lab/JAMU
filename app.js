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
function fmtDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString(locale(), { day: 'numeric', month: lang() === 'cs' ? 'long' : 'short', year: 'numeric' }) : ''; }
function fmtRange(a, b) {
  const s = parseDate(a), e = parseDate(b);
  if (!s) return tr('Date not set');
  if (!e || a === b) return fmtDate(a);
  if (lang() === 'cs') {
    const dm = d => d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'long' });
    if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${s.getDate()}.–${fmtDate(b)}`;
    if (s.getFullYear() === e.getFullYear()) return `${dm(s)} – ${fmtDate(b)}`;
    return `${fmtDate(a)} – ${fmtDate(b)}`;
  }
  const day = d => d.getDate(), mon = d => d.toLocaleDateString('en-GB', { month: 'short' });
  if (s.getFullYear() === e.getFullYear() && s.getMonth() === e.getMonth()) return `${day(s)}–${day(e)} ${mon(e)} ${e.getFullYear()}`;
  if (s.getFullYear() === e.getFullYear()) return `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)} ${e.getFullYear()}`;
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
function memberOptions(selected, { blank = false } = {}) {
  return (blank ? `<option value="">— not decided —</option>` : '') +
    MEMBERS.map(m => `<option value="${m.id}" ${m.id === selected ? 'selected' : ''}>${esc(m.name)}${m.nick ? ' · ' + esc(m.nick) : ''}</option>`).join('');
}
function memberChecks(name, checked = []) {
  return `<div class="checks">${MEMBERS.map(m => `
    <label class="check"><input type="checkbox" name="${name}" value="${m.id}" ${checked.includes(m.id) ? 'checked' : ''}>${esc(m.short)}${m.id === 'nikol' ? ' <span class="muted">(really?)</span>' : ''}</label>`).join('')}</div>`;
}

let toastTimer;
function toast(msg) {
  let t = $('.toast');
  if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
  t.textContent = tr(msg); t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
}

/* ---------------- languages ---------------- */
// The page is written in English and translated after rendering. Czech texts live in i18n-cs.js.
// {sk|cz} in a translation shows the Slovak word with a small ⓘ that reveals the Czech one.
const I18N = window.JAMU_I18N || {};
const lang = () => { const l = ls.get('jamu-lang'); return l === 'en' || !I18N.cs ? 'en' : 'cs'; };
const locale = () => (lang() === 'cs' ? 'cs-CZ' : 'en-GB');
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
function langSwitch() {
  return `<button class="lang" type="button" data-action="lang" title="Language / Jazyk" data-notr>${lang() === 'cs' ? '<b>CZ</b> · EN' : 'CZ · <b>EN</b>'}</button>`;
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
    { id: t, collection: 'trips', created_at: now, status: 'planning', title: 'Spring cottage weekend (example)', organiser: 'ladislav',
      place: 'Chata u Lesa (example)', address: 'Hlubočky 123, 783 61 Hlubočky', notes: 'Bring: slippers, a towel, a dish to share.\nKeys are under the gnome.', rsvp: { ladislav: 'yes', julia: 'yes', jakub: 'yes', nikol: 'love', sylvie: 'maybe', michaela: 'yes' } },
    { id: o1, collection: 'date_options', created_at: now, trip_id: t, start: fri(4, 17), end: fri(4, 19), votes: { ladislav: 'yes', julia: 'yes', jakub: 'maybe', nikol: 'yes', michaela: 'yes' } },
    { id: o2, collection: 'date_options', created_at: now, trip_id: t, start: fri(4, 24), end: fri(4, 26), votes: { ladislav: 'yes', julia: 'no', jakub: 'yes', sylvie: 'yes', adam: 'yes', viktoria: 'yes' } },
    { id: o3, collection: 'date_options', created_at: now, trip_id: t, start: fri(5, 8), end: fri(5, 10), votes: { ladislav: 'maybe', alzbeta: 'yes' } },
    { id: uid(), collection: 'milestones', created_at: now, date: `${y - 1}-06-12`, who: ['michaela'], kind: 'baby', title: 'Míša’s baby is born (example)', label: 'First baby of the gang', note: 'Replace this example with the real date.' },
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
      <div class="login-lang">${langSwitch()}</div>
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
      const { error } = await sb.auth.signInWithPassword({ email: C.groupEmail, password: pw });
      ok = !error;
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
function closeModal() { $$('.modal-bg').forEach(m => m.remove()); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && me()) closeModal(); });

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
      ${langSwitch()}
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
  const last = doneTrips()[0];
  const items = [];
  const add = (text, btn) => items.push(`<li class="todo"><span>${text}</span>${btn}</li>`);
  if (!m) add('First, tell the site who you are, so your votes and photos get your name.', `<button class="btn primary sm" type="button" data-action="switch-me">Pick my name</button>`);
  if (plan) {
    const opts = S.options.filter(o => o.trip_id === plan.id);
    if (!plan.start && opts.length && m && !opts.some(o => (o.votes || {})[m])) add(`We’re choosing dates for <b>${esc(plan.title)}</b>. Which weekends work for you?`, `<a class="btn primary sm" href="#next">Vote on dates</a>`);
    if (m && !(plan.rsvp || {})[m]) add(`Are you coming to <b>${esc(plan.title)}</b>?`, `<a class="btn primary sm" href="#next">Answer</a>`);
  } else if (m && m === court().ruler) {
    add('You’re the reigning monarch, so the next trip is yours to plan. Start with the cottage and a few date options.', `<button class="btn primary sm" type="button" data-action="new-plan">Plan the next trip</button>`);
  }
  if (last) {
    add(`Do you have nice photos from <b>${esc(last.title)}</b>? Share them with everyone.`, `<button class="btn primary sm" type="button" data-action="share-photos" data-trip="${last.id}">Share photos</button>`);
    add(`Did you pay for something on <b>${esc(last.title)}</b>? Add it and the page works out who owes whom.`, `<a class="btn sm" href="#trip-${esc(last.id)}">Add an expense</a>`);
  } else {
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
  const years = new Date().getFullYear() - 2016;
  const nikolCame = done.filter(t => (t.attendees || []).includes('nikol')).length;
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
      <p class="eyebrow">Welcome, gang</p>
      <div class="letter-body">
        <p>This is our own little corner of the internet.</p>
        <p>We met at JAMU in 2016, survived more deadlines than anyone should (and one whole international festival), and somewhere along the way became family. School brought us together. What we share keeps us there: new jobs and new homes, babies, worries, big questions about the world and small ones about dinner. Every time we sit at a cottage table, someone says “we should write this down”. So here it is: one place for everything that holds us together.</p>
        <ul class="letter-list">
          <li><a href="#next"><b>Plan the next trip.</b></a> Vote on dates, say if you’re coming, and find the cottage with one tap.</li>
          <li><a href="#archive"><b>Remember the old ones.</b></a> Every trip with its photos, stories and the quotes we’ll never live down.</li>
          <li><a href="#after"><b>Settle up without awkward messages.</b></a> Log who paid for what and the page works out who owes whom.</li>
        </ul>
        <p>It’s ours, so make it better. If something is missing or wrong, press “Suggest an edit” in the corner.</p>
        <p class="signature">Built for us with <span class="heart">♥</span><br><span>Jakub (Honza Peniz)</span></p>
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
        <div class="kpi"><b>${years}</b><span class="muted small">years since we survived JAMU</span></div>
        <div class="kpi"><b>${done.filter(t => t.crowned).length}</b><span class="muted small">crowns handed over</span></div>
        <div class="kpi"><b>${nikolCame}/${done.length}</b><span class="muted small">trips Nikol arrived at</span></div>
      </div>
    </section>

    <section class="stack quote-block" style="gap:8px">
      <p class="eyebrow">Overheard at a cottage</p>
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
      <li><b>Get there</b><span>On the day, tap \u201cNavigate\u201d and your phone takes you to the cottage.</span></li>
      <li><b>Wrap it up</b><span>Back home, press the button at the bottom to crown the next monarch and share photos.</span></li>
    </ol>

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
      <p>Every trip we\u2019ve taken. Open one to see its photos, stories and who paid for what. Remember a trip that isn\u2019t here yet? Add it.</p>
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
  </div>`;
}
function tripRow(t) {
  const href = '#trip-' + esc(t.id);
  return `
  <tr data-href="${href}">
    <td class="date">${esc(fmtRange(t.start, t.end))}</td>
    <td><a class="trip-link" href="${href}">${esc(t.title || 'Untitled trip')}</a>${t.place ? `<br><span class="muted small">${esc(t.place)}</span>` : ''}</td>
    <td class="small"><span class="crown">♛</span> ${esc(nameOf(t.organiser))}${t.crowned ? ` <span class="muted">→ ${esc(nameOf(t.crowned))}</span>` : ''}</td>
    <td><div class="row" style="gap:6px"><div class="av-row">${(t.attendees || []).map(id => avatar(id, 'xs')).join('')}</div>${(t.attendees || []).includes('nikol') ? '<span class="badge">Nikol arrived!</span>' : ''}</div></td>
    <td class="small">${(() => { const n = S.photos.filter(p => p.trip_id === t.id).length; return n ? `${n} ${n === 1 ? 'photo' : 'photos'}` : safeUrl(t.photos_url) ? 'Album' : '<span class="muted">—</span>'; })()}</td>
  </tr>`;
}

function photosSection(t, albumUrl) {
  const pics = S.photos.filter(p => p.trip_id === t.id).sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
  return `
  <section class="panel stack" id="photos">
    <div class="spread">
      <div><p class="eyebrow">Photos</p><h2>${pics.length ? `${pics.length} ${pics.length === 1 ? 'photo' : 'photos'}` : 'No photos yet'}</h2></div>
      ${albumUrl ? `<a class="btn sm" target="_blank" rel="noopener" href="${esc(albumUrl)}">Full album ↗</a>` : ''}
    </div>
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
    <details class="album-link">
      <summary class="small muted">${albumUrl ? 'Change the shared album link' : 'Have a Google Photos / Drive album with everything? Link it too'}</summary>
      <form id="photo-form" class="row" data-trip="${t.id}" style="margin-top:10px">
        <input type="url" name="url" id="photo-url" placeholder="https://photos.app.goo.gl/…" value="${esc(albumUrl)}" required style="flex:1 1 240px">
        <button class="btn" type="submit">Save link</button>
      </form>
    </details>
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
          <p class="small muted">${esc(m.approx ? (parseDate(m.date)?.toLocaleDateString(locale(), { month: 'long', year: 'numeric' }) || '') : fmtDate(m.date))} · ${esc(k[0])}</p>
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
function milestoneForm(m) {
  return `
  <div class="spread"><h2>${m ? 'Edit milestone' : 'Add a milestone'}</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
  <form>
    <label>What happened<input name="title" id="m-title" required value="${esc(m?.title)}" placeholder="Míša’s baby is born"></label>
    <div class="grid2">
      <label>Date<input type="date" name="date" id="m-date" required value="${esc(m?.date)}"></label>
      <label>Type<select name="kind" id="m-kind">${Object.entries(KINDS).map(([k, [l, i]]) => `<option value="${k}" ${m?.kind === k ? 'selected' : ''}>${i} ${l}</option>`).join('')}</select></label>
    </div>
    <label>Special label (optional)<input name="label" id="m-label" value="${esc(m?.label)}" placeholder="First baby of the gang"></label>
    <div class="stack" style="gap:6px"><span class="small muted" style="font-weight:500">Who is it about</span>${memberChecks('who', m?.who || [])}</div>
    <label>Links found online (optional, one per line: <span class="mono">Title | https://…</span>)<textarea name="links" id="m-links" style="min-height:64px" placeholder="Article about us | https://…">${esc((m?.links || []).map(l => (l.title ? l.title + ' | ' : '') + l.url).join('\n'))}</textarea></label>
    <label>A few words (optional)<textarea name="note" id="m-note" placeholder="Name, weight, who cried first…">${esc(m?.note)}</textarea></label>
    <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
  </form>`;
}
const hostOf = u => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return u; } };
const parseLinks = txt => String(txt || '').split('\n').map(l => l.trim()).filter(Boolean).map(l => {
  const i = l.lastIndexOf('|');
  const url = (i >= 0 ? l.slice(i + 1) : l).trim(), title = i >= 0 ? l.slice(0, i).trim() : '';
  return { title, url };
}).filter(l => safeUrl(l.url));
const readMilestone = fd => ({ title: String(fd.get('title')).trim(), date: String(fd.get('date')), kind: String(fd.get('kind')), label: String(fd.get('label') || '').trim(), note: String(fd.get('note') || '').trim(), who: fd.getAll('who'), links: parseLinks(fd.get('links')) });

/* ---------------- suggestions ---------------- */
const openIdeas = () => S.suggestions.filter(s => !s.done).length;
function suggestForm() {
  const here = route().startsWith('trip-') ? 'Archive' : (PAGE_NAMES[route()] || 'Home');
  return `
  <div class="spread"><h2>Suggest an edit</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
  <form>
    <p class="muted small">Spotted a typo, a wrong date, a missing joke, or have an idea for a new feature? Write it here. Jakub sees every suggestion.</p>
    <label>Which page<select name="page" id="s-page">${Object.values(PAGE_NAMES).concat('Whole site / new idea').map(p => `<option ${p === here ? 'selected' : ''}>${esc(p)}</option>`).join('')}</select></label>
    <label>Your suggestion<textarea name="text" id="s-text" required placeholder="e.g. My nickname is spelled wrong. It should be…"></textarea></label>
    <div class="row"><button class="btn primary" type="submit">Send suggestion</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
  </form>`;
}
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
      ${after ? `<p class="hint">Just got back? Two things to do: <button class="linkish" type="button" data-action="share-photos" data-trip="${t.id}">share your photos</button> and <button class="linkish" type="button" data-action="scroll" data-to="exp-form">add what you paid for</button>. The page works out who owes whom.</p>` : ''}
    </section>

    ${photosSection(t, photos)}

    <section class="panel stack">
      <div class="spread"><div><p class="eyebrow">Who was there</p><h3 class="num">${(t.attendees || []).length} survivors</h3></div>${(t.attendees || []).includes('nikol') ? '<span class="badge">Nikol actually arrived</span>' : ''}</div>
      <div class="row">${(t.attendees || []).map(id => `<span class="row" style="gap:6px">${avatar(id, 'xs')}<span class="small">${esc(nameOf(id))}</span></span>`).join('') || '<span class="muted small">Not filled in. Use Edit to add who came.</span>'}</div>
    </section>

    <div class="two-col">
      <section class="panel stack">
        <div class="spread"><div><p class="eyebrow">Who paid for what</p><h2 class="num">${kc(total)}</h2></div>${att.length ? `<span class="muted small num">≈ ${kc(total / att.length)} per person</span>` : ''}</div>
        <div>${ex.map(e => `
          <div class="exp">
            <div style="min-width:0"><b>${esc(e.what || 'Something')}</b><br><span class="muted small">${esc(nameOf(e.payer))} paid · split ${(e.split || []).length} ways</span></div>
            <span class="amount">${kc(e.amount)}</span>
            <button class="btn sm ghost danger" type="button" data-action="del-exp" data-exp="${e.id}" aria-label="Delete expense">✕</button>
          </div>`).join('') || '<p class="muted small">No expenses yet. Who bought the beer? (This budget, unlike the festival one, will actually balance.)</p>'}</div>
        <form id="exp-form" class="stack" data-trip="${t.id}" style="gap:10px;border-top:1px solid var(--line);padding-top:14px">
          <div class="grid2">
            <label>What<input name="what" id="exp-what" placeholder="Groceries, cottage, petrol…" required></label>
            <label>Amount (Kč)<input name="amount" id="exp-amount" type="number" min="1" step="1" inputmode="numeric" required></label>
            <label>Paid by<select name="payer" id="exp-payer">${memberOptions(me() || att[0])}</select></label>
          </div>
          <div class="stack" style="gap:6px"><span class="small muted" style="font-weight:600">Split between</span>${memberChecks('split', att)}</div>
          <div><button class="btn primary" type="submit">Add expense</button></div>
        </form>
      </section>

      <section class="panel stack">
        <p class="eyebrow">Settle up</p>
        <h2>Who sends money to whom</h2>
        ${transfers.length ? transfers.map(x => `
          <div class="transfer">${avatar(x.from, 'xs')}<b>${esc(nameOf(x.from))}</b><span class="muted">pays</span>${avatar(x.to, 'xs')}<b>${esc(nameOf(x.to))}</b><span class="amount" style="margin-left:auto">${kc(x.amount)}</span></div>`).join('')
          : `<p class="muted">${ex.length ? 'Everyone is square. Cleaner than any festival budget we ever handed in.' : 'Add expenses and the fewest possible payments will appear here.'}</p>`}
      </section>
    </div>

    <section class="panel stack">
      <p class="eyebrow">Stories &amp; quotes</p>
      ${t.story ? `<p class="story">${esc(t.story)}</p>` : '<p class="muted">No story yet. What happened at the cottage? (What happens at the cottage stays on this website.)</p>'}
      ${quotes.length ? `<ul class="quotes">${quotes.map(q => `<li class="quote">${esc(q)}</li>`).join('')}</ul>` : ''}
      <div><button class="btn sm" type="button" data-action="edit-trip" data-trip="${t.id}">Add story or quotes</button></div>
    </section>

    <section class="row"><button class="btn sm ghost danger" type="button" data-action="del-trip" data-trip="${t.id}">Delete this trip</button></section>
  </div>`;
}

function viewAfter() {
  const t = doneTrips().sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '') || tripSortKey(b).localeCompare(tripSortKey(a)))[0];
  if (!t) return `
    <div class="stack-lg">
      <section class="hero"><p class="eyebrow">After the trip</p><h1>Nothing to settle yet</h1></section>
      <div class="empty">
        <div class="big">🧾</div>
        <h3>No finished trips yet</h3>
        <p class="muted">When you get back from a trip, press “Wrap up” on the Next Trip page. Photos and expenses for it will show up here.</p>
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

/* ---------------- forms ---------------- */
function tripForm(t, mode) {
  // mode: 'plan' (upcoming) or 'past'
  const past = mode === 'past';
  return `
  <div class="spread"><h2>${t ? 'Edit trip' : past ? 'Add a past trip' : 'Plan the next trip'}</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
  <form>
    <label>Name of the trip<input name="title" id="f-title" required value="${esc(t?.title)}" placeholder="${past ? 'e.g. The one where the stove exploded' : 'e.g. Spring weekend at the cottage'}"></label>
    <div class="grid2">
      <label>Place<input name="place" id="f-place" value="${esc(t?.place)}" placeholder="Chata u Lesa"></label>
      <label>Organiser<select name="organiser" id="f-org">${memberOptions(t?.organiser || court().ruler)}</select></label>
    </div>
    <label>Address (for navigation)<input name="address" id="f-address" value="${esc(t?.address)}" placeholder="Street, number, town"></label>
    <div class="grid2">
      <label>From${!past && !t ? ' (optional, you can vote instead)' : ''}<input type="date" name="start" id="f-start" value="${esc(t?.start)}" ${past ? 'required' : ''}></label>
      <label>To<input type="date" name="end" id="f-end" value="${esc(t?.end)}"></label>
    </div>
    ${past ? `
      <label>Crowned at the end (next organiser)<select name="crowned" id="f-crowned">${memberOptions(t?.crowned, { blank: true })}</select></label>
      <div class="stack" style="gap:6px"><span class="small muted" style="font-weight:600">Who came</span>${memberChecks('attendees', t?.attendees || [])}</div>
      <label>Photo album link<input type="url" name="photos_url" id="f-photos" value="${esc(t?.photos_url)}" placeholder="https://drive.google.com/…"></label>
      <label>The story<textarea name="story" id="f-story" placeholder="What happened?">${esc(t?.story)}</textarea></label>
      <label>Quotes (one per line)<textarea name="quotes" id="f-quotes" placeholder="&quot;Has anyone seen Nikol?&quot; – everyone, every trip">${esc(t?.quotes)}</textarea></label>
    ` : `
      <label>Good to know (what to bring, keys, check-in…)<textarea name="notes" id="f-notes">${esc(t?.notes)}</textarea></label>
    `}
    <div class="row"><button class="btn primary" type="submit">Save</button><button class="btn ghost" type="button" data-close>Cancel</button></div>
  </form>`;
}
function readTripForm(fd, past) {
  const d = {};
  ['title', 'place', 'organiser', 'address', 'start', 'end', 'notes', 'photos_url', 'story', 'quotes', 'crowned'].forEach(k => { if (fd.has(k)) d[k] = String(fd.get(k)).trim(); });
  if (past) d.attendees = fd.getAll('attendees');
  if (d.start && (!d.end || d.end < d.start)) d.end = d.start;
  return d;
}

function wrapUpForm(t) {
  const c = court();
  const coming = Object.entries(t.rsvp || {}).filter(([, v]) => v === 'yes').map(([k]) => k);
  return `
  <div class="spread"><h2>The crowning ceremony ♛</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
  <form>
    <p class="muted">This moves “${esc(t.title)}” to the archive and hands over the crown. Photos and expenses come next.</p>
    <div class="grid2">
      <label>Trip started<input type="date" name="start" id="w-start" value="${esc(t.start)}" required></label>
      <label>Trip ended<input type="date" name="end" id="w-end" value="${esc(t.end)}"></label>
    </div>
    <div class="stack" style="gap:6px"><span class="small muted" style="font-weight:600">Who actually came</span>${memberChecks('attendees', coming)}</div>
    <label>Crown the new monarch (plans the next trip)<select name="crowned" id="w-crowned">${memberOptions(c.heir && c.heir !== t.organiser ? c.heir : '')}</select></label>
    <label>Heir after them (optional)<select name="heir" id="w-heir">${memberOptions('', { blank: true })}</select></label>
    <div class="row"><button class="btn gold" type="submit">Long live the new monarch!</button><button class="btn ghost" type="button" data-close>Not yet</button></div>
  </form>`;
}

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
  if (a === 'lang') { ls.set('jamu-lang', lang() === 'cs' ? 'en' : 'cs'); return $('.top') ? render() : renderLogin(); }
  if (a === 'logout') return logout();
  if (a === 'copy') {
    try { await navigator.clipboard.writeText(b.dataset.text); toast('Address copied'); }
    catch { const r = document.createRange(); const el = $('.addr'); if (el) { r.selectNodeContents(el); getSelection().removeAllRanges(); getSelection().addRange(r); } toast('Address selected. Press Ctrl+C to copy.'); }
    return;
  }
  if (a === 'new-plan') return openModal(tripForm(null, 'plan'), async fd => {
    await DB.add('trips', { ...readTripForm(fd, false), status: 'planning', rsvp: {} });
    await load(); render(); toast('Trip created. Now propose some dates!');
  });
  if (a === 'add-past') return openModal(tripForm(null, 'past'), async fd => {
    await DB.add('trips', { ...readTripForm(fd, true), status: 'done' });
    await load(); render(); toast('Added to the archive 🎟️');
  });
  if (a === 'edit-trip') {
    const t = trip(b.dataset.trip); if (!t) return;
    const past = t.status === 'done';
    return openModal(tripForm(t, past ? 'past' : 'plan'), async fd => {
      await DB.update(t, readTripForm(fd, past)); await load(); render(); toast('Saved');
    });
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
    return openModal(wrapUpForm(t), async fd => {
      const crowned = String(fd.get('crowned'));
      let start = String(fd.get('start')), end = String(fd.get('end') || '');
      if (!end || end < start) end = start;
      await DB.update(t, { status: 'done', start, end, attendees: fd.getAll('attendees'), crowned, done_at: new Date().toISOString() });
      await saveCourt({ ruler: crowned, heir: String(fd.get('heir') || '') });
      await load(); location.hash = '#after'; render();
      toast(`Long live ${member(crowned)?.name}! 👑`);
    });
  }
  if (a === 'del-exp') {
    const x = S.expenses.find(z => z.id === b.dataset.exp); if (!x) return;
    return act(() => DB.remove(x), 'Expense deleted');
  }
  if (a === 'suggest') return openModal(suggestForm(), async fd => {
    await DB.add('suggestions', { page: String(fd.get('page')), text: String(fd.get('text')).trim(), by: me() || '', done: false });
    await load(); render(); toast('Thanks! Your suggestion is in.');
  });
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
  if (a === 'add-ms') return openModal(milestoneForm(null), async fd => {
    await DB.add('milestones', readMilestone(fd));
    if (route() !== 'timeline') location.hash = '#timeline';
    await load(); render(); toast('Added to the timeline');
  });
  if (a === 'edit-ms') {
    const m = S.milestones.find(x => x.id === b.dataset.ms); if (!m) return;
    return openModal(milestoneForm(m), async fd => { await DB.update(m, readMilestone(fd)); await load(); render(); toast('Saved'); });
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
  if (f.id === 'exp-form') {
    e.preventDefault();
    const fd = new FormData(f);
    const split = fd.getAll('split');
    if (!split.length) { toast('Pick at least one person to split it between.'); return; }
    const amount = Number(fd.get('amount'));
    return act(() => DB.add('expenses', { trip_id: f.dataset.trip, what: String(fd.get('what')).trim(), amount, payer: String(fd.get('payer')), split }), 'Expense added');
  }
  if (f.id === 'photo-form') {
    e.preventDefault();
    const t = S.trips.find(x => x.id === f.dataset.trip); if (!t) return;
    const url = String(new FormData(f).get('url')).trim();
    if (!safeUrl(url)) { toast('That link should start with https://'); return; }
    return act(() => DB.update(t, { photos_url: url }), 'Photo link saved 📸');
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
