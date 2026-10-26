const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Notification, Tray, Menu, powerMonitor, shell, net } = require('electron');
const path = require('path');
const fs = require('fs');
const zlib = require('zlib');

// A separate data folder for development, so experiments don't touch real tasks
if (process.env.QUILL_DATA_DIR) app.setPath('userData', path.resolve(process.env.QUILL_DATA_DIR));

const dataDir = app.getPath('userData');
const dataFile = path.join(dataDir, 'quill-track-data.json');
const backupDir = path.join(dataDir, 'backups');

// The app used to be called Flow: copy its data over once. The old folder is left untouched.
if (!process.env.QUILL_DATA_DIR && !fs.existsSync(dataFile)) {
  const legacyDir = path.join(app.getPath('appData'), 'flow');
  try {
    if (fs.existsSync(path.join(legacyDir, 'flow-data.json'))) {
      fs.mkdirSync(backupDir, { recursive: true });
      for (const f of fs.existsSync(path.join(legacyDir, 'backups')) ? fs.readdirSync(path.join(legacyDir, 'backups')) : []) {
        fs.copyFileSync(path.join(legacyDir, 'backups', f), path.join(backupDir, f));
      }
      fs.copyFileSync(path.join(legacyDir, 'flow-data.json'), dataFile);
    }
  } catch {}
}

let win;
let tray = null;
let quitting = false;

// What the renderer last told us (see 'status' below)
const status = { title: '', clock: '', tracking: false, canResume: false, closeToTray: true, idleMin: 5, trayHinted: false, autoUpdate: true };
try {
  const s = JSON.parse(fs.readFileSync(dataFile, 'utf8')).settings || {};
  if (s.closeToTray === false) status.closeToTray = false;
  if (typeof s.idleMin === 'number') status.idleMin = s.idleMin;
  status.trayHinted = !!s.trayHinted;
  if (s.autoUpdate === false) status.autoUpdate = false;
} catch {}

// Started by Windows at logon: stay in the tray until the user opens the window
const startHidden = process.argv.includes('--hidden');

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', showWindow);

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
    show: !startHidden,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#16171b' : '#f6f6f3',
    icon: path.join(__dirname, 'src', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: nativeTheme.shouldUseDarkColors ? '#c9cad1' : '#55565e', height: 40 },
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // the timer must keep ticking while the window sits in the tray
      backgroundThrottling: false,
    },
  });
  win.removeMenu();
  win.loadFile(path.join(__dirname, 'src', 'index.html'));

  win.on('close', (e) => {
    if (quitting || !status.closeToTray) return;
    e.preventDefault();
    win.hide();
    if (!status.trayHinted && tray) {
      status.trayHinted = true;
      win.webContents.send('tray:hinted');
      tray.displayBalloon({
        iconType: 'info',
        title: 'Quill Track работает в трее',
        content: 'Таймер продолжает идти. Чтобы выйти, нажмите на значок правой кнопкой → «Выход».',
      });
    }
  });
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show();
  win.focus();
}

/** Asks the renderer to write the last seconds of tracked time, then quits (or installs a downloaded update). */
let installOnQuit = false;
function quitApp(install) {
  if (quitting) return;
  quitting = true;
  installOnQuit = !!install;
  if (!win || win.isDestroyed()) return finishQuit();
  win.webContents.send('app:before-quit');
  setTimeout(finishQuit, 1500);
}
function finishQuit() {
  if (installOnQuit) autoUpdater.quitAndInstall(true, true);
  else app.quit();
}
ipcMain.on('app:quit-ready', finishQuit);
app.on('before-quit', () => (quitting = true));

/* ---------- Tray ---------- */

function createTray() {
  tray = new Tray(path.join(__dirname, 'src', 'tray.ico'));
  tray.on('click', showWindow);
  updateTray(true);
}

let lastMenuKey = '';
function updateTray(force) {
  if (!tray) return;
  const tip = status.tracking
    ? `Quill Track – ${status.title.length > 80 ? status.title.slice(0, 79) + '…' : status.title} · ${status.clock}`
    : 'Quill Track – таймер не запущен';
  tray.setToolTip(tip);
  const key = `${status.tracking}|${status.canResume}|${update.state}`;
  if (!force && key === lastMenuKey) return;
  lastMenuKey = key;
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'Открыть', click: showWindow },
      { type: 'separator' },
      {
        label: status.tracking ? 'Пауза' : 'Продолжить таймер',
        enabled: status.tracking || status.canResume,
        click: () => win?.webContents.send('tray:toggle'),
      },
      { type: 'separator' },
      ...(update.state === 'ready' ? [{ label: `Обновить до ${update.version} и перезапустить`, click: () => quitApp(true) }] : []),
      { label: 'Выход', click: () => quitApp() },
    ])
  );
}

ipcMain.on('status', (_e, s) => {
  Object.assign(status, s);
  updateTray();
  // timer stopped or detection switched off while away; a click means the user is back
  if (!status.tracking || !status.idleMin) endIdle(powerMonitor.getSystemIdleTime() < 5);
});

/* ---------- Idle detection ---------- */

// While the timer runs, watch for the user being away longer than the threshold.
// The renderer is told when the absence started and when the user came back.
let idleFrom = null;
const idleThresholdSec = () => Number(process.env.QUILL_IDLE_SECONDS) || status.idleMin * 60;

function checkIdle() {
  if (!win || !status.tracking || !status.idleMin) return;
  const idle = powerMonitor.getSystemIdleTime();
  if (idleFrom === null && idle >= idleThresholdSec()) {
    idleFrom = Date.now() - idle * 1000;
    win.webContents.send('idle:start', idleFrom);
  } else if (idleFrom !== null && idle < 5) {
    endIdle(true);
  }
}
function endIdle(back) {
  if (idleFrom === null) return;
  idleFrom = null;
  if (!back) return win?.webContents.send('idle:cancel');
  win.webContents.send('idle:end', Date.now() - powerMonitor.getSystemIdleTime() * 1000);
  showWindow();
  win.flashFrame(true);
}

/* ---------- Updates ---------- */

// The installed version downloads updates from GitHub Releases and installs them on restart.
// The portable exe can't replace itself, so it only says a new version is out.
const portable = !!process.env.PORTABLE_EXECUTABLE_DIR;
const releasesApi = 'https://api.github.com/repos/worldruschel/quill-track/releases/latest';
let autoUpdater = null;
const update = { state: app.isPackaged ? 'idle' : 'dev', version: '', percent: 0, url: '', current: app.getVersion(), portable };

function setUpdate(patch) {
  Object.assign(update, patch);
  win?.webContents.send('update:state', update);
  updateTray();
}

if (app.isPackaged && !portable) {
  autoUpdater = require('electron-updater').autoUpdater;
  // for testing against a local server instead of GitHub
  if (process.env.QUILL_UPDATE_URL) autoUpdater.setFeedURL({ provider: 'generic', url: process.env.QUILL_UPDATE_URL });
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => update.state !== 'ready' && setUpdate({ state: 'checking' }));
  autoUpdater.on('update-not-available', () => setUpdate({ state: 'none' }));
  autoUpdater.on('update-available', (i) => setUpdate({ state: 'downloading', version: i.version, percent: 0 }));
  autoUpdater.on('download-progress', (p) => setUpdate({ percent: Math.round(p.percent) }));
  autoUpdater.on('update-downloaded', (i) => setUpdate({ state: 'ready', version: i.version }));
  autoUpdater.on('error', () => update.state !== 'ready' && setUpdate({ state: 'error' }));
}

const newer = (a, b) => {
  const x = a.split('.').map(Number), y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0);
  return false;
};

async function checkForUpdates() {
  if (update.state === 'dev' || update.state === 'ready' || update.state === 'downloading') return;
  if (autoUpdater) return autoUpdater.checkForUpdates().catch(() => {});
  setUpdate({ state: 'checking' });
  try {
    const res = await net.fetch(releasesApi, { headers: { Accept: 'application/vnd.github+json' } });
    if (!res.ok) throw new Error(res.status);
    const rel = await res.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    if (newer(version, app.getVersion())) setUpdate({ state: 'available', version, url: rel.html_url });
    else setUpdate({ state: 'none' });
  } catch {
    setUpdate({ state: 'error' });
  }
}

ipcMain.handle('update:get', () => update);
ipcMain.handle('update:check', () => checkForUpdates());
ipcMain.handle('update:install', () => update.state === 'ready' && quitApp(true));
ipcMain.handle('update:open', () => update.url && shell.openExternal(update.url));

/* ---------- Data & files ---------- */

// When the file was last read or written by this process. If it changed since then, someone else
// (another copy of the app, a restore from backup) wrote it, and our state in memory is stale:
// saving would overwrite their data with ours.
let dataMtime = 0;
// set after a conflict: refuse saves (including the one on unload) until the window reloads the file
let dataStale = false;
const fileMtime = () => {
  try {
    return fs.statSync(dataFile).mtimeMs;
  } catch {
    return 0;
  }
};

ipcMain.handle('data:load', () => {
  try {
    dataStale = false;
    dataMtime = fileMtime();
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('data:save', (_e, data) => {
  fs.mkdirSync(dataDir, { recursive: true });
  if (dataStale) return false;
  if (fileMtime() !== dataMtime) {
    // keep our version next to it and reload what is on disk
    const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
    fs.writeFileSync(path.join(dataDir, `quill-track-data.conflict-${stamp}.json`), JSON.stringify(data));
    dataStale = true;
    if (Notification.isSupported()) {
      new Notification({
        title: 'Quill Track: данные изменились на диске',
        body: 'Файл задач изменила другая программа или копия Quill Track. Загружена версия с диска, ваша сохранена рядом как conflict-файл.',
      }).show();
    }
    win?.reload();
    return false;
  }
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dataFile);
  dataMtime = fileMtime();
  // One backup per day, keep the last 14
  const day = new Date().toISOString().slice(0, 10);
  const backup = path.join(backupDir, `quill-track-${day}.json`);
  if (!fs.existsSync(backup)) {
    fs.mkdirSync(backupDir, { recursive: true });
    fs.copyFileSync(dataFile, backup);
    const old = fs.readdirSync(backupDir).sort().slice(0, -14);
    old.forEach((f) => fs.unlinkSync(path.join(backupDir, f)));
  }
  return true;
});

ipcMain.handle('file:open-json', async () => {
  const res = await dialog.showOpenDialog(win, {
    title: 'Выберите файл резервной копии',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths[0]) return null;
  return fs.readFileSync(res.filePaths[0], 'utf8');
});

ipcMain.handle('file:save-json', async (_e, name, content) => {
  const res = await dialog.showSaveDialog(win, {
    defaultPath: name,
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (res.canceled || !res.filePath) return false;
  fs.writeFileSync(res.filePath, content);
  return true;
});

/* ---------- Sync folder ---------- */

// Like SuperProductivity's file sync: the data is written to a folder of the user's choice
// (often one that Google Drive or Dropbox syncs), in the same format as SP's sync-data.json.
const syncFileName = 'quill-track-sync.json';

ipcMain.handle('sync:pick-folder', async (_e, title) => {
  const res = await dialog.showOpenDialog(win, { title: title || 'Папка для выгрузки', properties: ['openDirectory'] });
  return res.canceled ? '' : res.filePaths[0] || '';
});

ipcMain.handle('sync:write', (_e, dir, json) => {
  // a cloud drive may be unmounted; don't create the folder in its place
  if (!dir || !fs.existsSync(dir)) throw new Error('Папка не найдена. Диск подключён?');
  // SP's format: a prefix, then base64 of gzipped JSON
  const content = 'pf_C2__' + zlib.gzipSync(Buffer.from(json, 'utf8')).toString('base64');
  const file = path.join(dir, syncFileName);
  fs.writeFileSync(file + '.tmp', content);
  fs.renameSync(file + '.tmp', file);
  return file;
});

/* ---------- Inbox folder ---------- */

// Other programs drop JSON files with changes here; the renderer applies them.
// Applied files are deleted, broken ones are renamed to *.failed.json with the reason next to them.
ipcMain.handle('inbox:read', (_e, dir) => {
  if (!dir || !fs.existsSync(dir)) throw new Error('Папка не найдена. Диск подключён?');
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json') && !f.endsWith('.failed.json'))
    .sort()
    .map((name) => path.join(dir, name))
    // skip a file that may still be being written
    .filter((file) => Date.now() - fs.statSync(file).mtimeMs > 3000)
    .map((file) => ({ name: path.basename(file), text: fs.readFileSync(file, 'utf8') }));
});

ipcMain.handle('inbox:finish', (_e, dir, name, error) => {
  const file = path.join(dir, path.basename(name));
  if (!error) return fs.rmSync(file, { force: true });
  const base = file.replace(/\.json$/, '');
  fs.renameSync(file, base + '.failed.json');
  fs.writeFileSync(base + '.failed.txt', error);
});

/* ---------- Start with Windows ---------- */

// A Run entry that opens the app straight into the tray.
// The portable exe runs from a temporary copy, so point at the original file.
const loginItem = { path: process.env.PORTABLE_EXECUTABLE_FILE || process.execPath, args: ['--hidden'], name: 'Quill Track' };
const autostartOn = () => (app.isPackaged ? app.getLoginItemSettings(loginItem).openAtLogin : null);

ipcMain.handle('autostart:get', autostartOn);
ipcMain.handle('autostart:set', (_e, on) => {
  if (app.isPackaged) app.setLoginItemSettings({ ...loginItem, openAtLogin: !!on });
  return autostartOn();
});

ipcMain.handle('notify', (_e, title, body) => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
});

ipcMain.handle('theme:titlebar', (_e, dark) => {
  if (!win) return;
  win.setTitleBarOverlay({ color: '#00000000', symbolColor: dark ? '#c9cad1' : '#55565e', height: 40 });
});

app.whenReady().then(() => {
  if (!gotLock) return;
  app.setAppUserModelId('app.quilltrack');
  createWindow();
  createTray();
  setInterval(checkIdle, 5000);
  // first check shortly after start, then every 6 hours
  const autoCheck = () => status.autoUpdate && checkForUpdates();
  setTimeout(autoCheck, 15000);
  setInterval(autoCheck, 6 * 3600000);
});
app.on('window-all-closed', () => app.quit());
