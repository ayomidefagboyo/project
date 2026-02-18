/**
 * Electron Main Process — Compazz POS Desktop
 *
 * Creates a single BrowserWindow that loads the Vite-built React app
 * (production) or the Vite dev server (development).
 *
 * Registers IPC handlers for:
 *   - Silent receipt printing (via printBridge)
 *   - Cash drawer control
 *   - Printer enumeration
 *   - App version info
 *   - App auto-update (check/download/install)
 */

import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';
import { autoUpdater } from 'electron-updater';
import { printReceipt, listPrinters, setMainWindow } from './printBridge.js';

// ---------------------------------------------------------------------------
// ESM __dirname equivalent
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const PRELOAD_PATH = path.join(__dirname, 'preload.cjs');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const DEV_URL = 'http://localhost:5174';

const isDev = !app.isPackaged;
const AUTO_UPDATE_CHECK_DELAY_MS = 15_000;
const AUTO_UPDATE_INTERVAL_MS = 4 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Single-instance lock — prevent launching multiple windows
// ---------------------------------------------------------------------------

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

// ---------------------------------------------------------------------------
// Window creation
// ---------------------------------------------------------------------------

let mainWindow: BrowserWindow | null = null;
let updateInterval: NodeJS.Timeout | null = null;
let isCheckingForUpdates = false;
let updateDownloaded = false;
let autoUpdaterConfigured = false;

type AppUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName?: string }
  | { state: 'not-available'; version?: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { state: 'downloaded'; version: string; releaseName?: string }
  | { state: 'error'; message: string };

let latestUpdateStatus: AppUpdateStatus = { state: 'idle' };

const readVersion = (payload: unknown): string => {
  if (payload && typeof payload === 'object' && 'version' in payload) {
    const version = (payload as { version?: unknown }).version;
    if (typeof version === 'string' && version.trim().length > 0) return version;
  }
  return '';
};

const readReleaseName = (payload: unknown): string | undefined => {
  if (payload && typeof payload === 'object' && 'releaseName' in payload) {
    const releaseName = (payload as { releaseName?: unknown }).releaseName;
    if (typeof releaseName === 'string' && releaseName.trim().length > 0) return releaseName;
  }
  return undefined;
};

const readErrorMessage = (err: unknown): string => {
  if (err instanceof Error && err.message.trim().length > 0) return err.message;
  if (typeof err === 'string' && err.trim().length > 0) return err;
  return 'Unknown update error';
};

const toNumber = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : 0;

const publishUpdateStatus = (status: AppUpdateStatus): void => {
  latestUpdateStatus = status;
  if (!mainWindow || mainWindow.isDestroyed()) return;
  mainWindow.webContents.send('app-update-status', status);
};

const checkForAppUpdates = async (): Promise<{ ok: boolean; error?: string }> => {
  if (isDev) return { ok: false, error: 'Auto-update is disabled in development.' };
  if (isCheckingForUpdates) return { ok: true };

  isCheckingForUpdates = true;
  publishUpdateStatus({ state: 'checking' });

  try {
    await autoUpdater.checkForUpdates();
    return { ok: true };
  } catch (err) {
    const message = readErrorMessage(err);
    publishUpdateStatus({ state: 'error', message });
    return { ok: false, error: message };
  } finally {
    isCheckingForUpdates = false;
  }
};

const configureAutoUpdater = (): void => {
  if (isDev || autoUpdaterConfigured) return;
  autoUpdaterConfigured = true;

  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    publishUpdateStatus({ state: 'checking' });
  });

  autoUpdater.on('update-available', (info: unknown) => {
    updateDownloaded = false;
    const version = readVersion(info);
    publishUpdateStatus({
      state: 'available',
      version: version || 'latest',
      releaseName: readReleaseName(info),
    });
  });

  autoUpdater.on('update-not-available', (info: unknown) => {
    updateDownloaded = false;
    const version = readVersion(info);
    publishUpdateStatus({ state: 'not-available', ...(version ? { version } : {}) });
  });

  autoUpdater.on('download-progress', (progress: unknown) => {
    if (!progress || typeof progress !== 'object') return;
    publishUpdateStatus({
      state: 'downloading',
      percent: toNumber((progress as { percent?: unknown }).percent),
      transferred: toNumber((progress as { transferred?: unknown }).transferred),
      total: toNumber((progress as { total?: unknown }).total),
      bytesPerSecond: toNumber((progress as { bytesPerSecond?: unknown }).bytesPerSecond),
    });
  });

  autoUpdater.on('update-downloaded', async (info: unknown) => {
    updateDownloaded = true;
    const version = readVersion(info) || app.getVersion();
    publishUpdateStatus({
      state: 'downloaded',
      version,
      releaseName: readReleaseName(info),
    });

    if (!mainWindow || mainWindow.isDestroyed()) return;

    try {
      const response = await dialog.showMessageBox(mainWindow, {
        type: 'info',
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
        noLink: true,
        title: 'Update Ready',
        message: `Compazz POS ${version} is ready to install.`,
        detail: 'Choose "Restart Now" to apply it immediately. Otherwise it will install when the app closes.',
      });

      if (response.response === 0) {
        setImmediate(() => {
          autoUpdater.quitAndInstall();
        });
      }
    } catch (err) {
      publishUpdateStatus({ state: 'error', message: readErrorMessage(err) });
    }
  });

  autoUpdater.on('error', (err: unknown) => {
    publishUpdateStatus({ state: 'error', message: readErrorMessage(err) });
  });

  setTimeout(() => {
    void checkForAppUpdates();
  }, AUTO_UPDATE_CHECK_DELAY_MS);

  updateInterval = setInterval(() => {
    void checkForAppUpdates();
  }, AUTO_UPDATE_INTERVAL_MS);
  updateInterval.unref?.();
};

const createWindow = (): void => {
  // Hide the default menu bar (no File/Edit/View etc.)
  Menu.setApplicationMenu(null);

  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    title: 'Compazz POS',
    autoHideMenuBar: true,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false, // Required for preload to use Node.js APIs via contextBridge
    },
  });

  // Pass window reference to printBridge so it can enumerate printers
  setMainWindow(mainWindow);

  if (isDev) {
    // In dev, try Vite dev server first; fall back to dist/ if server isn't running
    mainWindow.loadURL(DEV_URL).catch(() => {
      console.log('Vite dev server not available, loading production build...');
      mainWindow!.loadFile(path.join(DIST_PATH, 'index.html'));
    });
  } else {
    mainWindow.loadFile(path.join(DIST_PATH, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
};

// Focus existing window if user tries to launch a second instance
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.focus();
  }
});

// ---------------------------------------------------------------------------
// App lifecycle
// ---------------------------------------------------------------------------

app.whenReady().then(() => {
  createWindow();
  configureAutoUpdater();

  // macOS: re-create window when dock icon clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except macOS dock behavior)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  if (!updateInterval) return;
  clearInterval(updateInterval);
  updateInterval = null;
});

// ---------------------------------------------------------------------------
// IPC Handlers
// ---------------------------------------------------------------------------

/** Silent receipt printing */
ipcMain.handle(
  'print-receipt',
  async (_event, payload: { content: string; copies?: number; printerName?: string }) => {
    return printReceipt({
      content: payload.content,
      copies: payload.copies,
      printerName: payload.printerName,
      openDrawer: false,
    });
  },
);

/** Cash drawer kick */
ipcMain.handle(
  'open-cash-drawer',
  async (_event, payload: { printerName?: string }) => {
    // Send only the drawer-kick command (no receipt content)
    const result = await printReceipt({
      content: '',
      copies: 1,
      printerName: payload?.printerName,
      openDrawer: true,
    });
    return result.success;
  },
);

/** List OS printers */
ipcMain.handle('list-printers', async () => {
  return listPrinters();
});

/** App version */
ipcMain.handle('get-app-version', () => {
  return app.getVersion();
});

/** Trigger manual update check */
ipcMain.handle('app-update:check', async () => {
  return checkForAppUpdates();
});

/** Read latest update status snapshot */
ipcMain.handle('app-update:get-status', () => {
  return latestUpdateStatus;
});

/** Install downloaded update immediately */
ipcMain.handle('app-update:install', () => {
  if (isDev || !updateDownloaded) return false;
  autoUpdater.quitAndInstall();
  return true;
});
