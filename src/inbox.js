'use strict';

/**
 * Applies changes that other programs drop into the inbox folder as JSON files (mutates `state`).
 * A file holds one command, an array of them, or { "commands": [...] }:
 *
 *   { "action": "update", "find": { "parent": { "id": "…" }, "due": "2026-10-26" },
 *     "set": { "title": "…", "done": true } }
 *   { "action": "add", "task": { "title": "…", "project": "Работа", "due": "2026-10-26" } }
 *
 * find: id, title, titleStartsWith, due, project (title), parent (another find).
 * Ids may be given without the "sp_" prefix of tasks imported from SuperProductivity.
 * Works in the renderer (window.inbox) and in Node (module.exports).
 */
(function (root) {
  const sameId = (a, b) => a === b || a === 'sp_' + b;

  function projectByTitle(state, title) {
    const want = String(title).trim().toLowerCase();
    return Object.values(state.projects).find((p) => p.title.trim().toLowerCase() === want);
  }

  function matches(state, t, f) {
    if (f.id && !sameId(t.id, f.id)) return false;
    if (f.title !== undefined && t.title !== f.title) return false;
    if (f.titleStartsWith !== undefined && !t.title.startsWith(f.titleStartsWith)) return false;
    if (f.due !== undefined && t.due !== f.due) return false;
    if (f.project !== undefined) {
      const p = projectByTitle(state, f.project);
      const own = t.parentId ? state.tasks[t.parentId]?.projectId : t.projectId;
      if (!p || (own || t.projectId) !== p.id) return false;
    }
    if (f.parent) {
      const parent = t.parentId && state.tasks[t.parentId];
      if (!parent || !matches(state, parent, f.parent)) return false;
    }
    return true;
  }

  function findOne(state, f) {
    if (!f || typeof f !== 'object' || !Object.keys(f).length) throw new Error('не указано, какую задачу искать (find)');
    const hits = Object.values(state.tasks).filter((t) => matches(state, t, f));
    if (!hits.length) throw new Error('задача не найдена: ' + JSON.stringify(f));
    if (hits.length > 1) throw new Error(`найдено ${hits.length} задач, нужна одна: ` + JSON.stringify(f));
    return hits[0];
  }

  function applySet(t, set) {
    if (set.title !== undefined) t.title = String(set.title);
    if (set.notes !== undefined) t.notes = String(set.notes);
    if (set.appendNotes) t.notes = t.notes ? `${t.notes}\n${set.appendNotes}` : String(set.appendNotes);
    if (set.due !== undefined) t.due = set.due || null;
    if (set.done !== undefined && !!set.done !== t.done) {
      t.done = !!set.done;
      t.doneAt = t.done ? Date.now() : null;
    }
  }

  function toList(json) {
    if (Array.isArray(json)) return json;
    if (json && Array.isArray(json.commands)) return json.commands;
    return [json];
  }

  /** `addTask` is the app's own helper, so new tasks get every default field. Returns a line per command. */
  function applyInbox(state, json, { addTask }) {
    const done = [];
    for (const c of toList(json)) {
      if (!c || typeof c !== 'object') throw new Error('команда должна быть объектом');
      if (c.action === 'update') {
        const t = findOne(state, c.find);
        applySet(t, c.set || {});
        done.push(`изменена «${t.title}»`);
      } else if (c.action === 'add') {
        const d = c.task || {};
        if (!d.title) throw new Error('у новой задачи нет названия (task.title)');
        const data = { title: String(d.title), notes: d.notes || '', due: d.due || null };
        if (d.parent) data.parentId = findOne(state, d.parent).id;
        else if (d.project) {
          const p = projectByTitle(state, d.project);
          if (!p) throw new Error('нет проекта «' + d.project + '»');
          data.projectId = p.id;
        }
        const t = addTask(data);
        if (d.done) applySet(t, { done: true });
        done.push(`добавлена «${t.title}»`);
      } else {
        throw new Error('неизвестное действие: ' + c.action);
      }
    }
    return done;
  }

  const api = { applyInbox };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.inbox = api;
})(typeof window !== 'undefined' ? window : globalThis);
