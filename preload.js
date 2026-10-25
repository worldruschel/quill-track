const { contextBridge, ipcRenderer } = require('electron');

const on = (channel) => (fn) => ipcRenderer.on(channel, (_e, ...args) => fn(...args));

contextBridge.exposeInMainWorld('flow', {
  load: () => ipcRenderer.invoke('data:load'),
  save: (data) => ipcRenderer.invoke('data:save', data),
  openJson: () => ipcRenderer.invoke('file:open-json'),
  saveJson: (name, content) => ipcRenderer.invoke('file:save-json', name, content),
  notify: (title, body) => ipcRenderer.invoke('notify', title, body),
  setTitlebarTheme: (dark) => ipcRenderer.invoke('theme:titlebar', dark),
  // tray & idle
  status: (s) => ipcRenderer.send('status', s),
  quitReady: () => ipcRenderer.send('app:quit-ready'),
  onTrayToggle: on('tray:toggle'),
  onTrayHinted: on('tray:hinted'),
  onBeforeQuit: on('app:before-quit'),
  onIdleStart: on('idle:start'),
  onIdleEnd: on('idle:end'),
  onIdleCancel: on('idle:cancel'),
});
