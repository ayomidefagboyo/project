/**
 * Print Bridge — Silent Receipt Printing
 *
 * Receives plain-text receipt content from the renderer (via IPC) and
 * sends it to the thermal printer without any user dialog.
 *
 * Supports three connection strategies (tried in order):
 *   1. Network — TCP socket to printer IP:9100 (most common for LAN printers)
 *   2. Windows spooler — sends a RAW job via PowerShell (works with any
 *      printer visible in Windows "Devices and Printers")
 *   3. Device path — write directly to a device file (Linux/macOS: /dev/usb/lp0)
 *
 * Which strategy is used depends on what `printerName` looks like:
 *   - Contains `:` and a port number → network  (e.g. "192.168.1.50:9100")
 *   - Starts with `/dev/`             → device path
 *   - Anything else                   → Windows spooler (treated as the printer's
 *                                       friendly name in the OS)
 */

import * as net from 'node:net';
import * as fs from 'node:fs';
import { execFile } from 'node:child_process';
import { buildReceiptPayload } from './escpos';

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
  mode: 'network' | 'spooler' | 'device' | 'none';
  error?: string;
}

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

    // Write payload to a temp file, then send it as a RAW job via PowerShell.
    const tempPath = `${process.env.TEMP || '/tmp'}/compazz_receipt_${Date.now()}.bin`;
    try {
      fs.writeFileSync(tempPath, Buffer.from(payload));
    } catch {
      resolve(false);
      return;
    }

    // PowerShell script to send a RAW print job
    const psScript = `
      $printer = Get-WmiObject -Query "SELECT * FROM Win32_Printer WHERE Name='${printerName.replace(/'/g, "''")}'";
      if (-not $printer) { exit 1 };
      $port = $printer.PortName;
      Copy-Item '${tempPath.replace(/\\/g, '\\\\')}' -Destination "\\\\localhost\\${printerName.replace(/'/g, "''")}" -Force;
      exit 0;
    `;

    execFile(
      'powershell.exe',
      ['-NoProfile', '-NonInteractive', '-Command', psScript],
      { timeout: 8000 },
      (err) => {
        // Clean up temp file
        try { fs.unlinkSync(tempPath); } catch { /* ignore */ }

        if (err) {
          // Fallback: try the `print /d:` command which works with many printers
          execFile(
            'cmd.exe',
            ['/c', `copy /b "${tempPath}" "\\\\localhost\\${printerName}"`],
            { timeout: 8000 },
            (err2) => {
              try { fs.unlinkSync(tempPath); } catch { /* ignore */ }
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

// ---------------------------------------------------------------------------
// Public API — called from IPC handler in main.ts
// ---------------------------------------------------------------------------

export const printReceipt = async (req: PrintRequest): Promise<PrintResult> => {
  const { content, copies = 1, printerName, openDrawer = false } = req;

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
      return { success: false, mode: 'none', error: `Network print to ${addr.host}:${addr.port} failed` };
    }

    // 2. Try device path (Linux/macOS)
    if (printerName.startsWith('/dev/')) {
      const ok = printViaDevicePath(printerName, payload);
      if (ok) return { success: true, mode: 'device' };
      return { success: false, mode: 'none', error: `Device write to ${printerName} failed` };
    }

    // 3. Try Windows spooler (printer friendly name)
    if (process.platform === 'win32') {
      const ok = await printViaSpooler(printerName, payload);
      if (ok) return { success: true, mode: 'spooler' };
      return { success: false, mode: 'none', error: `Spooler print to "${printerName}" failed` };
    }
  }

  // No printer name — try default printer via spooler on Windows
  if (process.platform === 'win32') {
    const printers = await listPrinters();
    const defaultPrinter = printers.find((p) => p.isDefault);
    if (defaultPrinter) {
      const ok = await printViaSpooler(defaultPrinter.name, payload);
      if (ok) return { success: true, mode: 'spooler' };
    }
  }

  return { success: false, mode: 'none', error: 'No printer available' };
};
