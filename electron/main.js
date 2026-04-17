const { app, BrowserWindow, ipcMain, dialog, Menu, shell, net } = require('electron');
const path  = require('path');
const isDev = process.env.NODE_ENV === 'development';

const APP_URL = 'https://edu-class-pi.vercel.app';

let mainWindow   = null;
let splashWindow = null;

// ── Splash screen ─────────────────────────────────────────
function createSplash() {
  splashWindow = new BrowserWindow({
    width: 420, height: 280,
    frame: false, resizable: false, center: true,
    alwaysOnTop: true,
    webPreferences: { nodeIntegration: false },
  });
  splashWindow.loadFile(path.join(__dirname, 'splash.html'));
}

// ── Main window ───────────────────────────────────────────
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280, height: 800,
    minWidth: 960, minHeight: 600,
    show: false,
    title: 'EduClass',
    icon: path.join(__dirname, 'assets', 'icon.png'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
      // Allow loading the Vercel app
      webSecurity: true,
    },
  });

  mainWindow.loadURL(isDev ? 'http://localhost:3000' : APP_URL);

  mainWindow.once('ready-to-show', () => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.show();
    mainWindow.focus();
  });

  // If load fails (no internet) show a friendly error
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    if (splashWindow && !splashWindow.isDestroyed()) {
      splashWindow.destroy();
      splashWindow = null;
    }
    mainWindow.loadFile(path.join(__dirname, 'offline.html'));
    mainWindow.show();
  });

  mainWindow.on('closed', () => { mainWindow = null; });
  buildMenu();
}

// ── Check internet connectivity ───────────────────────────
function checkOnline() {
  return new Promise((resolve) => {
    const request = net.request('https://edu-class-pi.vercel.app');
    request.on('response', () => resolve(true));
    request.on('error', () => resolve(false));
    request.end();
    setTimeout(() => resolve(false), 8000);
  });
}

// ── Menu ─────────────────────────────────────────────────
function buildMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Reload page',
          accelerator: 'CmdOrCtrl+R',
          click: () => mainWindow?.loadURL(APP_URL),
        },
        { type: 'separator' },
        {
          label: 'Quit EduClass',
          accelerator: 'CmdOrCtrl+Q',
          click: () => app.quit(),
        },
      ],
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle fullscreen',
          accelerator: 'F11',
          click: () => mainWindow?.setFullScreen(!mainWindow.isFullScreen()),
        },
        {
          label: 'Zoom in',
          accelerator: 'CmdOrCtrl+=',
          click: () => {
            const level = mainWindow?.webContents.getZoomLevel() || 0;
            mainWindow?.webContents.setZoomLevel(level + 0.5);
          },
        },
        {
          label: 'Zoom out',
          accelerator: 'CmdOrCtrl+-',
          click: () => {
            const level = mainWindow?.webContents.getZoomLevel() || 0;
            mainWindow?.webContents.setZoomLevel(level - 0.5);
          },
        },
        {
          label: 'Reset zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow?.webContents.setZoomLevel(0),
        },
        { type: 'separator' },
        {
          label: 'Open in browser',
          click: () => shell.openExternal(APP_URL),
        },
      ],
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About EduClass',
          click: () => dialog.showMessageBox(mainWindow, {
            type: 'info',
            title: 'About EduClass',
            message: 'EduClass v1.0.0',
            detail: [
              'School Management System',
              '',
              'Student: Maxpella Geraldo',
              'ID: BIT1001725',
              'BSc Information Technology',
              'Faculty of Engineering — Dept. ICT',
              '',
              `App URL: ${APP_URL}`,
            ].join('\n'),
            icon: path.join(__dirname, 'assets', 'icon.png'),
          }),
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// ── App lifecycle ─────────────────────────────────────────
app.whenReady().then(async () => {
  createSplash();

  // Give splash 1.5s to show, then open main window
  // The splash auto-hides when main window is ready-to-show
  setTimeout(() => {
    createWindow();
  }, 1500);
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ── IPC handlers ─────────────────────────────────────────
ipcMain.handle('open-external', (_, url) => shell.openExternal(url));

ipcMain.handle('get-app-info', () => ({
  version: app.getVersion(),
  appUrl:  APP_URL,
  platform: process.platform,
}));