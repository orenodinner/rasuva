import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { createDb } from '@db';
import { registerIpcHandlers } from './ipc';

let mainWindow: BrowserWindow | null = null;
let db: ReturnType<typeof createDb> | null = null;

const createMainWindow = () => {
  const preloadPath = join(__dirname, '../preload/index.js');
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
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    const indexPath = join(__dirname, '../../dist/renderer/index.html');
    window.loadFile(indexPath);
  }

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
