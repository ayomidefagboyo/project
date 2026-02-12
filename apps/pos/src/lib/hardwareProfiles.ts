export type HardwareConnectionStatus = 'connected' | 'disconnected';
export type AutoOpenDrawerMode = 'on-sale' | 'cash-only' | 'manual';
export type AutoPrintMode = 'always' | 'ask' | 'never';

export interface HardwarePolicyProfile {
  id: string;
  name: string;
  autoOpenDrawerMode: AutoOpenDrawerMode;
  autoPrintMode: AutoPrintMode;
  scannerBeepEnabled: boolean;
  cutPaperEnabled: boolean;
  duplicateReceiptsEnabled: boolean;
}

export interface PrinterConfig {
  id: string;
  name: string;
  type: 'thermal' | 'label' | string;
  status: HardwareConnectionStatus;
  defaultPrint: 'receipts' | 'labels' | string;
  profileId: string;
}

export interface ScannerConfig {
  id: string;
  name: string;
  type: 'usb' | 'bluetooth' | string;
  status: HardwareConnectionStatus;
  profileId: string;
}

export interface CashDrawerConfig {
  id: string;
  name: string;
  type: 'rj11' | string;
  status: HardwareConnectionStatus;
  profileId: string;
}

export interface HardwareState {
  printers: PrinterConfig[];
  scanners: ScannerConfig[];
  cashDrawers: CashDrawerConfig[];
  profiles: HardwarePolicyProfile[];
  terminalDefaultProfileId: string;
}

type LegacyHardwarePrefs = {
  autoOpenDrawerMode?: AutoOpenDrawerMode;
  autoPrintMode?: AutoPrintMode;
  scannerBeepEnabled?: boolean;
  cutPaperEnabled?: boolean;
  duplicateReceiptsEnabled?: boolean;
};

export const DEFAULT_HARDWARE_PROFILE_ID = 'policy-standard';

const defaultHardwareProfile: HardwarePolicyProfile = {
  id: DEFAULT_HARDWARE_PROFILE_ID,
  name: 'Standard Policy',
  autoOpenDrawerMode: 'on-sale',
  autoPrintMode: 'always',
  scannerBeepEnabled: true,
  cutPaperEnabled: true,
  duplicateReceiptsEnabled: false,
};

const defaultPrinters: PrinterConfig[] = [
  {
    id: 'thermal-1',
    name: 'Receipt Printer',
    type: 'thermal',
    status: 'connected',
    defaultPrint: 'receipts',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
  },
  {
    id: 'label-1',
    name: 'Label Printer',
    type: 'label',
    status: 'disconnected',
    defaultPrint: 'labels',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
  },
];

const defaultScanners: ScannerConfig[] = [
  {
    id: 'scanner-1',
    name: 'Barcode Scanner',
    type: 'usb',
    status: 'connected',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
  },
];

const defaultCashDrawers: CashDrawerConfig[] = [
  {
    id: 'drawer-1',
    name: 'Cash Drawer',
    type: 'rj11',
    status: 'connected',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
  },
];

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const asConnectionStatus = (value: unknown): HardwareConnectionStatus =>
  value === 'connected' || value === 'disconnected' ? value : 'disconnected';

const asAutoOpenDrawerMode = (value: unknown): AutoOpenDrawerMode =>
  value === 'on-sale' || value === 'cash-only' || value === 'manual'
    ? value
    : defaultHardwareProfile.autoOpenDrawerMode;

const asAutoPrintMode = (value: unknown): AutoPrintMode =>
  value === 'always' || value === 'ask' || value === 'never'
    ? value
    : defaultHardwareProfile.autoPrintMode;

export const createHardwareProfileId = (): string =>
  `policy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const createHardwareProfile = (
  name = 'Custom Policy',
  seed?: Partial<HardwarePolicyProfile>
): HardwarePolicyProfile => ({
  id: createHardwareProfileId(),
  name,
  autoOpenDrawerMode: asAutoOpenDrawerMode(seed?.autoOpenDrawerMode),
  autoPrintMode: asAutoPrintMode(seed?.autoPrintMode),
  scannerBeepEnabled: seed?.scannerBeepEnabled ?? defaultHardwareProfile.scannerBeepEnabled,
  cutPaperEnabled: seed?.cutPaperEnabled ?? defaultHardwareProfile.cutPaperEnabled,
  duplicateReceiptsEnabled:
    seed?.duplicateReceiptsEnabled ?? defaultHardwareProfile.duplicateReceiptsEnabled,
});

export const createDefaultHardwareState = (): HardwareState => ({
  printers: defaultPrinters.map((printer) => ({ ...printer })),
  scanners: defaultScanners.map((scanner) => ({ ...scanner })),
  cashDrawers: defaultCashDrawers.map((drawer) => ({ ...drawer })),
  profiles: [{ ...defaultHardwareProfile }],
  terminalDefaultProfileId: DEFAULT_HARDWARE_PROFILE_ID,
});

const buildProfileFromLegacyPrefs = (prefs?: LegacyHardwarePrefs): HardwarePolicyProfile => ({
  id: DEFAULT_HARDWARE_PROFILE_ID,
  name: 'Standard Policy',
  autoOpenDrawerMode: asAutoOpenDrawerMode(prefs?.autoOpenDrawerMode),
  autoPrintMode: asAutoPrintMode(prefs?.autoPrintMode),
  scannerBeepEnabled: prefs?.scannerBeepEnabled ?? defaultHardwareProfile.scannerBeepEnabled,
  cutPaperEnabled: prefs?.cutPaperEnabled ?? defaultHardwareProfile.cutPaperEnabled,
  duplicateReceiptsEnabled:
    prefs?.duplicateReceiptsEnabled ?? defaultHardwareProfile.duplicateReceiptsEnabled,
});

const sanitizeProfiles = (rawProfiles: unknown, legacyPrefs?: LegacyHardwarePrefs): HardwarePolicyProfile[] => {
  if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) {
    return [buildProfileFromLegacyPrefs(legacyPrefs)];
  }

  const profiles: HardwarePolicyProfile[] = rawProfiles
    .filter((profile): profile is Record<string, unknown> => isObject(profile))
    .map((profile, index) => {
      const fallbackId = index === 0 ? DEFAULT_HARDWARE_PROFILE_ID : createHardwareProfileId();
      return {
        id: typeof profile.id === 'string' && profile.id.trim().length > 0 ? profile.id : fallbackId,
        name:
          typeof profile.name === 'string' && profile.name.trim().length > 0
            ? profile.name
            : `Policy ${index + 1}`,
        autoOpenDrawerMode: asAutoOpenDrawerMode(profile.autoOpenDrawerMode),
        autoPrintMode: asAutoPrintMode(profile.autoPrintMode),
        scannerBeepEnabled:
          typeof profile.scannerBeepEnabled === 'boolean'
            ? profile.scannerBeepEnabled
            : defaultHardwareProfile.scannerBeepEnabled,
        cutPaperEnabled:
          typeof profile.cutPaperEnabled === 'boolean'
            ? profile.cutPaperEnabled
            : defaultHardwareProfile.cutPaperEnabled,
        duplicateReceiptsEnabled:
          typeof profile.duplicateReceiptsEnabled === 'boolean'
            ? profile.duplicateReceiptsEnabled
            : defaultHardwareProfile.duplicateReceiptsEnabled,
      };
    });

  return profiles.length > 0 ? profiles : [buildProfileFromLegacyPrefs(legacyPrefs)];
};

const getValidProfileId = (
  requestedProfileId: unknown,
  profiles: HardwarePolicyProfile[],
  fallbackProfileId: string
): string => {
  if (typeof requestedProfileId === 'string' && profiles.some((profile) => profile.id === requestedProfileId)) {
    return requestedProfileId;
  }
  return fallbackProfileId;
};

export const normalizeHardwareState = (raw: unknown): HardwareState => {
  const defaults = createDefaultHardwareState();
  if (!isObject(raw)) return defaults;

  const legacyPrefs = isObject(raw.prefs) ? (raw.prefs as LegacyHardwarePrefs) : undefined;
  const profiles = sanitizeProfiles(raw.profiles, legacyPrefs);
  const terminalDefaultProfileId = getValidProfileId(raw.terminalDefaultProfileId, profiles, profiles[0].id);

  const normalizedPrinters = Array.isArray(raw.printers)
    ? raw.printers
        .filter((printer): printer is Record<string, unknown> => isObject(printer))
        .map((printer, index) => ({
          id:
            typeof printer.id === 'string' && printer.id.trim().length > 0
              ? printer.id
              : `printer-${index + 1}`,
          name:
            typeof printer.name === 'string' && printer.name.trim().length > 0
              ? printer.name
              : `Printer ${index + 1}`,
          type:
            typeof printer.type === 'string' && printer.type.trim().length > 0
              ? printer.type
              : 'thermal',
          status: asConnectionStatus(printer.status),
          defaultPrint:
            typeof printer.defaultPrint === 'string' && printer.defaultPrint.trim().length > 0
              ? printer.defaultPrint
              : 'receipts',
          profileId: getValidProfileId(
            (printer as Record<string, unknown>).profileId,
            profiles,
            terminalDefaultProfileId
          ),
        }))
    : defaults.printers;

  const normalizedScanners = Array.isArray(raw.scanners)
    ? raw.scanners
        .filter((scanner): scanner is Record<string, unknown> => isObject(scanner))
        .map((scanner, index) => ({
          id:
            typeof scanner.id === 'string' && scanner.id.trim().length > 0
              ? scanner.id
              : `scanner-${index + 1}`,
          name:
            typeof scanner.name === 'string' && scanner.name.trim().length > 0
              ? scanner.name
              : `Scanner ${index + 1}`,
          type:
            typeof scanner.type === 'string' && scanner.type.trim().length > 0
              ? scanner.type
              : 'usb',
          status: asConnectionStatus(scanner.status),
          profileId: getValidProfileId(
            (scanner as Record<string, unknown>).profileId,
            profiles,
            terminalDefaultProfileId
          ),
        }))
    : defaults.scanners;

  const normalizedCashDrawers = Array.isArray(raw.cashDrawers)
    ? raw.cashDrawers
        .filter((drawer): drawer is Record<string, unknown> => isObject(drawer))
        .map((drawer, index) => ({
          id:
            typeof drawer.id === 'string' && drawer.id.trim().length > 0
              ? drawer.id
              : `drawer-${index + 1}`,
          name:
            typeof drawer.name === 'string' && drawer.name.trim().length > 0
              ? drawer.name
              : `Drawer ${index + 1}`,
          type:
            typeof drawer.type === 'string' && drawer.type.trim().length > 0
              ? drawer.type
              : 'rj11',
          status: asConnectionStatus(drawer.status),
          profileId: getValidProfileId(
            (drawer as Record<string, unknown>).profileId,
            profiles,
            terminalDefaultProfileId
          ),
        }))
    : defaults.cashDrawers;

  return {
    printers: normalizedPrinters,
    scanners: normalizedScanners,
    cashDrawers: normalizedCashDrawers,
    profiles,
    terminalDefaultProfileId,
  };
};

export const getHardwareStorageKey = (outletId?: string, terminalId?: string): string | null =>
  outletId && terminalId ? `pos_hardware_${outletId}_${terminalId}` : null;

export const loadHardwareState = (outletId?: string, terminalId?: string): HardwareState => {
  const storageKey = getHardwareStorageKey(outletId, terminalId);
  if (!storageKey) return createDefaultHardwareState();

  try {
    const raw = localStorage.getItem(storageKey);
    if (!raw) return createDefaultHardwareState();
    return normalizeHardwareState(JSON.parse(raw));
  } catch {
    return createDefaultHardwareState();
  }
};

export const saveHardwareState = (
  outletId: string | undefined,
  terminalId: string | undefined,
  state: HardwareState
): void => {
  const storageKey = getHardwareStorageKey(outletId, terminalId);
  if (!storageKey) return;

  try {
    localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    // Ignore storage errors.
  }
};

export const resolveHardwarePolicy = (
  state: HardwareState,
  requestedProfileId?: string
): HardwarePolicyProfile => {
  const profileId = requestedProfileId || state.terminalDefaultProfileId;
  return (
    state.profiles.find((profile) => profile.id === profileId) ||
    state.profiles[0] ||
    { ...defaultHardwareProfile }
  );
};

export const resolveReceiptPolicy = (state: HardwareState): HardwarePolicyProfile => {
  const preferredPrinter =
    state.printers.find((printer) => printer.defaultPrint === 'receipts' && printer.status === 'connected') ||
    state.printers.find((printer) => printer.defaultPrint === 'receipts') ||
    state.printers.find((printer) => printer.status === 'connected') ||
    state.printers[0];

  return resolveHardwarePolicy(state, preferredPrinter?.profileId || state.terminalDefaultProfileId);
};

