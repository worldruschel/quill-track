'use strict';

/**
 * Merges a SuperProductivity export into Quill Track state (mutates `state`).
 * Works in the renderer (window.spImport) and in Node (module.exports).
 */
(function (root) {
  function findSpRoot(json) {
    const candidates = [json, json?.data, json?.mainModelData, json?.state, json?.data?.mainModelData];
    return candidates.find((c) => c && typeof c === 'object' && (c.task?.entities || c.project?.entities));
  }

  // SP colors may be "rgb(r, g, b)"; Quill Track uses hex
  function toHex(color) {
    if (!color) return null;
    // SP's default black is invisible on a dark theme
    if (/^(#000000|#000|rgb\(0,\s*0,\s*0\))$/i.test(color)) return '#7a7f8c';
    const m = String(color).match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
    if (!m) return color;
    return '#' + m.slice(1).map((n) => (+n).toString(16).padStart(2, '0')).join('');
  }

  function spImport(state, json, { dayStr, colors, baseOrder }) {
    const root = findSpRoot(json);
    if (!root) throw new Error('Не нашёл в файле задач SuperProductivity');

    const pid = (id) => (id && id !== 'INBOX_PROJECT' && id !== 'INBOX' ? 'sp_' + id : null);
    const tid = (id) => 'sp_' + id;
    let np = 0, nt = 0, nk = 0;

    for (const p of Object.values(root.project?.entities || {})) {
      if (!p || !pid(p.id) || p.isArchived || p.isHiddenFromMenu || state.projects[pid(p.id)]) continue;
      state.projects[pid(p.id)] = {
        id: pid(p.id),
        title: p.title || 'Проект',
        color: toHex(p.theme?.primary || p.color) || colors[np % colors.length],
        created: Date.now() + np,
      };
      np++;
    }
    for (const t of Object.values(root.tag?.entities || {})) {
      if (!t || t.id === 'TODAY' || state.tags[tid(t.id)]) continue;
      state.tags[tid(t.id)] = {
        id: tid(t.id),
        title: t.title || 'тег',
        color: toHex(t.color || t.theme?.primary) || colors[nk % colors.length],
        created: Date.now(),
      };
      nk++;
    }

    // ordering hints from projects / today list
    const orderHint = {};
    let k = 0;
    const hint = (ids) => (ids || []).forEach((id) => (orderHint[id] ??= k++));
    hint(root.tag?.entities?.TODAY?.taskIds);
    for (const p of Object.values(root.project?.entities || {})) {
      hint(p?.taskIds);
      hint(p?.backlogTaskIds);
    }

    const sources = [
      root.task?.entities,
      root.archiveYoung?.task?.entities,
      root.archiveOld?.task?.entities,
      root.taskArchive?.entities,
      json.archiveYoung?.task?.entities,
      json.archiveOld?.task?.entities,
    ].filter(Boolean);
    const all = {};
    sources.forEach((src) => Object.values(src).forEach((t) => t && t.id && (all[t.id] ||= t)));

    const today = dayStr();
    const inToday = new Set(root.tag?.entities?.TODAY?.taskIds || []);

    for (const s of Object.values(all)) {
      const id = tid(s.id);
      if (state.tasks[id]) continue;
      // In SP a parent's time and estimate are the sums of its subtasks – Quill Track sums them itself
      const hasSubs = (s.subTaskIds || []).length > 0;
      const timeByDay = {};
      if (!hasSubs) for (const [d, v] of Object.entries(s.timeSpentOnDay || {})) if (typeof v === 'number' && v > 0) timeByDay[d] = v;
      let due = s.dueDay || (s.dueWithTime ? dayStr(s.dueWithTime) : null) || (s.plannedAt ? dayStr(s.plannedAt) : null);
      const tagIds = (s.tagIds || []).filter((x) => x !== 'TODAY').map(tid);
      if (!s.isDone && (inToday.has(s.id) || (s.tagIds || []).includes('TODAY')) && (!due || due > today)) due = today;
      state.tasks[id] = {
        id,
        title: s.title || '',
        notes: s.notes || '',
        done: !!s.isDone,
        doneAt: s.isDone ? s.doneOn || s.modified || s.created || Date.now() : null,
        projectId: pid(s.projectId),
        tagIds,
        parentId: s.parentId ? tid(s.parentId) : null,
        subIds: (s.subTaskIds || []).map(tid),
        due,
        estimate: hasSubs ? 0 : s.timeEstimate || 0,
        timeByDay,
        created: s.created || Date.now(),
        order: baseOrder + (orderHint[s.id] ?? 100000 + (s.created || 0) / 1e9),
        expanded: true,
      };
      nt++;
    }
    // drop dangling links
    for (const t of Object.values(state.tasks)) {
      t.subIds = t.subIds.filter((x) => state.tasks[x]);
      if (t.parentId && !state.tasks[t.parentId]) t.parentId = null;
      if (t.projectId && !state.projects[t.projectId]) t.projectId = null;
      t.tagIds = t.tagIds.filter((x) => state.tags[x]);
    }
    return { np, nt, nk };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = { spImport };
  else root.spImport = spImport;
})(typeof window !== 'undefined' ? window : globalThis);
