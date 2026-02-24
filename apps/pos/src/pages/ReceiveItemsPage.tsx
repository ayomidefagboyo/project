/**
 * Receive Items Page
 * High-throughput receiving flow:
 * - Fast scan/search add
 * - Inline line-item editing
 * - Inline product linking
 * - Quick supplier/vendor creation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  Package,
  ScanLine,
  Search,
  Sparkles,
  Trash2,
  Truck,
  UserPlus,
  X,
} from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useOutlet } from '../contexts/OutletContext';
import {
  invoiceService,
  type Invoice,
  type InvoiceItem,
  type ReceiveGoodsResponse,
} from '../lib/invoiceService';
import { vendorService, type CreateVendorData } from '../lib/vendorService';
import { posService, type POSProduct, type POSDepartment } from '../lib/posService';
import { useTerminalId } from '../hooks/useTerminalId';
import { printProductLabels, type ProductLabelData } from '../lib/labelPrinter';
import { resolveLabelTemplate } from '../lib/labelTemplate';
import { loadHardwareState, resolveLabelPrinter } from '../lib/hardwareProfiles';
import { resolveAdapterCapabilities, supportsHardwareAction } from '../lib/hardwareAdapters';
import { clearMissingProductIntent, peekMissingProductIntent } from '../lib/missingProductIntent';

interface VendorOption {
  id: string;
  name: string;
  email?: string;
  phone?: string;
}

type Step = 'entry' | 'receiving' | 'done';
type ReceivePaymentStatus = 'paid' | 'unpaid';

interface ReceiveLine extends InvoiceItem {
  lineId: string;
  line_total?: number;
  selling_price?: number;
  auto_pricing_enabled?: boolean;
  markup_percentage?: number;
}

interface HeldReceiveDraft {
  id: string;
  outlet_id: string;
  vendor_id: string;
  invoice_number: string;
  invoice_date: string;
  payment_status: ReceivePaymentStatus;
  payment_date: string;
  notes: string;
  items: ReceiveLine[];
  created_at: string;
  updated_at: string;
}

const createLineId = (): string =>
  `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const createHeldDraftId = (): string =>
  `receive-hold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const todayIsoDate = (): string => new Date().toISOString().split('T')[0];

const makeLine = (seed: Partial<ReceiveLine> = {}): ReceiveLine => ({
  lineId: createLineId(),
  description: '',
  quantity: 1,
  unit_price: 0,
  line_total: 0,
  selling_price: 0,
  auto_pricing_enabled: true,
  markup_percentage: 30,
  product_id: null,
  category: '',
  ...seed,
});

const normalizeVendor = (raw: any): VendorOption => ({
  id: String(raw?.id || ''),
  name: String(raw?.name || raw?.business_name || raw?.contact_person || 'Vendor'),
  email: raw?.email || undefined,
  phone: raw?.phone || undefined,
});

const extractVendorRows = (payload: any): any[] => {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
};

const parseNumber = (value: string, fallback = 0): number => {
  const next = Number(value);
  if (Number.isNaN(next)) return fallback;
  return next;
};

const roundMoney = (value: number): number => Number(Math.max(0, value).toFixed(2));

const computeSellingFromMargin = (costPrice: number, markupPercentage: number): number => {
  const safeCost = Math.max(0, Number(costPrice || 0));
  if (safeCost <= 0) return 0;
  const safeMarkup = Math.max(0, Number(markupPercentage || 0));
  return roundMoney(safeCost * (1 + safeMarkup / 100));
};

const normalizeDepartmentName = (value?: string | null): string =>
  String(value || '').trim();

const parseQuickToken = (value: string): { identifier: string; quantity: number | null } => {
  const raw = value.trim();
  if (!raw) return { identifier: '', quantity: null };

  const match = raw.match(/^(.*?)(?:\s*[x*]\s*(\d+))$/i);
  if (!match) return { identifier: raw, quantity: null };

  const identifier = match[1]?.trim() || '';
  const parsedQty = Number(match[2]);
  if (!identifier || Number.isNaN(parsedQty) || parsedQty <= 0) {
    return { identifier: raw, quantity: null };
  }

  return { identifier, quantity: parsedQty };
};

const normalizeLookupStrict = (value?: string | null): string =>
  String(value || '').trim().toLowerCase();

const normalizeLookupLoose = (value?: string | null): string =>
  normalizeLookupStrict(value).replace(/[^a-z0-9]/g, '');

const productMatchesLookup = (product: POSProduct, query: string): boolean => {
  const strictQuery = normalizeLookupStrict(query);
  if (!strictQuery) return false;

  if (
    normalizeLookupStrict(product.barcode) === strictQuery ||
    normalizeLookupStrict(product.sku) === strictQuery ||
    normalizeLookupStrict(product.name) === strictQuery
  ) {
    return true;
  }

  const looseQuery = normalizeLookupLoose(query);
  if (!looseQuery) return false;

  return (
    normalizeLookupLoose(product.barcode) === looseQuery ||
    normalizeLookupLoose(product.sku) === looseQuery
  );
};

const parseReceivedMeta = (
  notes?: string | null
): { date: string; receivedBy: string } | null => {
  const text = String(notes || '');
  const match = text.match(/\[Received on (\d{4}-\d{2}-\d{2}) by ([^\]]+)\]/i);
  if (!match) return null;
  return {
    date: match[1],
    receivedBy: match[2].trim() || 'Staff',
  };
};

const formatDisplayDate = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString();
};

const getInvoiceStatusDisplay = (
  invoice: Pick<Invoice, 'status' | 'vendor_id' | 'notes'>
): { key: string; label: string; badgeClass: string } => {
  const rawStatus = String(invoice.status || '').trim().toLowerCase();
  const receivedMeta = parseReceivedMeta(invoice.notes);
  const isVendorInvoice = Boolean(invoice.vendor_id);

  if (rawStatus === 'paid') {
    return {
      key: 'paid',
      label: 'paid',
      badgeClass: 'bg-blue-100 text-blue-700 border border-blue-200',
    };
  }

  if (rawStatus === 'received') {
    return isVendorInvoice
      ? {
          key: 'unpaid',
          label: 'unpaid',
          badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
        }
      : {
          key: 'received',
          label: 'received',
          badgeClass: 'bg-emerald-100 text-emerald-700 border border-emerald-200',
        };
  }

  if (isVendorInvoice && rawStatus === 'pending' && receivedMeta !== null) {
    return {
      key: 'unpaid',
      label: 'unpaid',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  if (rawStatus === 'draft') {
    return {
      key: 'draft',
      label: 'draft',
      badgeClass: 'bg-stone-100 text-stone-700 border border-stone-200',
    };
  }

  if (rawStatus === 'pending') {
    return {
      key: 'pending',
      label: 'pending',
      badgeClass: 'bg-amber-100 text-amber-700 border border-amber-200',
    };
  }

  if (rawStatus === 'overdue') {
    return {
      key: 'overdue',
      label: 'overdue',
      badgeClass: 'bg-red-100 text-red-700 border border-red-200',
    };
  }

  if (rawStatus === 'cancelled') {
    return {
      key: 'cancelled',
      label: 'cancelled',
      badgeClass: 'bg-stone-200 text-stone-700 border border-stone-300',
    };
  }

  return {
    key: rawStatus || 'unknown',
    label: rawStatus || 'unknown',
    badgeClass: 'bg-stone-100 text-stone-700 border border-stone-200',
  };
};

const ReceiveItemsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOutlet, businessSettings } = useOutlet();
  const { terminalId } = useTerminalId();

  const [step, setStep] = useState<Step>('entry');

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(todayIsoDate());
  const [paymentStatus, setPaymentStatus] = useState<ReceivePaymentStatus>('paid');
  const [paymentDate, setPaymentDate] = useState(todayIsoDate());
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<ReceiveLine[]>([]);

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [departments, setDepartments] = useState<POSDepartment[]>([]);
  const [lineSearchTargetId, setLineSearchTargetId] = useState<string | null>(null);
  const [lineProductSearch, setLineProductSearch] = useState('');
  const [lineSearchMatches, setLineSearchMatches] = useState<POSProduct[]>([]);
  const [lineSearchLoading, setLineSearchLoading] = useState(false);
  const [pendingLineFocusId, setPendingLineFocusId] = useState<string | null>(null);

  const [quickEntry, setQuickEntry] = useState('');
  const [quickMatches, setQuickMatches] = useState<POSProduct[]>([]);
  const [quickMatchLoading, setQuickMatchLoading] = useState(false);
  const quickEntryInputRef = useRef<HTMLInputElement | null>(null);

  const [showVendorModal, setShowVendorModal] = useState(false);
  const [isSavingVendor, setIsSavingVendor] = useState(false);
  const [vendorForm, setVendorForm] = useState({
    business_name: '',
    contact_person: '',
    email: '',
    phone: '',
    payment_terms: '',
    notes: '',
  });

  const [isCreating, setIsCreating] = useState(false);
  const [receiveResult, setReceiveResult] = useState<ReceiveGoodsResponse | null>(null);
  const [lastPrintedLabels, setLastPrintedLabels] = useState<ProductLabelData[]>([]);
  const [labelCopies, setLabelCopies] = useState('1');
  const [includePriceOnLabels, setIncludePriceOnLabels] = useState(true);
  const [error, setError] = useState('');

  const [invoiceHistory, setInvoiceHistory] = useState<Invoice[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [selectedHistoryInvoice, setSelectedHistoryInvoice] = useState<Invoice | null>(null);
  const [historyLoadingInvoiceId, setHistoryLoadingInvoiceId] = useState<string | null>(null);
  const [heldDrafts, setHeldDrafts] = useState<HeldReceiveDraft[]>([]);
  const [activeHeldDraftId, setActiveHeldDraftId] = useState<string | null>(null);

  const heldDraftStorageKey = useMemo(
    () => (currentOutlet?.id ? `pos_receive_hold_invoices_${currentOutlet.id}` : null),
    [currentOutlet?.id]
  );

  const vendorNameById = useMemo(() => {
    const map = new Map<string, string>();
    vendors.forEach((vendor) => {
      if (!vendor.id) return;
      map.set(vendor.id, vendor.name || 'Vendor');
    });
    return map;
  }, [vendors]);

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);

  const getInvoiceVendorName = useCallback(
    (invoice: Invoice): string => {
      const vendorRecord =
        invoice.vendors && typeof invoice.vendors === 'object'
          ? (invoice.vendors as Record<string, unknown>)
          : null;
      const directName = String(
        vendorRecord?.name ||
          vendorRecord?.business_name ||
          vendorRecord?.contact_person ||
          ''
      ).trim();
      if (directName) return directName;
      if (invoice.vendor_id && vendorNameById.has(invoice.vendor_id)) {
        return vendorNameById.get(invoice.vendor_id) as string;
      }
      return 'Walk-in / No Vendor';
    },
    [vendorNameById]
  );

  const persistHeldDrafts = useCallback(
    (nextDrafts: HeldReceiveDraft[]) => {
      setHeldDrafts(nextDrafts);
      if (heldDraftStorageKey) {
        localStorage.setItem(heldDraftStorageKey, JSON.stringify(nextDrafts));
      }
    },
    [heldDraftStorageKey]
  );

  const quickToken = useMemo(() => parseQuickToken(quickEntry), [quickEntry]);
  const showQuickSuggestions = quickToken.identifier.trim().length > 0 && (
    quickMatchLoading || quickMatches.length > 0 || quickToken.identifier.trim().length >= 3
  );

  useEffect(() => {
    if (!pendingLineFocusId) return;
    const selector = `[data-line-description-id="${pendingLineFocusId}"]`;
    let attempts = 0;

    const focusLine = () => {
      const target = document.querySelector<HTMLInputElement>(selector);
      if (target) {
        target.focus();
        setPendingLineFocusId(null);
        return true;
      }

      attempts += 1;
      if (attempts >= 4) {
        setPendingLineFocusId(null);
        return false;
      }

      window.requestAnimationFrame(focusLine);
      return false;
    };

    window.requestAnimationFrame(focusLine);
  }, [pendingLineFocusId, items.length]);

  const exactProductIndex = useMemo(() => {
    const barcodeMap = new Map<string, POSProduct>();
    const skuMap = new Map<string, POSProduct>();
    const nameMap = new Map<string, POSProduct>();
    products.forEach((product) => {
      const barcode = (product.barcode || '').trim().toLowerCase();
      const sku = (product.sku || '').trim().toLowerCase();
      const name = (product.name || '').trim().toLowerCase();
      if (barcode && !barcodeMap.has(barcode)) barcodeMap.set(barcode, product);
      if (sku && !skuMap.has(sku)) skuMap.set(sku, product);
      if (name && !nameMap.has(name)) nameMap.set(name, product);
    });
    return { barcodeMap, skuMap, nameMap };
  }, [products]);

  const findProductExact = useCallback(
    (query: string): POSProduct | undefined => {
      const needle = query.trim().toLowerCase();
      if (!needle) return undefined;
      return (
        exactProductIndex.barcodeMap.get(needle) ||
        exactProductIndex.skuMap.get(needle) ||
        exactProductIndex.nameMap.get(needle)
      );
    },
    [exactProductIndex]
  );

  const searchProductsFast = useCallback(
    async (query: string, limit: number): Promise<POSProduct[]> => {
      const trimmed = query.trim();
      if (!trimmed || !currentOutlet?.id) return [];

      const exact = findProductExact(trimmed);
      if (exact) {
        return [exact];
      }

      const local = await posService.searchLocalProducts(currentOutlet.id, trimmed);
      let rows = local;

      if (rows.length === 0 && navigator.onLine) {
        try {
          const online = await posService.getProducts(currentOutlet.id, {
            page: 1,
            size: Math.max(10, limit),
            search: trimmed,
            activeOnly: false,
          });
          rows = online.items || [];
        } catch {
          rows = [];
        }
      }

      return rows.slice(0, limit);
    },
    [currentOutlet?.id, findProductExact]
  );

  const departmentOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const addValue = (value?: string | null) => {
      const normalized = normalizeDepartmentName(value);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, normalized);
      }
    };

    departments
      .filter((department) => department.is_active !== false)
      .forEach((department) => addValue(department.name));
    products.forEach((product) => addValue(product.category));

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [departments, products]);

  const departmentPolicyByName = useMemo(() => {
    const map = new Map<string, POSDepartment>();
    departments.forEach((department) => {
      const key = normalizeDepartmentName(department.name).toLowerCase();
      if (!key) return;
      map.set(key, department);
    });
    return map;
  }, [departments]);

  const resolveDepartmentPricing = useCallback(
    (category?: string | null): { markup: number; autoPricingEnabled: boolean } => {
      const key = normalizeDepartmentName(category).toLowerCase();
      const policy = key ? departmentPolicyByName.get(key) : undefined;
      return {
        markup: Math.max(0, Number(policy?.default_markup_percentage ?? 30)),
        autoPricingEnabled: policy?.auto_pricing_enabled !== false,
      };
    },
    [departmentPolicyByName]
  );

  const getLineTotal = useCallback((line: ReceiveLine): number => {
    if (line.line_total !== undefined && line.line_total !== null && line.line_total > 0) {
      return roundMoney(line.line_total);
    }
    return roundMoney(line.quantity * line.unit_price);
  }, []);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + getLineTotal(item), 0),
    [items, getLineTotal]
  );

  const totalUnits = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const linkedCount = useMemo(
    () => items.filter((item) => !!item.product_id).length,
    [items]
  );

  const labelPrinterRuntime = useMemo(() => {
    const hardwareState = loadHardwareState(currentOutlet?.id, terminalId || undefined);
    const printer = resolveLabelPrinter(hardwareState);

    if (!printer) {
      return {
        printer: null as null,
        canPrint: false,
        reason: 'No label printer configured in Settings.',
      };
    }

    if (printer.status !== 'connected') {
      return {
        printer,
        canPrint: false,
        reason: `${printer.name} is disconnected.`,
      };
    }

    const printerCapabilities = resolveAdapterCapabilities(
      'printer',
      printer.adapterId,
      printer.capabilities
    );

    if (!supportsHardwareAction(printerCapabilities, 'print-label')) {
      return {
        printer,
        canPrint: false,
        reason: `${printer.name} is not configured for label printing.`,
      };
    }

    return {
      printer,
      canPrint: true,
      reason: '',
    };
  }, [currentOutlet?.id, terminalId]);

  const activeLabelTemplate = useMemo(
    () =>
      resolveLabelTemplate({
        outletId: currentOutlet?.id,
        terminalSettings: businessSettings?.pos_terminal_settings,
      }),
    [currentOutlet?.id, businessSettings?.pos_terminal_settings]
  );

  const getInvoiceLabelData = useCallback((invoice: Invoice): ProductLabelData[] => {
    const itemsForLabels = invoice.invoice_items || [];

    return itemsForLabels
      .map((item) => {
        const name = item.description?.trim() || '';
        const quantity = Math.max(1, Math.floor(Number(item.quantity) || 1));
        const price = typeof item.unit_price === 'number' ? item.unit_price : undefined;
        return {
          name,
          sku: item.sku,
          barcode: item.barcode,
          price,
          copies: quantity,
        };
      })
      .filter((label) => label.name.length > 0);
  }, []);

  useEffect(() => {
    if (!heldDraftStorageKey || !currentOutlet?.id) {
      setHeldDrafts([]);
      setActiveHeldDraftId(null);
      return;
    }

    try {
      const raw = localStorage.getItem(heldDraftStorageKey);
      if (!raw) {
        setHeldDrafts([]);
        setActiveHeldDraftId(null);
        return;
      }

      const nowIso = new Date().toISOString();
      const parsed = JSON.parse(raw);
      const normalized = Array.isArray(parsed)
        ? parsed
            .map((entryRaw: unknown): HeldReceiveDraft | null => {
              if (!entryRaw || typeof entryRaw !== 'object') return null;
              const entry = entryRaw as Record<string, unknown>;

              const entryItems = Array.isArray(entry.items)
                ? entry.items.map((lineRaw: unknown) => {
                    const line =
                      lineRaw && typeof lineRaw === 'object'
                        ? (lineRaw as Record<string, unknown>)
                        : {};
                    return (
                    makeLine({
                      ...line,
                      lineId: String(line.lineId || createLineId()),
                      description: String(line.description || ''),
                      quantity: Math.max(0, Number(line.quantity || 0)),
                      unit_price: Math.max(0, Number(line.unit_price || 0)),
                      line_total: Number.isFinite(Number(line.line_total))
                        ? Math.max(0, Number(line.line_total))
                        : undefined,
                      selling_price: Number.isFinite(Number(line.selling_price))
                        ? Math.max(0, Number(line.selling_price))
                        : undefined,
                      markup_percentage: Number.isFinite(Number(line.markup_percentage))
                        ? Math.max(0, Number(line.markup_percentage))
                        : undefined,
                      auto_pricing_enabled:
                        line.auto_pricing_enabled === undefined
                          ? undefined
                          : Boolean(line.auto_pricing_enabled),
                      product_id: line.product_id ?? null,
                      sku: typeof line.sku === 'string' ? line.sku : undefined,
                      barcode: typeof line.barcode === 'string' ? line.barcode : undefined,
                      category: typeof line.category === 'string' ? line.category : '',
                    })
                    );
                  })
                : [];

              return {
                id: String(entry.id || createHeldDraftId()),
                outlet_id: String(entry.outlet_id || currentOutlet.id),
                vendor_id: String(entry.vendor_id || ''),
                invoice_number: String(entry.invoice_number || ''),
                invoice_date: String(entry.invoice_date || todayIsoDate()),
                payment_status:
                  String(entry.payment_status || '').trim().toLowerCase() === 'unpaid'
                    ? 'unpaid'
                    : 'paid',
                payment_date: String(entry.payment_date || entry.invoice_date || todayIsoDate()),
                notes: String(entry.notes || ''),
                items: entryItems,
                created_at: String(entry.created_at || nowIso),
                updated_at: String(entry.updated_at || entry.created_at || nowIso),
              };
            })
            .filter((entry): entry is HeldReceiveDraft => !!entry)
        : [];

      normalized.sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      );

      setHeldDrafts(normalized);
      setActiveHeldDraftId(null);
    } catch {
      setHeldDrafts([]);
      setActiveHeldDraftId(null);
    }
  }, [heldDraftStorageKey, currentOutlet?.id]);

  useEffect(() => {
    if (!currentOutlet?.id) return;

    const load = async () => {
      try {
        const [vendorRes, cachedProducts, departmentRes] = await Promise.all([
          vendorService.getVendors(currentOutlet.id).catch((vendorError) => ({
            data: null,
            error:
              vendorError instanceof Error
                ? vendorError.message
                : 'Failed to fetch vendors',
            status: 0,
          })),
          posService.getCachedProducts(currentOutlet.id, {
            activeOnly: false,
            page: 1,
            size: 20000,
          }),
          posService.getDepartments(currentOutlet.id).catch(() => []),
        ]);

        const vendorRows = extractVendorRows((vendorRes as any).data);
        setVendors(vendorRows.map(normalizeVendor).filter((vendor) => vendor.id));
        if ((vendorRes as any).error) {
          console.warn('Vendor list failed to load:', (vendorRes as any).error);
        }

        const localProducts = cachedProducts.items || [];
        setProducts(localProducts);
        setDepartments((departmentRes as POSDepartment[]) || []);

        if (navigator.onLine) {
          void (async () => {
            try {
              await posService.syncProductCatalog(currentOutlet.id, { forceFull: localProducts.length === 0 });
              const refreshed = await posService.getCachedProducts(currentOutlet.id, {
                activeOnly: false,
                page: 1,
                size: 20000,
              });
              setProducts(refreshed.items || []);
            } catch (syncError) {
              console.warn('Background product sync failed for Receive Items:', syncError);
            }
          })();
        }
      } catch (loadError) {
        console.error('Failed to load receiving data:', loadError);
        setError('Unable to load vendors/products. Please refresh.');
      }
    };

    load();
  }, [currentOutlet?.id]);

  useEffect(() => {
    if (!currentOutlet?.id) return;

    const outletId = currentOutlet.id;
    const handleProductsSynced = async () => {
      try {
        const refreshed = await posService.getCachedProducts(outletId, {
          activeOnly: false,
          page: 1,
          size: 20000,
        });
        setProducts(refreshed.items || []);
      } catch (refreshError) {
        console.warn('Failed to refresh Receive Items products after sync event:', refreshError);
      }
    };

    window.addEventListener('pos-products-synced', handleProductsSynced);
    return () => window.removeEventListener('pos-products-synced', handleProductsSynced);
  }, [currentOutlet?.id]);

  const loadHistory = useCallback(async () => {
    if (!currentOutlet?.id) return;

    try {
      const response = await invoiceService.getInvoices(currentOutlet.id, {
        invoiceType: 'vendor',
        size: 30,
      });
      setInvoiceHistory(response.items || []);
    } catch {
      setInvoiceHistory([]);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const query = quickToken.identifier.trim();
    if (!query) {
      setQuickMatches([]);
      setQuickMatchLoading(false);
      return;
    }

    let active = true;
    setQuickMatchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchProductsFast(query, 8);
        if (active) {
          setQuickMatches(results);
        }
      } finally {
        if (active) setQuickMatchLoading(false);
      }
    }, 80);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [quickToken.identifier, searchProductsFast]);

  useEffect(() => {
    const query = lineProductSearch.trim();
    if (!query || !lineSearchTargetId) {
      setLineSearchMatches([]);
      setLineSearchLoading(false);
      return;
    }

    let active = true;
    setLineSearchLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await searchProductsFast(query, 10);
        if (active) {
          setLineSearchMatches(results);
        }
      } finally {
        if (active) setLineSearchLoading(false);
      }
    }, 80);

    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [lineProductSearch, lineSearchTargetId, searchProductsFast]);

  const upsertLineFromProduct = (product: POSProduct, quantity = 1, unitPrice?: number) => {
    const normalizedQty = Math.max(1, quantity);
    const costPrice = Math.max(0, unitPrice ?? product.cost_price ?? 0);
    const pricing = resolveDepartmentPricing(product.category);
    const sellingPrice = pricing.autoPricingEnabled
      ? computeSellingFromMargin(costPrice, pricing.markup)
      : Math.max(0, product.unit_price || costPrice);
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        const updatedQty = next[existingIndex].quantity + normalizedQty;
        const lineTotal = roundMoney(updatedQty * (next[existingIndex].unit_price || costPrice));
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: updatedQty,
          line_total: lineTotal,
        };
        return next;
      }

      return [
        ...prev,
        makeLine({
          description: product.name,
          quantity: normalizedQty,
          unit_price: costPrice,
          line_total: roundMoney(normalizedQty * costPrice),
          selling_price: sellingPrice,
          auto_pricing_enabled: pricing.autoPricingEnabled,
          markup_percentage: pricing.markup,
          product_id: product.id,
          sku: product.sku || undefined,
          barcode: product.barcode || undefined,
          category: product.category || '',
        }),
      ];
    });
  };

  const updateLine = <K extends keyof ReceiveLine>(lineId: string, field: K, value: ReceiveLine[K]) => {
    setItems((prev) =>
      prev.map((line) => {
        if (line.lineId !== lineId) return line;
        const next = { ...line, [field]: value } as ReceiveLine;

        if (field === 'quantity' || field === 'unit_price') {
          const quantity = Math.max(0, Number(next.quantity || 0));
          const unitPrice = Math.max(0, Number(next.unit_price || 0));
          next.line_total = roundMoney(quantity * unitPrice);
          if (next.auto_pricing_enabled) {
            next.selling_price = computeSellingFromMargin(unitPrice, Number(next.markup_percentage || 30));
          }
        }

        if (field === 'line_total') {
          const quantity = Math.max(0, Number(next.quantity || 0));
          const lineTotal = Math.max(0, Number(next.line_total || 0));
          next.unit_price = quantity > 0 ? roundMoney(lineTotal / quantity) : 0;
          if (next.auto_pricing_enabled) {
            next.selling_price = computeSellingFromMargin(next.unit_price, Number(next.markup_percentage || 30));
          }
        }

        if (field === 'category') {
          const pricing = resolveDepartmentPricing(String(next.category || ''));
          next.markup_percentage = pricing.markup;
          next.auto_pricing_enabled = pricing.autoPricingEnabled;
          if (pricing.autoPricingEnabled) {
            next.selling_price = computeSellingFromMargin(
              Number(next.unit_price || 0),
              pricing.markup
            );
          }
        }

        if (field === 'auto_pricing_enabled' || field === 'markup_percentage') {
          const auto = Boolean(next.auto_pricing_enabled);
          if (auto) {
            next.selling_price = computeSellingFromMargin(
              Number(next.unit_price || 0),
              Number(next.markup_percentage || 30)
            );
          }
        }

        return next;
      })
    );
  };

  const removeLine = (lineId: string) => {
    setItems((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const linkProductToLine = (lineId: string, product: POSProduct) => {
    setItems((prev) =>
      prev.map((line) =>
        line.lineId === lineId
          ? (() => {
              const category = line.category || product.category || '';
              const pricing = resolveDepartmentPricing(category);
              const unitPrice = line.unit_price || product.cost_price || 0;
              const fallbackSelling = product.unit_price || line.selling_price || unitPrice;
              return {
                ...line,
                description: product.name,
                product_id: product.id,
                unit_price: unitPrice,
                line_total: roundMoney((line.quantity || 0) * unitPrice),
                selling_price: pricing.autoPricingEnabled
                  ? computeSellingFromMargin(unitPrice, pricing.markup)
                  : fallbackSelling,
                auto_pricing_enabled: pricing.autoPricingEnabled,
                markup_percentage: pricing.markup,
                sku: product.sku || undefined,
                barcode: product.barcode || undefined,
                category,
              };
            })()
          : line
      )
    );
    setLineSearchTargetId(null);
    setLineProductSearch('');
  };

  const focusQuickEntry = () => {
    requestAnimationFrame(() => {
      quickEntryInputRef.current?.focus();
    });
  };

  const addBlankLine = useCallback(() => {
    const newLine = makeLine({ quantity: 0 });
    setItems((prev) => [...prev, newLine]);
    setPendingLineFocusId(newLine.lineId);
    setQuickEntry('');
    setLineSearchTargetId(null);
    setLineProductSearch('');
  }, []);

  const addQuickEntryToken = useCallback(async (rawEntry: string) => {
    const token = parseQuickToken(rawEntry);
    const query = token.identifier;
    if (!query) {
      addBlankLine();
      return;
    }

    const qty = Math.max(1, token.quantity ?? 1);
    const unitPrice = undefined;

    const exact = findProductExact(query);
    if (exact) {
      upsertLineFromProduct(exact, qty, unitPrice);
      setQuickEntry('');
      focusQuickEntry();
      return;
    }

    let matches = quickMatches;
    if (matches.length === 0) {
      matches = await searchProductsFast(query, 8);
    }

    const exactMatch = matches.find((product) => productMatchesLookup(product, query));
    if (exactMatch) {
      upsertLineFromProduct(exactMatch, qty, unitPrice);
      setQuickEntry('');
      focusQuickEntry();
      return;
    }

    if (matches.length === 1) {
      upsertLineFromProduct(matches[0], qty, unitPrice);
      setQuickEntry('');
      focusQuickEntry();
      return;
    }
    addBlankLine();
  }, [addBlankLine, findProductExact, quickMatches, searchProductsFast]);

  const handleQuickAdd = async () => {
    await addQuickEntryToken(quickEntry);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const autoCreate = params.get('auto_create') === '1';
    const queryBarcode = (params.get('barcode') || '').trim();
    const intentBarcode = peekMissingProductIntent()?.barcode?.trim() || '';
    const barcode = queryBarcode || intentBarcode;

    if (!barcode) return;

    void addQuickEntryToken(barcode);
    clearMissingProductIntent();

    if (autoCreate) {
      navigate('/receive', { replace: true });
    }
  }, [location.search, navigate, addQuickEntryToken]);

  const handleCreateVendor = async () => {
    if (!currentOutlet?.id) return;

    const businessName = vendorForm.business_name.trim();
    if (!businessName) {
      setError('Vendor name is required.');
      return;
    }

    setIsSavingVendor(true);
    try {
      const payload: CreateVendorData = {
        business_name: businessName,
        contact_person: vendorForm.contact_person.trim(),
        email: vendorForm.email.trim(),
        phone: vendorForm.phone.trim(),
        address: {
          street: '',
          city: '',
          state: '',
          zip: '',
          country: 'Nigeria',
        },
        vendor_type: 'supplier',
        tax_id: '',
        payment_terms: vendorForm.payment_terms.trim(),
        credit_limit: 0,
        website: '',
        notes: vendorForm.notes.trim(),
        outlet_id: currentOutlet.id,
        is_active: true,
      };

      const response = await vendorService.createVendor(payload, currentOutlet.id);
      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to create vendor');
      }

      const created = normalizeVendor(response.data as any);
      setVendors((prev) => [created, ...prev]);
      setSelectedVendorId(created.id);

      setVendorForm({
        business_name: '',
        contact_person: '',
        email: '',
        phone: '',
        payment_terms: '',
        notes: '',
      });
      setShowVendorModal(false);
    } catch (vendorError) {
      const message =
        vendorError instanceof Error ? vendorError.message : 'Failed to create vendor.';
      setError(message);
    } finally {
      setIsSavingVendor(false);
    }
  };

  const handleOpenHistoryInvoice = async (invoiceId: string) => {
    setHistoryLoadingInvoiceId(invoiceId);
    setError('');

    try {
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        setError('Unable to load invoice details.');
        return;
      }
      setSelectedHistoryInvoice(invoice);
    } catch {
      setError('Failed to load invoice details.');
    } finally {
      setHistoryLoadingInvoiceId(null);
    }
  };

  const handlePrintInvoiceLabels = (invoice: Invoice) => {
    const labels = getInvoiceLabelData(invoice);
    if (labels.length === 0) {
      setError('This invoice has no line items to print labels for.');
      return;
    }

    if (!labelPrinterRuntime.canPrint) {
      setError(labelPrinterRuntime.reason || 'Label printer is unavailable.');
      return;
    }

    const copies = Math.max(1, Math.min(50, Math.floor(parseNumber(labelCopies, 1))));
    const footerFallback = `${currentOutlet?.name || 'Compazz'} • ${labelPrinterRuntime.printer?.name || 'Label Printer'}`;
    const footerText = activeLabelTemplate.footerText.trim() || footerFallback;
    const opened = printProductLabels(labels, {
      title: `Invoice Labels - ${invoice.invoice_number || 'Invoice'}`,
      copiesPerProduct: copies,
      showPrice: includePriceOnLabels,
      footerText,
      template: activeLabelTemplate,
    });

    if (!opened) {
      setError('Allow pop-ups to print product labels.');
    }
  };

  const handlePrintReceivedLabels = () => {
    if (lastPrintedLabels.length === 0) {
      setError('No labels available for the last receive operation.');
      return;
    }

    if (!labelPrinterRuntime.canPrint) {
      setError(labelPrinterRuntime.reason || 'Label printer is unavailable.');
      return;
    }

    const copies = Math.max(1, Math.min(50, Math.floor(parseNumber(labelCopies, 1))));
    const footerFallback = `${currentOutlet?.name || 'Compazz'} • ${labelPrinterRuntime.printer?.name || 'Label Printer'}`;
    const footerText = activeLabelTemplate.footerText.trim() || footerFallback;
    const opened = printProductLabels(lastPrintedLabels, {
      title: `Receive Labels - ${receiveResult?.invoice_number || 'Invoice'}`,
      copiesPerProduct: copies,
      showPrice: includePriceOnLabels,
      footerText,
      template: activeLabelTemplate,
    });

    if (!opened) {
      setError('Allow pop-ups to print product labels.');
    }
  };

  const handleHoldInvoice = () => {
    if (!currentOutlet?.id) return;

    const hasMeaningfulContent =
      items.some((item) => item.description.trim().length > 0 && Number(item.quantity || 0) > 0) ||
      selectedVendorId.trim().length > 0 ||
      invoiceNumber.trim().length > 0 ||
      notes.trim().length > 0;

    if (!hasMeaningfulContent) {
      setError('Add invoice details or line items before holding.');
      return;
    }

    const now = new Date().toISOString();
    const holdId = activeHeldDraftId || createHeldDraftId();

    const draft: HeldReceiveDraft = {
      id: holdId,
      outlet_id: currentOutlet.id,
      vendor_id: selectedVendorId,
      invoice_number: invoiceNumber.trim(),
      invoice_date: invoiceDate,
      payment_status: paymentStatus,
      payment_date: paymentDate,
      notes: notes.trim(),
      items: items.map((line) =>
        makeLine({
          ...line,
          lineId: String(line.lineId || createLineId()),
        })
      ),
      created_at: now,
      updated_at: now,
    };

    const nextDrafts = [draft, ...heldDrafts.filter((entry) => entry.id !== holdId)];
    persistHeldDrafts(nextDrafts);

    setStep('entry');
    setSelectedVendorId('');
    setInvoiceNumber('');
    setInvoiceDate(todayIsoDate());
    setPaymentStatus('paid');
    setPaymentDate(todayIsoDate());
    setNotes('');
    setItems([]);
    setReceiveResult(null);
    setLastPrintedLabels([]);
    setError('');
    setQuickEntry('');
    setLineSearchTargetId(null);
    setLineProductSearch('');
    setActiveHeldDraftId(null);
    setSelectedHistoryInvoice(null);
    setHistoryLoadingInvoiceId(null);
  };

  const handleResumeHeldDraft = (draftId: string) => {
    const draft = heldDrafts.find((entry) => entry.id === draftId);
    if (!draft) return;

    setStep('entry');
    setSelectedVendorId(draft.vendor_id || '');
    setInvoiceNumber(draft.invoice_number || '');
    setInvoiceDate(draft.invoice_date || todayIsoDate());
    setPaymentStatus(draft.payment_status === 'unpaid' ? 'unpaid' : 'paid');
    setPaymentDate(draft.payment_date || draft.invoice_date || todayIsoDate());
    setNotes(draft.notes || '');
    setItems(
      (draft.items || []).map((line) =>
        makeLine({
          ...line,
          lineId: String(line.lineId || createLineId()),
        })
      )
    );
    setReceiveResult(null);
    setLastPrintedLabels([]);
    setError('');
    setQuickEntry('');
    setLineSearchTargetId(null);
    setLineProductSearch('');
    setSelectedHistoryInvoice(null);
    setHistoryLoadingInvoiceId(null);
    setActiveHeldDraftId(draft.id);

    persistHeldDrafts(heldDrafts.filter((entry) => entry.id !== draft.id));
  };

  const handleRemoveHeldDraft = (draftId: string) => {
    persistHeldDrafts(heldDrafts.filter((entry) => entry.id !== draftId));
    if (activeHeldDraftId === draftId) {
      setActiveHeldDraftId(null);
    }
  };

  const handleReceive = async () => {
    if (!currentOutlet?.id) return;
    const normalizedPaymentDate = paymentDate.trim();

    if (paymentStatus === 'unpaid' && !normalizedPaymentDate) {
      setError('Select a payment date for unpaid invoices before receiving.');
      return;
    }

    const validLines = items
      .filter((item) => item.description.trim() && item.quantity > 0)
      .map((item) => {
        const lineTotal = getLineTotal(item);
        const quantity = Math.max(0, Number(item.quantity || 0));
        const unitPrice = quantity > 0 ? roundMoney(lineTotal / quantity) : 0;
        const pricing = resolveDepartmentPricing(item.category);
        const sellingPrice = Math.max(
          0,
          Number(
            item.selling_price && item.selling_price > 0
              ? item.selling_price
              : pricing.autoPricingEnabled
                ? computeSellingFromMargin(unitPrice, pricing.markup)
                : unitPrice
          )
        );
        return {
          ...item,
          quantity,
          unit_price: unitPrice,
          line_total: lineTotal,
          markup_percentage: Number(item.markup_percentage ?? pricing.markup),
          auto_pricing_enabled: item.auto_pricing_enabled ?? pricing.autoPricingEnabled,
          selling_price: sellingPrice,
        } as ReceiveLine;
      });

    if (validLines.length === 0) {
      setError('Add at least one valid line item before receiving.');
      return;
    }

    const validItems: InvoiceItem[] = validLines.map((line) => {
      const { lineId, ...invoiceItem } = line;
      void lineId;
      return invoiceItem as InvoiceItem;
    });

    setError('');
    setIsCreating(true);
    setStep('receiving');

    try {
      const invoice = await invoiceService.createInvoice({
        outlet_id: currentOutlet.id,
        vendor_id: selectedVendorId || undefined,
        invoice_number: invoiceNumber || undefined,
        invoice_type: 'vendor',
        issue_date: invoiceDate,
        due_date: paymentStatus === 'unpaid' ? normalizedPaymentDate : invoiceDate,
        notes,
        items: validItems,
      });

      const invoiceItemRows = invoice.invoice_items || [];
      const itemOverrides = invoiceItemRows.map((invoiceItem, index) => {
        const source = validLines[index];
        if (!invoiceItem?.id || !source) return null;
        return {
          item_id: invoiceItem.id,
          quantity: source.quantity,
          cost_price: source.unit_price,
          selling_price: source.selling_price,
          line_total: source.line_total,
          category: source.category,
          markup_percentage: source.markup_percentage,
          auto_pricing_enabled: source.auto_pricing_enabled,
        };
      }).filter(Boolean) as Array<{
        item_id: string;
        quantity?: number;
        cost_price?: number;
        selling_price?: number;
        line_total?: number;
        category?: string;
        markup_percentage?: number;
        auto_pricing_enabled?: boolean;
      }>;

      const result = await invoiceService.receiveGoods(invoice.id, {
        addToInventory: true,
        updateCostPrices: true,
        paymentStatus,
        paymentDate: paymentStatus === 'unpaid' ? normalizedPaymentDate : undefined,
        itemsReceived: itemOverrides,
      });

      const byProductId = new Map(
        validLines
          .filter((line) => !!line.product_id)
          .map((line) => [line.product_id as string, line])
      );
      const byName = new Map(
        validLines.map((line) => [line.description.trim().toLowerCase(), line])
      );

      const printedLabels: ProductLabelData[] = [
        ...result.products_created.map((product) => {
          const source =
            byProductId.get(product.product_id) ||
            byName.get(product.name.trim().toLowerCase());
          return {
            name: product.name,
            sku: source?.sku,
            barcode: source?.barcode,
            price: source?.selling_price || source?.unit_price,
          };
        }),
        ...result.products_updated.map((product) => {
          const source =
            byProductId.get(product.product_id) ||
            byName.get(product.name.trim().toLowerCase());
          return {
            name: product.name,
            sku: source?.sku,
            barcode: source?.barcode,
            price: source?.selling_price || source?.unit_price,
          };
        }),
      ].filter((label) => label.name.trim().length > 0);

      setLastPrintedLabels(printedLabels);
      setReceiveResult(result);
      setActiveHeldDraftId(null);
      setStep('done');
      loadHistory();
    } catch (receiveError: any) {
      const message = receiveError?.message || 'Failed to receive items.';
      setError(message);
      setStep('entry');
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    setIncludePriceOnLabels(activeLabelTemplate.defaultShowPrice);
  }, [activeLabelTemplate.defaultShowPrice]);

  const resetForm = useCallback(() => {
    setStep('entry');
    setActiveHeldDraftId(null);
    setSelectedVendorId('');
    setInvoiceNumber('');
    setInvoiceDate(todayIsoDate());
    setPaymentStatus('paid');
    setPaymentDate(todayIsoDate());
    setNotes('');
    setItems([]);
    setReceiveResult(null);
    setLastPrintedLabels([]);
    setError('');
    setQuickEntry('');
    setLabelCopies('1');
    setIncludePriceOnLabels(activeLabelTemplate.defaultShowPrice);
    setLineSearchTargetId(null);
    setLineProductSearch('');
    setSelectedHistoryInvoice(null);
    setHistoryLoadingInvoiceId(null);
  }, [activeLabelTemplate.defaultShowPrice]);

  useEffect(() => {
    const handleHeaderAction = (event: Event) => {
      const action = (event as CustomEvent<{ action?: string }>).detail?.action;
      if (action === 'toggle-history') {
        setShowHistory((prev) => !prev);
        return;
      }
      if (action === 'reset') {
        resetForm();
      }
    };

    window.addEventListener('pos-receive-items-action', handleHeaderAction);
    return () => window.removeEventListener('pos-receive-items-action', handleHeaderAction);
  }, [resetForm]);

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-stone-50">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-5 lg:py-6">
        <div className="space-y-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError('')} className="ml-auto text-red-600 hover:text-red-800">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'entry' && (
            <>
              <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-500">
                    Invoice Details
                  </h2>
                  <button
                    onClick={() => setShowVendorModal(true)}
                    className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-medium text-slate-700 inline-flex items-center gap-1.5"
                  >
                    <UserPlus className="w-3.5 h-3.5" />
                    Add Supplier
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Supplier / Vendor</label>
                    <select
                      value={selectedVendorId}
                      onChange={(event) => setSelectedVendorId(event.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="">Walk-in / No Vendor</option>
                      {vendors.map((vendor) => (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Invoice Number</label>
                    <input
                      value={invoiceNumber}
                      onChange={(event) => setInvoiceNumber(event.target.value)}
                      placeholder="e.g. SUP-2026-001"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Invoice Date</label>
                    <input
                      type="date"
                      value={invoiceDate}
                      onChange={(event) => setInvoiceDate(event.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
                    <input
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Optional"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">Payment Status</label>
                    <select
                      value={paymentStatus}
                      onChange={(event) => setPaymentStatus(event.target.value as ReceivePaymentStatus)}
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    >
                      <option value="paid">Paid</option>
                      <option value="unpaid">Unpaid</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-stone-500 mb-1">
                      Payment Date{paymentStatus === 'unpaid' ? ' *' : ''}
                    </label>
                    <input
                      type="date"
                      value={paymentDate}
                      onChange={(event) => setPaymentDate(event.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-stone-200">
                  <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-500 mb-3">
                    Fast Receive
                  </h2>

                  <div className="space-y-3">
                    <div className="relative">
                      <div className="flex items-center rounded-xl border border-stone-300 bg-white px-3">
                        <ScanLine className="w-4 h-4 text-stone-500" />
                        <input
                          ref={quickEntryInputRef}
                          value={quickEntry}
                          onChange={(event) => setQuickEntry(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault();
                              void handleQuickAdd();
                            }
                          }}
                          placeholder="Scan barcode/SKU or type name (optional xQty, e.g. 123456 x6)"
                          className="w-full px-2 py-3 bg-transparent text-sm text-slate-800 focus:outline-none"
                        />
                        <button
                          onClick={() => { void handleQuickAdd(); }}
                          className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-xs font-semibold"
                        >
                          Add
                        </button>
                      </div>

                      {showQuickSuggestions && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                          {quickMatchLoading && (
                            <p className="px-3 py-2 text-xs text-stone-500">Searching inventory...</p>
                          )}
                          {!quickMatchLoading && quickMatches.length === 0 && quickToken.identifier.trim().length >= 3 && (
                            <p className="px-3 py-2 text-xs text-stone-500">
                              No exact inventory match. Press Add to insert a blank line.
                            </p>
                          )}
                          {quickMatches.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => {
                                upsertLineFromProduct(
                                  product,
                                  Math.max(1, quickToken.quantity ?? 1)
                                );
                                setQuickEntry('');
                                focusQuickEntry();
                              }}
                              className="w-full px-3 py-2.5 text-left hover:bg-stone-100 border-b border-stone-100 last:border-b-0"
                            >
                              <div className="flex items-center justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-medium text-slate-800 truncate">{product.name}</p>
                                  <p className="text-[11px] text-stone-500 truncate">
                                    {product.sku}
                                    {product.barcode ? ` · ${product.barcode}` : ''}
                                  </p>
                                </div>
                                <div className="text-xs font-semibold text-slate-700">
                                  Qty {product.quantity_on_hand}
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                  </div>

                </div>
              </div>

              {heldDrafts.length > 0 && (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 lg:p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-amber-700">
                      Held Invoices ({heldDrafts.length})
                    </h2>
                    {activeHeldDraftId && (
                      <span className="text-[11px] font-medium text-amber-700">
                        Editing held invoice
                      </span>
                    )}
                  </div>

                  <div className="space-y-2">
                    {heldDrafts.map((draft) => (
                      <div
                        key={draft.id}
                        className="rounded-xl border border-amber-200 bg-white px-3 py-2.5 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900 truncate">
                            {draft.invoice_number || 'Untitled held invoice'}
                          </p>
                          <p className="text-[11px] text-stone-500">
                            {draft.items.length} line{draft.items.length === 1 ? '' : 's'} ·{' '}
                            {formatCurrency(
                              draft.items.reduce((sum, line) => sum + getLineTotal(line), 0)
                            )}{' '}
                            · {new Date(draft.updated_at).toLocaleString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleResumeHeldDraft(draft.id)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-xs font-semibold"
                          >
                            Resume
                          </button>
                          <button
                            onClick={() => handleRemoveHeldDraft(draft.id)}
                            className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-slate-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
                <div className="px-4 lg:px-5 py-3 border-b border-stone-200 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-500">
                    Line Items ({items.length})
                  </h2>
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Sparkles className="w-3.5 h-3.5" />
                    Spreadsheet-style editing enabled
                  </div>
                </div>

                {items.length === 0 ? (
                  <div className="p-10 text-center">
                    <Package className="w-10 h-10 mx-auto text-stone-300 mb-2" />
                    <p className="text-sm font-medium text-slate-700">No items added yet</p>
                    <p className="text-xs text-stone-500 mt-1">
                      Scan/search inventory or press Add to insert a blank row.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[52vh]">
                    <table className="w-full min-w-[1040px] text-sm">
                      <thead className="sticky top-0 z-10 bg-stone-100 text-stone-600 text-[11px] uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left min-w-[300px]">Item Description</th>
                          <th className="px-2 py-2 text-center w-24">Link</th>
                          <th className="px-3 py-2 text-left min-w-[140px]">Category</th>
                          <th className="px-3 py-2 text-right w-24">Qty</th>
                          <th className="px-3 py-2 text-right w-36">Cost Price</th>
                          <th className="px-3 py-2 text-right w-36">Selling Price</th>
                          <th className="px-3 py-2 text-right w-36">Line Total</th>
                          <th className="px-3 py-2 text-center w-16">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100">
                        {items.map((line, index) => (
                          <tr key={line.lineId} className="hover:bg-stone-50/80">
                            <td className="px-3 py-2 text-stone-400">{index + 1}</td>

                            <td className="px-3 py-2">
                              <input
                                data-line-description-id={line.lineId}
                                value={line.description}
                                onChange={(event) =>
                                  updateLine(line.lineId, 'description', event.target.value)
                                }
                                placeholder="Item name or description"
                                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-2 py-2 relative text-center">
                              {line.product_id ? (
                                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium">
                                  <Check className="w-3 h-3" /> Linked
                                  <button
                                    onClick={() => updateLine(line.lineId, 'product_id', null)}
                                    className="hover:text-red-600"
                                    title="Unlink product"
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setLineSearchTargetId(line.lineId);
                                    setLineProductSearch('');
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-stone-300 bg-white text-[11px] font-medium text-slate-700 hover:bg-stone-100"
                                >
                                  <Search className="w-3.5 h-3.5" /> Link
                                </button>
                              )}

                              {lineSearchTargetId === line.lineId && (
                                <>
                                  <div
                                    className="fixed inset-0 z-20"
                                    onClick={() => {
                                      setLineSearchTargetId(null);
                                      setLineProductSearch('');
                                    }}
                                  />
                                  <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 w-80 rounded-xl border border-stone-200 bg-white shadow-xl z-30 p-2 text-left">
                                    <input
                                      value={lineProductSearch}
                                      onChange={(event) => setLineProductSearch(event.target.value)}
                                      onKeyDown={(event) => {
                                        if (event.key !== 'Enter') return;
                                        event.preventDefault();

                                        const exactCurrent = lineSearchMatches.find((product) =>
                                          productMatchesLookup(product, lineProductSearch)
                                        );
                                        if (exactCurrent) {
                                          linkProductToLine(line.lineId, exactCurrent);
                                          return;
                                        }

                                        if (lineSearchMatches.length === 1) {
                                          linkProductToLine(line.lineId, lineSearchMatches[0]);
                                          return;
                                        }

                                        void (async () => {
                                          const freshMatches = await searchProductsFast(lineProductSearch, 10);
                                          const exactFresh = freshMatches.find((product) =>
                                            productMatchesLookup(product, lineProductSearch)
                                          );
                                          const resolved =
                                            exactFresh || (freshMatches.length === 1 ? freshMatches[0] : null);
                                          if (resolved) {
                                            linkProductToLine(line.lineId, resolved);
                                          }
                                        })();
                                      }}
                                      placeholder="Search product by name, barcode, sku"
                                      className="w-full px-2.5 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                                      autoFocus
                                    />
                                    <div className="max-h-44 overflow-y-auto mt-1">
                                      {lineSearchLoading && (
                                        <p className="p-2 text-[11px] text-stone-500">Searching inventory...</p>
                                      )}
                                      {!lineSearchLoading && lineProductSearch.trim().length > 0 && lineSearchMatches.length === 0 && (
                                        <p className="p-2 text-[11px] text-stone-500">
                                          No existing product found. This line will create a new product.
                                        </p>
                                      )}
                                      {lineSearchMatches.map((product) => (
                                        <button
                                          key={product.id}
                                          onClick={() => linkProductToLine(line.lineId, product)}
                                          className="w-full text-left px-2.5 py-2 rounded-lg hover:bg-stone-100"
                                        >
                                          <p className="text-xs font-medium text-slate-800 truncate">{product.name}</p>
                                          <p className="text-[11px] text-stone-500 truncate">
                                            {product.sku}
                                            {product.barcode ? ` · ${product.barcode}` : ''}
                                            {` · Qty ${product.quantity_on_hand}`}
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                </>
                              )}
                            </td>

                            <td className="px-3 py-2">
                              <select
                                value={line.category || ''}
                                onChange={(event) =>
                                  updateLine(line.lineId, 'category', event.target.value)
                                }
                                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              >
                                <option value="">Select department</option>
                                {line.category &&
                                  !departmentOptions.some(
                                    (option) => option.toLowerCase() === line.category!.toLowerCase()
                                  ) && (
                                    <option value={line.category}>{line.category}</option>
                                  )}
                                {departmentOptions.map((department) => (
                                  <option key={department} value={department}>
                                    {department}
                                  </option>
                                ))}
                              </select>
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                value={line.quantity}
                                onChange={(event) =>
                                  updateLine(
                                    line.lineId,
                                    'quantity',
                                    Math.max(0, parseNumber(event.target.value, 0))
                                  )
                                }
                                className="w-full px-2.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.unit_price}
                                onChange={(event) =>
                                  updateLine(
                                    line.lineId,
                                    'unit_price',
                                    Math.max(0, parseNumber(event.target.value, 0))
                                  )
                                }
                                className="w-full px-2.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={line.selling_price ?? 0}
                                onChange={(event) =>
                                  updateLine(
                                    line.lineId,
                                    'selling_price',
                                    Math.max(0, parseNumber(event.target.value, 0))
                                  )
                                }
                                className="w-full px-2.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-right focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-3 py-2">
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={getLineTotal(line)}
                                onChange={(event) =>
                                  updateLine(
                                    line.lineId,
                                    'line_total',
                                    Math.max(0, parseNumber(event.target.value, 0))
                                  )
                                }
                                className="w-full px-2.5 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-right font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-3 py-2 text-center">
                              <button
                                onClick={() => removeLine(line.lineId)}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-lg text-stone-500 hover:text-red-600 hover:bg-red-50"
                                title="Remove line"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {items.length > 0 && (
                  <div className="px-4 lg:px-5 py-3 border-t border-stone-200 bg-stone-50 flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
                    <div className="flex flex-wrap items-center gap-3 text-xs text-stone-600">
                      <span>{items.length} lines</span>
                      <span>{totalUnits} units</span>
                      <span>{linkedCount} linked</span>
                      <span>{items.length - linkedCount} new</span>
                    </div>
                    <div className="text-right">
                      <span className="text-xs text-stone-500">Total</span>
                      <div className="text-xl font-bold text-slate-900">{formatCurrency(subtotal)}</div>
                    </div>
                  </div>
                )}
              </div>

              {items.length > 0 && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <p className="text-xs text-stone-500">
                    Linked lines update existing stock. Unlinked lines create new products automatically.
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={handleHoldInvoice}
                      disabled={isCreating}
                      className="px-4 py-3 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-slate-800 text-sm font-semibold disabled:opacity-60"
                    >
                      {activeHeldDraftId ? 'Update Hold' : 'Hold Invoice'}
                    </button>
                    <button
                      onClick={handleReceive}
                      disabled={isCreating}
                      className="px-5 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold disabled:opacity-60 inline-flex items-center gap-2"
                    >
                      <Truck className="w-4 h-4" />
                      Receive Into Inventory
                      <ArrowRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 'receiving' && (
            <div className="rounded-2xl border border-stone-200 bg-white px-5 py-10 text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-900 mx-auto mb-4"></div>
              <h2 className="text-lg font-semibold text-slate-900">Receiving items into inventory...</h2>
              <p className="text-sm text-stone-500 mt-1">Creating invoice and posting stock movements</p>
            </div>
          )}

          {step === 'done' && receiveResult && (
            <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:p-6">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 mx-auto flex items-center justify-center mb-3">
                  <Check className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-semibold text-slate-900">Items Received Successfully</h2>
                <p className="text-sm text-stone-500 mt-1">Invoice {receiveResult.invoice_number}</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{receiveResult.products_updated.length}</p>
                  <p className="text-xs text-stone-500">Products Updated</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{receiveResult.products_created.length}</p>
                  <p className="text-xs text-stone-500">New Products Created</p>
                </div>
                <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 text-center">
                  <p className="text-2xl font-bold text-slate-900">{receiveResult.stock_movements_count}</p>
                  <p className="text-xs text-stone-500">Stock Movements</p>
                </div>
              </div>

              <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 mb-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">Print Product Labels</p>
                    <p className="text-xs text-stone-500 mt-1">
                      {lastPrintedLabels.length} product label
                      {lastPrintedLabels.length === 1 ? '' : 's'} prepared from this receive batch.
                    </p>
                    <p className="text-xs mt-1 text-stone-500">
                      {labelPrinterRuntime.canPrint
                        ? `Label printer ready: ${labelPrinterRuntime.printer?.name}`
                        : labelPrinterRuntime.reason}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <div>
                      <label className="block text-[11px] font-medium text-stone-500 mb-1">Copies / product</label>
                      <input
                        type="number"
                        min="1"
                        max="50"
                        value={labelCopies}
                        onChange={(event) => setLabelCopies(event.target.value)}
                        className="w-24 px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                      />
                    </div>

                    <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-slate-700">
                      <input
                        type="checkbox"
                        checked={includePriceOnLabels}
                        onChange={(event) => setIncludePriceOnLabels(event.target.checked)}
                        className="rounded border-stone-300"
                      />
                      Include price
                    </label>

                    <button
                      onClick={handlePrintReceivedLabels}
                      disabled={!labelPrinterRuntime.canPrint || lastPrintedLabels.length === 0}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold disabled:opacity-60"
                    >
                      Print Labels
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  onClick={resetForm}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold"
                >
                  Receive More Items
                </button>
              </div>
            </div>
          )}

          {showHistory && (
            <div className="rounded-2xl border border-stone-200 bg-white overflow-hidden">
              <div className="px-4 lg:px-5 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-500">
                  Recent Vendor Invoices ({invoiceHistory.length})
                </h2>
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-stone-500 hover:text-slate-900"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {invoiceHistory.length === 0 ? (
                <p className="p-6 text-center text-sm text-stone-500">No invoices yet.</p>
              ) : (
                <div className="divide-y divide-stone-100">
                  {invoiceHistory.map((invoice) => (
                    (() => {
                      const statusDisplay = getInvoiceStatusDisplay(invoice);
                      const vendorName = getInvoiceVendorName(invoice);
                      return (
                    <div
                      key={invoice.id}
                      className="px-4 lg:px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-stone-500">
                          {formatDisplayDate(invoice.issue_date)} · {vendorName}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${statusDisplay.badgeClass}`}>
                          {statusDisplay.label}
                        </span>
                        <span className="font-semibold text-slate-800">{formatCurrency(invoice.total)}</span>
                        <button
                          onClick={() => handleOpenHistoryInvoice(invoice.id)}
                          disabled={historyLoadingInvoiceId === invoice.id}
                          className="px-3 py-1.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-slate-700 disabled:opacity-60"
                        >
                          {historyLoadingInvoiceId === invoice.id ? 'Opening...' : 'View Invoice'}
                        </button>
                      </div>
                    </div>
                      );
                    })()
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedHistoryInvoice && (
        (() => {
          const selectedStatusDisplay = getInvoiceStatusDisplay(selectedHistoryInvoice);
          const selectedVendorName = getInvoiceVendorName(selectedHistoryInvoice);
          const selectedReceiveMeta = parseReceivedMeta(selectedHistoryInvoice.notes);
          const lineItems = selectedHistoryInvoice.invoice_items || [];
          const lineSubtotal = lineItems.reduce(
            (sum, item) =>
              sum +
              (typeof item.total === 'number'
                ? Number(item.total)
                : Number(item.quantity || 0) * Number(item.unit_price || 0)),
            0
          );
          const invoiceTaxAmount = Number(selectedHistoryInvoice.tax_amount || 0);
          const invoiceSubtotal = Number(selectedHistoryInvoice.subtotal || lineSubtotal);
          const dueDateLabel =
            selectedStatusDisplay.key === 'unpaid' ? 'Payment Date' : 'Due Date';
          return (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Invoice {selectedHistoryInvoice.invoice_number}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${selectedStatusDisplay.badgeClass}`}>
                    {selectedStatusDisplay.label}
                  </span>
                  <span className="text-sm text-stone-500">{selectedVendorName}</span>
                  <span className="text-sm text-stone-400">•</span>
                  <span className="text-sm font-semibold text-slate-800">
                    {formatCurrency(selectedHistoryInvoice.total)}
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedHistoryInvoice(null)}
                className="text-stone-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[58vh]">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 mb-4">
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">Vendor</p>
                  <p className="text-sm font-semibold text-slate-800 truncate">{selectedVendorName}</p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">Invoice Date</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDisplayDate(selectedHistoryInvoice.issue_date)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">{dueDateLabel}</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDisplayDate(selectedHistoryInvoice.due_date)}
                  </p>
                </div>
                <div className="rounded-lg border border-stone-200 bg-stone-50 px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500">Created</p>
                  <p className="text-sm font-semibold text-slate-800">
                    {formatDisplayDate(selectedHistoryInvoice.created_at)}
                  </p>
                </div>
              </div>

              {selectedReceiveMeta && (
                <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-xs text-emerald-700">
                    Received on {selectedReceiveMeta.date} by {selectedReceiveMeta.receivedBy}.
                  </p>
                </div>
              )}

              {selectedHistoryInvoice.notes && selectedHistoryInvoice.notes.trim() && (
                <div className="mb-4 rounded-lg border border-stone-200 bg-white px-3 py-2">
                  <p className="text-[11px] uppercase tracking-wide text-stone-500 mb-1">Notes</p>
                  <p className="text-xs text-stone-700 whitespace-pre-wrap">
                    {selectedHistoryInvoice.notes}
                  </p>
                </div>
              )}

              {(selectedHistoryInvoice.invoice_items || []).length === 0 ? (
                <p className="text-sm text-stone-500">No line items found on this invoice.</p>
              ) : (
                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <table className="w-full min-w-[760px] text-sm">
                    <thead className="bg-stone-100 text-stone-600 text-[11px] uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left">Description</th>
                        <th className="px-3 py-2 text-right w-28">Qty</th>
                        <th className="px-3 py-2 text-right w-40">Cost Price</th>
                        <th className="px-3 py-2 text-right w-40">Line Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {(selectedHistoryInvoice.invoice_items || []).map((item, index) => (
                        <tr key={item.id || `${item.description}-${index}`} className="hover:bg-stone-50/80">
                          <td className="px-3 py-2 text-slate-800">{item.description}</td>
                          <td className="px-3 py-2 text-right text-slate-700">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-slate-700">
                            {formatCurrency(item.unit_price)}
                          </td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800">
                            {formatCurrency(
                              typeof item.total === 'number'
                                ? item.total
                                : item.quantity * item.unit_price
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-stone-50 border-t border-stone-200">
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-stone-600" colSpan={3}>
                          Subtotal
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                          {formatCurrency(invoiceSubtotal)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-stone-600" colSpan={3}>
                          Tax
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-semibold text-slate-800">
                          {formatCurrency(invoiceTaxAmount)}
                        </td>
                      </tr>
                      <tr>
                        <td className="px-3 py-2 text-xs font-semibold text-stone-700" colSpan={3}>
                          Total
                        </td>
                        <td className="px-3 py-2 text-right text-sm font-bold text-slate-900">
                          {formatCurrency(selectedHistoryInvoice.total)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-stone-200 bg-stone-50 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-xs text-stone-500">
                  {(selectedHistoryInvoice.invoice_items || []).length} line
                  {(selectedHistoryInvoice.invoice_items || []).length === 1 ? '' : 's'} on invoice.
                </p>
                <p className="text-xs mt-1 text-stone-500">
                  {labelPrinterRuntime.canPrint
                    ? `Label printer ready: ${labelPrinterRuntime.printer?.name}`
                    : labelPrinterRuntime.reason}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-stone-500 mb-1">Copies / product</label>
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={labelCopies}
                    onChange={(event) => setLabelCopies(event.target.value)}
                    className="w-24 px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  />
                </div>

                <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-stone-300 bg-white text-xs font-medium text-slate-700">
                  <input
                    type="checkbox"
                    checked={includePriceOnLabels}
                    onChange={(event) => setIncludePriceOnLabels(event.target.checked)}
                    className="rounded border-stone-300"
                  />
                  Include price
                </label>

                <button
                  onClick={() => handlePrintInvoiceLabels(selectedHistoryInvoice)}
                  disabled={!labelPrinterRuntime.canPrint}
                  className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold disabled:opacity-60"
                >
                  Print Invoice Labels
                </button>
              </div>
            </div>
          </div>
        </div>
          );
        })()
      )}

      {showVendorModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-slate-900">Add Supplier / Vendor</h3>
              <button onClick={() => setShowVendorModal(false)} className="text-stone-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Business Name *</label>
                <input
                  value={vendorForm.business_name}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, business_name: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Supplier name"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Contact Person</label>
                <input
                  value={vendorForm.contact_person}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, contact_person: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Contact person"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Phone</label>
                <input
                  value={vendorForm.phone}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="080..."
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Email</label>
                <input
                  value={vendorForm.email}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="vendor@example.com"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-stone-500 mb-1">Payment Terms</label>
                <input
                  value={vendorForm.payment_terms}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, payment_terms: event.target.value }))
                  }
                  className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="e.g. 30 days"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-stone-500 mb-1">Notes</label>
                <textarea
                  value={vendorForm.notes}
                  onChange={(event) =>
                    setVendorForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="w-full min-h-[90px] px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                  placeholder="Optional supplier notes"
                />
              </div>
            </div>

            <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowVendorModal(false)}
                className="px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-sm font-medium text-slate-700"
                disabled={isSavingVendor}
              >
                Cancel
              </button>
              <button
                onClick={handleCreateVendor}
                disabled={isSavingVendor}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold disabled:opacity-60"
              >
                {isSavingVendor ? 'Saving...' : 'Save Supplier'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReceiveItemsPage;
