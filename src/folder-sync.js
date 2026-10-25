'use strict';

/**
 * Builds the file Quill Track keeps in a sync folder. It has the shape of SuperProductivity's
 * sync-data.json, so tools that read SP's sync file can read this one too.
 * Tasks imported from SP keep their SP ids (without "sp_").
 * Works in the renderer (window.folderSync) and in Node (module.exports).
 */
(function (root) {
  const spId = (id) => (id && id.startsWith('sp_') ? id.slice(3) : id);

  // a subtask belongs to its parent's project
  function projectOf(state, t) {
    const parent = t.parentId && state.tasks[t.parentId];
    return (parent || t).projectId || t.projectId;
  }

  function buildSyncData(state, projectIds) {
    const wanted = new Set(projectIds);
    const project = { ids: [], entities: {} };
    for (const p of Object.values(state.projects)) {
      if (!wanted.has(p.id)) continue;
      project.ids.push(spId(p.id));
      project.entities[spId(p.id)] = { id: spId(p.id), title: p.title };
    }
    const task = { ids: [], entities: {} };
    for (const t of Object.values(state.tasks)) {
      const pid = projectOf(state, t);
      if (!wanted.has(pid)) continue;
      const id = spId(t.id);
      task.ids.push(id);
      task.entities[id] = {
        id,
        title: t.title,
        notes: t.notes || '',
        isDone: !!t.done,
        projectId: spId(pid),
        parentId: t.parentId ? spId(t.parentId) : null,
        subTaskIds: (t.subIds || []).map(spId),
        timeSpentOnDay: Object.assign({}, t.timeByDay),
      };
    }
    return { app: 'quill-track', exportedAt: new Date().toISOString(), state: { project, task } };
  }

  const api = { buildSyncData };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.folderSync = api;
})(typeof window !== 'undefined' ? window : globalThis);
