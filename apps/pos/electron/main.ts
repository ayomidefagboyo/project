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
 */

import { app, BrowserWindow, ipcMain, Menu } from 'electron';
import * as path from 'node:path';
import { printReceipt, listPrinters, setMainWindow } from './printBridge';
import { buildReceiptPayload } from './escpos';

// ---------------------------------------------------------------------------
// Paths
// ---------------------------------------------------------------------------

const isDev = !app.isPackaged;

const PRELOAD_PATH = path.join(__dirname, 'preload.js');
const DIST_PATH = path.join(__dirname, '..', 'dist');
const DEV_URL = 'http://localhost:5174';

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
    mainWindow.loadURL(DEV_URL);
    // Uncomment the next line to open DevTools by default in dev mode:
    // mainWindow.webContents.openDevTools();
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

  // macOS: re-create window when dock icon clicked and no windows open
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// Quit when all windows are closed (except macOS dock behavior)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
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
