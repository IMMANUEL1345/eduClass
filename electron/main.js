const { app, BrowserWindow, ipcMain, dialog, Menu, shell } = require('electron');
const { spawn } = require('child_process');
const path   = require('path');
const http   = require('http');
const isDev  = process.env.NODE_ENV === 'development';

const API_PORT  = 5000;
const API_URL   = `http://localhost:${API_PORT}`;

let mainWindow   = null;
let splashWindow = null;
let backendProc  = null;

// ── Splash screen ─────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 400, height: 260,
    frame: false, resizable: false, center: true,
    webPreferences: { nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ── Main window ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 1024, minHeight: 640,
    show: false,
    title: 'EduClass',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // In dev, load CRA dev server. In production, load from Express.
  const url = isDev ? 'http://localhost:3000' : `http://localhost:${API_PORT}`;
  mainWindow.loadURL(url);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) splashWindow.destroy();
    mainWindow.show();
    if (isDev) mainWindow.webContents.openDevTools({ mode: 'detach' });
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  buildMenu();
}

// ── Menu ─────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => mainWindow?.reload() },
        { type: 'separator' },
        { label: 'Quit EduClass', accelerator: 'CmdOrCtrl+Q', click: () => app.quit() },
      ],
    },
    {
      label: 'View',
      submenu: [
        { label: 'Toggle fullscreen', accelerator: 'F11', click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()) },
        { label: 'Zoom in',  accelerator: 'CmdOrCtrl+=', click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() + 0.5) },
        { label: 'Zoom out', accelerator: 'CmdOrCtrl+-', click: () => mainWindow?.webContents.setZoomLevel(mainWindow.webContents.getZoomLevel() - 0.5) },
        { label: 'Reset zoom', accelerator: 'CmdOrCtrl+0', click: () => mainWindow?.webContents.setZoomLevel(0) },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'EduClass documentation', click: () => shell.openExternal('https://github.com/your-org/educlass') },
        { label: 'About EduClass',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info', title: 'About EduClass',
            message: 'EduClass v1.0.0',
            detail: 'Web-based school management system\nFaculty of Engineering — BSc Information Technology',
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── Start Express backend ─────────────────────────────────
function startBackend() {
  return new Promise((resolve, reject) => {
    const serverEntry = isDev
      ? path.join(__dirname, '../backend/server.js')
      : path.join(process.resourcesPath, 'backend', 'server.js');

    const env = {
      ...process.env,
      PORT:         String(API_PORT),
      NODE_ENV:     'desktop',
      DESKTOP_MODE: 'true',
      // DATABASE_URL is read from the system env or from a local config file
    };

    backendProc = spawn(process.execPath, [serverEntry], {
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    backendProc.stdout.on('data', d => {
      const msg = d.toString();
      console.log('[backend]', msg.trim());
      if (msg.includes('running on')) resolve();
    });

    backendProc.stderr.on('data', d => console.error('[backend error]', d.toString().trim()));

    backendProc.on('error', reject);
    backendProc.on('exit', (code) => {
      console.log(`[backend] exited with code ${code}`);
    });

    // Fallback: poll for readiness
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      http.get(`${API_URL}/health`, (res) => {
        if (res.statusCode === 200) { clearInterval(poll); resolve(); }
      }).on('error', () => {});
      if (attempts > 30) { clearInterval(poll); reject(new Error('Backend did not start')); }
    }, 500);
  });
}

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();

  try {
    if (!isDev) {
      await startBackend();
    }
    createWindow();
  } catch (err) {
    dialog.showErrorBox('Startup failed', `EduClass could not start the server:\n${err.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (backendProc) { backendProc.kill('SIGTERM'); backendProc = null; }
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

app.on('before-quit', () => {
  if (backendProc) { backendProc.kill('SIGTERM'); backendProc = null; }
});

// ── IPC: DB config from renderer ─────────────────────────
ipcMain.handle('get-db-config', () => ({
  url: process.env.DATABASE_URL || '',
}));

ipcMain.handle('open-external', (_, url) => shell.openExternal(url));
