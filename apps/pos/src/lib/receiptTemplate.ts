export interface ReceiptTemplate {
  id: string;
  name: string;
  header: {
    showLogo: boolean;
    logoUrl?: string;
    businessName: string;
    address: string;
    phone: string;
    email?: string;
    website?: string;
    showQR: boolean;
  };
  body: {
    showItemCodes: boolean;
    showTaxBreakdown: boolean;
    showDiscounts: boolean;
    showRunningTotal: boolean;
    itemAlignment: 'left' | 'center' | 'right';
    priceAlignment: 'left' | 'center' | 'right';
  };
  footer: {
    thankYouMessage: string;
    returnPolicy?: string;
    additionalInfo?: string;
    showCashierName: boolean;
    showTransactionNumber: boolean;
    showDateTime: boolean;
  };
  styling: {
    fontSize: 'small' | 'medium' | 'large';
    fontFamily: 'monospace' | 'serif' | 'sans-serif';
    lineSpacing: 'compact' | 'normal' | 'loose';
    paperWidth: '58mm' | '80mm' | 'A4';
  };
}

export interface ReceiptSettingsSnapshot {
  header_text?: string;
  footer_text?: string;
  logo_url?: string;
  show_qr_code?: boolean;
  show_customer_points?: boolean;
  show_tax_breakdown?: boolean;
  receipt_width?: number;
  font_size?: string;
}

export interface OutletInfoSnapshot {
  name?: string;
  phone?: string;
  email?: string;
  website?: string;
  address?:
    | string
    | {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      };
}

const LEGACY_RECEIPT_TEMPLATE_CACHE_KEY = 'pos-receipt-template';

export const getReceiptTemplateCacheKey = (outletId: string): string =>
  `pos-receipt-template:${outletId}`;

export const defaultReceiptTemplate: ReceiptTemplate = {
  id: 'default',
  name: 'Default Receipt',
  header: {
    showLogo: true,
    businessName: 'Compazz POS',
    address: '',
    phone: '',
    email: '',
    website: '',
    showQR: true,
  },
  body: {
    showItemCodes: true,
    showTaxBreakdown: true,
    showDiscounts: true,
    showRunningTotal: false,
    itemAlignment: 'left',
    priceAlignment: 'right',
  },
  footer: {
    thankYouMessage: 'Thank you for shopping with us!',
    returnPolicy: 'Returns accepted within 7 days with receipt',
    additionalInfo: '',
    showCashierName: true,
    showTransactionNumber: true,
    showDateTime: true,
  },
  styling: {
    fontSize: 'medium',
    fontFamily: 'monospace',
    lineSpacing: 'normal',
    paperWidth: '80mm',
  },
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const parseTemplateLike = (value: unknown): Partial<ReceiptTemplate> | null => {
  if (!value) return null;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value) as Partial<ReceiptTemplate>;
      return parsed && typeof parsed === 'object' ? parsed : null;
    } catch {
      return null;
    }
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    return value as Partial<ReceiptTemplate>;
  }

  return null;
};

export const mergeReceiptTemplate = (
  base: ReceiptTemplate,
  overrides?: Partial<ReceiptTemplate> | null
): ReceiptTemplate => {
  if (!overrides) return base;

  return {
    ...base,
    ...overrides,
    header: {
      ...base.header,
      ...(overrides.header || {}),
    },
    body: {
      ...base.body,
      ...(overrides.body || {}),
    },
    footer: {
      ...base.footer,
      ...(overrides.footer || {}),
    },
    styling: {
      ...base.styling,
      ...(overrides.styling || {}),
    },
  };
};

export const extractReceiptTemplateFromTerminalSettings = (
  terminalSettings: unknown
): ReceiptTemplate | null => {
  const record = toRecord(terminalSettings);
  const rawTemplate =
    parseTemplateLike(record.receipt_template) ??
    parseTemplateLike(record.receiptTemplate);
  if (!rawTemplate) return null;
  return mergeReceiptTemplate(defaultReceiptTemplate, rawTemplate);
};

export const mergeReceiptTemplateIntoTerminalSettings = (
  terminalSettings: unknown,
  template: ReceiptTemplate
): Record<string, unknown> => {
  const base = toRecord(terminalSettings);
  return {
    ...base,
    receipt_template: template,
    receiptTemplate: template,
  };
};

const parseCachedTemplate = (raw: string): ReceiptTemplate | null => {
  try {
    const parsed = JSON.parse(raw) as Partial<ReceiptTemplate>;
    return mergeReceiptTemplate(defaultReceiptTemplate, parsed);
  } catch {
    return null;
  }
};

export const readCachedReceiptTemplate = (outletId: string): ReceiptTemplate | null => {
  const scopedKey = getReceiptTemplateCacheKey(outletId);
  const scopedRaw = localStorage.getItem(scopedKey);
  if (scopedRaw) {
    const parsed = parseCachedTemplate(scopedRaw);
    if (parsed) return parsed;
    localStorage.removeItem(scopedKey);
  }

  const legacyRaw = localStorage.getItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
  if (!legacyRaw) return null;

  const parsedLegacy = parseCachedTemplate(legacyRaw);
  if (!parsedLegacy) {
    localStorage.removeItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
    return null;
  }

  localStorage.setItem(scopedKey, JSON.stringify(parsedLegacy));
  localStorage.removeItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
  return parsedLegacy;
};

export const writeCachedReceiptTemplate = (
  outletId: string,
  template: ReceiptTemplate
): void => {
  localStorage.setItem(
    getReceiptTemplateCacheKey(outletId),
    JSON.stringify(mergeReceiptTemplate(defaultReceiptTemplate, template))
  );
  localStorage.removeItem(LEGACY_RECEIPT_TEMPLATE_CACHE_KEY);
};

export const mapBackendFontSizeToUi = (
  fontSize?: string
): ReceiptTemplate['styling']['fontSize'] => {
  if (fontSize === 'small') return 'small';
  if (fontSize === 'large') return 'large';
  return 'medium';
};

export const mapUiFontSizeToBackend = (
  fontSize: ReceiptTemplate['styling']['fontSize']
): string => {
  if (fontSize === 'medium') return 'normal';
  return fontSize;
};

export const mapBackendWidthToUi = (
  width?: number
): ReceiptTemplate['styling']['paperWidth'] => {
  if (width === 58) return '58mm';
  if (width === 80) return '80mm';
  return 'A4';
};

const resolveAddressText = (
  outletInfo: OutletInfoSnapshot | null | undefined,
  fallback: string
): string => {
  if (!outletInfo || outletInfo.address === undefined || outletInfo.address === null) return fallback;

  if (typeof outletInfo.address === 'string') {
    return outletInfo.address;
  }

  if (typeof outletInfo.address === 'object') {
    const addr = outletInfo.address as Record<string, string | undefined>;
    const parts = [
      addr.street,
      addr.city && addr.state
        ? `${addr.city}, ${addr.state} ${addr.zip || ''}`.trim()
        : addr.city || addr.state,
      addr.country,
    ].filter(Boolean);

    if (parts.length > 0) {
      return parts.join('\n');
    }
  }

  return fallback;
};

interface BuildReceiptTemplateFromSourcesParams {
  persistedTemplate?: ReceiptTemplate | null;
  cachedTemplate?: ReceiptTemplate | null;
  outletInfo?: OutletInfoSnapshot | null;
  receiptSettings?: ReceiptSettingsSnapshot | null;
  fallbackTemplate?: ReceiptTemplate;
}

export const buildReceiptTemplateFromSources = ({
  persistedTemplate,
  cachedTemplate,
  outletInfo,
  receiptSettings,
  fallbackTemplate,
}: BuildReceiptTemplateFromSourcesParams): ReceiptTemplate => {
  const source = persistedTemplate
    ? mergeReceiptTemplate(defaultReceiptTemplate, persistedTemplate)
    : cachedTemplate
    ? mergeReceiptTemplate(defaultReceiptTemplate, cachedTemplate)
    : mergeReceiptTemplate(defaultReceiptTemplate, fallbackTemplate || defaultReceiptTemplate);

  const withOutletInfo: ReceiptTemplate = {
    ...source,
    header: {
      ...source.header,
      businessName: source.header.businessName || outletInfo?.name || defaultReceiptTemplate.header.businessName,
      address: resolveAddressText(outletInfo, source.header.address),
      phone: outletInfo?.phone !== undefined ? outletInfo.phone ?? '' : source.header.phone,
      email: outletInfo?.email !== undefined ? outletInfo.email ?? '' : source.header.email,
      website: outletInfo?.website !== undefined ? outletInfo.website ?? '' : source.header.website,
    },
  };

  if (persistedTemplate) {
    return withOutletInfo;
  }

  return {
    ...withOutletInfo,
    header: {
      ...withOutletInfo.header,
      businessName: receiptSettings?.header_text ?? withOutletInfo.header.businessName,
      logoUrl: receiptSettings?.logo_url ?? withOutletInfo.header.logoUrl,
      showQR: receiptSettings?.show_qr_code ?? withOutletInfo.header.showQR,
    },
    body: {
      ...withOutletInfo.body,
      showTaxBreakdown: receiptSettings?.show_tax_breakdown ?? withOutletInfo.body.showTaxBreakdown,
    },
    footer: {
      ...withOutletInfo.footer,
      thankYouMessage: receiptSettings?.footer_text ?? withOutletInfo.footer.thankYouMessage,
      showCashierName: receiptSettings?.show_customer_points ?? withOutletInfo.footer.showCashierName,
    },
    styling: {
      ...withOutletInfo.styling,
      fontSize: mapBackendFontSizeToUi(receiptSettings?.font_size),
      paperWidth: mapBackendWidthToUi(receiptSettings?.receipt_width),
    },
  };
};
