const BRAND_COLOR_STORAGE_KEY = 'pos_brand_color';

export const DEFAULT_BRAND_COLOR = '#0f172a';

const HEX_COLOR_REGEX = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

const expandShortHex = (value: string): string => {
  if (value.length !== 4) return value;
  return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
};

const isValidHexColor = (value: string): boolean => HEX_COLOR_REGEX.test(value);

const toRgbTuple = (hexColor: string): [number, number, number] => {
  const normalized = expandShortHex(hexColor);
  const hex = normalized.slice(1);
  return [
    parseInt(hex.slice(0, 2), 16),
    parseInt(hex.slice(2, 4), 16),
    parseInt(hex.slice(4, 6), 16),
  ];
};

export const normalizeBrandColor = (value: string | null | undefined): string => {
  if (!value) return DEFAULT_BRAND_COLOR;
  const candidate = value.trim();
  if (!isValidHexColor(candidate)) return DEFAULT_BRAND_COLOR;
  return expandShortHex(candidate).toLowerCase();
};

export const readBrandColorFromStorage = (): string | null => {
  try {
    const raw = localStorage.getItem(BRAND_COLOR_STORAGE_KEY);
    return raw ? normalizeBrandColor(raw) : null;
  } catch {
    return null;
  }
};

export const applyBrandColorToDocument = (value: string | null | undefined): string => {
  const color = normalizeBrandColor(value || readBrandColorFromStorage() || DEFAULT_BRAND_COLOR);
  const [r, g, b] = toRgbTuple(color);

  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--brand-color', color);
    document.documentElement.style.setProperty('--brand-color-rgb', `${r}, ${g}, ${b}`);
  }

  try {
    localStorage.setItem(BRAND_COLOR_STORAGE_KEY, color);
  } catch {
    // Ignore storage errors
  }

  return color;
};

type BrandSettingsSource = {
  brand_color?: unknown;
  pos_terminal_settings?: unknown;
} | null | undefined;

export const resolveBrandColorFromSettings = (source: BrandSettingsSource): string => {
  const fromColumn = typeof source?.brand_color === 'string' ? source.brand_color : null;
  const terminalSettings =
    source?.pos_terminal_settings && typeof source.pos_terminal_settings === 'object'
      ? (source.pos_terminal_settings as Record<string, unknown>)
      : null;
  const fromTerminal =
    terminalSettings && typeof terminalSettings.brandColor === 'string'
      ? terminalSettings.brandColor
      : terminalSettings && typeof terminalSettings.brand_color === 'string'
        ? terminalSettings.brand_color
        : null;

  return normalizeBrandColor(fromColumn || fromTerminal || readBrandColorFromStorage() || DEFAULT_BRAND_COLOR);
};

export const mergeBrandColorIntoTerminalSettings = (
  currentSettings: unknown,
  color: string
): Record<string, unknown> => {
  const base =
    currentSettings && typeof currentSettings === 'object' && !Array.isArray(currentSettings)
      ? (currentSettings as Record<string, unknown>)
      : {};

  return {
    ...base,
    brandColor: normalizeBrandColor(color),
  };
};
