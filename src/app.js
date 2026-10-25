'use strict';

/* =========================================================
   Utilities
   ========================================================= */

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

const esc = (s) =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function dayStr(d = new Date()) {
  const dt = d instanceof Date ? d : new Date(d);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}
function addDays(str, n) {
  const [y, m, d] = str.split('-').map(Number);
  return dayStr(new Date(y, m - 1, d + n));
}
function parseDay(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const WEEKDAYS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];
const WEEKDAYS_LONG = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];

function fmtDate(str) {
  const d = parseDay(str);
  const s = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === new Date().getFullYear() ? s : `${s} ${d.getFullYear()}`;
}
function relDate(str) {
  const t = dayStr();
  if (str === t) return 'Сегодня';
  if (str === addDays(t, 1)) return 'Завтра';
  if (str === addDays(t, -1)) return 'Вчера';
  return fmtDate(str);
}

function fmtDur(ms) {
  if (!ms || ms < 0) return '0м';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h && m) return `${h}ч ${m}м`;
  if (h) return `${h}ч`;
  if (m) return `${m}м`;
  return '<1м';
}
function fmtClock(ms) {
  const s = Math.floor((ms || 0) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
/** "1ч 30м", "1h30m", "1:30", "90" (minutes), "1.5ч" → ms. Empty → 0, garbage → null. */
function parseDur(input) {
  const s = String(input || '').trim().toLowerCase().replace(',', '.');
  if (!s) return 0;
  let m = s.match(/^(\d+):(\d{1,2})$/);
  if (m) return (+m[1] * 60 + +m[2]) * 60000;
  if (/^\d+(\.\d+)?$/.test(s)) return Math.round(parseFloat(s) * 60000);
  let total = 0;
  let matched = false;
  const h = s.match(/(\d+(?:\.\d+)?)\s*(h|ч|час)/);
  const mi = s.match(/(\d+)\s*(m(?!o)|м|мин)/);
  if (h) { total += parseFloat(h[1]) * 3600000; matched = true; }
  if (mi) { total += parseInt(mi[1], 10) * 60000; matched = true; }
  return matched ? Math.round(total) : null;
}

function fmtTimeOfDay(ts) {
  const d = new Date(ts);
  return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Two number boxes, hours and minutes. `attrs` goes on the wrapper (id, data-*). */
function durField(ms, attrs = '') {
  const total = Math.round((ms || 0) / 60000);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `<span class="dur" ${attrs}>
    <input type="number" class="dh" min="0" max="999" step="1" value="${ms ? h : ''}" placeholder="0" aria-label="часы" /><span class="u">ч</span>
    <input type="number" class="dm" min="0" max="59" step="5" value="${ms ? m : ''}" placeholder="0" aria-label="минуты" /><span class="u">мин</span>
  </span>`;
}
/** Reads a durField; minutes over 59 simply roll into hours. */
function readDur(el) {
  const num = (inp) => Math.max(0, Math.floor(Number(inp.value) || 0));
  return (num(el.querySelector('.dh')) * 60 + num(el.querySelector('.dm'))) * 60000;
}
function setDur(el, ms) {
  const total = Math.round(ms / 60000);
  el.querySelector('.dh').value = ms ? Math.floor(total / 60) : '';
  el.querySelector('.dm').value = ms ? total % 60 : '';
}

const COLORS = ['#5b5bd6', '#3e8ed0', '#2f9e8f', '#4caf50', '#c9a227', '#e0803a', '#d4483b', '#d0447b', '#9b59d0', '#7a7f8c'];

const ICONS = {
  sun: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>',
  inbox: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-6l-2 3h-4l-2-3H2"/><path d="M5.5 5.1 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.5-6.9A2 2 0 0 0 16.7 4H7.3a2 2 0 0 0-1.8 1.1z"/></svg>',
  calendar: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="3" y="4.5" width="18" height="17" rx="3"/><path d="M8 2.5v4M16 2.5v4M3 10h18"/></svg>',
  list: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M9 6h12M9 12h12M9 18h12M4 6h.01M4 12h.01M4 18h.01"/></svg>',
  chart: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 4.5v15a1 1 0 0 0 1.5.9l12-7.5a1 1 0 0 0 0-1.8l-12-7.5A1 1 0 0 0 7 4.5z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><rect x="5.5" y="4" width="4.5" height="16" rx="1.2"/><rect x="14" y="4" width="4.5" height="16" rx="1.2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  trash: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4.5A1.5 1.5 0 0 1 9.5 3h5A1.5 1.5 0 0 1 16 4.5V6M18.5 6l-.8 13.1a2 2 0 0 1-2 1.9H8.3a2 2 0 0 1-2-1.9L5.5 6"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  note: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M4 6h16M4 12h16M4 18h10"/></svg>',
  subs: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3 8-8"/><path d="M20 12v6a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9"/></svg>',
  clock: '<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
};

// Fallback so the UI also runs in a plain browser (for previews)
if (!window.flow) {
  window.flow = {
    load: async () => JSON.parse(localStorage.getItem('flow-data') || 'null'),
    save: async (d) => localStorage.setItem('flow-data', JSON.stringify(d)),
    openJson: async () => null,
    saveJson: async () => false,
    notify: async () => {},
    setTitlebarTheme: async () => {},
    status: () => {},
    quitReady: () => {},
    onTrayToggle: () => {},
    onTrayHinted: () => {},
    onBeforeQuit: () => {},
    onIdleStart: () => {},
    onIdleEnd: () => {},
    onIdleCancel: () => {},
  };
}

/* =========================================================
   State & persistence
   ========================================================= */

const DEFAULT_STATE = () => ({
  version: 1,
  tasks: {},
  projects: {},
  tags: {},
  current: null, // { taskId, since }
  lastTaskId: null, // what "continue" in the tray resumes
  settings: DEFAULT_SETTINGS(),
});
// idleMin: minutes without mouse/keyboard before asking what to do with that time; 0 = off
const DEFAULT_SETTINGS = () => ({ theme: 'system', closeToTray: true, idleMin: 5, trayHinted: false });

let state = DEFAULT_STATE();
const ui = {
  view: { type: 'today' },
  selected: null,
  collapsed: { done: true },
  reportRange: 7,
};

let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => window.flow.save(state), 250);
}
function saveNow() {
  clearTimeout(saveTimer);
  return window.flow.save(state);
}

async function load() {
  const data = await window.flow.load();
  if (data && data.tasks) {
    state = Object.assign(DEFAULT_STATE(), data);
    state.settings = Object.assign(DEFAULT_SETTINGS(), data.settings);
  } else {
    seed();
  }
  // Time while the app was closed isn't counted
  if (state.current) state.current.since = Date.now();
}

function seed() {
  const p = addProject('Личное', COLORS[0]);
  const w = addProject('Работа', COLORS[2]);
  const t = addTag('важно', COLORS[6]);
  const today = dayStr();
  const a = addTask({ title: 'Посмотреть, как устроен Quill Track', due: today, projectId: p.id });
  addTask({ title: 'Нажать ▶ на задаче, чтобы засечь время', parentId: a.id });
  addTask({ title: 'Открыть задачу кликом и добавить заметку', parentId: a.id });
  addTask({ title: 'Импортировать данные из SuperProductivity (Настройки)', due: today, projectId: w.id, tagIds: [t.id] });
  addTask({ title: 'Перетащить задачу на проект в боковой панели', projectId: w.id, estimate: 15 * 60000 });
}

/* ---------- Model helpers ---------- */

function addProject(title, color) {
  const p = { id: uid(), title, color: color || COLORS[0], created: Date.now() };
  state.projects[p.id] = p;
  save();
  return p;
}
function addTag(title, color) {
  const t = { id: uid(), title, color: color || COLORS[Object.keys(state.tags).length % COLORS.length], created: Date.now() };
  state.tags[t.id] = t;
  save();
  return t;
}
function maxOrder() {
  let m = 0;
  for (const t of Object.values(state.tasks)) if (t.order > m) m = t.order;
  return m;
}
function addTask(data) {
  const t = Object.assign(
    {
      id: uid(),
      title: '',
      notes: '',
      done: false,
      doneAt: null,
      projectId: null,
      tagIds: [],
      parentId: null,
      subIds: [],
      due: null,
      estimate: 0,
      timeByDay: {},
      created: Date.now(),
      order: maxOrder() + 1,
      expanded: true,
    },
    data
  );
  state.tasks[t.id] = t;
  if (t.parentId && state.tasks[t.parentId]) {
    const parent = state.tasks[t.parentId];
    parent.subIds.push(t.id);
    t.projectId = parent.projectId;
  }
  save();
  return t;
}

function ownTime(t) {
  let s = 0;
  for (const v of Object.values(t.timeByDay || {})) s += v;
  return s;
}
function totalTime(t) {
  let s = ownTime(t);
  for (const id of t.subIds || []) if (state.tasks[id]) s += ownTime(state.tasks[id]);
  return s;
}
function timeOnDay(t, day) {
  let s = t.timeByDay?.[day] || 0;
  for (const id of t.subIds || []) s += state.tasks[id]?.timeByDay?.[day] || 0;
  return s;
}
function totalEstimate(t) {
  if (t.estimate) return t.estimate;
  let s = 0;
  for (const id of t.subIds || []) s += state.tasks[id]?.estimate || 0;
  return s;
}
function topLevel() {
  return Object.values(state.tasks).filter((t) => !t.parentId);
}
const byOrder = (a, b) => a.order - b.order;

function deleteTask(id) {
  const t = state.tasks[id];
  if (!t) return [];
  const removed = [t, ...t.subIds.map((s) => state.tasks[s]).filter(Boolean)];
  removed.forEach((r) => delete state.tasks[r.id]);
  if (t.parentId && state.tasks[t.parentId]) {
    const p = state.tasks[t.parentId];
    p.subIds = p.subIds.filter((s) => s !== id);
  }
  if (state.current && removed.some((r) => r.id === state.current.taskId)) state.current = null;
  if (ui.selected && removed.some((r) => r.id === ui.selected)) ui.selected = null;
  save();
  return removed.map((r) => JSON.parse(JSON.stringify(r)));
}
function restoreTasks(list) {
  for (const t of list) state.tasks[t.id] = t;
  for (const t of list) {
    if (t.parentId && state.tasks[t.parentId] && !state.tasks[t.parentId].subIds.includes(t.id)) {
      state.tasks[t.parentId].subIds.push(t.id);
    }
  }
  save();
}

function toggleDone(id) {
  const t = state.tasks[id];
  if (!t) return;
  t.done = !t.done;
  t.doneAt = t.done ? Date.now() : null;
  if (t.done && state.current?.taskId === id) stopTracking();
  if (t.done && !t.parentId) {
    // finishing a parent also finishes its open subtasks
    for (const s of t.subIds) {
      const st = state.tasks[s];
      if (st && !st.done) { st.done = true; st.doneAt = Date.now(); }
      if (state.current?.taskId === s) stopTracking();
    }
  }
  save();
}

/* ---------- Time tracking ---------- */

function startTracking(id) {
  flushTracking();
  const t = state.tasks[id];
  if (!t) return;
  if (t.done) { t.done = false; t.doneAt = null; }
  state.current = { taskId: id, since: Date.now() };
  save();
}
function stopTracking() {
  flushTracking();
  if (state.current) state.lastTaskId = state.current.taskId;
  state.current = null;
  save();
}
function toggleTracking(id) {
  if (state.current?.taskId === id) stopTracking();
  else startTracking(id);
  renderAll();
}
/** Adds (or with sign -1 removes) the span [from, to) to a task, split by calendar day. */
function addSpan(task, from, to, sign = 1) {
  let a = from;
  while (a < to) {
    const d = new Date(a);
    const midnight = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
    const b = Math.min(to, midnight);
    const day = dayStr(d);
    const v = (task.timeByDay[day] || 0) + sign * (b - a);
    if (v > 0) task.timeByDay[day] = v;
    else delete task.timeByDay[day];
    a = b;
  }
}

/*
 * Away time. While the timer runs, an absence longer than the threshold is held
 * aside and the user decides where it goes when they're back. Two sources:
 * main reports mouse/keyboard inactivity (powerMonitor), and a long gap between
 * ticks here means the PC was asleep.
 */
let idle = null; // { taskId, from, to? }

function flushTracking() {
  if (!state.current) return;
  const t = state.tasks[state.current.taskId];
  const now = Date.now();
  if (!t) { state.current = null; return; }
  const since = state.current.since;
  state.current.since = now;
  if (idle) return; // nothing is counted while the user is away
  const delta = now - since;
  if (delta <= 0) return;
  // ticks come every second, so a long gap means the PC slept
  if (delta > 60000) {
    const thr = state.settings.idleMin * 60000;
    if (thr && delta >= thr) return awayDetected(since, now);
    if (!thr && delta > 5 * 60000) return; // detection off: sleep isn't work, drop it as before
  }
  addSpan(t, since, now);
}

function idleStarted(from) {
  if (idle || !state.current) return;
  flushTracking();
  const t = state.tasks[state.current.taskId];
  // the threshold minutes were already counted — take them back until the user decides
  const from2 = Math.max(from, Date.now() - 24 * 3600000);
  addSpan(t, from2, Date.now(), -1);
  idle = { taskId: t.id, from: from2 };
  save();
}
function idleEnded(to) {
  if (!idle || idle.to) return;
  idle.to = Math.min(to, Date.now());
  if (state.current) state.current.since = Date.now();
  openIdleModal();
}
function idleCancelled() {
  // the timer was stopped or detection switched off while away: give the time back
  if (!idle || idle.to) return;
  const t = state.tasks[idle.taskId];
  if (t) addSpan(t, idle.from, Date.now());
  idle = null;
  save();
  renderAll();
}
function awayDetected(from, to) {
  if (idle) return;
  idle = { taskId: state.current.taskId, from, to };
  openIdleModal();
}

let tickCount = 0;
function tick() {
  if (state.current) {
    flushTracking();
    tickCount++;
    if (tickCount % 10 === 0) save();
    liveUpdate();
  }
  sendStatus();
}

/** Tray tooltip/menu and idle watching live in main; keep it informed. */
function sendStatus() {
  const cur = state.current && state.tasks[state.current.taskId];
  window.flow.status({
    tracking: !!cur,
    title: cur ? cur.title || 'Без названия' : '',
    clock: cur ? fmtClock(totalTime(cur)) : '',
    canResume: !!state.tasks[state.lastTaskId],
    closeToTray: state.settings.closeToTray,
    idleMin: state.settings.idleMin,
    trayHinted: state.settings.trayHinted,
  });
}

function liveUpdate() {
  renderTracker();
  if (!state.current) return;
  const t = state.tasks[state.current.taskId];
  if (!t) return;
  const ids = [t.id, t.parentId].filter(Boolean);
  for (const id of ids) {
    const task = state.tasks[id];
    $$(`[data-live="${id}"]`).forEach((el) => (el.textContent = fmtDur(totalTime(task))));
  }
  const dtv = $('#d-tv');
  if (dtv && ui.selected) {
    const sel = state.tasks[ui.selected];
    if (sel) {
      dtv.textContent = fmtClock(totalTime(sel));
      const dtt = $('#d-today');
      if (dtt) dtt.textContent = fmtDur(timeOnDay(sel, dayStr()));
    }
  }
  const tt = $('#stat-today');
  if (tt) tt.textContent = fmtDur(spentOnDay(dayStr()));
}

function spentOnDay(day) {
  let s = 0;
  for (const t of Object.values(state.tasks)) s += t.timeByDay?.[day] || 0;
  return s;
}

/* =========================================================
   Theme
   ========================================================= */

const mql = window.matchMedia('(prefers-color-scheme: dark)');
function applyTheme() {
  const pref = state.settings.theme;
  const dark = pref === 'dark' || (pref === 'system' && mql.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  window.flow.setTitlebarTheme(dark);
}
mql.addEventListener('change', applyTheme);

/* =========================================================
   Rendering — sidebar
   ========================================================= */

function viewIs(type, id) {
  return ui.view.type === type && (id === undefined || ui.view.id === id);
}

/** Open tasks whose due date matches; a subtask is listed on its own unless its parent already is. */
function datedOpen(pred) {
  const hit = (t) => t && !t.done && t.due && pred(t.due);
  return Object.values(state.tasks).filter((t) => hit(t) && !(t.parentId && hit(state.tasks[t.parentId])));
}
function todayTasks() {
  const t = dayStr();
  return datedOpen((d) => d <= t);
}

function renderSidebar() {
  const open = (f) => topLevel().filter((t) => !t.done && f(t)).length;
  const nav = (type, icon, label, count, id) => `
    <button class="nav-item ${viewIs(type, id) ? 'active' : ''}" data-nav="${type}" ${id ? `data-id="${id}"` : ''} ${
      ['today', 'inbox'].includes(type) ? `data-drop="${type}"` : ''
    }>
      <span class="ic">${icon}</span><span class="label">${esc(label)}</span>
      ${count ? `<span class="count">${count}</span>` : ''}
    </button>`;

  const projects = Object.values(state.projects).sort((a, b) => a.created - b.created);
  const tags = Object.values(state.tags).sort((a, b) => a.title.localeCompare(b.title, 'ru'));

  $('#sidebar').innerHTML = `
    ${nav('today', ICONS.sun, 'Сегодня', todayTasks().length)}
    ${nav('inbox', ICONS.inbox, 'Без проекта', open((t) => !t.projectId))}
    ${nav('upcoming', ICONS.calendar, 'Предстоящие', datedOpen((d) => d > dayStr()).length)}
    ${nav('all', ICONS.list, 'Все задачи', open(() => true))}

    <div class="nav-section"><span>Проекты</span><button data-action="new-project" title="Новый проект">${ICONS.plus}</button></div>
    ${projects
      .map(
        (p) => `
      <button class="nav-item ${viewIs('project', p.id) ? 'active' : ''}" data-nav="project" data-id="${p.id}" data-drop="project">
        <span class="ic"><span class="swatch" style="background:${p.color}"></span></span>
        <span class="label">${esc(p.title)}</span>
        <span class="count">${open((t) => t.projectId === p.id) || ''}</span>
      </button>`
      )
      .join('')}

    <div class="nav-section"><span>Теги</span><button data-action="new-tag" title="Новый тег">${ICONS.plus}</button></div>
    ${tags
      .map(
        (t) => `
      <button class="nav-item ${viewIs('tag', t.id) ? 'active' : ''}" data-nav="tag" data-id="${t.id}" data-drop="tag">
        <span class="ic"><span class="hash" style="color:${t.color}">#</span></span>
        <span class="label">${esc(t.title)}</span>
        <span class="count">${open((x) => x.tagIds.includes(t.id)) || ''}</span>
      </button>`
      )
      .join('')}

    <div class="spacer"></div>
    ${nav('reports', ICONS.chart, 'Отчёты')}
    ${nav('settings', ICONS.gear, 'Настройки')}
  `;
}

/* =========================================================
   Rendering — tracker
   ========================================================= */

function renderTracker() {
  const el = $('#tracker');
  const cur = state.current && state.tasks[state.current.taskId];
  if (!cur) {
    const today = spentOnDay(dayStr());
    el.innerHTML = `<span class="tracker-idle">${today ? `Сегодня отработано ${fmtDur(today)}` : 'Таймер не запущен'}</span>`;
    return;
  }
  const pill = el.querySelector('.tracker-pill');
  if (pill && pill.dataset.id === cur.id) {
    pill.querySelector('.t-time').textContent = fmtClock(totalTime(cur));
    return;
  }
  el.innerHTML = `
    <div class="tracker-pill" data-id="${cur.id}">
      <span class="dot"></span>
      <span class="t-title" data-open="${cur.id}">${esc(cur.title || 'Без названия')}</span>
      <span class="t-time">${fmtClock(totalTime(cur))}</span>
      <button data-track="${cur.id}" title="Пауза">${ICONS.pause.replace('<svg', '<svg width="11" height="11"')}</button>
    </div>`;
}

/* =========================================================
   Rendering — main area
   ========================================================= */

function renderMain() {
  // keep what the user is typing in the add bar across re-renders
  const add = $('#addbar-input');
  const draft = add ? add.value : '';
  const hadFocus = add && document.activeElement === add;
  const scroll = $('#main').scrollTop;

  const v = ui.view.type;
  let html;
  if (v === 'reports') html = renderReports();
  else if (v === 'settings') html = renderSettings();
  else html = renderListView();
  $('#main').innerHTML = `<div class="main-inner">${html}</div>`;

  const add2 = $('#addbar-input');
  if (add2) {
    add2.value = draft;
    if (hadFocus) add2.focus();
  }
  $('#main').scrollTop = scroll;
}

function listMeta() {
  const v = ui.view;
  const today = dayStr();
  if (v.type === 'today') {
    const d = new Date();
    return { title: 'Сегодня', sub: `${WEEKDAYS_LONG[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`, ctx: { due: today } };
  }
  if (v.type === 'inbox') return { title: 'Без проекта', sub: 'Задачи, которые не относятся ни к одному проекту', ctx: {} };
  if (v.type === 'upcoming') return { title: 'Предстоящие', sub: 'Задачи со сроком в будущем', ctx: { due: addDays(today, 1) } };
  if (v.type === 'all') return { title: 'Все задачи', sub: 'Всё, что не сделано', ctx: {} };
  if (v.type === 'project') {
    const p = state.projects[v.id];
    return { title: p?.title, color: p?.color, sub: 'Проект', ctx: { projectId: v.id }, editable: 'project' };
  }
  if (v.type === 'tag') {
    const t = state.tags[v.id];
    return { title: `#${t?.title}`, sub: 'Тег', ctx: { tagIds: [v.id] }, editable: 'tag' };
  }
  return { title: '', ctx: {} };
}

function groupsForView() {
  const v = ui.view;
  const today = dayStr();
  const all = topLevel();
  const open = all.filter((t) => !t.done);
  const doneSorted = (list) => list.sort((a, b) => (b.doneAt || 0) - (a.doneAt || 0));
  const groups = [];

  if (v.type === 'today') {
    const overdue = datedOpen((d) => d < today).sort(byOrder);
    const td = datedOpen((d) => d === today).sort(byOrder);
    if (overdue.length) groups.push({ key: 'overdue', title: 'Просрочено', tasks: overdue });
    groups.push({ key: 'today', title: overdue.length ? 'На сегодня' : null, tasks: td });
    const doneOnDay = (t) => t && t.done && t.doneAt && dayStr(t.doneAt) === today;
    const doneToday = Object.values(state.tasks).filter((t) => doneOnDay(t) && !(t.parentId && doneOnDay(state.tasks[t.parentId])));
    if (doneToday.length) groups.push({ key: 'done', title: 'Выполнено сегодня', tasks: doneSorted(doneToday), collapsible: true });
  } else if (v.type === 'upcoming') {
    const future = datedOpen((d) => d > today).sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : a.order - b.order));
    const byDay = {};
    future.forEach((t) => (byDay[t.due] ||= []).push(t));
    Object.keys(byDay)
      .sort()
      .forEach((d) => {
        const dt = parseDay(d);
        groups.push({ key: 'd' + d, title: `${relDate(d)} · ${WEEKDAYS[dt.getDay()]}`, tasks: byDay[d], due: d });
      });
    if (!groups.length) groups.push({ key: 'empty', tasks: [] });
  } else if (v.type === 'all') {
    const noProj = open.filter((t) => !t.projectId).sort(byOrder);
    if (noProj.length) groups.push({ key: 'inbox', title: 'Без проекта', tasks: noProj });
    Object.values(state.projects)
      .sort((a, b) => a.created - b.created)
      .forEach((p) => {
        const list = open.filter((t) => t.projectId === p.id).sort(byOrder);
        if (list.length) groups.push({ key: 'p' + p.id, title: p.title, color: p.color, tasks: list });
      });
    if (!groups.length) groups.push({ key: 'empty', tasks: [] });
  } else {
    const match =
      v.type === 'inbox' ? (t) => !t.projectId : v.type === 'project' ? (t) => t.projectId === v.id : (t) => t.tagIds.includes(v.id);
    groups.push({ key: 'open', tasks: open.filter(match).sort(byOrder) });
    const done = all.filter((t) => t.done && match(t));
    if (done.length) groups.push({ key: 'done', title: 'Выполнено', tasks: doneSorted(done), collapsible: true });
  }
  return groups;
}

function renderListView() {
  const meta = listMeta();
  if (!meta.title) {
    ui.view = { type: 'today' };
    return renderListView();
  }
  const groups = groupsForView();
  const today = dayStr();

  let stats = '';
  let progress = '';
  if (ui.view.type === 'today') {
    const list = todayTasks();
    const doneOnDay = (t) => t && t.done && t.doneAt && dayStr(t.doneAt) === today;
    const doneToday = Object.values(state.tasks).filter((t) => doneOnDay(t) && !(t.parentId && doneOnDay(state.tasks[t.parentId]))).length;
    const remaining = list.reduce((s, t) => s + Math.max(0, totalEstimate(t) - totalTime(t)), 0);
    const total = list.length + doneToday;
    stats = `
      <div class="head-stats">
        <div class="stat"><div class="v" id="stat-today">${fmtDur(spentOnDay(today))}</div><div class="k">Отработано</div></div>
        <div class="stat"><div class="v">${remaining ? fmtDur(remaining) : '—'}</div><div class="k">Осталось</div></div>
        <div class="stat"><div class="v">${doneToday}/${total}</div><div class="k">Готово</div></div>
      </div>`;
    progress = total ? `<div class="progress"><div style="width:${Math.round((doneToday / total) * 100)}%"></div></div>` : '';
  } else if (ui.view.type === 'project' || ui.view.type === 'tag') {
    const match = ui.view.type === 'project' ? (t) => t.projectId === ui.view.id : (t) => t.tagIds.includes(ui.view.id);
    const list = topLevel().filter(match);
    const spent = list.reduce((s, t) => s + totalTime(t), 0);
    const openN = list.filter((t) => !t.done).length;
    stats = `
      <div class="head-stats">
        <div class="stat"><div class="v">${fmtDur(spent)}</div><div class="k">Всего времени</div></div>
        <div class="stat"><div class="v">${openN}</div><div class="k">Открыто</div></div>
      </div>`;
  }

  const head = `
    <div class="page-head">
      <div>
        <h1 class="page-title" ${meta.editable ? `data-action="edit-${meta.editable}" style="cursor:pointer" title="Изменить"` : ''}>
          ${meta.color ? `<span class="swatch" style="background:${meta.color}"></span>` : ''}${esc(meta.title)}
        </h1>
        <div class="page-sub">${esc(meta.sub || '')}</div>
      </div>
      ${stats}
    </div>
    ${progress}
    <div class="addbar">
      <span class="plus">+</span>
      <input id="addbar-input" placeholder="Новая задача…" autocomplete="off" spellcheck="false" />
      <span class="hint">#тег &nbsp;+проект &nbsp;~30м &nbsp;@завтра</span>
    </div>`;

  const body = groups
    .map((g) => {
      if (!g.tasks.length && g.key !== 'empty' && g.key !== 'open' && g.key !== 'today') return '';
      const collapsed = g.collapsible && ui.collapsed[g.key];
      const title = g.title
        ? `<div class="group-title ${g.collapsible ? 'toggle' : ''} ${collapsed ? 'collapsed' : ''}" ${
            g.collapsible ? `data-collapse="${g.key}"` : ''
          }>
            ${g.collapsible ? ICONS.chev : ''}${g.color ? `<span class="swatch" style="width:8px;height:8px;border-radius:3px;background:${g.color}"></span>` : ''}
            ${esc(g.title)} <span class="n">${g.tasks.length}</span></div>`
        : '';
      if (!g.tasks.length) return title + emptyState();
      if (collapsed) return title;
      return `${title}<div class="tasks" data-group="${g.key}" ${g.due ? `data-due="${g.due}"` : ''}>${g.tasks.map((t) => taskRow(t)).join('')}</div>`;
    })
    .join('');

  return head + body;
}

function emptyState() {
  const v = ui.view.type;
  const msg = {
    today: ['☀️', 'На сегодня всё чисто', 'Добавьте задачу или перетащите её сюда из списка'],
    upcoming: ['🗓️', 'Ничего не запланировано', 'Укажите срок у задачи — она появится здесь'],
    inbox: ['📥', 'Здесь пусто', 'Сюда попадают задачи, которым не выбран проект'],
  }[v] || ['✨', 'Здесь пока пусто', 'Начните с первой задачи'];
  return `<div class="empty"><div class="big">${msg[0]}</div><div class="t">${msg[1]}</div><div>${msg[2]}</div></div>`;
}

function taskRow(t, isSub = false) {
  const today = dayStr();
  const tracking = state.current?.taskId === t.id;
  const v = ui.view;
  const meta = [];

  if (!isSub) {
    const parent = t.parentId && state.tasks[t.parentId];
    if (parent) meta.push(`<span class="m" data-open="${parent.id}" style="cursor:pointer;max-width:280px;display:inline-block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">↳ ${esc(parent.title)}</span>`);
    if (t.projectId && v.type !== 'project' && state.projects[t.projectId]) {
      const p = state.projects[t.projectId];
      meta.push(`<span class="chip"><span class="swatch" style="background:${p.color}"></span>${esc(p.title)}</span>`);
    }
    for (const tid of t.tagIds) {
      const tag = state.tags[tid];
      if (!tag || (v.type === 'tag' && v.id === tid)) continue;
      meta.push(`<span class="chip" style="color:${tag.color}">#${esc(tag.title)}</span>`);
    }
    if (t.due && !t.done) {
      const cls = t.due < today ? 'overdue' : t.due === today ? 'today' : '';
      if (!(v.type === 'today' && t.due === today) && v.type !== 'upcoming') {
        meta.push(`<span class="m ${cls}">${ICONS.calendar.replace(/16/g, '12')}${relDate(t.due)}</span>`);
      }
    }
    if (t.subIds.length) {
      const done = t.subIds.filter((s) => state.tasks[s]?.done).length;
      meta.push(`<span class="m" data-expand="${t.id}" style="cursor:pointer">${ICONS.subs}${done}/${t.subIds.length}</span>`);
    }
    if (t.notes?.trim()) meta.push(`<span class="m">${ICONS.note}</span>`);
  }

  const spent = isSub ? ownTime(t) : totalTime(t);
  const est = isSub ? t.estimate : totalEstimate(t);
  const pct = est ? Math.min(100, (spent / est) * 100) : 0;
  const time =
    spent || est || tracking
      ? `<div class="time"><b data-live="${t.id}">${fmtDur(spent)}</b>${est ? ` / ${fmtDur(est)}` : ''}
         ${est ? `<div class="est-bar ${spent > est ? 'over' : ''}"><div style="width:${pct}%"></div></div>` : ''}</div>`
      : '';

  const row = `
    <div class="task ${t.done ? 'done' : ''} ${tracking ? 'tracking' : ''} ${ui.selected === t.id ? 'selected' : ''} ${isSub ? 'sub' : ''}"
         data-task="${t.id}" ${isSub ? '' : 'draggable="true"'}>
      <button class="check" data-done="${t.id}" title="Готово">${ICONS.check}</button>
      <div class="body">
        <div class="title">${esc(t.title || 'Без названия')}</div>
        <div class="meta">${meta.join('')}</div>
      </div>
      ${time}
      <button class="play" data-track="${t.id}" title="${tracking ? 'Пауза' : 'Засечь время'}">${tracking ? ICONS.pause : ICONS.play}</button>
    </div>`;

  if (isSub || !t.subIds.length || !t.expanded) return row;
  const subs = t.subIds.map((s) => state.tasks[s]).filter(Boolean);
  return row + subs.map((s) => taskRow(s, true)).join('');
}

/* =========================================================
   Rendering — detail panel
   ========================================================= */

function renderDetail() {
  const panel = $('#detail');
  const t = ui.selected && state.tasks[ui.selected];
  if (!t) {
    panel.classList.remove('open');
    panel.innerHTML = '';
    return;
  }
  panel.classList.add('open');
  const tracking = state.current?.taskId === t.id;
  const parent = t.parentId && state.tasks[t.parentId];
  const projectOpts = [`<option value="">Без проекта</option>`]
    .concat(
      Object.values(state.projects)
        .sort((a, b) => a.created - b.created)
        .map((p) => `<option value="${p.id}" ${t.projectId === p.id ? 'selected' : ''}>${esc(p.title)}</option>`)
    )
    .join('');

  const days = Object.keys(t.timeByDay || {})
    .filter((d) => t.timeByDay[d] > 0)
    .sort()
    .reverse();

  panel.innerHTML = `
    <div class="detail-inner">
      <div class="detail-top">
        <div class="crumbs">${parent ? `<span data-open="${parent.id}" style="cursor:pointer">↖ ${esc(parent.title)}</span>` : t.done ? '✓ Выполнено' : ''}</div>
        <div style="display:flex;gap:2px">
          <button class="icon-btn danger" data-action="delete-task" title="Удалить (Del)">${ICONS.trash}</button>
          <button class="icon-btn" data-action="close-detail" title="Закрыть (Esc)">${ICONS.close}</button>
        </div>
      </div>

      <textarea class="d-title" id="d-title" rows="1" spellcheck="false">${esc(t.title)}</textarea>

      <div class="d-timer">
        <button class="big-play" data-track="${t.id}">${tracking ? ICONS.pause : ICONS.play}</button>
        <div>
          <div class="tv" id="d-tv">${fmtClock(totalTime(t))}</div>
          <div class="tl" id="d-tl">${timerLine(t)}</div>
        </div>
      </div>

      ${
        parent
          ? ''
          : `<div class="field"><label>Проект</label><select class="field-input" id="d-project">${projectOpts}</select></div>`
      }
      <div class="field"><label>Срок</label>
        <div style="display:flex;gap:6px;align-items:center">
          <input type="date" class="field-input" id="d-due" value="${t.due || ''}" />
          ${t.due !== dayStr() ? `<button class="btn" style="padding:4px 10px" data-action="due-today">Сегодня</button>` : ''}
        </div>
      </div>
      <div class="field"><label>Оценка</label>
        ${durField(t.estimate, 'id="d-estimate" title="Сколько времени, по-вашему, займёт задача"')}
      </div>
      ${
        parent
          ? ''
          : `<div class="field"><label>Теги</label>
        <div class="tag-editor">
          ${t.tagIds
            .map((id) => state.tags[id])
            .filter(Boolean)
            .map((tag) => `<span class="chip" data-untag="${tag.id}" title="Убрать" style="color:${tag.color}">#${esc(tag.title)}</span>`)
            .join('')}
          <button class="add-tag" data-action="tag-picker">+ тег</button>
        </div>
      </div>`
      }

      <div class="d-section">
        <h4>Заметки</h4>
        <textarea class="d-notes" id="d-notes" placeholder="Детали, ссылки, мысли…">${esc(t.notes)}</textarea>
      </div>

      ${
        parent
          ? ''
          : `<div class="d-section">
        <h4>Подзадачи ${t.subIds.length ? `· ${t.subIds.filter((s) => state.tasks[s]?.done).length}/${t.subIds.length}` : ''}</h4>
        <div class="subs">
          ${t.subIds
            .map((s) => state.tasks[s])
            .filter(Boolean)
            .map(
              (s) => `
            <div class="sub-row ${s.done ? 'done' : ''}">
              <button class="check" data-done="${s.id}">${ICONS.check}</button>
              <span data-open="${s.id}">${esc(s.title)}</span>
              <small style="color:var(--text-3)">${ownTime(s) ? fmtDur(ownTime(s)) : ''}</small>
              <button class="icon-btn x" data-del-sub="${s.id}" style="width:24px;height:24px">${ICONS.close}</button>
            </div>`
            )
            .join('')}
          <input class="sub-add" id="d-subadd" placeholder="+ Добавить подзадачу" />
        </div>
      </div>`
      }

      <div class="d-section">
        <h4>Журнал времени</h4>
        <div class="log">
          ${
            days.length
              ? days
                  .map(
                    (d) => `
            <div class="log-row"><span class="d">${relDate(d)}</span>
              ${durField(t.timeByDay[d], `data-logday="${d}" title="Можно исправить вручную"`)}</div>`
                  )
                  .join('')
              : '<div style="color:var(--text-3);font-size:13px">Время ещё не учитывалось</div>'
          }
          <div class="log-row" style="border:0;padding-top:10px">
            <button class="btn" style="padding:4px 10px;font-size:12.5px" data-action="add-time">+ Добавить время вручную</button>
          </div>
        </div>
      </div>

      <div style="margin-top:26px;font-size:12px;color:var(--text-3)">Создано ${fmtDate(dayStr(t.created))}${
        t.doneAt ? ` · выполнено ${fmtDate(dayStr(t.doneAt))}` : ''
      }</div>
    </div>`;

  autoGrow($('#d-title'));
}

function timerLine(t) {
  const est = totalEstimate(t);
  return `сегодня <span id="d-today">${fmtDur(timeOnDay(t, dayStr()))}</span>${est ? ` · оценка ${fmtDur(est)}` : ''}`;
}

function autoGrow(el) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/* =========================================================
   Rendering — reports
   ========================================================= */

function renderReports() {
  const range = ui.reportRange;
  const single = range === 1;
  const today = dayStr();
  const days = [];
  for (let i = range - 1; i >= 0; i--) days.push(addDays(today, -i));
  const daySet = new Set(days);
  const tasks = Object.values(state.tasks);

  const perDay = days.map((d) => ({ d, v: tasks.reduce((s, t) => s + (t.timeByDay?.[d] || 0), 0) }));
  const total = perDay.reduce((s, x) => s + x.v, 0);
  const max = Math.max(...perDay.map((x) => x.v), 1);
  const activeDays = perDay.filter((x) => x.v > 0).length;
  const completed = tasks.filter((t) => t.done && t.doneAt && daySet.has(dayStr(t.doneAt))).length;

  const perProject = {};
  const perTask = {};
  for (const t of tasks) {
    let s = 0;
    for (const d of days) s += t.timeByDay?.[d] || 0;
    if (!s) continue;
    const root = t.parentId ? state.tasks[t.parentId] || t : t;
    const pid = root.projectId || '_inbox';
    perProject[pid] = (perProject[pid] || 0) + s;
    perTask[root.id] = (perTask[root.id] || 0) + s;
  }
  const projRows = Object.entries(perProject).sort((a, b) => b[1] - a[1]);
  const projMax = projRows[0]?.[1] || 1;
  const taskRows = Object.entries(perTask)
    .sort((a, b) => b[1] - a[1])
    .slice(0, single ? 50 : 10);
  const taskMax = taskRows[0]?.[1] || 1;

  const showLabel = (i) => range <= 14 || i % 5 === 0 || i === days.length - 1;

  return `
    <div class="page-head">
      <div><h1 class="page-title">Отчёты</h1><div class="page-sub">Куда уходит время</div></div>
      <div class="seg">
        <button class="${range === 1 ? 'on' : ''}" data-range="1">Сегодня</button>
        <button class="${range === 7 ? 'on' : ''}" data-range="7">7 дней</button>
        <button class="${range === 30 ? 'on' : ''}" data-range="30">30 дней</button>
      </div>
    </div>

    <div class="cards">
      <div class="card"><div class="k">Сегодня</div><div class="v">${fmtDur(spentOnDay(today))}</div><div class="s">отработано</div></div>
      ${
        single
          ? `<div class="card"><div class="k">В работе</div><div class="v">${Object.keys(perTask).length}</div><div class="s">задач с учтённым временем</div></div>`
          : `<div class="card"><div class="k">За ${range} дней</div><div class="v">${fmtDur(total)}</div>
        <div class="s">в среднем ${fmtDur(activeDays ? total / activeDays : 0)} в рабочий день</div></div>`
      }
      <div class="card"><div class="k">Выполнено</div><div class="v">${completed}</div><div class="s">${single ? 'задач сегодня' : 'задач за период'}</div></div>
    </div>

    ${single ? '' : `<div class="card">
      <h3>По дням</h3>
      <div class="bars" style="gap:${range > 14 ? 4 : 10}px">
        ${perDay
          .map((x, i) => {
            const dt = parseDay(x.d);
            const isToday = x.d === today;
            return `<div class="bar-col" title="${relDate(x.d)}: ${fmtDur(x.v)}">
              <div class="bv">${range <= 14 && x.v ? fmtDur(x.v) : ''}</div>
              <div class="bar ${isToday ? 'today' : ''} ${x.v ? '' : 'zero'}" style="height:${(x.v / max) * 120}px"></div>
              <div class="bl ${isToday ? 'today' : ''}">${showLabel(i) ? (range <= 14 ? WEEKDAYS[dt.getDay()] : dt.getDate()) : '&nbsp;'}</div>
            </div>`;
          })
          .join('')}
      </div>
    </div>`}

    <div class="card">
      <h3>По проектам</h3>
      ${
        projRows.length
          ? `<div class="rows">${projRows
              .map(([pid, v]) => {
                const p = state.projects[pid];
                const color = p?.color || 'var(--text-3)';
                return `<div class="rrow"><div class="n"><span class="swatch" style="background:${color}"></span>${esc(p?.title || 'Без проекта')}</div>
                  <div class="track"><div style="width:${(v / projMax) * 100}%;background:${color}"></div></div>
                  <div class="v">${fmtDur(v)}</div></div>`;
              })
              .join('')}</div>`
          : `<div style="color:var(--text-3)">${single ? 'Сегодня время ещё не учитывалось' : 'За этот период время не учитывалось'}</div>`
      }
    </div>

    <div class="card">
      <h3>${single ? 'Задачи за сегодня' : 'Задачи, на которые ушло больше всего времени'}</h3>
      ${
        taskRows.length
          ? `<div class="rows">${taskRows
              .map(([id, v]) => {
                const t = state.tasks[id];
                const color = state.projects[t.projectId]?.color || 'var(--accent)';
                return `<div class="rrow" data-open="${id}" style="cursor:pointer"><div class="n">${esc(t.title)}</div>
                  <div class="track"><div style="width:${(v / taskMax) * 100}%;background:${color};opacity:.75"></div></div>
                  <div class="v">${fmtDur(v)}</div></div>`;
              })
              .join('')}</div>`
          : '<div style="color:var(--text-3)">Пока нет данных</div>'
      }
    </div>`;
}

/* =========================================================
   Rendering — settings
   ========================================================= */

function renderSettings() {
  const th = state.settings.theme;
  const n = Object.keys(state.tasks).length;
  return `
    <div class="page-head"><div><h1 class="page-title">Настройки</h1><div class="page-sub">${n} задач · ${
      Object.keys(state.projects).length
    } проектов · ${Object.keys(state.tags).length} тегов</div></div></div>

    <div class="card">
      <h3>Внешний вид</h3>
      <div class="set-row">
        <div><div class="t">Тема</div><div class="d">Светлая, тёмная или как в Windows</div></div>
        <div class="seg">
          <button class="${th === 'system' ? 'on' : ''}" data-theme-set="system">Системная</button>
          <button class="${th === 'light' ? 'on' : ''}" data-theme-set="light">Светлая</button>
          <button class="${th === 'dark' ? 'on' : ''}" data-theme-set="dark">Тёмная</button>
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Работа в фоне</h3>
      <div class="set-row">
        <div><div class="t">Сворачивать в трей при закрытии</div><div class="d">Крестик прячет окно к часам, таймер продолжает идти. Выйти — через значок в трее → «Выход»</div></div>
        <button class="switch ${state.settings.closeToTray ? 'on' : ''}" data-action="toggle-tray" role="switch" aria-checked="${state.settings.closeToTray}" title="${state.settings.closeToTray ? 'Включено' : 'Выключено'}"><span></span></button>
      </div>
      <div class="set-row">
        <div><div class="t">Спрашивать о времени простоя</div><div class="d">Если таймер идёт, а мышь и клавиатура не трогались дольше этого времени, Quill Track спросит, куда записать отсутствие</div></div>
        <div class="seg">
          ${[0, 3, 5, 10, 15, 30]
            .map((m) => `<button class="${state.settings.idleMin === m ? 'on' : ''}" data-idle-set="${m}">${m ? `${m} мин` : 'Выкл'}</button>`)
            .join('')}
        </div>
      </div>
    </div>

    <div class="card">
      <h3>Данные</h3>
      <div class="set-row">
        <div><div class="t">Импорт из SuperProductivity</div>
          <div class="d">В SuperProductivity: Настройки → Синхронизация и резервное копирование → «Экспорт данных».<br/>Затем выберите полученный .json здесь. Задачи, проекты, теги и учтённое время будут перенесены.</div></div>
        <button class="btn primary" data-action="import-sp">Импортировать…</button>
      </div>
      <div class="set-row">
        <div><div class="t">Резервная копия</div><div class="d">Сохранить все данные в файл. Автокопия также делается раз в день.</div></div>
        <button class="btn" data-action="export">Экспорт…</button>
      </div>
      <div class="set-row">
        <div><div class="t">Восстановить из резервной копии</div><div class="d">Заменит текущие данные содержимым файла</div></div>
        <button class="btn" data-action="import-flow">Восстановить…</button>
      </div>
      <div class="set-row">
        <div><div class="t">Очистить выполненные</div><div class="d">Удалить все выполненные задачи старше 30 дней (учтённое время пропадёт из отчётов)</div></div>
        <button class="btn danger" data-action="purge-done">Очистить</button>
      </div>
    </div>

    <div class="card">
      <h3>Горячие клавиши</h3>
      <div class="rows" style="font-size:13px;color:var(--text-2)">
        <div><kbd>N</kbd> новая задача &nbsp; <kbd>Esc</kbd> закрыть панель</div>
        <div><kbd>↑</kbd> <kbd>↓</kbd> выбор задачи &nbsp; <kbd>Enter</kbd> открыть</div>
        <div><kbd>Пробел</kbd> старт/пауза таймера &nbsp; <kbd>D</kbd> выполнено &nbsp; <kbd>Del</kbd> удалить</div>
        <div><kbd>T</kbd> на сегодня &nbsp; <kbd>1</kbd>–<kbd>4</kbd> разделы</div>
      </div>
    </div>`;
}

function renderAll() {
  renderSidebar();
  renderTracker();
  renderMain();
  renderDetail();
}

/* =========================================================
   Quick add parsing
   ========================================================= */

function parseQuickAdd(raw, ctx) {
  let title = ` ${raw} `;
  const data = { tagIds: [...(ctx.tagIds || [])], projectId: ctx.projectId || null, due: ctx.due || null };

  title = title.replace(/\s#([^\s#]+)/g, (_, name) => {
    const existing = Object.values(state.tags).find((t) => t.title.toLowerCase() === name.toLowerCase());
    const tag = existing || addTag(name);
    if (!data.tagIds.includes(tag.id)) data.tagIds.push(tag.id);
    return ' ';
  });
  title = title.replace(/\s\+(\S+)/g, (m, name) => {
    const n = name.toLowerCase();
    const p =
      Object.values(state.projects).find((x) => x.title.toLowerCase() === n) ||
      Object.values(state.projects).find((x) => x.title.toLowerCase().replace(/\s+/g, '').startsWith(n));
    if (!p) return m;
    data.projectId = p.id;
    return ' ';
  });
  title = title.replace(/\s~(\S+)/g, (m, d) => {
    const ms = parseDur(d);
    if (!ms) return m;
    data.estimate = ms;
    return ' ';
  });
  title = title.replace(/\s@(\S+)/g, (m, w) => {
    const s = w.toLowerCase();
    const t = dayStr();
    if (['сегодня', 'today', 'сег'].includes(s)) data.due = t;
    else if (['завтра', 'tomorrow', 'зав'].includes(s)) data.due = addDays(t, 1);
    else if (['послезавтра'].includes(s)) data.due = addDays(t, 2);
    else if (['неделя', 'week'].includes(s)) data.due = addDays(t, 7);
    else {
      const dm = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?$/);
      if (!dm) return m;
      let y = dm[3] ? +dm[3] : new Date().getFullYear();
      if (y < 100) y += 2000;
      const d = new Date(y, +dm[2] - 1, +dm[1]);
      if (!dm[3] && dayStr(d) < t) d.setFullYear(y + 1);
      data.due = dayStr(d);
    }
    return ' ';
  });
  data.title = title.replace(/\s+/g, ' ').trim();
  return data;
}

/* =========================================================
   Popovers, modals, toast
   ========================================================= */

let popoverEl = null;
function closePopover() {
  popoverEl?.remove();
  popoverEl = null;
}

function openTagPicker(anchor, task) {
  closePopover();
  const r = anchor.getBoundingClientRect();
  popoverEl = document.createElement('div');
  popoverEl.className = 'popover';
  popoverEl.style.left = Math.min(r.left, window.innerWidth - 240) + 'px';
  popoverEl.style.top = r.bottom + 6 + 'px';
  popoverEl.innerHTML = `<input placeholder="Найти или создать тег…" /><div class="opts"></div>`;
  document.body.appendChild(popoverEl);
  const input = popoverEl.querySelector('input');
  const opts = popoverEl.querySelector('.opts');

  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const list = Object.values(state.tags)
      .filter((t) => t.title.toLowerCase().includes(q))
      .sort((a, b) => a.title.localeCompare(b.title, 'ru'));
    const exact = list.some((t) => t.title.toLowerCase() === q);
    opts.innerHTML =
      list
        .map(
          (t, i) => `<div class="opt ${i === 0 && q ? 'hl' : ''}" data-tag="${t.id}"><span class="swatch" style="background:${t.color}"></span>${esc(t.title)}
          ${task.tagIds.includes(t.id) ? `<span class="ok">✓</span>` : ''}</div>`
        )
        .join('') + (q && !exact ? `<div class="opt" data-create="1">Создать «${esc(input.value.trim())}»</div>` : '');
  };
  const toggle = (id) => {
    task.tagIds = task.tagIds.includes(id) ? task.tagIds.filter((x) => x !== id) : [...task.tagIds, id];
    save();
    renderDetail();
    renderMain();
    renderSidebar();
    draw();
  };
  const create = () => {
    const tag = addTag(input.value.trim());
    input.value = '';
    toggle(tag.id);
  };
  input.addEventListener('input', draw);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const q = input.value.trim();
      if (!q) return;
      const first = opts.querySelector('[data-tag]');
      const exact = Object.values(state.tags).find((t) => t.title.toLowerCase() === q.toLowerCase());
      if (exact) toggle(exact.id);
      else if (first && opts.querySelector('.hl') && !opts.querySelector('[data-create]')) toggle(first.dataset.tag);
      else create();
      input.value = '';
      draw();
    }
    if (e.key === 'Escape') closePopover();
  });
  opts.addEventListener('click', (e) => {
    const o = e.target.closest('.opt');
    if (!o) return;
    if (o.dataset.create) create();
    else toggle(o.dataset.tag);
  });
  draw();
  input.focus();
}

function openEntityModal(kind, entity) {
  const modal = $('#modal');
  const isNew = !entity;
  let color = entity?.color || COLORS[(Object.keys(kind === 'project' ? state.projects : state.tags).length) % COLORS.length];
  const label = kind === 'project' ? 'проект' : 'тег';
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal">
      <h3>${isNew ? `Новый ${label}` : `Изменить ${label}`}</h3>
      <input class="in" id="m-name" placeholder="Название" value="${esc(entity?.title || '')}" />
      <div class="colors">${COLORS.map((c) => `<button data-color="${c}" class="${c === color ? 'on' : ''}" style="background:${c}"></button>`).join('')}</div>
      <div class="actions">
        ${isNew ? '' : `<button class="btn danger" id="m-del">Удалить</button>`}
        <div class="r"><button class="btn" id="m-cancel">Отмена</button><button class="btn primary" id="m-ok">${isNew ? 'Создать' : 'Сохранить'}</button></div>
      </div>
    </div>`;
  const name = $('#m-name');
  name.focus();
  name.select();
  const close = () => {
    modal.hidden = true;
    modal.innerHTML = '';
  };
  const ok = () => {
    const title = name.value.trim();
    if (!title) return name.focus();
    if (isNew) {
      const e = kind === 'project' ? addProject(title, color) : addTag(title, color);
      ui.view = { type: kind, id: e.id };
    } else {
      entity.title = title;
      entity.color = color;
      save();
    }
    close();
    renderAll();
  };
  modal.onclick = (e) => {
    if (e.target === modal) return close();
    const c = e.target.closest('[data-color]');
    if (c) {
      color = c.dataset.color;
      $$('.colors button', modal).forEach((b) => b.classList.toggle('on', b === c));
    }
    if (e.target.id === 'm-cancel') close();
    if (e.target.id === 'm-ok') ok();
    if (e.target.id === 'm-del') {
      const n = Object.values(state.tasks).filter((t) => (kind === 'project' ? t.projectId === entity.id : t.tagIds.includes(entity.id))).length;
      const msg = kind === 'project'
        ? `Удалить проект «${entity.title}»? ${n ? `${n} задач(и) останутся без проекта.` : ''}`
        : `Удалить тег «${entity.title}»? Он будет снят с задач.`;
      if (!confirm(msg)) return;
      for (const t of Object.values(state.tasks)) {
        if (kind === 'project' && t.projectId === entity.id) t.projectId = null;
        if (kind === 'tag') t.tagIds = t.tagIds.filter((x) => x !== entity.id);
      }
      delete (kind === 'project' ? state.projects : state.tags)[entity.id];
      ui.view = { type: 'today' };
      save();
      close();
      renderAll();
    }
  };
  name.onkeydown = (e) => {
    if (e.key === 'Enter') ok();
    if (e.key === 'Escape') close();
  };
}

function openTimeModal(task) {
  const modal = $('#modal');
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal">
      <h3>Добавить время</h3>
      <div class="m-sub">${esc(task.title || 'Без названия')}</div>
      <label class="m-lab" for="m-day">День</label>
      <input class="in" type="date" id="m-day" value="${dayStr()}" max="${dayStr()}" />
      <label class="m-lab">Сколько</label>
      <div class="m-dur">
        ${durField(0, 'id="m-dur"')}
        <div class="quick">
          <button class="btn" data-plus="15">+15 мин</button>
          <button class="btn" data-plus="30">+30 мин</button>
          <button class="btn" data-plus="60">+1 ч</button>
        </div>
      </div>
      <div class="m-hint" id="m-hint">Будет добавлено к журналу времени задачи</div>
      <div class="actions"><div class="r"><button class="btn" id="m-cancel">Отмена</button><button class="btn primary" id="m-ok">Добавить</button></div></div>
    </div>`;
  const dur = $('#m-dur');
  const hint = $('#m-hint');
  dur.querySelector('.dh').focus();
  const close = () => {
    modal.hidden = true;
    modal.innerHTML = '';
  };
  const refresh = () => {
    const ms = readDur(dur);
    hint.classList.remove('err');
    hint.textContent = ms ? `Будет добавлено: ${fmtDur(ms)}` : 'Будет добавлено к журналу времени задачи';
  };
  const ok = () => {
    const ms = readDur(dur);
    const day = $('#m-day').value;
    if (!day) return $('#m-day').focus();
    if (!ms) {
      hint.textContent = 'Укажите часы или минуты — или нажмите одну из кнопок выше';
      hint.classList.add('err');
      return dur.querySelector('.dh').focus();
    }
    task.timeByDay[day] = (task.timeByDay[day] || 0) + ms;
    save();
    close();
    renderAll();
    toast(`Добавлено ${fmtDur(ms)} · ${relDate(day).toLowerCase()}`);
  };
  dur.addEventListener('input', refresh);
  modal.onclick = (e) => {
    if (e.target === modal || e.target.id === 'm-cancel') close();
    if (e.target.id === 'm-ok') ok();
    const plus = e.target.closest('[data-plus]');
    if (plus) {
      setDur(dur, readDur(dur) + plus.dataset.plus * 60000);
      refresh();
    }
  };
  modal.onkeydown = (e) => {
    if (e.key === 'Enter') ok();
    if (e.key === 'Escape') close();
  };
}

/* ---------- Away-time dialog ---------- */

function openIdleModal() {
  if (!idle?.to) return;
  closePopover();
  const modal = $('#modal');
  const mins = Math.max(1, Math.round((idle.to - idle.from) / 60000));
  const away = mins >= 60 ? `${Math.floor(mins / 60)} ч${mins % 60 ? ` ${mins % 60} мин` : ''}` : `${mins} мин`;
  const cur = state.tasks[idle.taskId];
  const others = Object.values(state.tasks)
    .filter((t) => !t.done && t.id !== idle.taskId)
    .sort((a, b) => {
      const ra = a.parentId ? state.tasks[a.parentId] : a;
      const rb = b.parentId ? state.tasks[b.parentId] : b;
      return (ra?.order || 0) - (rb?.order || 0) || (a.parentId ? 1 : 0) - (b.parentId ? 1 : 0) || a.order - b.order;
    });
  const label = (t) => {
    const parent = t.parentId && state.tasks[t.parentId];
    const proj = state.projects[(parent || t).projectId];
    return (parent ? `${parent.title} → ` : '') + (t.title || 'Без названия') + (proj ? ` · ${proj.title}` : '');
  };
  modal.hidden = false;
  modal.innerHTML = `
    <div class="modal idle-modal">
      <h3>Вас не было ${away}</h3>
      <div class="m-sub">С ${fmtTimeOfDay(idle.from)} до ${fmtTimeOfDay(idle.to)} не было движения мыши и нажатий клавиш. Куда записать это время?</div>
      <div class="idle-opts">
        ${
          cur
            ? `<button class="idle-opt" data-idle="current">
          <span class="t">Засчитать текущей задаче</span><span class="d">${esc(cur.title || 'Без названия')}</span></button>`
            : ''
        }
        <div class="idle-opt other">
          <span class="t">Засчитать другой задаче</span>
          <div class="row">
            <select class="in" id="idle-task">${
              others.length
                ? others.map((t) => `<option value="${t.id}">${esc(label(t))}</option>`).join('')
                : '<option value="">Нет других открытых задач</option>'
            }</select>
            <button class="btn" data-idle="other" ${others.length ? '' : 'disabled'}>Засчитать</button>
          </div>
        </div>
        <button class="idle-opt" data-idle="drop"><span class="t">Не учитывать</span><span class="d">Это был перерыв</span></button>
      </div>
    </div>`;
  const resolve = (how) => {
    const target = how === 'current' ? cur : how === 'other' ? state.tasks[$('#idle-task').value] : null;
    if (how === 'other' && !target) return;
    if (target) addSpan(target, idle.from, idle.to);
    idle = null;
    modal.hidden = true;
    modal.innerHTML = '';
    save();
    renderAll();
    if (target) toast(`${away} записано на «${target.title || 'Без названия'}»`);
  };
  // no closing by backdrop or Esc: the time has to go somewhere
  modal.onclick = (e) => {
    const b = e.target.closest('[data-idle]');
    if (b) resolve(b.dataset.idle);
  };
  modal.onkeydown = null;
  modal.querySelector('.idle-opt')?.focus();
}

let toastTimer = null;
function toast(msg, action) {
  const el = $('#toast');
  el.hidden = false;
  el.innerHTML = `<span>${esc(msg)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => {
    action.run();
    el.hidden = true;
  };
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.hidden = true), 5000);
}

/* =========================================================
   Import / export
   ========================================================= */

function importSuperProductivity(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error('Файл не похож на JSON');
  }
  const r = window.spImport(state, json, { dayStr, colors: COLORS, baseOrder: maxOrder() + 1 });
  saveNow();
  return r;
}

async function doImportSp() {
  const text = await window.flow.openJson();
  if (!text) return;
  try {
    const r = importSuperProductivity(text);
    renderAll();
    toast(`Импортировано: ${r.nt} задач, ${r.np} проектов, ${r.nk} тегов`);
  } catch (e) {
    toast('Не удалось импортировать: ' + e.message);
  }
}

async function doExport() {
  flushTracking();
  const ok = await window.flow.saveJson(`quill-track-backup-${dayStr()}.json`, JSON.stringify(state, null, 2));
  if (ok) toast('Резервная копия сохранена');
}

async function doImportFlow() {
  const text = await window.flow.openJson();
  if (!text) return;
  try {
    const data = JSON.parse(text);
    if (!data.tasks || !data.projects) throw new Error();
    if (!confirm('Заменить текущие данные содержимым файла?')) return;
    state = Object.assign(DEFAULT_STATE(), data);
    state.settings = Object.assign(DEFAULT_SETTINGS(), data.settings);
    state.current = null;
    ui.selected = null;
    saveNow();
    applyTheme();
    renderAll();
    toast('Данные восстановлены');
  } catch {
    toast('Это не резервная копия Quill Track');
  }
}

/* =========================================================
   Events
   ========================================================= */

function openTask(id) {
  ui.selected = id;
  renderMain();
  renderDetail();
}

function setView(type, id) {
  ui.view = id ? { type, id } : { type };
  renderSidebar();
  renderMain();
  $('#main').scrollTop = 0;
}

function removeWithUndo(id) {
  const t = state.tasks[id];
  if (!t) return;
  const removed = deleteTask(id);
  renderAll();
  toast(`Удалено: «${t.title || 'Без названия'}»`, {
    label: 'Вернуть',
    run: () => {
      restoreTasks(removed);
      renderAll();
    },
  });
}

document.addEventListener('click', (e) => {
  if (popoverEl && !popoverEl.contains(e.target) && !e.target.closest('[data-action="tag-picker"]')) closePopover();

  const el = (sel) => e.target.closest(sel);
  let n;

  if ((n = el('[data-nav]'))) return setView(n.dataset.nav, n.dataset.id);
  if ((n = el('[data-done]'))) {
    e.stopPropagation();
    const id = n.dataset.done;
    const wasDone = state.tasks[id]?.done;
    toggleDone(id);
    renderAll();
    if (!wasDone) toast('Готово 🎉', { label: 'Отменить', run: () => { toggleDone(id); renderAll(); } });
    return;
  }
  if ((n = el('[data-track]'))) {
    e.stopPropagation();
    return toggleTracking(n.dataset.track);
  }
  if ((n = el('[data-expand]'))) {
    e.stopPropagation();
    const t = state.tasks[n.dataset.expand];
    t.expanded = !t.expanded;
    save();
    return renderMain();
  }
  if ((n = el('[data-collapse]'))) {
    ui.collapsed[n.dataset.collapse] = !ui.collapsed[n.dataset.collapse];
    return renderMain();
  }
  if ((n = el('[data-open]'))) return openTask(n.dataset.open);
  if ((n = el('[data-untag]'))) {
    const t = state.tasks[ui.selected];
    t.tagIds = t.tagIds.filter((x) => x !== n.dataset.untag);
    save();
    return renderAll();
  }
  if ((n = el('[data-del-sub]'))) return removeWithUndo(n.dataset.delSub);
  if ((n = el('[data-range]'))) {
    ui.reportRange = +n.dataset.range;
    return renderMain();
  }
  if ((n = el('[data-idle-set]'))) {
    state.settings.idleMin = +n.dataset.idleSet;
    save();
    sendStatus();
    return renderMain();
  }
  if ((n = el('[data-theme-set]'))) {
    state.settings.theme = n.dataset.themeSet;
    save();
    applyTheme();
    return renderMain();
  }
  if ((n = el('.task'))) {
    const id = n.dataset.task;
    return openTask(ui.selected === id && $('#detail').classList.contains('open') ? null : id);
  }

  if ((n = el('[data-action]'))) {
    const a = n.dataset.action;
    const t = state.tasks[ui.selected];
    if (a === 'new-project') openEntityModal('project');
    if (a === 'new-tag') openEntityModal('tag');
    if (a === 'edit-project') openEntityModal('project', state.projects[ui.view.id]);
    if (a === 'edit-tag') openEntityModal('tag', state.tags[ui.view.id]);
    if (a === 'close-detail') openTask(null);
    if (a === 'delete-task' && t) removeWithUndo(t.id);
    if (a === 'tag-picker' && t) openTagPicker(n, t);
    if (a === 'due-today' && t) { t.due = dayStr(); save(); renderAll(); }
    if (a === 'add-time' && t) openTimeModal(t);
    if (a === 'toggle-tray') {
      state.settings.closeToTray = !state.settings.closeToTray;
      save();
      sendStatus();
      renderMain();
    }
    if (a === 'import-sp') doImportSp();
    if (a === 'export') doExport();
    if (a === 'import-flow') doImportFlow();
    if (a === 'purge-done') {
      const cutoff = Date.now() - 30 * 86400000;
      const old = topLevel().filter((x) => x.done && (x.doneAt || 0) < cutoff);
      if (!old.length) return toast('Нечего очищать');
      if (!confirm(`Удалить ${old.length} старых выполненных задач?`)) return;
      old.forEach((x) => deleteTask(x.id));
      renderAll();
      toast(`Удалено ${old.length} задач`);
    }
  }
});

document.addEventListener('input', (e) => {
  const t = state.tasks[ui.selected];
  if (!t) return;
  const id = e.target.id;
  if (id === 'd-title') {
    t.title = e.target.value.replace(/\n/g, ' ');
    autoGrow(e.target);
    save();
    renderMain();
    renderTracker();
  }
  if (id === 'd-notes') {
    t.notes = e.target.value;
    save();
  }
});

document.addEventListener('change', (e) => {
  const t = state.tasks[ui.selected];
  const id = e.target.id;
  if (!t) return;
  if (id === 'd-project') {
    t.projectId = e.target.value || null;
    t.subIds.forEach((s) => state.tasks[s] && (state.tasks[s].projectId = t.projectId));
    save();
    renderAll();
  }
  if (id === 'd-due') {
    t.due = e.target.value || null;
    save();
    renderAll();
  }
  // hours/minutes boxes: update in place so focus can move from hours to minutes
  const dur = e.target.closest('#detail .dur');
  if (dur && dur.id === 'd-estimate') {
    t.estimate = readDur(dur);
    save();
    renderMain();
    $('#d-tl').innerHTML = timerLine(t);
  }
  if (dur && dur.dataset.logday) {
    const ms = readDur(dur);
    const d = dur.dataset.logday;
    if (ms) t.timeByDay[d] = ms;
    else delete t.timeByDay[d];
    save();
    renderMain();
    renderTracker();
    $('#d-tv').textContent = fmtClock(totalTime(t));
    $('#d-tl').innerHTML = timerLine(t);
  }
});

// once focus leaves a duration, show it tidied up (90 мин → 1 ч 30 мин)
document.addEventListener('focusout', (e) => {
  const dur = e.target.closest?.('.dur');
  if (dur && !dur.contains(e.relatedTarget)) setDur(dur, readDur(dur));
});

document.addEventListener('keydown', (e) => {
  const target = e.target;
  const inField = target.matches('input, textarea, select');

  if (target.id === 'addbar-input' && e.key === 'Enter') {
    const raw = target.value.trim();
    if (!raw) return;
    const data = parseQuickAdd(raw, listMeta().ctx);
    if (!data.title) return;
    addTask(data);
    target.value = '';
    renderSidebar();
    renderMain();
    return;
  }
  if (target.id === 'addbar-input' && e.key === 'Escape') return target.blur();

  if (target.id === 'd-subadd' && e.key === 'Enter') {
    const title = target.value.trim();
    if (!title) return;
    addTask({ title, parentId: ui.selected });
    renderMain();
    renderDetail();
    $('#d-subadd')?.focus();
    return;
  }
  if (target.closest('#detail .dur') && e.key === 'Enter') return target.blur();
  if (target.id === 'd-title' && e.key === 'Enter') {
    e.preventDefault();
    return target.blur();
  }

  if (e.key === 'Escape') {
    if (!$('#modal').hidden) return;
    if (popoverEl) return closePopover();
    if (inField) return target.blur();
    if (ui.selected) return openTask(null);
  }
  if (inField || !$('#modal').hidden || e.ctrlKey || e.altKey || e.metaKey) return;

  const k = e.key.toLowerCase();
  if (k === 'n' || k === 'т') {
    e.preventDefault();
    if (!$('#addbar-input')) setView('today');
    return $('#addbar-input')?.focus();
  }
  if (['1', '2', '3', '4'].includes(k)) return setView(['today', 'inbox', 'upcoming', 'all'][+k - 1]);

  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    const rows = $$('.task').map((r) => r.dataset.task);
    if (!rows.length) return;
    e.preventDefault();
    let i = rows.indexOf(ui.selected);
    i = e.key === 'ArrowDown' ? Math.min(rows.length - 1, i + 1) : Math.max(0, i === -1 ? 0 : i - 1);
    ui.selected = rows[i];
    renderMain();
    if ($('#detail').classList.contains('open')) renderDetail();
    $(`.task[data-task="${rows[i]}"]`)?.scrollIntoView({ block: 'nearest' });
    return;
  }
  const t = ui.selected && state.tasks[ui.selected];
  if (!t) return;
  if (e.key === 'Enter') return renderDetail();
  if (e.key === ' ') {
    e.preventDefault();
    return toggleTracking(t.id);
  }
  if (k === 'd' || k === 'в') {
    toggleDone(t.id);
    return renderAll();
  }
  if (k === 't' || k === 'е') {
    t.due = t.due === dayStr() ? null : dayStr();
    save();
    return renderAll();
  }
  if (e.key === 'Delete') return removeWithUndo(t.id);
});

/* ---------- Drag & drop ---------- */

let dragId = null;

document.addEventListener('dragstart', (e) => {
  const row = e.target.closest('.task[draggable]');
  if (!row) return;
  dragId = row.dataset.task;
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', dragId);
  requestAnimationFrame(() => row.classList.add('dragging'));
});

document.addEventListener('dragend', () => {
  dragId = null;
  $$('.dragging, .drag-over-top, .drag-over-bottom, .drop-target').forEach((el) =>
    el.classList.remove('dragging', 'drag-over-top', 'drag-over-bottom', 'drop-target')
  );
});

document.addEventListener('dragover', (e) => {
  if (!dragId) return;
  const nav = e.target.closest('[data-drop]');
  const row = e.target.closest('.task[draggable]');
  $$('.drag-over-top, .drag-over-bottom, .drop-target').forEach((el) => el.classList.remove('drag-over-top', 'drag-over-bottom', 'drop-target'));
  if (nav) {
    e.preventDefault();
    nav.classList.add('drop-target');
  } else if (row && row.dataset.task !== dragId) {
    e.preventDefault();
    const r = row.getBoundingClientRect();
    row.classList.add(e.clientY < r.top + r.height / 2 ? 'drag-over-top' : 'drag-over-bottom');
  }
});

document.addEventListener('drop', (e) => {
  if (!dragId) return;
  e.preventDefault();
  const t = state.tasks[dragId];
  const nav = e.target.closest('[data-drop]');
  if (nav) {
    const kind = nav.dataset.drop;
    if (kind === 'today') t.due = dayStr();
    if (kind === 'inbox') t.projectId = null;
    if (kind === 'project') t.projectId = nav.dataset.id;
    if (kind === 'tag' && !t.tagIds.includes(nav.dataset.id)) t.tagIds.push(nav.dataset.id);
    if (kind === 'project' || kind === 'inbox') t.subIds.forEach((s) => state.tasks[s] && (state.tasks[s].projectId = t.projectId));
    save();
    renderAll();
    const label = kind === 'today' ? 'на сегодня' : kind === 'inbox' ? 'в «Без проекта»' : `в «${nav.querySelector('.label').textContent}»`;
    toast(`Перемещено ${label}`);
    return;
  }
  const row = e.target.closest('.task[draggable]');
  if (!row || row.dataset.task === dragId) return;
  const group = row.closest('.tasks');
  const ids = $$('.task[draggable]', group).map((r) => r.dataset.task).filter((id) => id !== dragId);
  const r = row.getBoundingClientRect();
  let idx = ids.indexOf(row.dataset.task) + (e.clientY < r.top + r.height / 2 ? 0 : 1);
  const prev = state.tasks[ids[idx - 1]];
  const next = state.tasks[ids[idx]];
  if (prev && next) t.order = (prev.order + next.order) / 2;
  else if (prev) t.order = prev.order + 1;
  else if (next) t.order = next.order - 1;
  if (group.dataset.due) t.due = group.dataset.due;
  save();
  renderMain();
});

/* =========================================================
   Boot
   ========================================================= */

window.addEventListener('beforeunload', () => {
  flushTracking();
  window.flow.save(state);
});

// "Выход" from the tray: write everything, then let main quit
window.flow.onBeforeQuit(async () => {
  flushTracking();
  if (idle) {
    // nobody answered the away dialog; keep the time rather than lose it
    const t = state.tasks[idle.taskId];
    if (t) addSpan(t, idle.from, idle.to || Date.now());
    idle = null;
  }
  await saveNow();
  window.flow.quitReady();
});
window.flow.onTrayToggle(() => {
  if (state.current) toggleTracking(state.current.taskId);
  else if (state.tasks[state.lastTaskId]) toggleTracking(state.lastTaskId);
  sendStatus();
});
window.flow.onTrayHinted(() => {
  state.settings.trayHinted = true;
  save();
});
window.flow.onIdleStart((from) => {
  idleStarted(from);
  liveUpdate();
});
window.flow.onIdleEnd(idleEnded);
window.flow.onIdleCancel(idleCancelled);

(async function boot() {
  await load();
  applyTheme();
  renderAll();
  setInterval(tick, 1000);
  // re-render at midnight so "today" rolls over
  let lastDay = dayStr();
  setInterval(() => {
    if (dayStr() !== lastDay) {
      lastDay = dayStr();
      renderAll();
    }
  }, 30000);
})();
