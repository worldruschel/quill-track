const { app, BrowserWindow, ipcMain, dialog, nativeTheme, Notification, Tray, Menu, powerMonitor } = require('electron');
const path = require('path');
const fs = require('fs');

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
const status = { title: '', clock: '', tracking: false, canResume: false, closeToTray: true, idleMin: 5, trayHinted: false };
try {
  const s = JSON.parse(fs.readFileSync(dataFile, 'utf8')).settings || {};
  if (s.closeToTray === false) status.closeToTray = false;
  if (typeof s.idleMin === 'number') status.idleMin = s.idleMin;
  status.trayHinted = !!s.trayHinted;
} catch {}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) app.quit();
app.on('second-instance', showWindow);

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 520,
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

/** Asks the renderer to write the last seconds of tracked time, then quits. */
function quitApp() {
  if (quitting) return;
  quitting = true;
  if (!win || win.isDestroyed()) return app.quit();
  win.webContents.send('app:before-quit');
  setTimeout(() => app.quit(), 1500);
}
ipcMain.on('app:quit-ready', () => app.quit());
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
    ? `Quill Track — ${status.title.length > 80 ? status.title.slice(0, 79) + '…' : status.title} · ${status.clock}`
    : 'Quill Track — таймер не запущен';
  tray.setToolTip(tip);
  const key = `${status.tracking}|${status.canResume}`;
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
      { label: 'Выход', click: quitApp },
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

/* ---------- Data & files ---------- */

ipcMain.handle('data:load', () => {
  try {
    return JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  } catch {
    return null;
  }
});

ipcMain.handle('data:save', (_e, data) => {
  fs.mkdirSync(dataDir, { recursive: true });
  const tmp = dataFile + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(data));
  fs.renameSync(tmp, dataFile);
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
});
app.on('window-all-closed', () => app.quit());
