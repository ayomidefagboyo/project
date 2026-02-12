import {
  type HardwareBrand,
  type HardwareCapabilityOverrides,
  type HardwareConnection,
  inferHardwareAdapterId,
  inferHardwareBrand,
  inferHardwareConnection,
} from './hardwareAdapters';

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

interface BaseHardwareDeviceConfig {
  id: string;
  name: string;
  status: HardwareConnectionStatus;
  profileId: string;
  brand: HardwareBrand | string;
  model: string;
  connection: HardwareConnection | string;
  adapterId: string;
  capabilities?: HardwareCapabilityOverrides;
}

export interface PrinterConfig extends BaseHardwareDeviceConfig {
  type: 'thermal' | 'label' | string;
  defaultPrint: 'receipts' | 'labels' | string;
}

export interface ScannerConfig extends BaseHardwareDeviceConfig {
  type: 'usb' | 'bluetooth' | 'integrated' | string;
}

export interface CashDrawerConfig extends BaseHardwareDeviceConfig {
  type: 'rj11' | 'serial' | 'usb' | 'network' | string;
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
    brand: 'generic',
    model: 'Generic 80mm Thermal',
    connection: 'usb',
    adapterId: 'printer-generic-escpos',
  },
  {
    id: 'label-1',
    name: 'Label Printer',
    type: 'label',
    status: 'disconnected',
    defaultPrint: 'labels',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
    brand: 'zebra',
    model: 'ZD220',
    connection: 'usb',
    adapterId: 'printer-zebra-label',
  },
];

const defaultScanners: ScannerConfig[] = [
  {
    id: 'scanner-1',
    name: 'Barcode Scanner',
    type: 'usb',
    status: 'connected',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
    brand: 'generic',
    model: '1D/2D USB Scanner',
    connection: 'usb',
    adapterId: 'scanner-generic',
  },
];

const defaultCashDrawers: CashDrawerConfig[] = [
  {
    id: 'drawer-1',
    name: 'Cash Drawer',
    type: 'rj11',
    status: 'connected',
    profileId: DEFAULT_HARDWARE_PROFILE_ID,
    brand: 'generic',
    model: 'RJ11 Cash Drawer',
    connection: 'rj11',
    adapterId: 'drawer-rj11',
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

const asNonEmptyString = (value: unknown, fallback: string): string =>
  typeof value === 'string' && value.trim().length > 0 ? value.trim() : fallback;

const sanitizeCapabilities = (value: unknown): HardwareCapabilityOverrides | undefined => {
  if (!isObject(value)) return undefined;

  const next: HardwareCapabilityOverrides = {};
  const keys: Array<keyof HardwareCapabilityOverrides> = [
    'receiptPrint',
    'labelPrint',
    'openDrawer',
    'cutPaper',
    'barcodeScan',
    'scannerBeep',
  ];

  for (const key of keys) {
    const raw = value[key];
    if (typeof raw === 'boolean') {
      next[key] = raw;
    }
  }

  return Object.keys(next).length > 0 ? next : undefined;
};

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

const sanitizeProfiles = (
  rawProfiles: unknown,
  legacyPrefs?: LegacyHardwarePrefs
): HardwarePolicyProfile[] => {
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
  if (
    typeof requestedProfileId === 'string' &&
    profiles.some((profile) => profile.id === requestedProfileId)
  ) {
    return requestedProfileId;
  }
  return fallbackProfileId;
};

export const normalizeHardwareState = (raw: unknown): HardwareState => {
  const defaults = createDefaultHardwareState();
  if (!isObject(raw)) return defaults;

  const legacyPrefs = isObject(raw.prefs) ? (raw.prefs as LegacyHardwarePrefs) : undefined;
  const profiles = sanitizeProfiles(raw.profiles, legacyPrefs);
  const terminalDefaultProfileId = getValidProfileId(
    raw.terminalDefaultProfileId,
    profiles,
    profiles[0].id
  );

  const normalizedPrinters = Array.isArray(raw.printers)
    ? raw.printers
        .filter((printer): printer is Record<string, unknown> => isObject(printer))
        .map((printer, index) => {
          const type = asNonEmptyString(printer.type, 'thermal');
          const brand = inferHardwareBrand(printer.brand, 'printer');
          const connection = inferHardwareConnection(printer.connection, 'printer');
          const adapterId = inferHardwareAdapterId({
            kind: 'printer',
            brand,
            type,
            connection,
            requestedAdapterId:
              typeof printer.adapterId === 'string' && printer.adapterId.trim().length > 0
                ? printer.adapterId
                : undefined,
          });

          return {
            id: asNonEmptyString(printer.id, `printer-${index + 1}`),
            name: asNonEmptyString(printer.name, `Printer ${index + 1}`),
            type,
            status: asConnectionStatus(printer.status),
            defaultPrint: asNonEmptyString(printer.defaultPrint, 'receipts'),
            profileId: getValidProfileId(
              (printer as Record<string, unknown>).profileId,
              profiles,
              terminalDefaultProfileId
            ),
            brand,
            model: asNonEmptyString(
              printer.model,
              type === 'label' ? `${brand.toUpperCase()} Label Printer` : `${brand.toUpperCase()} Receipt Printer`
            ),
            connection,
            adapterId,
            capabilities: sanitizeCapabilities(printer.capabilities),
          } as PrinterConfig;
        })
    : defaults.printers;

  const normalizedScanners = Array.isArray(raw.scanners)
    ? raw.scanners
        .filter((scanner): scanner is Record<string, unknown> => isObject(scanner))
        .map((scanner, index) => {
          const type = asNonEmptyString(scanner.type, 'usb');
          const brand = inferHardwareBrand(scanner.brand, 'scanner');
          const connection = inferHardwareConnection(scanner.connection ?? type, 'scanner');
          const adapterId = inferHardwareAdapterId({
            kind: 'scanner',
            brand,
            type,
            connection,
            requestedAdapterId:
              typeof scanner.adapterId === 'string' && scanner.adapterId.trim().length > 0
                ? scanner.adapterId
                : undefined,
          });

          return {
            id: asNonEmptyString(scanner.id, `scanner-${index + 1}`),
            name: asNonEmptyString(scanner.name, `Scanner ${index + 1}`),
            type,
            status: asConnectionStatus(scanner.status),
            profileId: getValidProfileId(
              (scanner as Record<string, unknown>).profileId,
              profiles,
              terminalDefaultProfileId
            ),
            brand,
            model: asNonEmptyString(scanner.model, `${brand.toUpperCase()} Barcode Scanner`),
            connection,
            adapterId,
            capabilities: sanitizeCapabilities(scanner.capabilities),
          } as ScannerConfig;
        })
    : defaults.scanners;

  const normalizedCashDrawers = Array.isArray(raw.cashDrawers)
    ? raw.cashDrawers
        .filter((drawer): drawer is Record<string, unknown> => isObject(drawer))
        .map((drawer, index) => {
          const type = asNonEmptyString(drawer.type, 'rj11');
          const brand = inferHardwareBrand(drawer.brand, 'drawer');
          const connection = inferHardwareConnection(drawer.connection ?? type, 'drawer');
          const adapterId = inferHardwareAdapterId({
            kind: 'drawer',
            brand,
            type,
            connection,
            requestedAdapterId:
              typeof drawer.adapterId === 'string' && drawer.adapterId.trim().length > 0
                ? drawer.adapterId
                : undefined,
          });

          return {
            id: asNonEmptyString(drawer.id, `drawer-${index + 1}`),
            name: asNonEmptyString(drawer.name, `Drawer ${index + 1}`),
            type,
            status: asConnectionStatus(drawer.status),
            profileId: getValidProfileId(
              (drawer as Record<string, unknown>).profileId,
              profiles,
              terminalDefaultProfileId
            ),
            brand,
            model: asNonEmptyString(drawer.model, `${brand.toUpperCase()} Cash Drawer`),
            connection,
            adapterId,
            capabilities: sanitizeCapabilities(drawer.capabilities),
          } as CashDrawerConfig;
        })
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

export const resolveReceiptPrinter = (state: HardwareState): PrinterConfig | undefined =>
  state.printers.find(
    (printer) => printer.defaultPrint === 'receipts' && printer.status === 'connected'
  ) ||
  state.printers.find((printer) => printer.defaultPrint === 'receipts') ||
  state.printers.find((printer) => printer.status === 'connected') ||
  state.printers[0];

export const resolveLabelPrinter = (state: HardwareState): PrinterConfig | undefined =>
  state.printers.find(
    (printer) =>
      printer.defaultPrint === 'labels' &&
      printer.status === 'connected'
  ) ||
  state.printers.find(
    (printer) =>
      printer.type === 'label' &&
      printer.status === 'connected'
  ) ||
  state.printers.find((printer) => printer.defaultPrint === 'labels') ||
  state.printers.find((printer) => printer.type === 'label');

export const resolvePrimaryCashDrawer = (
  state: HardwareState,
  preferredProfileId?: string
): CashDrawerConfig | undefined => {
  if (state.cashDrawers.length === 0) return undefined;

  return (
    state.cashDrawers.find(
      (drawer) => drawer.status === 'connected' && drawer.profileId === preferredProfileId
    ) ||
    state.cashDrawers.find((drawer) => drawer.status === 'connected') ||
    state.cashDrawers.find((drawer) => drawer.profileId === preferredProfileId) ||
    state.cashDrawers[0]
  );
};

export const resolveReceiptPolicy = (state: HardwareState): HardwarePolicyProfile => {
  const preferredPrinter = resolveReceiptPrinter(state);
  return resolveHardwarePolicy(state, preferredPrinter?.profileId || state.terminalDefaultProfileId);
};
