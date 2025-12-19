import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { createDb } from '@db';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: ReturnType<typeof createDb> | null = null;

const createMainWindow = () => {
  const preloadPath = join(__dirname, '../preload/index.js');
  const isDev = Boolean(process.env.VITE_DEV_SERVER_URL);
  const window = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    show: false,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: preloadPath
    }
  });

  window.once('ready-to-show', () => {
    window.show();
    if (isDev) {
      window.webContents.openDevTools({ mode: 'detach' });
    }
  });

  const devServerUrl =
    process.env.VITE_DEV_SERVER_URL || process.env.ELECTRON_RENDERER_URL || null;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else if (isDev) {
    window.loadURL('http://localhost:5173/');
  } else {
    const indexPath = join(__dirname, '../../dist/renderer/index.html');
    window.loadFile(indexPath);
  }

  window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    console.error('Renderer load failed', { errorCode, errorDescription, validatedURL });
  });

  window.webContents.on('render-process-gone', (_event, details) => {
    console.error('Renderer process gone', details);
  });

  window.webContents.on('console-message', (_event, level, message) => {
    const levelLabel = ['LOG', 'WARN', 'ERROR'][level] ?? 'LOG';
    console.log(`[renderer:${levelLabel}] ${message}`);
  });

  return window;
};

const isAllowedUrl = (url: string) => {
  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl && url.startsWith(devServerUrl)) {
    return true;
  }
  return url.startsWith('file://');
};

app.on('web-contents-created', (_event, contents) => {
  contents.setWindowOpenHandler(({ url }) => {
    if (isAllowedUrl(url)) {
      return { action: 'allow' };
    }
    return { action: 'deny' };
  });

  contents.on('will-navigate', (event, url) => {
    if (!isAllowedUrl(url)) {
      event.preventDefault();
    }
  });
});

app.whenReady().then(() => {
  app.setAppUserModelId('com.company.rasuva');

  const dbPath = join(app.getPath('userData'), 'rasuva.db');
  db = createDb(dbPath);
  db.init();

  registerIpcHandlers(db);
  mainWindow = createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow = createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  db?.close();
});
