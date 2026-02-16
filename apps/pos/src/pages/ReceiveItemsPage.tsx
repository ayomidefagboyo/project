/**
 * Receive Items Page
 * High-throughput receiving flow:
 * - Fast scan/search add
 * - Spreadsheet-style bulk paste
 * - Inline product linking
 * - Quick supplier/vendor creation
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Check,
  ClipboardPaste,
  FileText,
  Package,
  Plus,
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
import { posService, type POSProduct } from '../lib/posService';
import { useTerminalId } from '../hooks/useTerminalId';
import { printProductLabels, type ProductLabelData } from '../lib/labelPrinter';
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

interface ReceiveLine extends InvoiceItem {
  lineId: string;
}

const createLineId = (): string =>
  `line-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const makeLine = (seed: Partial<ReceiveLine> = {}): ReceiveLine => ({
  lineId: createLineId(),
  description: '',
  quantity: 1,
  unit_price: 0,
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

const parseNumber = (value: string, fallback = 0): number => {
  const next = Number(value);
  if (Number.isNaN(next)) return fallback;
  return next;
};

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

const looksLikeBarcode = (value: string): boolean => {
  const normalized = value.trim();
  if (normalized.length < 4) return false;
  if (!/^[A-Z0-9._/-]+$/i.test(normalized)) return false;
  return /\d/.test(normalized) || normalized.length >= 8;
};

const ReceiveItemsPage: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOutlet } = useOutlet();
  const { terminalId } = useTerminalId();

  const [step, setStep] = useState<Step>('entry');

  const [vendors, setVendors] = useState<VendorOption[]>([]);
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');

  const [items, setItems] = useState<ReceiveLine[]>([]);

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [lineSearchTargetId, setLineSearchTargetId] = useState<string | null>(null);
  const [lineProductSearch, setLineProductSearch] = useState('');

  const [quickEntry, setQuickEntry] = useState('');
  const [quickQuantity, setQuickQuantity] = useState('1');
  const [quickCost, setQuickCost] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [showBulkModal, setShowBulkModal] = useState(false);
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

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);

  const findProductExact = useCallback(
    (query: string): POSProduct | undefined => {
      const needle = query.trim().toLowerCase();
      if (!needle) return undefined;

      return products.find((product) => {
        const barcode = product.barcode?.trim().toLowerCase() || '';
        const sku = product.sku?.trim().toLowerCase() || '';
        const name = product.name.trim().toLowerCase();
        return barcode === needle || sku === needle || name === needle;
      });
    },
    [products]
  );

  const quickToken = useMemo(() => parseQuickToken(quickEntry), [quickEntry]);

  const findQuickMatches = useCallback(
    (identifier: string): POSProduct[] => {
      const q = identifier.trim().toLowerCase();
      if (!q) return [];

      return products
        .filter((product) => {
          const barcode = product.barcode?.toLowerCase() || '';
          const sku = product.sku?.toLowerCase() || '';
          return (
            product.name.toLowerCase().includes(q) ||
            barcode.includes(q) ||
            sku.includes(q)
          );
        })
        .slice(0, 8);
    },
    [products]
  );

  const quickMatches = useMemo(
    () => findQuickMatches(quickToken.identifier),
    [quickToken.identifier, findQuickMatches]
  );

  const lineSearchMatches = useMemo(() => {
    const q = lineProductSearch.trim().toLowerCase();
    if (!q) return [];

    return products
      .filter((product) => {
        const barcode = product.barcode?.toLowerCase() || '';
        const sku = product.sku?.toLowerCase() || '';
        return (
          product.name.toLowerCase().includes(q) ||
          barcode.includes(q) ||
          sku.includes(q)
        );
      })
      .slice(0, 10);
  }, [lineProductSearch, products]);

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0),
    [items]
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
    if (!currentOutlet?.id) return;

    const load = async () => {
      try {
        const [vendorRes, productRes] = await Promise.all([
          vendorService.getVendors(currentOutlet.id),
          posService.getAllProducts(currentOutlet.id, { activeOnly: false }),
        ]);

        if (vendorRes.data) {
          const normalized = (vendorRes.data as any[])
            .map(normalizeVendor)
            .filter((vendor) => vendor.id);
          setVendors(normalized);
        }

        setProducts(productRes || []);
      } catch (loadError) {
        console.error('Failed to load receiving data:', loadError);
        setError('Unable to load vendors/products. Please refresh.');
      }
    };

    load();
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

  const upsertLineFromProduct = (product: POSProduct, quantity = 1, unitPrice?: number) => {
    const normalizedQty = Math.max(1, quantity);
    setItems((prev) => {
      const existingIndex = prev.findIndex((item) => item.product_id === product.id);
      if (existingIndex >= 0) {
        const next = [...prev];
        next[existingIndex] = {
          ...next[existingIndex],
          quantity: next[existingIndex].quantity + normalizedQty,
        };
        return next;
      }

      return [
        ...prev,
        makeLine({
          description: product.name,
          quantity: normalizedQty,
          unit_price: unitPrice ?? product.cost_price ?? 0,
          product_id: product.id,
          sku: product.sku || undefined,
          barcode: product.barcode || undefined,
          category: product.category || '',
        }),
      ];
    });
  };

  const addBlankLine = () => {
    setItems((prev) => [...prev, makeLine()]);
  };

  const updateLine = <K extends keyof ReceiveLine>(lineId: string, field: K, value: ReceiveLine[K]) => {
    setItems((prev) =>
      prev.map((line) => (line.lineId === lineId ? { ...line, [field]: value } : line))
    );
  };

  const removeLine = (lineId: string) => {
    setItems((prev) => prev.filter((line) => line.lineId !== lineId));
  };

  const linkProductToLine = (lineId: string, product: POSProduct) => {
    setItems((prev) =>
      prev.map((line) =>
        line.lineId === lineId
          ? {
              ...line,
              description: product.name,
              product_id: product.id,
              unit_price: line.unit_price || product.cost_price || 0,
              sku: product.sku || undefined,
              barcode: product.barcode || undefined,
              category: line.category || product.category || '',
            }
          : line
      )
    );
    setLineSearchTargetId(null);
    setLineProductSearch('');
  };

  const getQuickQuantity = (quickTokenQty?: number | null): number => {
    const fallbackQty = parseNumber(quickQuantity || '1', 1);
    const computed = quickTokenQty ?? fallbackQty;
    return Math.max(1, computed);
  };

  const getQuickUnitPrice = (): number | undefined => {
    const parsed = parseNumber(quickCost || '0', 0);
    return parsed > 0 ? parsed : undefined;
  };

  const focusQuickEntry = () => {
    requestAnimationFrame(() => {
      quickEntryInputRef.current?.focus();
    });
  };

  const addQuickEntryToken = useCallback((rawEntry: string) => {
    const token = parseQuickToken(rawEntry);
    const query = token.identifier;
    if (!query) return;

    const qty = getQuickQuantity(token.quantity);
    const unitPrice = getQuickUnitPrice();

    const exact = findProductExact(query);
    if (exact) {
      upsertLineFromProduct(exact, qty, unitPrice);
      setQuickEntry('');
      focusQuickEntry();
      return;
    }

    const matches = findQuickMatches(query);
    if (matches.length === 1) {
      upsertLineFromProduct(matches[0], qty, unitPrice);
      setQuickEntry('');
      focusQuickEntry();
      return;
    }

    const inferredBarcode = looksLikeBarcode(query) ? query : undefined;
    setItems((prev) => [
      ...prev,
      makeLine({
        description: query,
        quantity: qty,
        unit_price: unitPrice ?? 0,
        product_id: null,
        barcode: inferredBarcode,
      }),
    ]);
    setQuickEntry('');
    focusQuickEntry();
  }, [findProductExact, findQuickMatches, quickCost, quickQuantity]);

  const handleQuickAdd = () => {
    addQuickEntryToken(quickEntry);
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const autoCreate = params.get('auto_create') === '1';
    const queryBarcode = (params.get('barcode') || '').trim();
    const intentBarcode = peekMissingProductIntent()?.barcode?.trim() || '';
    const barcode = queryBarcode || intentBarcode;

    if (!barcode) return;

    addQuickEntryToken(barcode);
    clearMissingProductIntent();

    if (autoCreate) {
      navigate('/receive', { replace: true });
    }
  }, [location.search, navigate, addQuickEntryToken]);

  const parseBulkRows = (input: string): ReceiveLine[] => {
    const rows = input
      .split(/\r?\n/)
      .map((row) => row.trim())
      .filter(Boolean);

    if (rows.length === 0) return [];

    const first = rows[0].toLowerCase();
    const hasHeader =
      first.includes('qty') ||
      first.includes('quantity') ||
      first.includes('price') ||
      first.includes('description') ||
      first.includes('item');

    const dataRows = hasHeader ? rows.slice(1) : rows;

    const parsed: ReceiveLine[] = [];

    for (const row of dataRows) {
      const cols = (row.includes('\t') ? row.split('\t') : row.split(',')).map((col) =>
        col.trim()
      );

      if (cols.length === 0) continue;

      const identifier = cols[0] || '';
      const qty = Math.max(0, parseNumber(cols[1] || '1', 1));
      if (!identifier || qty <= 0) continue;

      const price = Math.max(0, parseNumber(cols[2] || '0', 0));
      const category = cols[3] || '';
      const barcode = cols[4] || '';
      const sku = cols[5] || '';

      const matched =
        findProductExact(identifier) ||
        findProductExact(barcode) ||
        findProductExact(sku) ||
        products.find(
          (product) =>
            product.name.toLowerCase().includes(identifier.toLowerCase()) ||
            product.sku.toLowerCase() === identifier.toLowerCase() ||
            (product.barcode || '').toLowerCase() === identifier.toLowerCase()
        );

      if (matched) {
        parsed.push(
          makeLine({
            description: matched.name,
            quantity: qty,
            unit_price: price > 0 ? price : matched.cost_price || 0,
            product_id: matched.id,
            sku: matched.sku || undefined,
            barcode: matched.barcode || undefined,
            category: category || matched.category || '',
          })
        );
      } else {
        parsed.push(
          makeLine({
            description: identifier,
            quantity: qty,
            unit_price: price,
            product_id: null,
            category,
            barcode: barcode || undefined,
            sku: sku || undefined,
          })
        );
      }
    }

    return parsed;
  };

  const mergeLines = (base: ReceiveLine[], incoming: ReceiveLine[]): ReceiveLine[] => {
    if (incoming.length === 0) return base;

    const next = [...base];
    incoming.forEach((line) => {
      if (line.product_id) {
        const existingIndex = next.findIndex((item) => item.product_id === line.product_id);
        if (existingIndex >= 0) {
          next[existingIndex] = {
            ...next[existingIndex],
            quantity: next[existingIndex].quantity + line.quantity,
            unit_price: line.unit_price > 0 ? line.unit_price : next[existingIndex].unit_price,
          };
          return;
        }
      }
      next.push(line);
    });

    return next;
  };

  const handleImportBulk = () => {
    const parsed = parseBulkRows(bulkText);
    if (parsed.length === 0) {
      setError('No valid rows found in pasted data.');
      return;
    }

    setItems((prev) => mergeLines(prev, parsed));
    setBulkText('');
    setShowBulkModal(false);
  };

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

      const response = await vendorService.createVendor(payload);
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
    const opened = printProductLabels(labels, {
      title: `Invoice Labels - ${invoice.invoice_number || 'Invoice'}`,
      copiesPerProduct: copies,
      showPrice: includePriceOnLabels,
      footerText: `${currentOutlet?.name || 'Compazz'} • ${labelPrinterRuntime.printer?.name || 'Label Printer'}`,
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
    const opened = printProductLabels(lastPrintedLabels, {
      title: `Receive Labels - ${receiveResult?.invoice_number || 'Invoice'}`,
      copiesPerProduct: copies,
      showPrice: includePriceOnLabels,
      footerText: `${currentOutlet?.name || 'Compazz'} • ${labelPrinterRuntime.printer?.name || 'Label Printer'}`,
    });

    if (!opened) {
      setError('Allow pop-ups to print product labels.');
    }
  };

  const handleReceive = async () => {
    if (!currentOutlet?.id) return;

    const validItems = items
      .filter((item) => item.description.trim() && item.quantity > 0)
      .map((item) => {
        const { lineId, ...invoiceItem } = item;
        void lineId;
        return invoiceItem as InvoiceItem;
      });

    if (validItems.length === 0) {
      setError('Add at least one valid line item before receiving.');
      return;
    }

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
        notes,
        items: validItems,
      });

      const result = await invoiceService.receiveGoods(invoice.id, {
        addToInventory: true,
        updateCostPrices: true,
      });

      const byProductId = new Map(
        validItems
          .filter((item) => !!item.product_id)
          .map((item) => [item.product_id as string, item])
      );
      const byName = new Map(
        validItems.map((item) => [item.description.trim().toLowerCase(), item])
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
            price: source?.unit_price,
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
            price: source?.unit_price,
          };
        }),
      ].filter((label) => label.name.trim().length > 0);

      setLastPrintedLabels(printedLabels);
      setReceiveResult(result);
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

  const resetForm = () => {
    setStep('entry');
    setSelectedVendorId('');
    setInvoiceNumber('');
    setInvoiceDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setItems([]);
    setReceiveResult(null);
    setLastPrintedLabels([]);
    setError('');
    setQuickEntry('');
    setQuickQuantity('1');
    setQuickCost('');
    setLabelCopies('1');
    setIncludePriceOnLabels(true);
    setLineSearchTargetId(null);
    setLineProductSearch('');
    setSelectedHistoryInvoice(null);
    setHistoryLoadingInvoiceId(null);
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-stone-50">
      <div className="max-w-[1440px] mx-auto px-4 lg:px-6 py-5 lg:py-6">
        <div className="space-y-4">
          <div className="rounded-2xl border border-stone-200 bg-white px-4 lg:px-5 py-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-slate-900 text-stone-100 flex items-center justify-center">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h1 className="text-xl lg:text-2xl font-semibold text-slate-900">Receive Items</h1>
                  <p className="text-sm text-stone-500">
                    Fast receiving for supplier invoices, barcode scans, and bulk rows.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowHistory((prev) => !prev)}
                  className="px-4 py-2.5 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-sm font-medium text-slate-700 flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  {showHistory ? 'Hide History' : 'History'}
                </button>

                {step !== 'done' && (
                  <button
                    onClick={resetForm}
                    className="px-4 py-2.5 rounded-xl border border-stone-300 bg-stone-100 hover:bg-stone-200 text-sm font-medium text-slate-700"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

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
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
                <div className="xl:col-span-2 rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3">
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
                  </div>
                </div>

                <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
                  <h2 className="text-xs font-semibold tracking-[0.14em] uppercase text-stone-500 mb-3">
                    Fast Receive
                  </h2>

                  <div className="space-y-2">
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
                              handleQuickAdd();
                            }
                          }}
                          placeholder="Scan barcode/SKU or type name (optional xQty, e.g. 123456 x6)"
                          className="w-full px-2 py-3 bg-transparent text-sm text-slate-800 focus:outline-none"
                        />
                        <button
                          onClick={handleQuickAdd}
                          className="px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-xs font-semibold"
                        >
                          Add
                        </button>
                      </div>

                      {quickToken.identifier.trim().length > 0 && quickMatches.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-xl border border-stone-200 bg-white shadow-lg max-h-56 overflow-y-auto">
                          {quickMatches.map((product) => (
                            <button
                              key={product.id}
                              onClick={() => {
                                upsertLineFromProduct(
                                  product,
                                  getQuickQuantity(quickToken.quantity),
                                  getQuickUnitPrice()
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

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-1">Quick Qty</label>
                        <input
                          type="number"
                          min="1"
                          value={quickQuantity}
                          onChange={(event) => setQuickQuantity(event.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-medium text-stone-500 mb-1">Quick Cost (optional)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={quickCost}
                          onChange={(event) => setQuickCost(event.target.value)}
                          className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-300"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      onClick={addBlankLine}
                      className="px-3 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Blank Row
                    </button>
                    <button
                      onClick={() => setShowBulkModal(true)}
                      className="px-3 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-medium text-slate-700 inline-flex items-center justify-center gap-1.5"
                    >
                      <ClipboardPaste className="w-3.5 h-3.5" />
                      Paste Table
                    </button>
                  </div>

                  <div className="mt-3 rounded-xl border border-stone-200 bg-stone-50 px-3 py-2.5 text-xs text-stone-600">
                    Tip: Scan continuously and press Enter. You can also append quantity like `x6`, or paste rows from Excel/Sheets.
                  </div>
                </div>
              </div>

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
                      Scan/search inventory or paste rows to begin receiving.
                    </p>
                  </div>
                ) : (
                  <div className="overflow-auto max-h-[52vh]">
                    <table className="w-full min-w-[980px] text-sm">
                      <thead className="sticky top-0 z-10 bg-stone-100 text-stone-600 text-[11px] uppercase tracking-wide">
                        <tr>
                          <th className="px-3 py-2 text-left w-10">#</th>
                          <th className="px-3 py-2 text-left min-w-[300px]">Item Description</th>
                          <th className="px-3 py-2 text-left min-w-[160px]">Inventory Link</th>
                          <th className="px-3 py-2 text-left min-w-[120px]">Category</th>
                          <th className="px-3 py-2 text-right w-24">Qty</th>
                          <th className="px-3 py-2 text-right w-36">Cost Price</th>
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
                                value={line.description}
                                onChange={(event) =>
                                  updateLine(line.lineId, 'description', event.target.value)
                                }
                                placeholder="Item name or description"
                                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
                            </td>

                            <td className="px-3 py-2 relative">
                              {line.product_id ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium">
                                  <Check className="w-3.5 h-3.5" /> Linked
                                  <button
                                    onClick={() => updateLine(line.lineId, 'product_id', null)}
                                    className="hover:text-red-600"
                                    title="Unlink product"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </span>
                              ) : (
                                <button
                                  onClick={() => {
                                    setLineSearchTargetId(line.lineId);
                                    setLineProductSearch('');
                                  }}
                                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-medium text-slate-700 hover:bg-stone-100"
                                >
                                  <Search className="w-3.5 h-3.5" /> Search
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
                                  <div className="absolute left-0 top-full mt-1 w-80 rounded-xl border border-stone-200 bg-white shadow-xl z-30 p-2">
                                    <input
                                      value={lineProductSearch}
                                      onChange={(event) => setLineProductSearch(event.target.value)}
                                      placeholder="Search product by name, barcode, sku"
                                      className="w-full px-2.5 py-2 rounded-lg border border-stone-300 text-xs focus:outline-none focus:ring-2 focus:ring-slate-300"
                                      autoFocus
                                    />
                                    <div className="max-h-44 overflow-y-auto mt-1">
                                      {lineProductSearch.trim().length > 0 && lineSearchMatches.length === 0 && (
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
                              <input
                                value={line.category || ''}
                                onChange={(event) =>
                                  updateLine(line.lineId, 'category', event.target.value)
                                }
                                placeholder="Category"
                                className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
                              />
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

                            <td className="px-3 py-2 text-right font-semibold text-slate-800">
                              {formatCurrency(line.quantity * line.unit_price)}
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
                    <div
                      key={invoice.id}
                      className="px-4 lg:px-5 py-3 flex flex-wrap items-center justify-between gap-2 text-sm"
                    >
                      <div>
                        <p className="font-medium text-slate-900">{invoice.invoice_number}</p>
                        <p className="text-xs text-stone-500">{invoice.issue_date}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-stone-500">{invoice.status}</span>
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
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {selectedHistoryInvoice && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-stone-200 bg-white shadow-2xl overflow-hidden">
            <div className="px-5 py-4 border-b border-stone-200 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  Invoice {selectedHistoryInvoice.invoice_number}
                </h3>
                <p className="text-sm text-stone-500 mt-0.5">
                  {selectedHistoryInvoice.issue_date} • {selectedHistoryInvoice.status} •{' '}
                  {formatCurrency(selectedHistoryInvoice.total)}
                </p>
              </div>
              <button
                onClick={() => setSelectedHistoryInvoice(null)}
                className="text-stone-500 hover:text-slate-900"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[58vh]">
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
                            {formatCurrency(item.quantity * item.unit_price)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
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
      )}

      {showBulkModal && (
        <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl rounded-2xl border border-stone-200 bg-white shadow-2xl">
            <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Paste Rows from Spreadsheet</h3>
                <p className="text-xs text-stone-500 mt-0.5">
                  Format: Item/Barcode, Qty, Cost, Category (optional), Barcode (optional), SKU (optional)
                </p>
              </div>
              <button onClick={() => setShowBulkModal(false)} className="text-stone-500 hover:text-slate-900">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5">
              <textarea
                value={bulkText}
                onChange={(event) => setBulkText(event.target.value)}
                placeholder={`Item Name\tQty\tCost\tCategory\n1234567890123\t12\t950\tBeverages\nSKU-001\t4\t2800\tGroceries`}
                className="w-full min-h-[220px] rounded-xl border border-stone-300 bg-white px-3 py-3 text-sm text-slate-800 font-mono focus:outline-none focus:ring-2 focus:ring-slate-300"
              />
            </div>

            <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-end gap-2">
              <button
                onClick={() => setShowBulkModal(false)}
                className="px-4 py-2.5 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-sm font-medium text-slate-700"
              >
                Cancel
              </button>
              <button
                onClick={handleImportBulk}
                className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold"
              >
                Import Rows
              </button>
            </div>
          </div>
        </div>
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
