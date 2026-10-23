// Stargazer: hear my GitHub stars.
// Made by Carter (2three1y). See credits.html for every starred repo used.
import A11yDialog from './vendor/a11y-dialog.esm.min.js';
import { tabbable } from './vendor/tabbable.esm.min.js';
import { WebHaptics } from './vendor/web-haptics.mjs';
import { sonify } from './sonify.js';

const $ = (sel) => document.querySelector(sel);
const fmt = (n) => Number(n).toLocaleString('en-US');

/* ---------- License families ---------- */
const FAMILIES = {
  permissive: { label: 'Permissive', sound: 'permissive', safe: true, says: 'permissive, safe to mash up' },
  publicdomain: { label: 'Public domain', sound: 'publicdomain', safe: true, says: 'public domain, safe to mash up' },
  weak: { label: 'Weak copyleft', sound: 'weak', safe: false, says: 'weak copyleft, changed files keep its license' },
  copyleft: { label: 'Copyleft', sound: 'copyleft', safe: false, says: 'copyleft, the whole project would take this license' },
  other: { label: 'Other or unrecognized', sound: 'other', safe: false, says: 'unrecognized or content license, check before using' },
  none: { label: 'No license', sound: 'none', safe: false, says: 'no license, look but do not copy' },
};
const FAMILY_ORDER = ['permissive', 'publicdomain', 'weak', 'copyleft', 'other', 'none'];
const PERMISSIVE = new Set(['MIT', 'MIT-0', 'Apache-2.0', 'BSD-2-Clause', 'BSD-3-Clause', 'BSD-3-Clause-Clear', 'BSD-4-Clause', 'BSD-2-Clause-Patent', '0BSD', 'ISC', 'Zlib', 'BSL-1.0', 'WTFPL', 'NCSA', 'PostgreSQL', 'UPL-1.0', 'MS-PL', 'AFL-3.0', 'ECL-2.0', 'BlueOak-1.0.0', 'CERN-OHL-P-2.0', 'Artistic-2.0']);
const PUBLIC_DOMAIN = new Set(['CC0-1.0', 'Unlicense']);
const WEAK = new Set(['LGPL-2.1', 'LGPL-3.0', 'MPL-2.0', 'EPL-1.0', 'EPL-2.0', 'MS-RL', 'CERN-OHL-W-2.0', 'OSL-3.0', 'LPPL-1.3c']);
const COPYLEFT = new Set(['GPL-2.0', 'GPL-3.0', 'AGPL-3.0', 'EUPL-1.1', 'EUPL-1.2', 'CECILL-2.1', 'CERN-OHL-S-2.0']);
export function familyOf(id) {
  if (!id || id === 'none') return 'none';
  if (PERMISSIVE.has(id)) return 'permissive';
  if (PUBLIC_DOMAIN.has(id)) return 'publicdomain';
  if (WEAK.has(id)) return 'weak';
  if (COPYLEFT.has(id)) return 'copyleft';
  return 'other';
}

/* ---------- State ---------- */
const state = {
  repos: [],
  licenses: {},
  hasDates: false,
  maxStars: 1,
  arrange: 'all',
  order: 'newest',
  safeOnly: false,
  groups: [],
  groupIdx: 0,
  items: [],
  pos: 0,
  listShown: 25,
  findQuery: '',
  findHits: [],
  findAt: -1,
  sweepTimer: null,
  graph: null,
  started: false,
};
const opts = { earcons: true, tones: true, speech: false, haptics: true, speed: 450, volume: 70 };
try { Object.assign(opts, JSON.parse(localStorage.getItem('stargazer-opts') || '{}')); } catch (e) { /* ignore */ }
const saveOpts = () => { try { localStorage.setItem('stargazer-opts', JSON.stringify(opts)); } catch (e) { /* ignore */ } };

/* ---------- Announcements (one polite live region) ---------- */
const announcer = $('#announcer');
let announceTimer = null;
function speak(text) {
  if (!('speechSynthesis' in window)) return false;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'en-US';
  speechSynthesis.speak(u);
  return true;
}
function announce(text) {
  if (opts.speech && speak(text)) return;
  clearTimeout(announceTimer);
  announcer.textContent = '';
  announceTimer = setTimeout(() => { announcer.textContent = text; }, 120);
}

/* ---------- Audio ---------- */
let ctx = null;
let master = null;
const buffers = {};
const SOUND_NAMES = ['permissive', 'publicdomain', 'copyleft', 'weak', 'other', 'none', 'tick', 'group', 'open', 'close', 'found', 'miss', 'sweep'];
function ensureAudio() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = opts.volume / 100;
  master.connect(ctx.destination);
  // Unlock on iOS: play one silent sample inside the user press.
  const b = ctx.createBuffer(1, 1, 22050);
  const s = ctx.createBufferSource();
  s.buffer = b; s.connect(master); s.start(0);
  SOUND_NAMES.forEach((name) => {
    fetch(`sounds/${name}.mp3`)
      .then((r) => r.arrayBuffer())
      .then((ab) => new Promise((res, rej) => ctx.decodeAudioData(ab, res, rej)))
      .then((buf) => { buffers[name] = buf; })
      .catch(() => { /* a missing sound just stays silent */ });
  });
}
function playSound(name, when = 0, gain = 1) {
  if (!ctx || !buffers[name]) return;
  const src = ctx.createBufferSource();
  src.buffer = buffers[name];
  const g = ctx.createGain();
  g.gain.value = gain;
  src.connect(g).connect(master);
  src.start(ctx.currentTime + when);
}
// Pentatonic notes over three octaves from A3. Pitch follows star count on a log scale.
const PENTA = [0, 2, 4, 7, 9];
export function noteFor(stars, maxStars) {
  const steps = 15;
  const ratio = Math.log10((stars || 0) + 1) / Math.log10((maxStars || 1) + 1);
  const step = Math.max(0, Math.min(steps, Math.round(ratio * steps)));
  const semis = Math.floor(step / 5) * 12 + PENTA[step % 5];
  return 220 * Math.pow(2, semis / 12);
}
function playTone(freq, when = 0, dur = 0.28, type = 'triangle', vol = 0.32) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}
function playRepo(repo, quick = false) {
  ensureAudio();
  if (!repo) return;
  if (opts.earcons) playSound(FAMILIES[repo.family].sound, 0, quick ? 0.6 : 0.9);
  if (opts.tones) playTone(noteFor(repo.stars, state.maxStars), opts.earcons ? 0.12 : 0, quick ? 0.18 : 0.3);
  if (opts.haptics) haptic('selection');
}

/* ---------- Haptics ---------- */
let haptics = null;
function haptic(kind) {
  try {
    if (!haptics) haptics = new WebHaptics();
    haptics.trigger(kind);
  } catch (e) { /* no haptics here */ }
}

/* ---------- Data ---------- */
function bandOf(stars) {
  if (stars >= 100000) return '100,000 stars or more';
  if (stars >= 10000) return '10,000 to 99,999 stars';
  if (stars >= 1000) return '1,000 to 9,999 stars';
  if (stars >= 100) return '100 to 999 stars';
  return 'Under 100 stars';
}
const BAND_ORDER = ['100,000 stars or more', '10,000 to 99,999 stars', '1,000 to 9,999 stars', '100 to 999 stars', 'Under 100 stars'];

function licenseTitle(id) {
  if (id === 'none') return 'No license';
  if (id === 'NOASSERTION') return 'Unrecognized license';
  return (state.licenses[id] && state.licenses[id].title) || id;
}
function yearOf(r) { return r.starredAt ? r.starredAt.slice(0, 4) : null; }
function monthOf(r) { return r.starredAt ? r.starredAt.slice(0, 7) : null; }
function monthLabel(key) {
  const [y, m] = key.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
}

export function buildGroups(repos, arrange) {
  const map = new Map();
  const add = (key, label, r) => {
    if (!map.has(key)) map.set(key, { key, label, repos: [] });
    map.get(key).repos.push(r);
  };
  for (const r of repos) {
    if (arrange === 'all') add('all', 'All stars', r);
    else if (arrange === 'year') add(yearOf(r) || 'unknown', yearOf(r) ? `Starred in ${yearOf(r)}` : 'Star date unknown', r);
    else if (arrange === 'month') add(monthOf(r) || 'unknown', monthOf(r) ? `Starred in ${monthLabel(monthOf(r))}` : 'Star date unknown', r);
    else if (arrange === 'language') add(r.language || 'none', r.language || 'No language listed', r);
    else if (arrange === 'license') add(r.license, licenseTitle(r.license), r);
    else if (arrange === 'band') add(bandOf(r.stars), bandOf(r.stars), r);
  }
  let groups = [...map.values()];
  if (arrange === 'year' || arrange === 'month') groups.sort((a, b) => b.key.localeCompare(a.key));
  else if (arrange === 'band') groups.sort((a, b) => BAND_ORDER.indexOf(a.key) - BAND_ORDER.indexOf(b.key));
  else groups.sort((a, b) => b.repos.length - a.repos.length || a.label.localeCompare(b.label));
  return groups;
}
export function sortItems(items, order) {
  const a = [...items];
  if (order === 'newest') a.sort((x, y) => x.i - y.i);
  else if (order === 'oldest') a.sort((x, y) => y.i - x.i);
  else if (order === 'most') a.sort((x, y) => y.stars - x.stars || x.i - y.i);
  else if (order === 'fewest') a.sort((x, y) => x.stars - y.stars || x.i - y.i);
  else if (order === 'az') a.sort((x, y) => x.repo.localeCompare(y.repo, 'en', { sensitivity: 'base' }));
  return a;
}

/* ---------- Describing a repo ---------- */
function shortLine(r) {
  return `${r.repo}, ${fmt(r.stars)} ${r.stars === 1 ? 'star' : 'stars'}, ${licenseTitle(r.license)}`;
}
function positionText() {
  const g = state.groups[state.groupIdx];
  return `${fmt(state.pos + 1)} of ${fmt(state.items.length)}${g && state.arrange !== 'all' ? ` in ${g.label}` : ''}`;
}
function sayLine(r) {
  return `${shortLine(r)}. ${r.language ? r.language + '. ' : ''}${positionText()}.`;
}

/* ---------- Rendering ---------- */
const el = {
  arrange: $('#arrange'), group: $('#group'), order: $('#order'), safe: $('#safe-only'),
  position: $('#position'), nowPos: $('#now-position'), nowName: $('#now-name'), nowFacts: $('#now-facts'),
  nowDesc: $('#now-desc'), pitch: $('#pitch-bar'), gh: $('#gh-link'), list: $('#list'), listSummary: $('#list-summary'),
  more: $('#more'), sweep: $('#sweep'),
};

function filtered() {
  return state.safeOnly ? state.repos.filter((r) => FAMILIES[r.family].safe) : state.repos;
}
function rebuild(keepRepo) {
  const prev = keepRepo || current();
  state.groups = buildGroups(filtered(), state.arrange);
  if (state.groupIdx >= state.groups.length) state.groupIdx = 0;
  el.group.innerHTML = '';
  state.groups.forEach((g, i) => {
    const o = document.createElement('option');
    o.value = String(i);
    o.textContent = `${g.label} (${fmt(g.repos.length)})`;
    el.group.appendChild(o);
  });
  el.group.disabled = state.groups.length < 2;
  $('#prev-group').disabled = state.groups.length < 2;
  $('#next-group').disabled = state.groups.length < 2;
  if (prev) {
    const gi = state.groups.findIndex((g) => g.repos.includes(prev));
    if (gi >= 0) state.groupIdx = gi;
  }
  loadGroup(prev);
}
function loadGroup(keepRepo) {
  const g = state.groups[state.groupIdx];
  el.group.value = String(state.groupIdx);
  state.items = g ? sortItems(g.repos, state.order) : [];
  state.pos = 0;
  if (keepRepo) {
    const p = state.items.indexOf(keepRepo);
    if (p >= 0) state.pos = p;
  }
  state.listShown = 25;
  el.position.max = String(Math.max(0, state.items.length - 1));
  el.position.disabled = state.items.length === 0;
  renderNow();
  renderList();
  renderGroupGraphText();
  persist();
}
function current() { return state.items[state.pos]; }

function renderNow() {
  const r = current();
  if (!r) {
    el.nowName.textContent = 'No stars match this filter';
    el.nowPos.textContent = '';
    el.nowFacts.innerHTML = '';
    el.nowDesc.textContent = '';
    el.position.setAttribute('aria-valuetext', 'empty');
    return;
  }
  el.nowPos.textContent = `Star ${positionText()}`;
  el.nowName.textContent = r.repo;
  el.nowFacts.innerHTML = '';
  const facts = [
    `${fmt(r.stars)} ${r.stars === 1 ? 'star' : 'stars'}`,
    `License: ${licenseTitle(r.license)} (${FAMILIES[r.family].label.toLowerCase()})`,
    `Language: ${r.language || 'not listed'}`,
  ];
  if (r.starredAt) facts.push(`Starred ${formatDate(r.starredAt)}`);
  for (const f of facts) { const li = document.createElement('li'); li.textContent = f; el.nowFacts.appendChild(li); }
  el.nowDesc.textContent = r.description || 'No description.';
  el.position.value = String(state.pos);
  el.position.setAttribute('aria-valuetext', `${shortLine(r)}. ${positionText()}`);
  el.gh.href = `https://github.com/${r.repo}`;
  el.gh.textContent = `Open ${r.repo} on GitHub`;
  const ratio = Math.log10(r.stars + 1) / Math.log10(state.maxStars + 1);
  el.pitch.style.width = `${Math.max(3, Math.round(ratio * 100))}%`;
  el.pitch.dataset.family = r.family;
}
function formatDate(iso) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
}
function renderList() {
  el.list.innerHTML = '';
  const shown = state.items.slice(0, state.listShown);
  shown.forEach((r, i) => {
    const li = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'repo-btn';
    b.dataset.pos = String(i);
    b.textContent = shortLine(r);
    li.appendChild(b);
    el.list.appendChild(li);
  });
  const g = state.groups[state.groupIdx];
  el.listSummary.textContent = g
    ? `Showing ${fmt(shown.length)} of ${fmt(state.items.length)} in ${g.label}. Pressing a repo plays it and makes it the current star.`
    : '';
  el.more.hidden = shown.length >= state.items.length;
}
function persist() {
  try {
    const r = current();
    localStorage.setItem('stargazer-view', JSON.stringify({ arrange: state.arrange, order: state.order, safeOnly: state.safeOnly, repo: r ? r.repo : null }));
  } catch (e) { /* ignore */ }
}

/* ---------- Moving ---------- */
function go(pos, { speakIt = true, quick = false } = {}) {
  if (!state.items.length) { ensureAudio(); playSound('miss'); announce('No stars here.'); return; }
  if (pos < 0 || pos >= state.items.length) {
    ensureAudio();
    playSound('miss');
    if (speakIt) announce(pos < 0 ? 'Start of the group.' : 'End of the group.');
    return;
  }
  state.pos = pos;
  renderNow();
  persist();
  playRepo(current(), quick);
  if (speakIt) announce(sayLine(current()));
}
function goGroup(delta) {
  if (state.groups.length < 2) return;
  stopSweep(false);
  state.groupIdx = (state.groupIdx + delta + state.groups.length) % state.groups.length;
  loadGroup();
  ensureAudio();
  playSound('group', 0, 0.7);
  const g = state.groups[state.groupIdx];
  const r = current();
  setTimeout(() => playRepo(r), 380);
  announce(`${g.label}, ${fmt(g.repos.length)} repos. First: ${r ? shortLine(r) : 'none'}.`);
}

/* ---------- Sweep ---------- */
function startSweep() {
  ensureAudio();
  if (!state.items.length) return;
  stopGraph();
  el.sweep.setAttribute('aria-pressed', 'true');
  el.sweep.textContent = 'Stop sweep';
  announce(`Sweeping ${state.groups[state.groupIdx].label}. Press S or Stop sweep to stop.`);
  playSound('sweep', 0, 0.6);
  const step = () => {
    if (state.pos >= state.items.length - 1) { stopSweep(true); return; }
    go(state.pos + 1, { speakIt: false, quick: true });
    state.sweepTimer = setTimeout(step, opts.speed);
  };
  state.sweepTimer = setTimeout(step, 700);
}
function stopSweep(say = true) {
  if (!state.sweepTimer) return;
  clearTimeout(state.sweepTimer);
  state.sweepTimer = null;
  el.sweep.setAttribute('aria-pressed', 'false');
  el.sweep.textContent = 'Sweep this group';
  const r = current();
  if (say && r) announce(`Stopped at ${sayLine(r)}`);
}

/* ---------- Details dialog ---------- */
const dialogEl = $('#detail');
const dialog = new A11yDialog(dialogEl);
let lastFocus = null;
function li(text) { const x = document.createElement('li'); x.textContent = text; return x; }
function h(tag, text) { const x = document.createElement(tag); x.textContent = text; return x; }
function openDetails(r = current()) {
  if (!r) return;
  stopSweep(false);
  ensureAudio();
  playSound('open', 0, 0.6);
  lastFocus = document.activeElement;
  $('#detail-title').textContent = r.repo;
  const body = $('#detail-body');
  body.innerHTML = '';
  const sec = document.createElement('section');
  sec.className = 'spkbl';
  sec.id = 'detail-speak';
  sec.setAttribute('aria-label', `About ${r.repo}`);
  const fam = FAMILIES[r.family];
  sec.appendChild(h('p', `${fam.safe ? 'Mash-up safe' : 'Not mash-up safe'}: ${fam.says}.`));
  const facts = document.createElement('ul');
  facts.appendChild(li(`Stars: ${fmt(r.stars)}`));
  facts.appendChild(li(`Language: ${r.language || 'not listed'}`));
  facts.appendChild(li(`License: ${licenseTitle(r.license)}`));
  if (r.starredAt) facts.appendChild(li(`I starred it on ${formatDate(r.starredAt)}`));
  facts.appendChild(li(`Owner: ${r.repo.split('/')[0]}`));
  sec.appendChild(facts);
  sec.appendChild(h('p', r.description || 'No description.'));
  sec.appendChild(h('h3', 'What the license lets you do'));
  const lic = state.licenses[r.license];
  if (lic) {
    sec.appendChild(h('p', lic.description));
    const parts = [['You can', lic.permissions], ['You must', lic.conditions], ['It does not give you', lic.limitations]];
    for (const [title, items] of parts) {
      if (!items || !items.length) continue;
      sec.appendChild(h('h4', title));
      const ul = document.createElement('ul');
      items.forEach((t) => ul.appendChild(li(t)));
      sec.appendChild(ul);
    }
    const src = document.createElement('p');
    src.className = 'muted';
    src.textContent = 'License summary from choosealicense.com. It is a guide, not legal advice.';
    sec.appendChild(src);
  } else if (r.license === 'none') {
    sec.appendChild(h('p', 'No license means all rights reserved. You can read the code and link to it, but not copy it into your own project. You can ask the author to add a license.'));
  } else if (r.license === 'NOASSERTION') {
    sec.appendChild(h('p', "GitHub could not recognize this repo's license. Open its license file and read it before using any code."));
  } else {
    sec.appendChild(h('p', `${r.license} is not in the choosealicense.com list. Read the repo's license file before using any code.`));
  }
  body.appendChild(sec);
  const p = document.createElement('p');
  const a = document.createElement('a');
  a.href = `https://github.com/${r.repo}`;
  a.textContent = `Open ${r.repo} on GitHub`;
  p.appendChild(a);
  body.appendChild(p);
  if ('Speakable' in window) {
    try { window.Speakable.init({ selector: '#detail-speak', l18n: { play: 'Read details aloud', pause: 'Pause reading', progress: 'Reading progress', stop: 'Stop reading' } }); } catch (e) { /* speech not available */ }
  }
  dialog.show();
}
dialog.on('hide', () => {
  if ('speechSynthesis' in window) speechSynthesis.cancel();
  if (ctx) playSound('close', 0, 0.5);
  // Return focus somewhere real even if the element that opened the dialog was re-rendered.
  setTimeout(() => {
    if (lastFocus && document.body.contains(lastFocus) && lastFocus.offsetParent !== null) { lastFocus.focus(); return; }
    const t = tabbable($('#explore'));
    const target = t.find((x) => x.id === 'details-btn') || t[0];
    if (target) target.focus();
  }, 0);
});

/* ---------- Find ---------- */
function find(q) {
  q = q.trim().toLowerCase();
  if (!q) { announce('Type a name or word first.'); return; }
  ensureAudio();
  if (q !== state.findQuery) {
    state.findQuery = q;
    state.findHits = filtered().filter((r) => r.repo.toLowerCase().includes(q) || (r.description || '').toLowerCase().includes(q));
    // Name matches first, then description matches.
    state.findHits.sort((a, b) => (b.repo.toLowerCase().includes(q) - a.repo.toLowerCase().includes(q)) || a.i - b.i);
    state.findAt = -1;
  }
  if (!state.findHits.length) { playSound('miss'); announce(`No stars match ${q}.`); return; }
  state.findAt = (state.findAt + 1) % state.findHits.length;
  const r = state.findHits[state.findAt];
  stopSweep(false);
  rebuild(r);
  playSound('found', 0, 0.6);
  setTimeout(() => playRepo(r), 300);
  if (opts.haptics) haptic('success');
  announce(`Match ${state.findAt + 1} of ${fmt(state.findHits.length)}: ${sayLine(r)}`);
}

/* ---------- Audio graphs (sonifier) ---------- */
function stopGraph() { if (state.graph) { state.graph.stop(); state.graph = null; } }
function countBy(arr, fn) { const m = new Map(); arr.forEach((x) => { const k = fn(x); m.set(k, (m.get(k) || 0) + 1); }); return m; }
function graphData(kind) {
  const repos = filtered();
  if (kind === 'months') {
    if (!state.hasDates) return null;
    const m = countBy(repos.filter((r) => r.starredAt), monthOf);
    const xs = [...m.keys()].sort();
    return { x: xs.map(monthLabel), y: xs.map((k) => m.get(k)), label: 'Stars per month, oldest month first' };
  }
  if (kind === 'languages') {
    const m = countBy(repos.filter((r) => r.language), (r) => r.language);
    const top = [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    return { x: top.map((t) => t[0]), y: top.map((t) => t[1]), label: 'Top 12 languages, most first' };
  }
  if (kind === 'licenses') {
    const m = countBy(repos, (r) => r.family);
    const xs = FAMILY_ORDER.filter((f) => m.get(f));
    return { x: xs.map((f) => FAMILIES[f].label), y: xs.map((f) => m.get(f)), label: 'License families' };
  }
  const items = state.items.slice(0, 40);
  return { x: items.map((r) => r.repo), y: items.map((r) => r.stars), label: 'Star counts in this group' };
}
function graphText(d) {
  if (!d) return '';
  const max = Math.max(...d.y);
  const maxI = d.y.indexOf(max);
  const min = Math.min(...d.y);
  const minI = d.y.indexOf(min);
  const head = d.x.length <= 24 ? d.x.map((x, i) => `${x}: ${fmt(d.y[i])}`).join(', ') : `${fmt(d.x.length)} notes`;
  return `${d.label}. ${head}. Highest note ${d.x[maxI]} (${fmt(max)}), lowest ${d.x[minI]} (${fmt(min)}).`;
}
function renderGraphTexts() {
  const y = graphData('months');
  $('#graph-months').textContent = y ? graphText(y) : 'Needs star dates. They arrive with the next weekly data refresh.';
  $('[data-graph="months"]').disabled = !y;
  $('#graph-languages').textContent = graphText(graphData('languages'));
  $('#graph-licenses').textContent = graphText(graphData('licenses'));
}
function renderGroupGraphText() { $('#graph-group').textContent = graphText(graphData('group')); }
function playGraph(kind) {
  ensureAudio();
  if (!ctx) return;
  stopSweep(false);
  stopGraph();
  const d = graphData(kind);
  if (!d || !d.y.length) return;
  const btn = document.querySelector(`[data-graph="${kind}"]`);
  btn.classList.add('playing');
  state.graph = sonify(ctx, master, d, {}, () => {}, () => {
    btn.classList.remove('playing');
    state.graph = null;
    announce('Graph finished.');
  });
}

/* ---------- Legend ---------- */
function renderLegend() {
  const ul = $('#legend');
  const words = {
    permissive: 'Glass chime: permissive license (MIT, Apache, BSD, ISC). Safe to mash up.',
    publicdomain: 'Bright chime: public domain (CC0, Unlicense). Safe to mash up.',
    weak: 'Pluck: weak copyleft (LGPL, MPL, EPL). Changed files keep their license.',
    copyleft: 'Bell: copyleft (GPL, AGPL). Using it makes your whole project GPL.',
    other: 'Question sound: unrecognized or content license (like CC BY). Check first.',
    none: 'Buzz: no license. Look and link, never copy.',
  };
  FAMILY_ORDER.forEach((f) => {
    const item = document.createElement('li');
    const b = document.createElement('button');
    b.type = 'button';
    b.dataset.family = f;
    b.textContent = `Hear it. ${words[f]}`;
    item.appendChild(b);
    ul.appendChild(item);
  });
  const toneLi = document.createElement('li');
  const tb = document.createElement('button');
  tb.type = 'button';
  tb.id = 'hear-scale';
  tb.textContent = 'Hear it. Notes from 1 star (lowest) up to the most starred repo (highest).';
  toneLi.appendChild(tb);
  ul.appendChild(toneLi);
}

/* ---------- Wiring ---------- */
function bind() {
  $('#start-btn').addEventListener('click', () => {
    ensureAudio();
    state.started = true;
    $('#explore-title').focus();
    const r = current();
    setTimeout(() => { playRepo(r); announce(`Ready. ${r ? sayLine(r) : ''} Use Next star and Previous star, or the Position slider.`); }, 450);
  });
  $('#next').addEventListener('click', () => go(state.pos + 1));
  $('#prev').addEventListener('click', () => go(state.pos - 1));
  $('#again').addEventListener('click', () => go(state.pos));
  $('#details-btn').addEventListener('click', () => openDetails());
  $('#next-group').addEventListener('click', () => goGroup(1));
  $('#prev-group').addEventListener('click', () => goGroup(-1));
  el.sweep.addEventListener('click', () => (state.sweepTimer ? stopSweep() : startSweep()));
  el.position.addEventListener('input', () => {
    stopSweep(false);
    // VoiceOver reads the slider's own value text, so no extra announcement here.
    go(Number(el.position.value), { speakIt: opts.speech });
  });
  el.arrange.addEventListener('change', () => {
    state.arrange = el.arrange.value;
    state.groupIdx = 0;
    stopSweep(false);
    rebuild(null);
    const g = state.groups[state.groupIdx];
    announce(`${fmt(state.groups.length)} ${state.groups.length === 1 ? 'group' : 'groups'}. Now in ${g ? g.label : 'nothing'}.`);
  });
  el.group.addEventListener('change', () => {
    state.groupIdx = Number(el.group.value);
    stopSweep(false);
    loadGroup();
    const g = state.groups[state.groupIdx];
    announce(`${g.label}, ${fmt(g.repos.length)} repos.`);
  });
  el.order.addEventListener('change', () => {
    state.order = el.order.value;
    stopSweep(false);
    loadGroup();
    announce(`Order changed. ${current() ? 'First: ' + shortLine(current()) : ''}`);
  });
  el.safe.addEventListener('change', () => {
    state.safeOnly = el.safe.checked;
    stopSweep(false);
    state.findQuery = '';
    rebuild(current());
    renderGraphTexts();
    announce(state.safeOnly ? `Only mash-up safe stars: ${fmt(filtered().length)}.` : `All ${fmt(filtered().length)} stars.`);
  });
  el.list.addEventListener('click', (e) => {
    const b = e.target.closest('.repo-btn');
    if (!b) return;
    stopSweep(false);
    go(Number(b.dataset.pos), { speakIt: opts.speech });
  });
  el.more.addEventListener('click', () => {
    const first = state.listShown;
    state.listShown += 25;
    renderList();
    const next = el.list.querySelectorAll('.repo-btn')[first];
    if (next) next.focus();
  });
  $('#find-form').addEventListener('submit', (e) => { e.preventDefault(); find($('#find').value); });
  $('#find').addEventListener('input', () => { state.findQuery = ''; });
  document.querySelectorAll('[data-graph]').forEach((b) => b.addEventListener('click', () => playGraph(b.dataset.graph)));
  $('#graph-stop').addEventListener('click', () => { stopGraph(); document.querySelectorAll('.playing').forEach((x) => x.classList.remove('playing')); announce('Graph stopped.'); });
  $('#legend').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    ensureAudio();
    if (b.id === 'hear-scale') {
      [1, 10, 100, 1000, 10000, 100000, state.maxStars].forEach((s, i) => playTone(noteFor(s, state.maxStars), 0.1 + i * 0.28, 0.25));
    } else {
      playSound(FAMILIES[b.dataset.family].sound);
    }
  });
  // Settings
  const checks = { earcons: '#opt-earcons', tones: '#opt-tones', speech: '#opt-speech', haptics: '#opt-haptics' };
  for (const [k, sel] of Object.entries(checks)) {
    const c = $(sel);
    c.checked = !!opts[k];
    c.addEventListener('change', () => { opts[k] = c.checked; saveOpts(); if (k === 'speech' && !c.checked && 'speechSynthesis' in window) speechSynthesis.cancel(); });
  }
  if (!('speechSynthesis' in window)) { $('#opt-speech').disabled = true; }
  const speed = $('#opt-speed');
  speed.value = String(opts.speed);
  speed.addEventListener('change', () => { opts.speed = Number(speed.value); saveOpts(); });
  const vol = $('#opt-volume');
  vol.value = String(opts.volume);
  vol.setAttribute('aria-valuetext', `${opts.volume} percent`);
  vol.addEventListener('input', () => {
    opts.volume = Number(vol.value);
    vol.setAttribute('aria-valuetext', `${opts.volume} percent`);
    if (master) master.gain.value = opts.volume / 100;
    saveOpts();
  });
  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'Escape') { stopSweep(); stopGraph(); if ('speechSynthesis' in window) speechSynthesis.cancel(); return; }
    if (dialogEl.getAttribute('aria-hidden') !== 'true') return;
    const t = e.target;
    const tag = t.tagName;
    if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || t.isContentEditable) return;
    const onControl = tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY';
    if (onControl && (e.key === ' ' || e.key === 'Enter')) return;
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    const map = {
      ArrowRight: () => go(state.pos + 1), j: () => go(state.pos + 1),
      ArrowLeft: () => go(state.pos - 1), k: () => go(state.pos - 1),
      ArrowDown: () => goGroup(1), ArrowUp: () => goGroup(-1),
      d: () => openDetails(), ' ': () => go(state.pos), p: () => go(state.pos),
      s: () => (state.sweepTimer ? stopSweep() : startSweep()),
      '/': () => $('#find').focus(),
    };
    if (map[k]) { e.preventDefault(); map[k](); }
  });
}

/* ---------- Boot ---------- */
async function boot() {
  renderLegend();
  bind();
  try {
    const [starsRes, licRes] = await Promise.all([fetch('data/stars.json'), fetch('data/licenses.json')]);
    if (!starsRes.ok) throw new Error(`stars.json answered ${starsRes.status}`);
    const data = await starsRes.json();
    const lic = licRes.ok ? await licRes.json() : { licenses: {} };
    state.licenses = lic.licenses || {};
    const f = data.fields;
    const ix = (name) => f.indexOf(name);
    state.repos = data.repos.map((row, i) => {
      const license = row[ix('license')] || 'none';
      return {
        i,
        repo: row[ix('name')],
        language: row[ix('language')] || '',
        license,
        family: familyOf(license),
        stars: Number(row[ix('stars')]) || 0,
        description: row[ix('description')] || '',
        starredAt: row[ix('starred_at')] || null,
      };
    });
    state.maxStars = state.repos.reduce((m, r) => Math.max(m, r.stars), 1);
    state.hasDates = state.repos.some((r) => r.starredAt);
    if (!state.hasDates) {
      for (const v of ['year', 'month']) {
        const o = el.arrange.querySelector(`option[value="${v}"]`);
        o.disabled = true;
        o.textContent += ' (needs star dates, coming with the next refresh)';
      }
    }
    $('#total-count').textContent = fmt(state.repos.length);
    $('#load-status').textContent = `${fmt(state.repos.length)} stars loaded.`;
    $('#data-note').textContent = `Star data from ${data.generated}${data.source ? ': ' + data.source : ''}. It refreshes weekly.`;
    // Restore the last view.
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem('stargazer-view') || '{}'); } catch (e) { /* ignore */ }
    if (saved.arrange && !((saved.arrange === 'year' || saved.arrange === 'month') && !state.hasDates)) state.arrange = saved.arrange;
    if (saved.order) state.order = saved.order;
    state.safeOnly = !!saved.safeOnly;
    el.arrange.value = state.arrange;
    el.order.value = state.order;
    el.safe.checked = state.safeOnly;
    const keep = saved.repo ? state.repos.find((r) => r.repo === saved.repo) : null;
    rebuild(keep && (!state.safeOnly || FAMILIES[keep.family].safe) ? keep : null);
    renderGraphTexts();
    document.body.classList.add('ready');
  } catch (err) {
    $('#load-status').textContent = `Could not load the star data (${err.message}). Try reloading the page.`;
  }
}
boot();
