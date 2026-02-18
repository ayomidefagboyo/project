type DesktopUpdateStatus =
  | { state: 'idle' }
  | { state: 'checking' }
  | { state: 'available'; version: string; releaseName?: string }
  | { state: 'not-available'; version?: string }
  | { state: 'downloading'; percent: number; transferred: number; total: number; bytesPerSecond: number }
  | { state: 'downloaded'; version: string; releaseName?: string }
  | { state: 'error'; message: string };

interface CompazzDesktopBridge {
  isElectron: boolean;
  getAppVersion: () => Promise<string>;
  getPrinters: () => Promise<Array<{ name: string; isDefault: boolean }>>;
  openCashDrawer: (printerName?: string) => Promise<boolean>;
  checkForUpdates: () => Promise<{ ok: boolean; error?: string }>;
  getUpdateStatus: () => Promise<DesktopUpdateStatus>;
  installUpdate: () => Promise<boolean>;
  onUpdateStatus: (callback: (status: DesktopUpdateStatus) => void) => string;
  offUpdateStatus: (listenerId: string) => void;
}

declare global {
  interface Window {
    compazzDesktop?: CompazzDesktopBridge;
  }
}

export {};
