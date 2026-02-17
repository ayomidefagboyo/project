import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Plus, RefreshCw, Send, Truck, X } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, TransferStatus, type InventoryTransfer, type POSProduct } from '@/lib/posService';
import { useToast } from '@/components/ui/Toast';
import { dataService } from '@/lib/dataService';
import type { Outlet } from '@/types';

interface TransferDraftItem {
  product_id: string;
  quantity_requested: number;
}

const TransferToOutletPage: React.FC = () => {
  const { currentOutlet, userOutlets } = useOutlet();
  const { success, error: showError, warning } = useToast();

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [draftItems, setDraftItems] = useState<TransferDraftItem[]>([]);
  const [toOutletId, setToOutletId] = useState('');
  const [transferReason, setTransferReason] = useState('Inter-outlet replenishment');
  const [notes, setNotes] = useState('');
  const [transfers, setTransfers] = useState<InventoryTransfer[]>([]);
  const [fallbackOutlets, setFallbackOutlets] = useState<Outlet[]>([]);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [isLoadingTransfers, setIsLoadingTransfers] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const productLoadRequestRef = useRef(0);

  const destinationOutlets = useMemo(() => {
    if (!currentOutlet?.id) return [] as Outlet[];

    const mergedById = new Map<string, Outlet>();
    [...userOutlets, ...fallbackOutlets].forEach((outlet) => {
      if (outlet?.id) mergedById.set(outlet.id, outlet);
    });

    return Array.from(mergedById.values()).filter((outlet) => outlet.id !== currentOutlet.id);
  }, [currentOutlet?.id, userOutlets, fallbackOutlets]);

  const selectedDestination = destinationOutlets.find((outlet) => outlet.id === toOutletId);

  const productMap = useMemo(() => {
    const map = new Map<string, POSProduct>();
    products.forEach((product) => map.set(product.id, product));
    return map;
  }, [products]);

  const loadProducts = async () => {
    if (!currentOutlet?.id) {
      setProducts([]);
      setIsLoadingProducts(false);
      return;
    }

    const outletId = currentOutlet.id;
    const requestId = ++productLoadRequestRef.current;

    setIsLoadingProducts(true);
    try {
      const cached = await posService.getCachedProducts(outletId, {
        activeOnly: true,
        page: 1,
        size: 20000,
      });
      if (requestId !== productLoadRequestRef.current) return;
      const hasCached = (cached.items || []).length > 0;
      setProducts(cached.items || []);
      setIsLoadingProducts(false);

      const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!isOnlineNow) {
        if (!hasCached) {
          showError('No local inventory cache yet. Connect once to sync products.');
        }
        return;
      }

      void (async () => {
        try {
          await posService.syncProductCatalog(outletId, { forceFull: !hasCached });
          const refreshed = await posService.getCachedProducts(outletId, {
            activeOnly: true,
            page: 1,
            size: 20000,
          });
          if (requestId !== productLoadRequestRef.current) return;
          setProducts(refreshed.items || []);
        } catch (syncErr) {
          if (requestId !== productLoadRequestRef.current) return;
          console.error('Background transfer product sync failed:', syncErr);
          if (!hasCached) {
            showError('Unable to sync products right now. Try again shortly.');
          }
        }
      })();
    } catch (err) {
      if (requestId !== productLoadRequestRef.current) return;
      console.error('Failed to load products for transfer:', err);
      showError('Failed to load products for transfer.');
    } finally {
      if (requestId === productLoadRequestRef.current) {
        setIsLoadingProducts(false);
      }
    }
  };

  const loadTransfers = async () => {
    if (!currentOutlet?.id) return;

    setIsLoadingTransfers(true);
    try {
      const response = await posService.getInventoryTransfers({
        outletId: currentOutlet.id,
        page: 1,
        size: 20,
      });
      setTransfers(response?.items || []);
    } catch (err) {
      console.error('Failed to load transfer history:', err);
      showError('Failed to load transfer history.');
    } finally {
      setIsLoadingTransfers(false);
    }
  };

  const loadOutletsFallback = async () => {
    try {
      const response = await dataService.listOutlets();
      setFallbackOutlets(response.data || []);
    } catch (err) {
      console.error('Failed to load outlets list for transfer:', err);
      setFallbackOutlets([]);
    }
  };

  useEffect(() => {
    void loadProducts();
    void loadTransfers();
    void loadOutletsFallback();
  }, [currentOutlet?.id]);

  const addDraftItem = () => {
    if (!selectedProductId) return;

    if (draftItems.some((item) => item.product_id === selectedProductId)) {
      warning('Product already in transfer list.');
      return;
    }

    setDraftItems((prev) => [
      ...prev,
      {
        product_id: selectedProductId,
        quantity_requested: 1,
      },
    ]);
    setSelectedProductId('');
  };

  const updateDraftItem = (productId: string, quantityRequested: number) => {
    setDraftItems((prev) => prev.map((item) => {
      if (item.product_id !== productId) return item;
      return {
        ...item,
        quantity_requested: Math.max(1, Math.floor(quantityRequested || 1)),
      };
    }));
  };

  const removeDraftItem = (productId: string) => {
    setDraftItems((prev) => prev.filter((item) => item.product_id !== productId));
  };

  const totalUnits = draftItems.reduce((sum, item) => sum + item.quantity_requested, 0);

  const handleSubmitTransfer = async () => {
    if (!currentOutlet?.id) return;

    if (!toOutletId) {
      warning('Select a destination outlet.');
      return;
    }

    if (draftItems.length === 0) {
      warning('Add at least one product to transfer.');
      return;
    }

    const invalidItem = draftItems.find((item) => {
      const product = productMap.get(item.product_id);
      if (!product) return true;
      return item.quantity_requested > (product.quantity_on_hand || 0);
    });

    if (invalidItem) {
      const invalidProduct = productMap.get(invalidItem.product_id);
      warning(`${invalidProduct?.name || 'Selected item'} exceeds available stock.`);
      return;
    }

    setIsSubmitting(true);
    try {
      const createdTransfer = await posService.createInventoryTransfer({
        from_outlet_id: currentOutlet.id,
        to_outlet_id: toOutletId,
        transfer_reason: transferReason.trim() || undefined,
        notes: notes.trim() || undefined,
        items: draftItems.map((item) => ({
          product_id: item.product_id,
          quantity_requested: item.quantity_requested,
        })),
      });

      success(`Transfer ${createdTransfer.transfer_number} sent to ${selectedDestination?.name || 'destination outlet'}.`);
      setDraftItems([]);
      setSelectedProductId('');
      setTransferReason('Inter-outlet replenishment');
      setNotes('');
      const transferQtyByProductId = new Map(
        draftItems.map((item) => [item.product_id, item.quantity_requested])
      );
      setProducts((prev) =>
        prev.map((product) => {
          const movedQty = transferQtyByProductId.get(product.id);
          if (!movedQty) return product;
          return {
            ...product,
            quantity_on_hand: Math.max(0, Number(product.quantity_on_hand || 0) - movedQty),
          };
        })
      );
      setTransfers((prev) => {
        const deduped = prev.filter((transfer) => transfer.id !== createdTransfer.id);
        return [createdTransfer, ...deduped].slice(0, 20);
      });
    } catch (err) {
      console.error('Failed to create outlet transfer:', err);
      showError('Transfer failed. Please check stock and try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-stone-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4">
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
          <div className="xl:col-span-2 rounded-2xl border border-stone-200 bg-white p-4 lg:p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-xl font-semibold text-slate-900">Create Transfer</h2>
              <button
                type="button"
                onClick={() => {
                  void loadProducts();
                  void loadTransfers();
                  void loadOutletsFallback();
                }}
                className="h-11 px-4 rounded-xl border border-stone-300 bg-white text-slate-700 hover:bg-stone-100 text-sm lg:text-base font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4 lg:w-5 lg:h-5" />
                Refresh
              </button>
            </div>

            {destinationOutlets.length === 0 && (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                No additional outlet found for this account. Add/assign more outlets to use transfers.
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">From Outlet</label>
                <div className="h-12 px-3 rounded-xl border border-stone-300 bg-stone-100 text-slate-700 flex items-center text-base font-semibold">
                  {currentOutlet?.name || 'Current Outlet'}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">To Outlet</label>
                <select
                  value={toOutletId}
                  onChange={(event) => setToOutletId(event.target.value)}
                  className="w-full h-12 rounded-xl border border-stone-300 px-3 text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                  <option value="">Select destination outlet</option>
                  {destinationOutlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>{outlet.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Reason</label>
                <input
                  type="text"
                  value={transferReason}
                  onChange={(event) => setTransferReason(event.target.value)}
                  className="w-full h-12 rounded-xl border border-stone-300 px-3 text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                  placeholder="Transfer reason"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-600 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  className="w-full h-12 rounded-xl border border-stone-300 px-3 text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                  placeholder="Optional internal note"
                />
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 p-3 space-y-3">
              <div className="flex flex-col lg:flex-row lg:items-center gap-2">
                <select
                  value={selectedProductId}
                  onChange={(event) => setSelectedProductId(event.target.value)}
                  className="flex-1 h-12 rounded-xl border border-stone-300 px-3 text-base focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                >
                  <option value="">Select product to transfer</option>
                  {products
                    .filter((product) => (product.quantity_on_hand || 0) > 0)
                    .map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.name} ({product.sku}) • Stock: {product.quantity_on_hand}
                      </option>
                    ))}
                </select>

                <button
                  type="button"
                  onClick={addDraftItem}
                  disabled={!selectedProductId || isLoadingProducts}
                  className="h-12 px-4 rounded-xl border border-stone-300 bg-white hover:bg-stone-100 text-base font-semibold text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <Plus className="w-5 h-5" />
                  Add Item
                </button>
              </div>

              <div className="border border-stone-200 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-sm lg:text-base">
                    <thead className="bg-stone-100 text-stone-600">
                      <tr>
                        <th className="text-left px-4 py-3 font-semibold">Product</th>
                        <th className="text-left px-4 py-3 font-semibold">SKU</th>
                        <th className="text-right px-4 py-3 font-semibold">Available</th>
                        <th className="text-right px-4 py-3 font-semibold">Transfer Qty</th>
                        <th className="text-right px-4 py-3 font-semibold">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-200">
                      {draftItems.length === 0 && (
                        <tr>
                          <td colSpan={5} className="px-4 py-8 text-center text-stone-500">No transfer items added yet.</td>
                        </tr>
                      )}

                      {draftItems.map((item) => {
                        const product = productMap.get(item.product_id);
                        if (!product) return null;

                        const exceeds = item.quantity_requested > (product.quantity_on_hand || 0);

                        return (
                          <tr key={item.product_id} className={exceeds ? 'bg-rose-50' : 'bg-white'}>
                            <td className="px-4 py-3 font-semibold text-slate-900">{product.name}</td>
                            <td className="px-4 py-3 text-stone-600">{product.sku}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{product.quantity_on_hand}</td>
                            <td className="px-4 py-3 text-right">
                              <input
                                type="number"
                                min={1}
                                value={item.quantity_requested}
                                onChange={(event) => updateDraftItem(item.product_id, Number(event.target.value))}
                                className={`w-28 h-11 rounded-lg border px-3 text-right font-semibold focus:ring-2 focus:ring-slate-400 focus:border-transparent ${
                                  exceeds ? 'border-rose-300 bg-rose-50 text-rose-700' : 'border-stone-300'
                                }`}
                              />
                            </td>
                            <td className="px-4 py-3 text-right">
                              <button
                                type="button"
                                onClick={() => removeDraftItem(item.product_id)}
                                className="h-11 px-3 rounded-lg border border-stone-300 hover:bg-stone-100 text-slate-600"
                                title="Remove item"
                              >
                                <X className="w-5 h-5" />
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
              <div className="text-sm lg:text-base text-stone-600">
                {draftItems.length} item{draftItems.length !== 1 ? 's' : ''} • {totalUnits} total unit{totalUnits !== 1 ? 's' : ''}
              </div>
              <button
                type="button"
                onClick={handleSubmitTransfer}
                disabled={isSubmitting || draftItems.length === 0 || !toOutletId || destinationOutlets.length === 0}
                className="h-12 px-6 rounded-xl btn-brand text-white text-base lg:text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
              >
                <Send className="w-5 h-5" />
                {isSubmitting ? 'Submitting Transfer...' : 'Submit Transfer'}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
            <h2 className="text-xl font-semibold text-slate-900 mb-3">Recent Transfers</h2>

            {isLoadingTransfers && <p className="text-sm text-stone-500">Loading transfers...</p>}

            {!isLoadingTransfers && transfers.length === 0 && (
              <p className="text-sm text-stone-500">No transfer activity yet.</p>
            )}

            <div className="space-y-3 max-h-[70vh] overflow-y-auto pr-1">
              {transfers.map((transfer) => {
                const requestedAt = transfer.requested_at ? new Date(transfer.requested_at) : null;

                return (
                  <div key={transfer.id} className="rounded-xl border border-stone-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-sm font-semibold text-slate-900">{transfer.transfer_number}</div>
                        <div className="text-xs text-stone-500 mt-0.5">
                          {requestedAt ? requestedAt.toLocaleDateString([], { day: '2-digit', month: 'short', year: 'numeric' }) : 'Unknown date'}
                          {' • '}
                          {requestedAt ? requestedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--'}
                        </div>
                      </div>

                      <span className={`px-2 py-1 rounded-md text-xs font-semibold ${
                        transfer.status === TransferStatus.RECEIVED
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-stone-200 text-stone-700'
                      }`}>
                        {transfer.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="text-sm text-stone-600 mt-2">
                      <div className="flex items-center gap-1">
                        <Truck className="w-4 h-4" />
                        {transfer.from_outlet_name} → {transfer.to_outlet_name}
                      </div>
                      <div className="mt-1">{transfer.total_items} units • ₦{Number(transfer.total_value || 0).toLocaleString()}</div>
                      {transfer.transfer_reason && <div className="mt-1 text-stone-500">{transfer.transfer_reason}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransferToOutletPage;
