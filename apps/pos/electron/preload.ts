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
});
