import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, RefreshCw, Search } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, type POSProduct } from '@/lib/posService';
import { useToast } from '@/components/ui/Toast';

interface StocktakeEdit {
  counted_quantity: number;
  reason: string;
  notes: string;
}

const stocktakeReasons = [
  'Cycle count correction',
  'Damaged or expired items',
  'Shrinkage or theft',
  'Supplier short delivery',
  'Receiving overage',
  'Other',
];

const StocktakingPage: React.FC = () => {
  const { currentOutlet, currentUser } = useOutlet();
  const { success, error: showError, warning } = useToast();

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [edits, setEdits] = useState<Record<string, StocktakeEdit>>({});
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const activeStaffId = useMemo(() => {
    try {
      const raw = localStorage.getItem('pos_staff_session');
      if (!raw) return currentUser?.id || 'system';
      const parsed = JSON.parse(raw);
      return parsed?.staff_profile?.id || currentUser?.id || 'system';
    } catch {
      return currentUser?.id || 'system';
    }
  }, [currentUser?.id]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) return;

    setIsLoading(true);
    try {
      const cached = await posService.getCachedProducts(currentOutlet.id, {
        activeOnly: true,
        page: 1,
        size: 20000,
      });
      const hasCached = cached.items.length > 0;

      if (hasCached) {
        setProducts(cached.items);
        setIsLoading(false);
      }

      const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!isOnlineNow) {
        if (!hasCached) {
          showError('No local inventory cache yet. Connect once to sync products.');
        }
        return;
      }

      await posService.syncProductCatalog(currentOutlet.id, { forceFull: !hasCached });
      const refreshed = await posService.getCachedProducts(currentOutlet.id, {
        activeOnly: true,
        page: 1,
        size: 20000,
      });
      setProducts(refreshed.items);
    } catch (err) {
      console.error('Failed to load products for stocktaking:', err);
      showError('Failed to load inventory for stocktaking.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadProducts();
  }, [currentOutlet?.id]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return products.filter((product) => {
      const edit = edits[product.id];
      const countedQty = edit?.counted_quantity ?? product.quantity_on_hand;
      const hasChange = countedQty !== product.quantity_on_hand;

      if (onlyChanged && !hasChange) return false;

      if (!query) return true;
      const name = product.name?.toLowerCase() || '';
      const sku = product.sku?.toLowerCase() || '';
      const barcode = product.barcode?.toLowerCase() || '';
      return name.includes(query) || sku.includes(query) || barcode.includes(query);
    });
  }, [products, edits, onlyChanged, search]);

  const changedRows = useMemo(() => {
    return products
      .map((product) => {
        const edit = edits[product.id];
        const counted = edit?.counted_quantity ?? product.quantity_on_hand;
        const delta = counted - product.quantity_on_hand;

        return {
          product,
          counted,
          delta,
          reason: edit?.reason || '',
          notes: edit?.notes || '',
        };
      })
      .filter((row) => row.delta !== 0);
  }, [products, edits]);

  const netVariance = changedRows.reduce((sum, row) => sum + row.delta, 0);

  const updateEdit = (productId: string, patch: Partial<StocktakeEdit>) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setEdits((prev) => {
      const existing = prev[productId] || {
        counted_quantity: product.quantity_on_hand,
        reason: '',
        notes: '',
      };

      return {
        ...prev,
        [productId]: {
          ...existing,
          ...patch,
        },
      };
    });
  };

  const handleApplyStocktake = async () => {
    if (!currentOutlet?.id) return;

    if (changedRows.length === 0) {
      warning('No stock differences to reconcile.');
      return;
    }

    const rowMissingReason = changedRows.find((row) => !row.reason.trim());
    if (rowMissingReason) {
      warning(`Please select a reason for ${rowMissingReason.product.name}.`);
      return;
    }

    setIsSaving(true);
    try {
      await posService.applyStocktake({
        outlet_id: currentOutlet.id,
        performed_by: activeStaffId,
        items: changedRows.map((row) => ({
          product_id: row.product.id,
          current_quantity: row.product.quantity_on_hand,
          counted_quantity: row.counted,
          reason: row.reason,
          notes: row.notes,
          unit_cost: row.product.cost_price,
        })),
      });

      success(`Stocktake completed for ${changedRows.length} item${changedRows.length > 1 ? 's' : ''}.`);
      setEdits({});
      await loadProducts();
    } catch (err) {
      console.error('Stocktake failed:', err);
      showError('Stocktake failed. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-stone-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setOnlyChanged((prev) => !prev)}
                className={`h-12 px-4 rounded-xl border text-base font-semibold transition-colors ${
                  onlyChanged ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-700 border-stone-300 hover:bg-stone-100'
                }`}
              >
                {onlyChanged ? 'Showing Changes' : 'Show Changes Only'}
              </button>
              <button
                type="button"
                onClick={() => void loadProducts()}
                className="h-12 px-4 rounded-xl border border-stone-300 bg-white text-slate-700 hover:bg-stone-100 text-base font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-5 h-5" />
                Refresh
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm text-stone-500">Products in Outlet</div>
              <div className="text-3xl font-semibold text-slate-900 mt-1">{products.length}</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm text-stone-500">Items with Variance</div>
              <div className="text-3xl font-semibold text-slate-900 mt-1">{changedRows.length}</div>
            </div>
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm text-stone-500">Net Variance</div>
              <div className={`text-3xl font-semibold mt-1 ${netVariance > 0 ? 'text-emerald-700' : netVariance < 0 ? 'text-rose-700' : 'text-slate-900'}`}>
                {netVariance > 0 ? `+${netVariance}` : netVariance}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
          <div className="relative max-w-xl">
            <Search className="w-5 h-5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search product name, SKU, or barcode"
              className="w-full h-12 rounded-xl border border-stone-300 pl-11 pr-4 text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
            />
          </div>

          <div className="mt-4 border border-stone-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1100px] text-sm lg:text-base">
                <thead className="bg-stone-100 text-stone-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Product</th>
                    <th className="text-left font-semibold px-4 py-3">SKU</th>
                    <th className="text-right font-semibold px-4 py-3">System Qty</th>
                    <th className="text-right font-semibold px-4 py-3">Counted Qty</th>
                    <th className="text-right font-semibold px-4 py-3">Variance</th>
                    <th className="text-left font-semibold px-4 py-3">Reason</th>
                    <th className="text-left font-semibold px-4 py-3">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {isLoading && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-stone-500">Loading stock items...</td>
                    </tr>
                  )}

                  {!isLoading && visibleProducts.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-stone-500">
                        {products.length === 0 ? 'No products found for this outlet.' : 'No products match your filter.'}
                      </td>
                    </tr>
                  )}

                  {!isLoading && visibleProducts.map((product) => {
                    const edit = edits[product.id];
                    const countedQty = edit?.counted_quantity ?? product.quantity_on_hand;
                    const variance = countedQty - product.quantity_on_hand;
                    const isChanged = variance !== 0;

                    return (
                      <tr key={product.id} className={isChanged ? 'bg-amber-50/40' : 'bg-white'}>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{product.name}</div>
                          {product.barcode && <div className="text-xs text-stone-500">{product.barcode}</div>}
                        </td>
                        <td className="px-4 py-3 text-stone-600">{product.sku}</td>
                        <td className="px-4 py-3 text-right font-semibold text-slate-900">{product.quantity_on_hand}</td>
                        <td className="px-4 py-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={countedQty}
                            onChange={(event) => {
                              const nextValue = Number(event.target.value);
                              updateEdit(product.id, {
                                counted_quantity: Number.isFinite(nextValue) && nextValue >= 0 ? Math.floor(nextValue) : 0,
                              });
                            }}
                            className="w-28 h-11 rounded-lg border border-stone-300 px-3 text-right font-semibold focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          />
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${variance > 0 ? 'text-emerald-700' : variance < 0 ? 'text-rose-700' : 'text-stone-500'}`}>
                          {variance > 0 ? `+${variance}` : variance}
                        </td>
                        <td className="px-4 py-3">
                          <select
                            value={edit?.reason || ''}
                            onChange={(event) => updateEdit(product.id, { reason: event.target.value })}
                            className="w-full h-11 rounded-lg border border-stone-300 px-3 text-sm lg:text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          >
                            <option value="">Select reason</option>
                            {stocktakeReasons.map((reason) => (
                              <option key={reason} value={reason}>{reason}</option>
                            ))}
                          </select>
                        </td>
                        <td className="px-4 py-3">
                          <input
                            type="text"
                            value={edit?.notes || ''}
                            onChange={(event) => updateEdit(product.id, { notes: event.target.value })}
                            placeholder="Optional note"
                            className="w-full h-11 rounded-lg border border-stone-300 px-3 text-sm lg:text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="sticky bottom-0 z-20">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div className="flex items-center gap-2 text-sm lg:text-base">
              {changedRows.length === 0 ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <span className="text-stone-600">No stock differences pending.</span>
                </>
              ) : (
                <>
                  <AlertTriangle className="w-5 h-5 text-amber-600" />
                  <span className="text-stone-700 font-medium">{changedRows.length} item{changedRows.length > 1 ? 's' : ''} will be reconciled.</span>
                </>
              )}
            </div>

            <button
              type="button"
              onClick={handleApplyStocktake}
              disabled={isSaving || changedRows.length === 0}
              className="h-12 px-6 rounded-xl btn-brand text-white text-base lg:text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? 'Applying Stocktake...' : 'Apply Stocktake'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StocktakingPage;
