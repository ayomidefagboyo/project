import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  ClipboardList,
  Loader2,
  RefreshCw,
  Truck,
  X,
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import {
  posService,
  type PurchasingAnalyticsResponse,
  type PurchasingMode,
  type PurchasingRecommendationsResponse,
} from '@/lib/posService';
import { invoiceService, type Invoice } from '@/lib/invoiceService';
import { useToast } from '@/components/ui/Toast';

type ReceivePaymentStatus = 'paid' | 'unpaid';

interface ReceiveLineDraft {
  item_id: string;
  description: string;
  ordered_quantity: number;
  remaining_quantity: number;
  receive_quantity: number;
  cost_price: number;
}

const todayIsoDate = (): string => new Date().toISOString().split('T')[0];

const formatCurrency = (value: number): string =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value || 0));

const formatDateTime = (value?: string | null): string => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const PurchasingPage: React.FC = () => {
  const { currentOutlet } = useOutlet();
  const { success, error: showError, warning } = useToast();

  const [mode, setMode] = useState<PurchasingMode>('all');
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [recommendations, setRecommendations] = useState<PurchasingRecommendationsResponse | null>(null);
  const [analytics, setAnalytics] = useState<PurchasingAnalyticsResponse | null>(null);
  const [selectedByProductId, setSelectedByProductId] = useState<Record<string, boolean>>({});
  const [draftQtyByProductId, setDraftQtyByProductId] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<string | null>(null);
  const [receiveInvoice, setReceiveInvoice] = useState<Invoice | null>(null);
  const [receiveLines, setReceiveLines] = useState<ReceiveLineDraft[]>([]);
  const [receivePaymentStatus, setReceivePaymentStatus] = useState<ReceivePaymentStatus>('paid');
  const [receivePaymentDate, setReceivePaymentDate] = useState(todayIsoDate());
  const [isReceiving, setIsReceiving] = useState(false);
  const isMountedRef = useRef(true);
  const requestSequenceRef = useRef(0);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      requestSequenceRef.current += 1;
    };
  }, []);

  const loadPurchasingData = async () => {
    const activeOutletId = currentOutlet?.id;
    const requestId = requestSequenceRef.current + 1;
    requestSequenceRef.current = requestId;

    if (!activeOutletId) {
      if (!isMountedRef.current) return;
      setRecommendations(null);
      setAnalytics(null);
      setSelectedByProductId({});
      setDraftQtyByProductId({});
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const [recommendationResponse, analyticsResponse] = await Promise.all([
        posService.getPurchasingRecommendations(activeOutletId, {
          mode,
          department: selectedDepartment || undefined,
          vendorId: selectedVendorId || undefined,
        }),
        posService.getPurchasingAnalytics(activeOutletId),
      ]);

      if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
        return;
      }

      setRecommendations(recommendationResponse);
      setAnalytics(analyticsResponse);
      setSelectedByProductId((prev) => {
        const next: Record<string, boolean> = {};
        for (const item of recommendationResponse.items) {
          if (prev[item.product_id]) {
            next[item.product_id] = true;
          }
        }
        return next;
      });
      setDraftQtyByProductId((prev) => {
        const next: Record<string, number> = {};
        for (const item of recommendationResponse.items) {
          const existingQty = prev[item.product_id];
          next[item.product_id] = Math.max(1, Number.isFinite(existingQty) ? existingQty : Math.max(1, item.recommended_qty || 1));
        }
        return next;
      });
    } catch (err) {
      if (!isMountedRef.current || requestSequenceRef.current !== requestId) {
        return;
      }
      console.error('Failed to load purchasing data:', err);
      showError('Failed to load purchasing recommendations.');
      setRecommendations(null);
      setAnalytics(null);
    } finally {
      if (isMountedRef.current && requestSequenceRef.current === requestId) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadPurchasingData();
  }, [currentOutlet?.id, mode, selectedDepartment, selectedVendorId]);

  const recommendationItems = recommendations?.items || [];
  const summary = recommendations?.summary || analytics?.summary || null;

  const departmentOptions = useMemo(() => {
    const source = analytics?.department_summary || recommendations?.department_summary || [];
    return source.map((entry) => entry.department);
  }, [analytics?.department_summary, recommendations?.department_summary]);

  const vendorOptions = useMemo(() => {
    const source = analytics?.vendor_summary || recommendations?.vendor_summary || [];
    return source
      .filter((entry) => entry.vendor_id || entry.vendor_name)
      .map((entry) => ({
        id: String(entry.vendor_id || ''),
        name: entry.vendor_name,
      }));
  }, [analytics?.vendor_summary, recommendations?.vendor_summary]);

  const selectedLines = useMemo(() => {
    return recommendationItems
      .filter((item) => selectedByProductId[item.product_id])
      .map((item) => ({
        ...item,
        draft_quantity: Math.max(1, Math.floor(draftQtyByProductId[item.product_id] || item.recommended_qty || 1)),
      }))
      .filter((item) => item.draft_quantity > 0);
  }, [draftQtyByProductId, recommendationItems, selectedByProductId]);

  const selectedLineCount = selectedLines.length;
  const selectedUnits = selectedLines.reduce((sum, item) => sum + item.draft_quantity, 0);
  const selectedCost = selectedLines.reduce((sum, item) => sum + (item.draft_quantity * Number(item.cost_price || 0)), 0);

  const draftPurchaseOrders = useMemo(() => {
    const orders = recommendations?.draft_purchase_orders || analytics?.draft_purchase_orders || [];
    if (!selectedVendorId) return orders;
    return orders.filter((order) => String(order.vendor_id || '') === selectedVendorId);
  }, [analytics?.draft_purchase_orders, recommendations?.draft_purchase_orders, selectedVendorId]);

  const toggleSelect = (productId: string) => {
    setSelectedByProductId((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  const toggleSelectAllVisible = () => {
    const selectable = recommendationItems.filter((item) => Number(item.recommended_qty || 0) > 0);
    if (selectable.length === 0) {
      warning('No recommended lines available to select.');
      return;
    }
    const allSelected = selectable.every((item) => selectedByProductId[item.product_id]);
    setSelectedByProductId((prev) => {
      const next = { ...prev };
      for (const item of selectable) {
        next[item.product_id] = !allSelected;
      }
      return next;
    });
  };

  const updateDraftQuantity = (productId: string, quantity: number) => {
    setDraftQtyByProductId((prev) => ({
      ...prev,
      [productId]: Math.max(1, Math.floor(quantity || 1)),
    }));
  };

  const handleCreateDraftPurchaseOrders = async () => {
    if (!currentOutlet?.id) {
      warning('Select an outlet first.');
      return;
    }
    if (selectedLines.length === 0) {
      warning('Select at least one recommendation line.');
      return;
    }

    setIsCreating(true);
    try {
      const result = await posService.createDraftPurchaseOrders({
        outlet_id: currentOutlet.id,
        source: mode === 'all' ? 'replenishment' : mode,
        department: selectedDepartment || undefined,
        lines: selectedLines.map((item) => ({
          product_id: item.product_id,
          quantity: item.draft_quantity,
          vendor_id: item.vendor_id || undefined,
          unit_cost: Number(item.cost_price || 0),
        })),
      });

      success(result.message || 'Draft purchase orders created.');
      setSelectedByProductId({});
      await loadPurchasingData();
    } catch (err) {
      console.error('Failed to create purchase orders:', err);
      showError(err instanceof Error ? err.message : 'Failed to create purchase orders.');
    } finally {
      setIsCreating(false);
    }
  };

  const openReceiveModal = async (invoiceId: string) => {
    setLoadingInvoiceId(invoiceId);
    try {
      const invoice = await invoiceService.getInvoice(invoiceId);
      if (!invoice) {
        throw new Error('Unable to load purchase order.');
      }

      const openLines = (invoice.invoice_items || [])
        .map((item) => {
          const remaining = Number(item.remaining_quantity ?? item.quantity ?? 0);
          return {
            item_id: String(item.id || ''),
            description: item.description || 'Item',
            ordered_quantity: Number(item.quantity || 0),
            remaining_quantity: Math.max(0, remaining),
            receive_quantity: Math.max(0, remaining),
            cost_price: Number(item.unit_price || 0),
          };
        })
        .filter((item) => item.item_id && item.remaining_quantity > 0);

      if (openLines.length === 0) {
        warning('This purchase order has no remaining quantities to receive.');
        await loadPurchasingData();
        return;
      }

      setReceiveInvoice(invoice);
      setReceiveLines(openLines);
      setReceivePaymentStatus((invoice.payment_status === 'unpaid' ? 'unpaid' : 'paid'));
      setReceivePaymentDate(invoice.payment_date || todayIsoDate());
    } catch (err) {
      console.error('Failed to open purchase order for receiving:', err);
      showError(err instanceof Error ? err.message : 'Failed to load purchase order.');
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const closeReceiveModal = () => {
    if (isReceiving) return;
    setReceiveInvoice(null);
    setReceiveLines([]);
    setReceivePaymentStatus('paid');
    setReceivePaymentDate(todayIsoDate());
  };

  const updateReceiveLine = (itemId: string, field: 'receive_quantity' | 'cost_price', value: number) => {
    setReceiveLines((prev) => prev.map((line) => {
      if (line.item_id !== itemId) return line;
      if (field === 'receive_quantity') {
        const nextQty = Math.max(0, Math.min(line.remaining_quantity, Number(value || 0)));
        return { ...line, receive_quantity: nextQty };
      }
      return { ...line, cost_price: Math.max(0, Number(value || 0)) };
    }));
  };

  const handleReceivePurchaseOrder = async () => {
    if (!receiveInvoice?.id) return;

    const linesToReceive = receiveLines.filter((line) => Number(line.receive_quantity || 0) > 0);
    if (linesToReceive.length === 0) {
      warning('Set at least one quantity to receive.');
      return;
    }
    if (receivePaymentStatus === 'unpaid' && !receivePaymentDate) {
      warning('Choose a payment date for unpaid invoices.');
      return;
    }

    setIsReceiving(true);
    try {
      const result = await invoiceService.receiveGoods(receiveInvoice.id, {
        paymentStatus: receivePaymentStatus,
        paymentDate: receivePaymentStatus === 'unpaid' ? receivePaymentDate : undefined,
        itemsReceived: linesToReceive.map((line) => ({
          item_id: line.item_id,
          quantity: line.receive_quantity,
          cost_price: line.cost_price,
        })),
      });

      success(result.message || 'Purchase order received.');
      closeReceiveModal();
      await loadPurchasingData();
    } catch (err) {
      console.error('Failed to receive purchase order:', err);
      showError(err instanceof Error ? err.message : 'Failed to receive purchase order.');
    } finally {
      setIsReceiving(false);
    }
  };

  const topDepartment = analytics?.department_summary?.[0];
  const topVendor = analytics?.vendor_summary?.[0];

  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <div className="mx-auto w-full max-w-7xl px-4 py-4 sm:px-6 sm:py-6">
        <div className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Recommended Items</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-xl font-semibold text-slate-900">{summary?.recommended_items || 0}</p>
                  <p className="text-xs text-stone-500">{summary?.total_recommended_units || 0} units</p>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">need action now</p>
              </div>
              <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Selection</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">
                  {selectedLineCount} lines • {selectedUnits} units
                </p>
                <p className="mt-0.5 text-xs text-stone-500">{formatCurrency(selectedCost)} draft PO value</p>
              </div>
            </div>

            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                onClick={() => void loadPurchasingData()}
                disabled={isLoading}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleCreateDraftPurchaseOrders}
                disabled={isCreating || selectedLineCount === 0}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isCreating ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
                Create Draft POs
              </button>
            </div>
          </div>

          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Mode</span>
              <select
                value={mode}
                onChange={(event) => setMode(event.target.value as PurchasingMode)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="all">All Signals</option>
                <option value="low_stock">Low Stock</option>
                <option value="fast_movers">Fast Movers</option>
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Department</span>
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="">All Departments</option>
                {departmentOptions.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500">Vendor</span>
              <select
                value={selectedVendorId}
                onChange={(event) => setSelectedVendorId(event.target.value)}
                className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
              >
                <option value="">All Vendors</option>
                {vendorOptions.map((vendor) => (
                  <option key={`${vendor.id}-${vendor.name}`} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-[1.5fr_1fr] xl:items-start">
          <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
            <div className="flex flex-col gap-3 border-b border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Recommendation Queue</h3>
                <p className="text-sm text-stone-500">Select items, adjust order quantities, then generate vendor-grouped draft POs.</p>
              </div>
              <button
                type="button"
                onClick={toggleSelectAllVisible}
                className="inline-flex items-center justify-center rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-stone-100"
              >
                Toggle All
              </button>
            </div>

            {isLoading ? (
              <div className="flex h-[32rem] items-center justify-center gap-3 px-6 text-sm text-stone-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading purchasing recommendations...
              </div>
            ) : recommendationItems.length === 0 ? (
              <div className="flex h-[32rem] items-center justify-center px-6 text-center text-sm text-stone-500">
                No replenishment lines match the current filters.
              </div>
            ) : (
              <>
                <div className="hidden max-h-[32rem] overflow-auto lg:block">
                  <table className="min-w-full divide-y divide-stone-200 text-sm">
                    <thead className="bg-stone-50 text-xs uppercase tracking-[0.12em] text-stone-500">
                      <tr>
                        <th className="px-4 py-3 text-left">Pick</th>
                        <th className="px-4 py-3 text-left">Item</th>
                        <th className="px-4 py-3 text-left">Vendor</th>
                        <th className="px-4 py-3 text-left">Stock</th>
                        <th className="px-4 py-3 text-left">Velocity</th>
                        <th className="px-4 py-3 text-left">Order Qty</th>
                        <th className="px-4 py-3 text-left">Est. Cost</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {recommendationItems.map((item) => {
                        const selected = Boolean(selectedByProductId[item.product_id]);
                        const draftQty = Math.max(1, Math.floor(draftQtyByProductId[item.product_id] || item.recommended_qty || 1));
                        const rowClass = item.stockout_risk
                          ? 'bg-red-50'
                          : item.is_low_stock
                            ? 'bg-amber-50'
                            : 'bg-white';

                        return (
                          <tr key={item.product_id} className={rowClass}>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="checkbox"
                                checked={selected}
                                onChange={() => toggleSelect(item.product_id)}
                                className="mt-1 h-4 w-4 rounded border-stone-300"
                              />
                            </td>
                            <td className="px-4 py-3 align-top">
                              <div className="font-medium text-slate-900">{item.name}</div>
                              <div className="mt-1 text-xs text-stone-500">
                                {item.sku} • {item.department}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-1.5">
                                {item.reason_codes.slice(0, 3).map((reason) => (
                                  <span
                                    key={`${item.product_id}-${reason}`}
                                    className="rounded-full bg-stone-100 px-2 py-0.5 text-[11px] font-medium text-stone-600"
                                  >
                                    {reason.replace(/_/g, ' ')}
                                  </span>
                                ))}
                              </div>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">{item.vendor_name}</td>
                            <td className="px-4 py-3 align-top text-slate-700">
                              <div>On hand: {item.quantity_on_hand}</div>
                              <div className="text-xs text-stone-500">On order: {item.on_order_qty}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">
                              <div>{item.qty_sold_period} sold</div>
                              <div className="text-xs text-stone-500">{item.avg_daily_sales}/day</div>
                            </td>
                            <td className="px-4 py-3 align-top">
                              <input
                                type="number"
                                min={1}
                                value={draftQty}
                                onChange={(event) => updateDraftQuantity(item.product_id, Number(event.target.value))}
                                className="w-24 rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
                              />
                              <div className="mt-1 text-xs text-stone-500">Suggested: {item.recommended_qty}</div>
                            </td>
                            <td className="px-4 py-3 align-top text-slate-700">
                              {formatCurrency(draftQty * Number(item.cost_price || 0))}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="max-h-[32rem] space-y-3 overflow-y-auto p-4 lg:hidden">
                  {recommendationItems.map((item) => {
                    const selected = Boolean(selectedByProductId[item.product_id]);
                    const draftQty = Math.max(1, Math.floor(draftQtyByProductId[item.product_id] || item.recommended_qty || 1));
                    return (
                      <div
                        key={item.product_id}
                        className={`rounded-2xl border p-4 ${
                          item.stockout_risk ? 'border-red-200 bg-red-50' : item.is_low_stock ? 'border-amber-200 bg-amber-50' : 'border-stone-200 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={() => toggleSelect(item.product_id)}
                            className="mt-1 h-4 w-4 rounded border-stone-300"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-slate-900">{item.name}</div>
                            <div className="mt-1 text-xs text-stone-500">
                              {item.vendor_name} • {item.department}
                            </div>
                            <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-stone-600">
                              <div>On hand: {item.quantity_on_hand}</div>
                              <div>On order: {item.on_order_qty}</div>
                              <div>Sold: {item.qty_sold_period}</div>
                              <div>Cover: {item.days_of_cover ?? 'N/A'} days</div>
                            </div>
                            <div className="mt-3 flex items-center gap-2">
                              <input
                                type="number"
                                min={1}
                                value={draftQty}
                                onChange={(event) => updateDraftQuantity(item.product_id, Number(event.target.value))}
                                className="w-24 rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
                              />
                              <span className="text-xs text-stone-500">
                                Suggested {item.recommended_qty}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>

          <div className="space-y-6">
            <section className="rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold text-slate-900">Action Focus</h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Top Department</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{topDepartment?.department || 'None'}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {topDepartment ? `${topDepartment.recommended_units} units • ${formatCurrency(topDepartment.estimated_cost)}` : 'No current demand'}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Top Vendor Exposure</p>
                  <p className="mt-2 text-base font-semibold text-slate-900">{topVendor?.vendor_name || 'None'}</p>
                  <p className="mt-1 text-sm text-stone-500">
                    {topVendor ? `${topVendor.recommended_units} units • ${formatCurrency(topVendor.estimated_cost)}` : 'No vendor exposure'}
                  </p>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-stone-200 bg-white shadow-sm">
              <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Open Purchase Orders</h3>
                  <p className="text-sm text-stone-500">Receive remaining quantities and keep open balances visible.</p>
                </div>
              </div>

              <div className="divide-y divide-stone-200">
                {draftPurchaseOrders.length === 0 ? (
                  <div className="px-5 py-10 text-center text-sm text-stone-500">
                    No open purchase orders for the current scope.
                  </div>
                ) : (
                  draftPurchaseOrders.map((order) => (
                    <div key={order.id} className="px-5 py-4">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="font-medium text-slate-900">{order.invoice_number}</div>
                          <div className="mt-1 text-sm text-stone-500">
                            {order.vendor_name} • {order.remaining_lines} open line{order.remaining_lines === 1 ? '' : 's'}
                          </div>
                          <div className="mt-2 text-xs text-stone-500">
                            Created {formatDateTime(order.created_at || order.issue_date)}
                          </div>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                          <div className="text-right">
                            <div className="text-sm font-semibold text-slate-900">{order.remaining_units} units</div>
                            <div className="text-xs text-stone-500">{formatCurrency(order.remaining_value)}</div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void openReceiveModal(order.id)}
                            disabled={loadingInvoiceId === order.id}
                            className="inline-flex items-center gap-2 rounded-xl border border-stone-300 px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {loadingInvoiceId === order.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Truck className="h-4 w-4" />}
                            Receive
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        </div>
      </div>

      {receiveInvoice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 px-5 py-4">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Receive {receiveInvoice.invoice_number}</h3>
                <p className="text-sm text-stone-500">
                  Receive partial or full quantities and keep the purchase order open until all lines are completed.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReceiveModal}
                className="rounded-xl p-2 text-stone-500 transition hover:bg-stone-100 hover:text-slate-900"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="max-h-[70vh] overflow-y-auto px-5 py-4">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Vendor</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {typeof receiveInvoice.vendors === 'object' && receiveInvoice.vendors && 'name' in receiveInvoice.vendors
                      ? String((receiveInvoice.vendors as Record<string, unknown>).name || 'Vendor')
                      : receiveInvoice.vendor_id || 'Vendor'}
                  </p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Open Lines</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">{receiveLines.length}</p>
                </div>
                <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Outstanding</p>
                  <p className="mt-2 text-sm font-semibold text-slate-900">
                    {formatCurrency(receiveLines.reduce((sum, line) => sum + (line.remaining_quantity * line.cost_price), 0))}
                  </p>
                </div>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Payment Status</span>
                  <select
                    value={receivePaymentStatus}
                    onChange={(event) => setReceivePaymentStatus(event.target.value as ReceivePaymentStatus)}
                    className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500"
                  >
                    <option value="paid">Paid</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </label>

                {receivePaymentStatus === 'unpaid' && (
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-semibold uppercase tracking-[0.12em] text-stone-500">Payment Date</span>
                    <input
                      type="date"
                      value={receivePaymentDate}
                      onChange={(event) => setReceivePaymentDate(event.target.value)}
                      className="w-full rounded-2xl border border-stone-300 bg-white px-3 py-2.5 text-sm text-slate-700 outline-none focus:border-slate-500"
                    />
                  </label>
                )}
              </div>

              <div className="mt-5 space-y-3">
                {receiveLines.map((line) => (
                  <div key={line.item_id} className="rounded-2xl border border-stone-200 p-4">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-slate-900">{line.description}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          Ordered {line.ordered_quantity} • Remaining {line.remaining_quantity}
                        </div>
                      </div>
                      <div className="grid w-full gap-3 sm:grid-cols-2 lg:w-auto lg:min-w-[320px]">
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-stone-500">Receive Qty</span>
                          <input
                            type="number"
                            min={0}
                            max={line.remaining_quantity}
                            value={line.receive_quantity}
                            onChange={(event) => updateReceiveLine(line.item_id, 'receive_quantity', Number(event.target.value))}
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
                          />
                        </label>
                        <label className="block">
                          <span className="mb-1 block text-xs font-medium text-stone-500">Unit Cost</span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={line.cost_price}
                            onChange={(event) => updateReceiveLine(line.item_id, 'cost_price', Number(event.target.value))}
                            className="w-full rounded-xl border border-stone-300 px-3 py-2 text-sm text-slate-700 outline-none focus:border-slate-500"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  <p>
                    The invoice stays open until every line has zero remaining quantity. This keeps open purchase commitments
                    visible in the recommendation engine.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-stone-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-stone-500">
                Receiving {receiveLines.filter((line) => line.receive_quantity > 0).length} line(s) in this batch.
              </div>
              <div className="flex flex-col gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={closeReceiveModal}
                  disabled={isReceiving}
                  className="rounded-2xl border border-stone-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-stone-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleReceivePurchaseOrder}
                  disabled={isReceiving}
                  className="inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isReceiving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Receive Batch
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PurchasingPage;
