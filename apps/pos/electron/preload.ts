/**
 * Electron Preload Script
 *
 * Runs in a sandboxed renderer context with access to `contextBridge` and
 * `ipcRenderer`.  Exposes two objects on `window`:
 *
 *   1. `window.CompazzNativePrinter` — matches the interface already declared
 *      in src/lib/receiptPrinter.ts.  The existing `tryCompazzNativePrint()`
 *      will detect it automatically and use it for silent printing.
 *
 *   2. `window.compazzDesktop` — utility API for feature-detection, cash
 *      drawer control, and printer enumeration.
 */

import { contextBridge, ipcRenderer } from 'electron';

type AppUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName?: string }
  | { state: 'not-available'; version?: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { state: 'downloaded'; version: string; releaseName?: string }
  | { state: 'error'; message: string };

const updateStatusListeners = new Map<string, (_event: any, status: AppUpdateStatus) => void>();
const createListenerId = (): string =>
  `listener-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

// ---------------------------------------------------------------------------
// 1. CompazzNativePrinter — the receipt printing bridge
//    (matches the type in src/lib/receiptPrinter.ts)
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('CompazzNativePrinter', {
  /**
   * Print a plain-text receipt silently via the native print bridge.
   * Returns `true` if the printer accepted the job, `false` otherwise.
   */
  printReceipt: async (payload: {
    content: string;
    copies?: number;
    printerName?: string;
  }): Promise<boolean> => {
    try {
      const result = await ipcRenderer.invoke('print-receipt', payload);
      return result?.success === true;
    } catch {
      return false;
    }
  },
});

// ---------------------------------------------------------------------------
// 2. compazzDesktop — desktop-specific utilities
// ---------------------------------------------------------------------------

contextBridge.exposeInMainWorld('compazzDesktop', {
  /** Feature-detection: `true` when running inside Electron. */
  isElectron: true,

  /** Get the Compazz POS desktop app version. */
  getAppVersion: (): Promise<string> => ipcRenderer.invoke('get-app-version'),

  /**
   * List printers known to the operating system.
   * Each entry has `{ name: string; isDefault: boolean }`.
   */
  getPrinters: (): Promise<Array<{ name: string; isDefault: boolean }>> =>
    ipcRenderer.invoke('list-printers'),

  /**
   * Kick the cash drawer open.
   * `printerName` is optional — if omitted, uses the default receipt printer.
   */
  openCashDrawer: (printerName?: string): Promise<boolean> =>
    ipcRenderer.invoke('open-cash-drawer', { printerName }),

  /** Manual update check trigger. */
  checkForUpdates: (): Promise<{ ok: boolean; error?: string }> =>
    ipcRenderer.invoke('app-update:check'),

  /** Get latest update status snapshot from main process. */
  getUpdateStatus: (): Promise<AppUpdateStatus> =>
    ipcRenderer.invoke('app-update:get-status'),

  /** Install a downloaded update immediately (quits app). */
  installUpdate: (): Promise<boolean> =>
    ipcRenderer.invoke('app-update:install'),

  /** Subscribe to updater status events from the main process. */
  onUpdateStatus: (callback: (status: AppUpdateStatus) => void): string => {
    const listenerId = createListenerId();
    const listener = (_event: any, status: AppUpdateStatus) => callback(status);
    updateStatusListeners.set(listenerId, listener);
    ipcRenderer.on('app-update-status', listener);
    return listenerId;
  },

  /** Unsubscribe from updater status events. */
  offUpdateStatus: (listenerId: string): void => {
    const listener = updateStatusListeners.get(listenerId);
    if (!listener) return;
    ipcRenderer.removeListener('app-update-status', listener);
    updateStatusListeners.delete(listenerId);
  },
});
