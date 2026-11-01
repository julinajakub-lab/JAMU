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
function fmtDate(s) { const d = parseDate(s); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : ''; }
function fmtRange(a, b) {
  const s = parseDate(a), e = parseDate(b);
  if (!s) return 'Date not set';
  if (!e || a === b) return fmtDate(a);
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
  return `<span class="av ${size}" style="--h:${m.hue}" title="${esc(m.name)}" aria-hidden="true">${esc(ini)}</span>`;
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
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 3200);
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
    { id: o3, collection: 'date_options', created_at: now, trip_id: t, start: fri(5, 8), end: fri(5, 10), votes: { ladislav: 'maybe', alzbeta: 'yes' } }
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

let S = { trips: [], options: [], expenses: [], settings: null };
async function load() {
  const all = await DB.all();
  S = {
    trips: all.filter(r => r.collection === 'trips'),
    options: all.filter(r => r.collection === 'date_options'),
    expenses: all.filter(r => r.collection === 'expenses'),
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
  'Nope. Even Nikol knows this one. She just never uses it.',
  'Still wrong. This is worse than the dramaturgy exam.',
  'Wrong again. Ask the current king, he knows.'
];
let wrongCount = 0;
function renderLogin() {
  document.title = 'JAMU Survivors’ Club';
  app.innerHTML = `
  <div class="login">
    <div class="box">
      <div class="bulbs" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>
      <p class="eyebrow" style="color:#f3cf72">Est. 2016 · JAMU, Brno</p>
      <h1>JAMU Survivors’ Club</h1>
      <p>Members only. Iva, if you’re reading this: the door is still open.</p>
      <form id="login-form">
        <input id="pw" type="password" autocomplete="current-password" placeholder="The group password" aria-label="Group password" required>
        <button class="btn gold" type="submit">Let me in</button>
        <p class="err" id="login-err" role="alert"></p>
        ${LIVE ? '' : `<p class="small" style="opacity:.8">Demo mode: the password is <b class="mono">${esc(C.demoPassword || 'jamu2016')}</b></p>`}
      </form>
    </div>
  </div>`;
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const pw = $('#pw').value;
    let ok = false;
    if (LIVE) {
      const { error } = await sb.auth.signInWithPassword({ email: C.groupEmail, password: pw });
      ok = !error;
    } else ok = pw === (C.demoPassword || 'jamu2016');
    if (ok) { ls.set('jamu-auth', '1'); start(); }
    else { $('#login-err').textContent = WRONG[wrongCount++ % WRONG.length]; $('#pw').select(); }
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
      if (b.dataset.pick === 'iva') { $('#pick-msg').textContent = 'Iva is no longer with us. 🕯️ (Please pick someone who actually shows up.)'; return; }
      ls.set('jamu-me', b.dataset.pick); closeModal(); render();
      if (b.dataset.pick === 'nikol') toast('Nikol! Is that really you? We’re so happy. 💌');
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
  if (setup) setup(modal);
  const first = $('input, select, textarea, button', modal); if (first) first.focus();
}
function closeModal() { $$('.modal-bg').forEach(m => m.remove()); }
document.addEventListener('keydown', e => { if (e.key === 'Escape' && me()) closeModal(); });

/* ---------------- layout ---------------- */
const NAV = [['home', 'Home'], ['gang', 'The Gang'], ['next', 'Next Trip'], ['archive', 'Archive'], ['after', 'After the Trip']];
function route() { const h = (location.hash || '#home').slice(1); return h || 'home'; }

function shell(active, content) {
  const m = me();
  return `
  <header class="top">
    <div class="wrap">
      <a class="logo" href="#home">JAMU<small>Survivors’ Club</small></a>
      <nav class="nav" aria-label="Main">${NAV.map(([k, l]) => `<a href="#${k}" class="${active === k ? 'on' : ''}">${l}</a>`).join('')}</nav>
      <button class="me" type="button" data-action="switch-me" title="Change who you are">${m ? avatar(m, 'xs') + ' ' + esc(nameOf(m)) : 'Who are you?'}</button>
    </div>
  </header>
  ${LIVE ? '' : `<div class="demo-banner"><div class="wrap">Demo mode: changes are saved only in this browser. Once the database is connected, the whole gang shares everything.</div></div>`}
  <main><div class="wrap">${content}</div></main>
  <footer><div class="wrap">
    <span>Est. 2016 at JAMU, Brno. Forged in suffering, held together by love.</span>
    <span>In memory of ${esc(GHOST.name)}, who is no longer with us. (She’s fine.) · <button class="btn ghost sm" type="button" data-action="logout">Log out</button></span>
  </div></footer>`;
}

/* ---------------- views ---------------- */
const FALLBACK_QUOTES = [
  '“Iva is no longer with us.”',
  'Nikol: “I’m definitely coming this time! ❤️”',
  '“Whatever JAMU did to us, one cottage weekend undoes it.”',
  '“Who brought the bottle opener?” — every trip, ever'
];
function allQuotes() {
  const q = [];
  S.trips.forEach(t => (t.quotes || '').split('\n').map(s => s.trim()).filter(Boolean).forEach(s => q.push({ text: s, trip: t })));
  return q;
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
            <p class="muted">${plan.place ? esc(plan.place) + ' · ' : ''}organised by 👑 ${esc(nameOf(plan.organiser))}</p>
          </div>
          ${d !== null ? `<div style="text-align:right"><div class="countdown num">${d > 0 ? d : d === 0 ? 'Today!' : '🎭'}</div><p class="muted small">${d > 0 ? (d === 1 ? 'day to go' : 'days to go') : d === 0 ? '' : 'already started'}</p></div>` : ''}
        </div>
        <p>${plan.start ? '📅 ' + esc(fmtRange(plan.start, plan.end)) : '📅 The date is still being voted on. Have you voted yet?'}</p>
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
      <h1>The JAMU Survivors’ Club</h1>
      <p>Ten people who survived theatre management school together, plus one adopted from JevTech. Twice a year we retreat to a cottage in the woods to cook, walk, talk, and recover.</p>
    </section>

    <section class="court" aria-label="The royal court">
      <div class="throne">
        ${avatar(c.ruler, 'lg')}
        <div class="who"><span class="eyebrow">👑 Reigning monarch</span><span class="name">${esc(member(c.ruler)?.name || '—')}</span><span class="muted small">${esc(member(c.ruler)?.nick || '')} · plans the next trip</span></div>
      </div>
      <div class="throne" style="background:var(--card)">
        ${c.heir ? avatar(c.heir, 'lg') : '<span class="av lg" style="--h:0">?</span>'}
        <div class="who"><span class="eyebrow">Heir to the throne</span><span class="name">${esc(member(c.heir)?.name || 'Not decided')}</span><span class="muted small">${c.heir ? 'to be crowned at the end of the next trip' : 'to be decided at the next trip'}</span></div>
      </div>
    </section>

    ${nextBlock}

    <section>
      <div class="section-head"><h2>By the numbers</h2></div>
      <div class="stats">
        <div class="stat"><b class="num">${done.length}</b><span class="muted small">trips in the archive</span></div>
        <div class="stat"><b class="num">${years}</b><span class="muted small">years since JAMU tried to break us</span></div>
        <div class="stat"><b class="num">${done.filter(t => t.crowned).length}</b><span class="muted small">crowns handed over</span></div>
        <div class="stat"><b class="num">${nikolCame}/${done.length}</b><span class="muted small">trips Nikol actually came to</span></div>
      </div>
    </section>

    <section class="stack" style="gap:8px">
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
    const badge = m.id === c.ruler ? '<span class="badge">👑 Reigning</span>' : m.id === c.heir ? '<span class="badge">Heir</span>' : m.id === 'dalibor' ? '<span class="badge">Adopted</span>' : '';
    return `
      <article class="panel member">
        ${badge}
        ${avatar(m.id, 'lg')}
        <div style="min-width:0">
          <h3>${esc(m.name)}</h3>
          <p class="nick ${m.nick ? '' : 'unset'}">${m.nick ? esc(m.nick) : 'nickname not set yet'}</p>
          <p class="small" style="margin-top:6px">${esc(m.line)}</p>
          <div class="tally num"><span>🏕️ ${trips} ${trips === 1 ? 'trip' : 'trips'}</span><span>👑 ${crowns} organised</span>${m.id === 'nikol' ? '<span>💌 ∞ love sent</span>' : ''}</div>
        </div>
      </article>`;
  }).join('');
  return `
  <div class="stack-lg">
    <section class="hero">
      <p class="eyebrow">Cast list</p>
      <h1>The Gang</h1>
      <p>Met at JAMU in 2016. Bonded by a common enemy (the workload). Stayed for the love.</p>
    </section>
    <section class="gang">
      ${cards}
      <article class="panel member ghost-card">
        <span class="badge">In memoriam</span>
        <span class="av lg">🕯️</span>
        <div>
          <h3>${esc(GHOST.name)}</h3>
          <p class="nick unset">2016 – 2016-ish</p>
          <p class="small" style="margin-top:6px">Is no longer with us. (She’s absolutely fine. She just never wanted to hang out.)</p>
          <div class="tally"><span>🏕️ 0 trips</span><span>🕊️ forever in our hearts</span></div>
        </div>
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
        <div class="big">👑</div>
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
          <span class="opt-date">${esc(fmtRange(o.start, o.end))}${chosen ? ' ✅' : ''}</span>
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
      <p class="eyebrow">Next trip · organised by 👑 ${esc(nameOf(plan.organiser))}</p>
      <h1>${esc(plan.title || 'Untitled trip')}</h1>
      <p>${plan.start ? '📅 ' + esc(fmtRange(plan.start, plan.end)) : '📅 Date not decided yet. Vote below.'}</p>
      <div class="row"><button class="btn sm" type="button" data-action="edit-trip" data-trip="${plan.id}">Edit trip details</button></div>
    </section>

    <div class="two-col">
      <section class="panel stack">
        <p class="eyebrow">The cottage</p>
        <h2>${esc(plan.place || 'Place not set yet')}</h2>
        ${addr ? `<p class="addr">${esc(addr)}</p>
          <div class="row">
            <a class="btn primary" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}">🚗 Navigate (Google Maps)</a>
            <a class="btn" target="_blank" rel="noopener" href="https://mapy.cz/zakladni?q=${encodeURIComponent(addr)}">Mapy.cz</a>
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
        <p class="muted small">Answer for yourself. (Or for Nikol. She’ll say yes anyway.)</p>
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
      <button class="btn gold" type="button" data-action="wrap-up" data-trip="${plan.id}">👑 Wrap up &amp; crown the next ruler</button>
    </section>
  </div>`;
}

function viewArchive() {
  const done = doneTrips();
  return `
  <div class="stack-lg">
    <section class="hero spread" style="align-items:end">
      <div class="stack" style="gap:8px"><p class="eyebrow">Every weekend we survived</p><h1>The Archive</h1></div>
      <button class="btn primary" type="button" data-action="add-past">+ Add a past trip</button>
    </section>
    ${done.length ? `<div class="tickets">${done.map(ticket).join('')}</div>` : `
      <div class="empty">
        <div class="big">🎟️</div>
        <h3>The archive is empty</h3>
        <p class="muted">Our memory is worse than our JAMU grades. Add the trips you remember, one ticket at a time.</p>
        <button class="btn primary" type="button" data-action="add-past">+ Add the first trip</button>
      </div>`}
  </div>`;
}
function ticket(t) {
  const d = parseDate(t.start);
  const n = (t.attendees || []).length;
  return `
  <a class="ticket" href="#trip-${esc(t.id)}">
    <div class="stub">
      <span class="mo">${d ? d.toLocaleDateString('en-GB', { month: 'short' }) : '???'}</span>
      <span class="yr num">${d ? d.getFullYear() : '—'}</span>
      <span class="admit">ADMIT ${n || '?'}</span>
    </div>
    <div class="body">
      <h3>${esc(t.title || 'Untitled trip')}</h3>
      <p class="muted small">${esc(fmtRange(t.start, t.end))}${t.place ? ' · ' + esc(t.place) : ''}</p>
      <p class="small">👑 ${esc(nameOf(t.organiser))}${t.crowned ? ` → crowned ${esc(nameOf(t.crowned))}` : ''}${(t.attendees || []).includes('nikol') ? ' · 🦄 Nikol came!' : ''}</p>
      <div class="row"><div class="av-row">${(t.attendees || []).map(id => avatar(id, 'xs')).join('')}</div>${safeUrl(t.photos_url) ? '<span class="chip">📸 photos</span>' : ''}</div>
    </div>
  </a>`;
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
      <p class="small">👑 Organised by <b>${esc(member(t.organiser)?.name || '—')}</b>${t.crowned ? ` · crowned at the end: <b>${esc(member(t.crowned)?.name)}</b>` : ''}</p>
      <div class="row"><button class="btn sm" type="button" data-action="edit-trip" data-trip="${t.id}">Edit</button>${after ? `<a class="btn sm ghost" href="#trip-${esc(t.id)}">Permalink</a>` : ''}</div>
    </section>

    ${photos ? `
      <section class="photos-cta">
        <div class="stack" style="gap:2px"><p class="eyebrow" style="color:#f3cf72">Photos</p><h2>All the pictures are in one album</h2></div>
        <a class="btn" target="_blank" rel="noopener" href="${esc(photos)}">📸 Open the photos</a>
      </section>` : `
      <section class="panel stack">
        <p class="eyebrow">Photos</p>
        <h3>Where are the pictures?</h3>
        <p class="muted small">Make a shared Google Drive (or Google Photos) album, upload everything there, and paste its link here.</p>
        <form id="photo-form" class="row" data-trip="${t.id}">
          <input type="url" name="url" id="photo-url" placeholder="https://drive.google.com/…" required style="flex:1 1 240px">
          <button class="btn primary" type="submit">Save link</button>
        </form>
      </section>`}

    <section class="panel stack">
      <div class="spread"><div><p class="eyebrow">Who was there</p><h3 class="num">${(t.attendees || []).length} survivors</h3></div>${(t.attendees || []).includes('nikol') ? '<span class="badge">🦄 Nikol actually came</span>' : ''}</div>
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
          </div>`).join('') || '<p class="muted small">No expenses yet. Who bought the beer?</p>'}</div>
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
          : `<p class="muted">${ex.length ? 'Everyone is square. A miracle.' : 'Add expenses and the fewest possible payments will appear here.'}</p>`}
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
      <label>Organiser 👑<select name="organiser" id="f-org">${memberOptions(t?.organiser || court().ruler)}</select></label>
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
      <label>Quotes (one per line)<textarea name="quotes" id="f-quotes" placeholder="&quot;I'm definitely coming next time!&quot; – Nikol">${esc(t?.quotes)}</textarea></label>
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
  <div class="spread"><h2>👑 The crowning ceremony</h2><button class="btn sm ghost" type="button" data-close>Close</button></div>
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
    if (pendingDelete !== o.id) { pendingDelete = o.id; b.textContent = 'Sure?'; return; }
    pendingDelete = null;
    return act(() => DB.remove(o), 'Date removed');
  }
  if (a === 'rsvp') {
    const t = planning(); if (!t) return;
    const rsvp = { ...(t.rsvp || {}) };
    const who = b.dataset.who, val = b.dataset.val;
    if (rsvp[who] === val) delete rsvp[who]; else rsvp[who] = val;
    const msg = who === 'nikol' && rsvp[who] === 'yes' ? 'Nikol is coming?! Somebody screenshot this. 📸'
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
  if (a === 'del-trip') {
    const t = trip(b.dataset.trip); if (!t) return;
    if (pendingDelete !== t.id) { pendingDelete = t.id; b.textContent = 'Click again to delete it for good'; return; }
    pendingDelete = null;
    const kids = [...S.options.filter(o => o.trip_id === t.id), ...S.expenses.filter(x => x.trip_id === t.id)];
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
  else { active = 'home'; html = viewHome(); }
  const titles = { home: 'JAMU Survivors’ Club', gang: 'The Gang', next: 'Next Trip', archive: 'Archive', after: 'After the Trip' };
  document.title = (titles[active] && active !== 'home' ? titles[active] + ' · ' : '') + 'JAMU Survivors’ Club';
  app.innerHTML = shell(active, html);
}
window.addEventListener('hashchange', () => { pendingDelete = null; if ($('.top')) { render(); window.scrollTo(0, 0); } });

async function start() {
  if (!(await isLoggedIn())) return renderLogin();
  app.innerHTML = '<div class="loading">Raising the curtain…</div>';
  try { await load(); }
  catch (e) {
    console.error(e);
    app.innerHTML = `<div class="wrap loading"><p>Couldn’t reach the database: ${esc(e.message)}</p><p><button class="btn" type="button" data-action="logout">Log out and try again</button></p></div>`;
    return;
  }
  render();
  pickMe();
}
start();
})();
