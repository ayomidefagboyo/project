export type LabelCodeSource = 'auto' | 'barcode' | 'sku';

export interface LabelTemplate {
  columns: number;
  gapMm: number;
  pageMarginMm: number;
  paddingMm: number;
  minHeightMm: number;
  borderRadiusPx: number;
  showBorder: boolean;
  borderColor: string;
  fontScalePercent: number;
  showCode: boolean;
  codeSource: LabelCodeSource;
  showFooter: boolean;
  footerText: string;
  defaultShowPrice: boolean;
}

const LEGACY_LABEL_TEMPLATE_CACHE_KEY = 'pos-label-template';

export const getLabelTemplateCacheKey = (outletId: string): string =>
  `pos-label-template:${outletId}`;

export const defaultLabelTemplate: LabelTemplate = {
  columns: 1,
  gapMm: 2,
  pageMarginMm: 4,
  paddingMm: 2,
  minHeightMm: 24,
  borderRadiusPx: 6,
  showBorder: true,
  borderColor: '#d1d5db',
  fontScalePercent: 100,
  showCode: true,
  codeSource: 'auto',
  showFooter: true,
  footerText: 'Compazz POS',
  defaultShowPrice: true,
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const clampNumber = (
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  digits = 2
): number => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  const bounded = Math.min(max, Math.max(min, parsed));
  return Number(bounded.toFixed(digits));
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const normalizeCodeSource = (
  value: unknown,
  fallback: LabelCodeSource
): LabelCodeSource => {
  const normalized = String(value || '').toLowerCase();
  if (normalized === 'barcode' || normalized === 'sku') return normalized;
  if (normalized === 'auto') return 'auto';
  return fallback;
};

const normalizeColor = (value: unknown, fallback: string): string => {
  const normalized = String(value || '').trim();
  return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback;
};

const sanitizeLabelTemplate = (template: Partial<LabelTemplate>): LabelTemplate => {
  const base = { ...defaultLabelTemplate, ...template };
  return {
    columns: Math.round(clampNumber(base.columns, defaultLabelTemplate.columns, 1, 4, 0)),
    gapMm: clampNumber(base.gapMm, defaultLabelTemplate.gapMm, 0, 10),
    pageMarginMm: clampNumber(
      base.pageMarginMm,
      defaultLabelTemplate.pageMarginMm,
      0,
      15
    ),
    paddingMm: clampNumber(base.paddingMm, defaultLabelTemplate.paddingMm, 0.5, 10),
    minHeightMm: clampNumber(base.minHeightMm, defaultLabelTemplate.minHeightMm, 10, 80),
    borderRadiusPx: Math.round(
      clampNumber(base.borderRadiusPx, defaultLabelTemplate.borderRadiusPx, 0, 24, 0)
    ),
    showBorder: toBoolean(base.showBorder, defaultLabelTemplate.showBorder),
    borderColor: normalizeColor(base.borderColor, defaultLabelTemplate.borderColor),
    fontScalePercent: Math.round(
      clampNumber(base.fontScalePercent, defaultLabelTemplate.fontScalePercent, 70, 200, 0)
    ),
    showCode: toBoolean(base.showCode, defaultLabelTemplate.showCode),
    codeSource: normalizeCodeSource(base.codeSource, defaultLabelTemplate.codeSource),
    showFooter: toBoolean(base.showFooter, defaultLabelTemplate.showFooter),
    footerText: String(base.footerText ?? defaultLabelTemplate.footerText).slice(0, 120),
    defaultShowPrice: toBoolean(
      base.defaultShowPrice,
      defaultLabelTemplate.defaultShowPrice
    ),
  };
};

export const mergeLabelTemplate = (
  base: LabelTemplate,
  overrides?: Partial<LabelTemplate> | null
): LabelTemplate => {
  if (!overrides) return sanitizeLabelTemplate(base);
  return sanitizeLabelTemplate({
    ...base,
    ...overrides,
  });
};

const parseTemplateLike = (value: unknown): Partial<LabelTemplate> | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Partial<LabelTemplate>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Partial<LabelTemplate>;
  }

  return null;
};

export const extractLabelTemplateFromTerminalSettings = (
  terminalSettings: unknown
): LabelTemplate | null => {
  const record = toRecord(terminalSettings);
  const rawTemplate =
    parseTemplateLike(record.label_template) ?? parseTemplateLike(record.labelTemplate);
  if (!rawTemplate) return null;
  return mergeLabelTemplate(defaultLabelTemplate, rawTemplate);
};

export const mergeLabelTemplateIntoTerminalSettings = (
  terminalSettings: unknown,
  template: LabelTemplate
): Record<string, unknown> => {
  const base = toRecord(terminalSettings);
  const normalizedTemplate = mergeLabelTemplate(defaultLabelTemplate, template);
  return {
    ...base,
    label_template: normalizedTemplate,
    labelTemplate: normalizedTemplate,
  };
};

const parseCachedTemplate = (raw: string): LabelTemplate | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<LabelTemplate>;
    return mergeLabelTemplate(defaultLabelTemplate, parsed);
  } catch {
    return null;
  }
};

export const readCachedLabelTemplate = (outletId: string): LabelTemplate | null => {
  const scopedKey = getLabelTemplateCacheKey(outletId);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) {
    const parsed = parseCachedTemplate(scopedRaw);
    if (parsed) return parsed;
    localStorage.removeItem(scopedKey);
  }

  const legacyRaw = localStorage.getItem(LEGACY_LABEL_TEMPLATE_CACHE_KEY);
  if (!legacyRaw) return null;

  const parsedLegacy = parseCachedTemplate(legacyRaw);
  if (!parsedLegacy) {
    localStorage.removeItem(LEGACY_LABEL_TEMPLATE_CACHE_KEY);
    return null;
  }

  localStorage.setItem(scopedKey, JSON.stringify(parsedLegacy));
  localStorage.removeItem(LEGACY_LABEL_TEMPLATE_CACHE_KEY);
  return parsedLegacy;
};

export const writeCachedLabelTemplate = (
  outletId: string,
  template: LabelTemplate
): void => {
  localStorage.setItem(
    getLabelTemplateCacheKey(outletId),
    JSON.stringify(mergeLabelTemplate(defaultLabelTemplate, template))
  );
  localStorage.removeItem(LEGACY_LABEL_TEMPLATE_CACHE_KEY);
};

interface ResolveLabelTemplateParams {
  outletId?: string | null;
  terminalSettings?: unknown;
}

export const resolveLabelTemplate = ({
  outletId,
  terminalSettings,
}: ResolveLabelTemplateParams): LabelTemplate => {
  const fromTerminalSettings = extractLabelTemplateFromTerminalSettings(terminalSettings);
  if (fromTerminalSettings) return fromTerminalSettings;

  if (outletId) {
    const fromCache = readCachedLabelTemplate(outletId);
    if (fromCache) return fromCache;
  }

  return defaultLabelTemplate;
};
