/**
 * Print Bridge — Silent Receipt Printing
 *
 * Receives plain-text receipt content from the renderer (via IPC) and
 * sends it to the thermal printer without any user dialog.
 *
 * Supports four connection strategies (tried in order):
 *   1. Network — TCP socket to printer IP:9100 (most common for LAN printers)
 *   2. Device path — write directly to a device file (Linux/macOS: /dev/usb/lp0)
 *   3. macOS lp — uses the built-in `lp` command (works with any printer
 *      visible in System Preferences → Printers & Scanners)
 *   4. Windows spooler — sends a RAW job via PowerShell (works with any
 *      printer visible in Windows "Devices and Printers")
 *
 * Which strategy is used depends on what `printerName` looks like:
 *   - Looks like an IP address        → network  (e.g. "192.168.1.50:9100")
 *   - Starts with `/dev/`             → device path
 *   - On macOS, a friendly name       → macOS lp command
 *   - On Windows, a friendly name     → Windows spooler
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { execFile } from 'node:child_process';
import { BrowserWindow } from 'electron';
import { buildReceiptPayload } from './escpos.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PrintRequest {
  content: string;
  copies?: number;
  printerName?: string;
  openDrawer?: boolean;
}

export interface PrintResult {
  success: boolean;
  mode: 'network' | 'spooler' | 'lp' | 'device' | 'silent' | 'none';
  error?: string;
}

// ---------------------------------------------------------------------------
// Temp file helper
// ---------------------------------------------------------------------------

const writeTempFile = (payload: Uint8Array): string | null => {
  const tempDir = os.tmpdir();
  const tempPath = path.join(tempDir, `compazz_receipt_${Date.now()}.bin`);
  try {
    fs.writeFileSync(tempPath, Buffer.from(payload));
    return tempPath;
  } catch {
    return null;
  }
};

const removeTempFile = (filePath: string): void => {
  try { fs.unlinkSync(filePath); } catch { /* ignore */ }
};

// ---------------------------------------------------------------------------
// Network printing (TCP raw socket on port 9100)
// ---------------------------------------------------------------------------

const parseNetworkAddress = (
  name: string,
): { host: string; port: number } | null => {
  // Accept "192.168.1.50:9100" or "192.168.1.50" (default port 9100)
  const match = name.match(/^(\d{1,3}(?:\.\d{1,3}){3})(?::(\d+))?$/);
  if (!match) return null;
  return { host: match[1], port: match[2] ? parseInt(match[2], 10) : 9100 };
};

const printViaNetwork = (
  host: string,
  port: number,
  payload: Uint8Array,
): Promise<boolean> =>
  new Promise((resolve) => {
    const socket = new net.Socket();
    const timeout = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, 5000);

    socket.connect(port, host, () => {
      socket.write(Buffer.from(payload), () => {
        clearTimeout(timeout);
        socket.end();
        resolve(true);
      });
    });

    socket.on('error', () => {
      clearTimeout(timeout);
      socket.destroy();
      resolve(false);
    });
  });

// ---------------------------------------------------------------------------
// Device path printing (Linux / macOS — /dev/usb/lp0 etc.)
// ---------------------------------------------------------------------------

const printViaDevicePath = (
  devicePath: string,
  payload: Uint8Array,
): boolean => {
  try {
    fs.writeFileSync(devicePath, Buffer.from(payload));
    return true;
  } catch {
    return false;
  }
};

// ---------------------------------------------------------------------------
// macOS printing via `lp` command
// ---------------------------------------------------------------------------

const printViaMacLp = (
  printerName: string | undefined,
  payload: Uint8Array,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (process.platform !== 'darwin') {
      resolve(false);
      return;
    }

    const tempPath = writeTempFile(payload);
    if (!tempPath) {
      resolve(false);
      return;
    }

    // Build lp arguments
    // -o raw: send raw bytes (ESC/POS) without any processing
    // -d <printer>: specify printer by name (optional — uses default if omitted)
    const args: string[] = ['-o', 'raw'];
    if (printerName) {
      args.push('-d', printerName);
    }
    args.push(tempPath);

    execFile('/usr/bin/lp', args, { timeout: 10000 }, (err) => {
      removeTempFile(tempPath);
      resolve(!err);
    });
  });

// ---------------------------------------------------------------------------
// Linux printing via `lp` command (same as macOS but different path check)
// ---------------------------------------------------------------------------

const printViaLinuxLp = (
  printerName: string | undefined,
  payload: Uint8Array,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (process.platform !== 'linux') {
      resolve(false);
      return;
    }

    const tempPath = writeTempFile(payload);
    if (!tempPath) {
      resolve(false);
      return;
    }

    const args: string[] = ['-o', 'raw'];
    if (printerName) {
      args.push('-d', printerName);
    }
    args.push(tempPath);

    execFile('lp', args, { timeout: 10000 }, (err) => {
      removeTempFile(tempPath);
      resolve(!err);
    });
  });

// ---------------------------------------------------------------------------
// Windows spooler printing (PowerShell RAW job)
// ---------------------------------------------------------------------------

const printViaSpooler = (
  printerName: string,
  payload: Uint8Array,
): Promise<boolean> =>
  new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }

    const tempPath = writeTempFile(payload);
    if (!tempPath) {
      resolve(false);
      return;
    }

    // PowerShell script to send a RAW print job
    const safeName = printerName.replace(/'/g, "''");
    const safePath = tempPath.replace(/\\/g, '\\\\');
    const psScript = `
      $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='${safeName}'";
      if (-not $printer) { exit 1 };
      Copy-Item '${safePath}' -Destination "\\\\localhost\\${safeName}" -Force;
      exit 0;
    `;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 8000 },
      (err) => {
        removeTempFile(tempPath);

        if (err) {
          // Fallback: try copy /b command which works with many shared printers
          const tempPath2 = writeTempFile(payload);
          if (!tempPath2) {
            resolve(false);
            return;
          }
          execFile(
            'cmd.exe',
            ['/c', `copy /b "${tempPath2}" "\\\\localhost\\${printerName}"`],
            { timeout: 8000 },
            (err2) => {
              removeTempFile(tempPath2);
              resolve(!err2);
            },
          );
          return;
        }
        resolve(true);
      },
    );
  });

// ---------------------------------------------------------------------------
// Electron printer list (Chromium's built-in printer enumeration)
// ---------------------------------------------------------------------------

let _mainWindow: Electron.BrowserWindow | null = null;

/** Call once from main.ts after creating the BrowserWindow. */
export const setMainWindow = (win: Electron.BrowserWindow): void => {
  _mainWindow = win;
};

/**
 * List printers known to the OS (via Chromium's printer API).
 * Returns an array of `{ name, isDefault }` objects.
 */
export const listPrinters = async (): Promise<
  Array<{ name: string; isDefault: boolean }>
> => {
  if (!_mainWindow) return [];
  try {
    const printers = _mainWindow.webContents.getPrintersAsync
      ? await _mainWindow.webContents.getPrintersAsync()
      : [];
    return printers.map((p: any) => ({
      name: p.name || p.displayName || '',
      isDefault: !!p.isDefault,
    }));
  } catch {
    return [];
  }
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const buildSilentPrintHtml = (content: string): string => {
  const markup = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => `<div class=\"line\">${escapeHtml(line || ' ')}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 0; size: auto; }
      html, body {
        margin: 0;
        padding: 0;
        background: #ffffff;
        color: #111827;
        font-family: "Courier New", Courier, monospace;
        font-size: 12px;
        line-height: 1.4;
      }
      body { padding: 8px 6px; font-feature-settings: "tnum" 1; }
      .line {
        white-space: pre-wrap;
        word-break: break-word;
        color: #111827;
        font-weight: 600;
        text-rendering: geometricPrecision;
      }
      @media print {
        html, body { margin: 0; padding: 0; }
      }
    </style>
  </head>
  <body>${markup}</body>
</html>`;
};

const printViaElectronSilent = async (
  content: string,
  printerName?: string,
): Promise<boolean> => {
  if (!_mainWindow) return false;

  const attempt = async (deviceName?: string): Promise<boolean> =>
    new Promise((resolve) => {
      const printWindow = new BrowserWindow({
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      let done = false;
      const finish = (ok: boolean): void => {
        if (done) return;
        done = true;
        if (!printWindow.isDestroyed()) {
          printWindow.destroy();
        }
        resolve(ok);
      };

      const timeout = setTimeout(() => finish(false), 12_000);

      printWindow.webContents.once('did-finish-load', () => {
        printWindow.webContents.print(
          {
            silent: true,
            printBackground: true,
            ...(deviceName ? { deviceName } : {}),
          },
          (success) => {
            clearTimeout(timeout);
            finish(!!success);
          },
        );
      });

      printWindow.webContents.once('did-fail-load', () => {
        clearTimeout(timeout);
        finish(false);
      });

      void printWindow.webContents
        .loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(buildSilentPrintHtml(content))}`)
        .catch(() => {
          clearTimeout(timeout);
          finish(false);
        });
    });

  if (printerName && printerName.trim().length > 0) {
    const targeted = await attempt(printerName.trim());
    if (targeted) return true;
  }

  return attempt(undefined);
};

// ---------------------------------------------------------------------------
// Public API — called from IPC handler in main.ts
// ---------------------------------------------------------------------------

export const printReceipt = async (req: PrintRequest): Promise<PrintResult> => {
  const { content, copies = 1, printerName, openDrawer = false } = req;
  let lastError = 'No printer available';

  const payload = buildReceiptPayload({
    content,
    copies,
    cut: true,
    openDrawer,
    feedBeforeCut: 3,
  });

  // 1. Try network (if printerName looks like an IP address)
  if (printerName) {
    const addr = parseNetworkAddress(printerName);
    if (addr) {
      const ok = await printViaNetwork(addr.host, addr.port, payload);
      if (ok) return { success: true, mode: 'network' };
      lastError = `Network print to ${addr.host}:${addr.port} failed`;
    }

    // 2. Try device path (Linux/macOS)
    if (printerName.startsWith('/dev/')) {
      const ok = printViaDevicePath(printerName, payload);
      if (ok) return { success: true, mode: 'device' };
      lastError = `Device write to ${printerName} failed`;
    }

    // 3. Try OS-specific spooler by printer friendly name
    if (process.platform === 'win32') {
      const ok = await printViaSpooler(printerName, payload);
      if (ok) return { success: true, mode: 'spooler' };
      lastError = `Spooler print to "${printerName}" failed`;
    }

    if (process.platform === 'darwin') {
      const ok = await printViaMacLp(printerName, payload);
      if (ok) return { success: true, mode: 'lp' };
      lastError = `macOS lp print to "${printerName}" failed`;
    }

    if (process.platform === 'linux') {
      const ok = await printViaLinuxLp(printerName, payload);
      if (ok) return { success: true, mode: 'lp' };
      lastError = `Linux lp print to "${printerName}" failed`;
    }
  }

  // No printer name given — try default printer on each platform
  if (process.platform === 'win32') {
    const printers = await listPrinters();
    const defaultPrinter = printers.find((p) => p.isDefault);
    if (defaultPrinter) {
      const ok = await printViaSpooler(defaultPrinter.name, payload);
      if (ok) return { success: true, mode: 'spooler' };
      lastError = `Default spooler print to "${defaultPrinter.name}" failed`;
    }
  }

  if (process.platform === 'darwin') {
    // lp with no -d flag prints to the default printer
    const ok = await printViaMacLp(undefined, payload);
    if (ok) return { success: true, mode: 'lp' };
    lastError = 'macOS default lp print failed';
  }

  if (process.platform === 'linux') {
    const ok = await printViaLinuxLp(undefined, payload);
    if (ok) return { success: true, mode: 'lp' };
    lastError = 'Linux default lp print failed';
  }

  // Last resort for desktop app: Chromium silent print (no dialog)
  if (!openDrawer) {
    const silentOk = await printViaElectronSilent(content, printerName);
    if (silentOk) return { success: true, mode: 'silent' };
    if (printerName) {
      lastError = `Silent print to "${printerName}" failed`;
    }
  }

  return { success: false, mode: 'none', error: lastError };
};
