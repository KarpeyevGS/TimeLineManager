import { app, BrowserWindow, ipcMain, dialog, shell, Menu } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { IPC } from './ipcChannels';

const DATA_FILE = path.join(app.getPath('userData'), 'timeline_app_data.json');
const VIEW_FILE = path.join(app.getPath('userData'), 'timeline_view_state.json');
const isDev     = !app.isPackaged;

let mainWindow: BrowserWindow | null = null;
let isCloseConfirmed = false;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: 'TimeLine Planner',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  mainWindow = win;

  if (isDev) {
    win.loadURL('http://[::1]:5173');
    win.webContents.openDevTools();
  } else {
    win.loadFile(path.join(__dirname, '../frontend/dist/index.html'));
  }

  win.once('ready-to-show', () => win.show());

  win.on('close', (event) => {
    if (!isCloseConfirmed) {
      event.preventDefault();
      win.webContents.send(IPC.WINDOW_CLOSING);
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http')) shell.openExternal(url);
    return { action: 'deny' };
  });
}

// ---- IPC: App Data ----

ipcMain.handle(IPC.DATA_LOAD, (): string | null => {
  try {
    if (fs.existsSync(DATA_FILE)) {
      return fs.readFileSync(DATA_FILE, 'utf-8');
    }
  } catch (e) {
    console.error('DATA_LOAD error:', e);
  }
  return null;
});

ipcMain.on(IPC.DATA_SAVE, (_event, json: string) => {
  fs.writeFile(DATA_FILE, json, 'utf-8', (err) => {
    if (err) console.error('DATA_SAVE error:', err);
  });
});

ipcMain.on(IPC.DATA_CLEAR, () => {
  try {
    if (fs.existsSync(DATA_FILE)) fs.unlinkSync(DATA_FILE);
  } catch (e) {
    console.error('DATA_CLEAR error:', e);
  }
});

// ---- IPC: View State ----

ipcMain.handle(IPC.VIEW_STATE_LOAD, (): string | null => {
  try {
    if (fs.existsSync(VIEW_FILE)) {
      return fs.readFileSync(VIEW_FILE, 'utf-8');
    }
  } catch (e) {
    console.error('VIEW_STATE_LOAD error:', e);
  }
  return null;
});

ipcMain.on(IPC.VIEW_STATE_SAVE, (_event, json: string) => {
  fs.writeFile(VIEW_FILE, json, 'utf-8', (err) => {
    if (err) console.error('VIEW_STATE_SAVE error:', err);
  });
});

// ---- IPC: Export / Import ----

ipcMain.handle(IPC.EXPORT_JSON, async (_event, json: string): Promise<boolean> => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Экспорт данных',
    defaultPath: 'timeline_export.json',
    filters: [{ name: 'JSON', extensions: ['json'] }],
  });
  if (!canceled && filePath) {
    fs.writeFileSync(filePath, json, 'utf-8');
    return true;
  }
  return false;
});

ipcMain.handle(IPC.IMPORT_JSON, async (): Promise<string | null> => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Импорт данных',
    filters: [{ name: 'JSON', extensions: ['json'] }],
    properties: ['openFile'],
  });
  if (!canceled && filePaths.length > 0) {
    return fs.readFileSync(filePaths[0], 'utf-8');
  }
  return null;
});

// ---- IPC: App Version ----

ipcMain.handle(IPC.APP_VERSION, (): string => app.getVersion());

// ---- IPC: Print ----

ipcMain.on(IPC.PRINT, () => {
  mainWindow?.webContents.print(
    { silent: false, printBackground: true },
    (success, failureReason) => {
      if (!success) console.error('Print failed:', failureReason);
    }
  );
});

// ---- IPC: Window Close ----

ipcMain.on(IPC.WINDOW_CLOSE_CONFIRMED, () => {
  isCloseConfirmed = true;
  mainWindow?.close();
});

// ---- App lifecycle ----

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
