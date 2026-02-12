export type HardwareDeviceKind = 'printer' | 'scanner' | 'drawer';

export type HardwareBrand =
  | 'generic'
  | 'epson'
  | 'star'
  | 'bixolon'
  | 'zebra'
  | 'sunmi'
  | 'honeywell'
  | 'datalogic'
  | 'socketmobile'
  | 'custom';

export type HardwareConnection =
  | 'usb'
  | 'lan'
  | 'bluetooth'
  | 'wifi'
  | 'serial'
  | 'rj11'
  | 'integrated'
  | 'cloud';

export interface HardwareCapabilities {
  receiptPrint: boolean;
  labelPrint: boolean;
  openDrawer: boolean;
  cutPaper: boolean;
  barcodeScan: boolean;
  scannerBeep: boolean;
}

export type HardwareCapabilityOverrides = Partial<HardwareCapabilities>;

export type HardwareAction =
  | 'print-receipt'
  | 'print-label'
  | 'open-drawer'
  | 'cut-paper'
  | 'scan-barcode'
  | 'scanner-beep';

export interface HardwareAdapterDefinition {
  id: string;
  label: string;
  kind: HardwareDeviceKind;
  brands: HardwareBrand[];
  supportedConnections: HardwareConnection[];
  defaultConnection: HardwareConnection;
  capabilities: HardwareCapabilities;
}

const EMPTY_CAPABILITIES: HardwareCapabilities = {
  receiptPrint: false,
  labelPrint: false,
  openDrawer: false,
  cutPaper: false,
  barcodeScan: false,
  scannerBeep: false,
};

const HARDWARE_ADAPTERS: HardwareAdapterDefinition[] = [
  {
    id: 'printer-generic-escpos',
    label: 'Generic ESC/POS Receipt Printer',
    kind: 'printer',
    brands: ['generic', 'custom'],
    supportedConnections: ['usb', 'lan', 'bluetooth', 'wifi'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      receiptPrint: true,
      cutPaper: true,
    },
  },
  {
    id: 'printer-epson-escpos',
    label: 'Epson ESC/POS Printer',
    kind: 'printer',
    brands: ['epson'],
    supportedConnections: ['usb', 'lan', 'bluetooth', 'wifi'],
    defaultConnection: 'lan',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      receiptPrint: true,
      cutPaper: true,
    },
  },
  {
    id: 'printer-star-micronics',
    label: 'Star Micronics Printer',
    kind: 'printer',
    brands: ['star'],
    supportedConnections: ['usb', 'lan', 'bluetooth', 'wifi'],
    defaultConnection: 'lan',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      receiptPrint: true,
      cutPaper: true,
    },
  },
  {
    id: 'printer-bixolon',
    label: 'Bixolon Printer',
    kind: 'printer',
    brands: ['bixolon'],
    supportedConnections: ['usb', 'lan', 'bluetooth'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      receiptPrint: true,
      cutPaper: true,
    },
  },
  {
    id: 'printer-zebra-label',
    label: 'Zebra Label Printer',
    kind: 'printer',
    brands: ['zebra'],
    supportedConnections: ['usb', 'lan', 'bluetooth'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      labelPrint: true,
    },
  },
  {
    id: 'printer-sunmi-integrated',
    label: 'Sunmi Integrated Printer',
    kind: 'printer',
    brands: ['sunmi'],
    supportedConnections: ['integrated'],
    defaultConnection: 'integrated',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      receiptPrint: true,
      cutPaper: true,
      openDrawer: true,
    },
  },
  {
    id: 'scanner-generic',
    label: 'Generic Barcode Scanner',
    kind: 'scanner',
    brands: ['generic', 'custom'],
    supportedConnections: ['usb', 'bluetooth', 'integrated'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      barcodeScan: true,
    },
  },
  {
    id: 'scanner-honeywell',
    label: 'Honeywell Barcode Scanner',
    kind: 'scanner',
    brands: ['honeywell'],
    supportedConnections: ['usb', 'bluetooth', 'integrated'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      barcodeScan: true,
      scannerBeep: true,
    },
  },
  {
    id: 'scanner-datalogic',
    label: 'Datalogic Barcode Scanner',
    kind: 'scanner',
    brands: ['datalogic'],
    supportedConnections: ['usb', 'bluetooth', 'integrated'],
    defaultConnection: 'usb',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      barcodeScan: true,
      scannerBeep: true,
    },
  },
  {
    id: 'scanner-socketmobile',
    label: 'Socket Mobile Scanner',
    kind: 'scanner',
    brands: ['socketmobile'],
    supportedConnections: ['bluetooth'],
    defaultConnection: 'bluetooth',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      barcodeScan: true,
    },
  },
  {
    id: 'scanner-sunmi-integrated',
    label: 'Sunmi Integrated Scanner',
    kind: 'scanner',
    brands: ['sunmi'],
    supportedConnections: ['integrated'],
    defaultConnection: 'integrated',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      barcodeScan: true,
      scannerBeep: true,
    },
  },
  {
    id: 'drawer-rj11',
    label: 'RJ11 Cash Drawer',
    kind: 'drawer',
    brands: ['generic', 'custom'],
    supportedConnections: ['rj11'],
    defaultConnection: 'rj11',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      openDrawer: true,
    },
  },
  {
    id: 'drawer-serial',
    label: 'Serial Cash Drawer',
    kind: 'drawer',
    brands: ['generic', 'custom'],
    supportedConnections: ['serial', 'usb'],
    defaultConnection: 'serial',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      openDrawer: true,
    },
  },
  {
    id: 'drawer-network',
    label: 'Network Cash Drawer',
    kind: 'drawer',
    brands: ['generic', 'custom'],
    supportedConnections: ['lan', 'wifi'],
    defaultConnection: 'lan',
    capabilities: {
      ...EMPTY_CAPABILITIES,
      openDrawer: true,
    },
  },
];

export const HARDWARE_BRAND_OPTIONS: Record<HardwareDeviceKind, HardwareBrand[]> = {
  printer: ['generic', 'epson', 'star', 'bixolon', 'zebra', 'sunmi', 'custom'],
  scanner: ['generic', 'honeywell', 'datalogic', 'socketmobile', 'sunmi', 'custom'],
  drawer: ['generic', 'custom'],
};

export const HARDWARE_CONNECTION_OPTIONS: Record<HardwareDeviceKind, HardwareConnection[]> = {
  printer: ['usb', 'lan', 'bluetooth', 'wifi', 'integrated'],
  scanner: ['usb', 'bluetooth', 'integrated'],
  drawer: ['rj11', 'serial', 'usb', 'lan', 'wifi'],
};

const normalizeToken = (value: unknown): string =>
  typeof value === 'string' ? value.trim().toLowerCase().replace(/[_\s]+/g, '') : '';

const BRAND_ALIASES: Record<string, HardwareBrand> = {
  epson: 'epson',
  star: 'star',
  starmicronics: 'star',
  bixolon: 'bixolon',
  zebra: 'zebra',
  sunmi: 'sunmi',
  honeywell: 'honeywell',
  datalogic: 'datalogic',
  socketmobile: 'socketmobile',
  socket: 'socketmobile',
  generic: 'generic',
  custom: 'custom',
};

const CONNECTION_ALIASES: Record<string, HardwareConnection> = {
  usb: 'usb',
  lan: 'lan',
  ethernet: 'lan',
  bt: 'bluetooth',
  bluetooth: 'bluetooth',
  wifi: 'wifi',
  serial: 'serial',
  rs232: 'serial',
  rj11: 'rj11',
  integrated: 'integrated',
  builtin: 'integrated',
  cloud: 'cloud',
};

export const listHardwareAdapters = (kind?: HardwareDeviceKind): HardwareAdapterDefinition[] =>
  kind ? HARDWARE_ADAPTERS.filter((adapter) => adapter.kind === kind) : [...HARDWARE_ADAPTERS];

export const getHardwareAdapterById = (
  adapterId: string,
  kind?: HardwareDeviceKind
): HardwareAdapterDefinition | undefined =>
  HARDWARE_ADAPTERS.find((adapter) => adapter.id === adapterId && (!kind || adapter.kind === kind));

export const getHardwareAdapterLabel = (adapterId: string, kind?: HardwareDeviceKind): string =>
  getHardwareAdapterById(adapterId, kind)?.label || 'Generic Adapter';

export const inferHardwareBrand = (rawBrand: unknown, kind: HardwareDeviceKind): HardwareBrand => {
  const normalized = normalizeToken(rawBrand);
  const brand = BRAND_ALIASES[normalized];
  if (brand && HARDWARE_BRAND_OPTIONS[kind].includes(brand)) {
    return brand;
  }
  return 'generic';
};

export const inferHardwareConnection = (
  rawConnection: unknown,
  kind: HardwareDeviceKind
): HardwareConnection => {
  const normalized = normalizeToken(rawConnection);
  const connection = CONNECTION_ALIASES[normalized];
  if (connection && HARDWARE_CONNECTION_OPTIONS[kind].includes(connection)) {
    return connection;
  }
  return HARDWARE_CONNECTION_OPTIONS[kind][0];
};

interface InferAdapterOptions {
  kind: HardwareDeviceKind;
  brand: unknown;
  type?: unknown;
  connection?: unknown;
  requestedAdapterId?: string;
}

export const inferHardwareAdapterId = ({
  kind,
  brand,
  type,
  connection,
  requestedAdapterId,
}: InferAdapterOptions): string => {
  const normalizedBrand = inferHardwareBrand(brand, kind);
  const normalizedConnection = inferHardwareConnection(connection, kind);
  const normalizedType = normalizeToken(type);

  if (requestedAdapterId && getHardwareAdapterById(requestedAdapterId, kind)) {
    return requestedAdapterId;
  }

  if (kind === 'printer') {
    const isLabelType = normalizedType.includes('label');
    if (normalizedBrand === 'zebra' || isLabelType) {
      return 'printer-zebra-label';
    }

    if (normalizedBrand === 'epson') return 'printer-epson-escpos';
    if (normalizedBrand === 'star') return 'printer-star-micronics';
    if (normalizedBrand === 'bixolon') return 'printer-bixolon';
    if (normalizedBrand === 'sunmi') return 'printer-sunmi-integrated';
    return 'printer-generic-escpos';
  }

  if (kind === 'scanner') {
    if (normalizedBrand === 'honeywell') return 'scanner-honeywell';
    if (normalizedBrand === 'datalogic') return 'scanner-datalogic';
    if (normalizedBrand === 'socketmobile') return 'scanner-socketmobile';
    if (normalizedBrand === 'sunmi') return 'scanner-sunmi-integrated';
    return 'scanner-generic';
  }

  if (normalizedConnection === 'rj11') return 'drawer-rj11';
  if (normalizedConnection === 'lan' || normalizedConnection === 'wifi') return 'drawer-network';
  if (normalizedConnection === 'serial' || normalizedConnection === 'usb') return 'drawer-serial';
  return 'drawer-rj11';
};

export const resolveAdapterCapabilities = (
  kind: HardwareDeviceKind,
  adapterId?: string,
  overrides?: HardwareCapabilityOverrides
): HardwareCapabilities => {
  const adapter =
    (adapterId ? getHardwareAdapterById(adapterId, kind) : undefined) ||
    getHardwareAdapterById(inferHardwareAdapterId({ kind, brand: 'generic' }), kind);

  const resolved: HardwareCapabilities = {
    ...(adapter?.capabilities || EMPTY_CAPABILITIES),
  };

  if (!overrides) {
    return resolved;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value === 'boolean' && key in resolved) {
      (resolved as Record<string, boolean>)[key] = value;
    }
  }

  return resolved;
};

export const supportsHardwareAction = (
  capabilities: HardwareCapabilities,
  action: HardwareAction
): boolean => {
  switch (action) {
    case 'print-receipt':
      return capabilities.receiptPrint;
    case 'print-label':
      return capabilities.labelPrint;
    case 'open-drawer':
      return capabilities.openDrawer;
    case 'cut-paper':
      return capabilities.cutPaper;
    case 'scan-barcode':
      return capabilities.barcodeScan;
    case 'scanner-beep':
      return capabilities.scannerBeep;
    default:
      return false;
  }
};
