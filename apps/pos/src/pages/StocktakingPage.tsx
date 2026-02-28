import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Archive, CheckCircle2, History, Play, RefreshCw, Search, Trash2 } from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, type POSProduct, type POSDepartment, type StocktakeHistoryItem } from '@/lib/posService';
import { getParsedStaffSession } from '@/lib/staffSessionStorage';
import { useToast } from '@/components/ui/Toast';

interface StocktakeEdit {
  counted_quantity: number;
  reason: string;
}

interface HeldStocktakeDraft {
  id: string;
  outlet_id: string;
  selected_department: string;
  edits: Record<string, StocktakeEdit>;
  created_at: string;
  updated_at: string;
}

const stocktakeReasons = [
  'Cycle count correction',
  'Damaged or expired items',
  'Shrinkage or theft',
  'Supplier short delivery',
  'Receiving overage',
  'Other',
];

const ALL_DEPARTMENTS = '__all__';

const createHeldDraftId = (): string =>
  `stocktake-hold-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const parseHeldDrafts = (raw: string | null): HeldStocktakeDraft[] => {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((draft) => {
        const edits: Record<string, StocktakeEdit> = {};
        const rawEdits = draft?.edits && typeof draft.edits === 'object' ? draft.edits : {};
        for (const [productId, value] of Object.entries(rawEdits)) {
          const countedQuantity = Math.max(0, Math.floor(Number((value as StocktakeEdit)?.counted_quantity ?? 0)));
          edits[productId] = {
            counted_quantity: Number.isFinite(countedQuantity) ? countedQuantity : 0,
            reason: String((value as StocktakeEdit)?.reason || '').trim(),
          };
        }
        return {
          id: String(draft?.id || createHeldDraftId()),
          outlet_id: String(draft?.outlet_id || ''),
          selected_department: String(draft?.selected_department || ALL_DEPARTMENTS),
          edits,
          created_at: String(draft?.created_at || new Date().toISOString()),
          updated_at: String(draft?.updated_at || draft?.created_at || new Date().toISOString()),
        };
      })
      .filter((draft) => draft.outlet_id && Object.keys(draft.edits).length > 0);
  } catch (error) {
    console.error('Failed to parse held stocktake drafts:', error);
    return [];
  }
};

const getDepartmentName = (category?: string | null) => {
  const normalized = String(category || '').trim();
  return normalized || 'Uncategorized';
};

const formatDateTime = (value?: string | null) => {
  if (!value) return 'N/A';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
};

const StocktakingPage: React.FC = () => {
  const { currentOutlet, currentUser } = useOutlet();
  const { success, error: showError, warning } = useToast();

  const [products, setProducts] = useState<POSProduct[]>([]);
  const [departmentMaster, setDepartmentMaster] = useState<POSDepartment[]>([]);
  const [edits, setEdits] = useState<Record<string, StocktakeEdit>>({});
  const [selectedDepartment, setSelectedDepartment] = useState(ALL_DEPARTMENTS);
  const [search, setSearch] = useState('');
  const [onlyChanged, setOnlyChanged] = useState(false);
  const [heldDrafts, setHeldDrafts] = useState<HeldStocktakeDraft[]>([]);
  const [activeHeldDraftId, setActiveHeldDraftId] = useState<string | null>(null);
  const [stocktakeHistory, setStocktakeHistory] = useState<StocktakeHistoryItem[]>([]);
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const loadRequestRef = useRef(0);
  const heldDraftStorageKey = useMemo(
    () => (currentOutlet?.id ? `pos_stocktake_holds_${currentOutlet.id}` : null),
    [currentOutlet?.id]
  );

  const activeStaffId = useMemo(() => {
    const parsed = getParsedStaffSession<any>();
    return parsed?.staff_profile?.id || currentUser?.id || 'system';
  }, [currentUser?.id]);

  const persistHeldDrafts = (nextDrafts: HeldStocktakeDraft[]) => {
    setHeldDrafts(nextDrafts);
    if (!heldDraftStorageKey) return;
    try {
      if (nextDrafts.length === 0) {
        localStorage.removeItem(heldDraftStorageKey);
      } else {
        localStorage.setItem(heldDraftStorageKey, JSON.stringify(nextDrafts));
      }
    } catch (error) {
      console.error('Failed to persist held stocktake drafts:', error);
    }
  };

  const loadStocktakeHistory = async () => {
    if (!currentOutlet?.id) {
      setStocktakeHistory([]);
      setIsHistoryLoading(false);
      return;
    }

    setIsHistoryLoading(true);
    try {
      const history = await posService.getStocktakeHistory(currentOutlet.id, { limit: 8 });
      setStocktakeHistory(history);
    } catch (err) {
      console.error('Failed to load stocktake history:', err);
      showError('Failed to load stocktake history.');
      setStocktakeHistory([]);
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const loadProducts = async () => {
    if (!currentOutlet?.id) {
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const outletId = currentOutlet.id;
    const requestId = ++loadRequestRef.current;

    setIsLoading(true);
    try {
      const [cached, loadedDepartments] = await Promise.all([
        posService.getCachedProducts(outletId, {
          activeOnly: true,
          page: 1,
          size: 20000,
        }),
        posService.getDepartments(outletId).catch(() => []),
      ]);
      if (requestId !== loadRequestRef.current) return;
      setDepartmentMaster(loadedDepartments || []);
      const hasCached = (cached.items || []).length > 0;
      setProducts(cached.items || []);
      setIsLoading(false);

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
          if (requestId !== loadRequestRef.current) return;
          setProducts(refreshed.items || []);
        } catch (syncErr) {
          if (requestId !== loadRequestRef.current) return;
          console.error('Background stocktaking sync failed:', syncErr);
          if (!hasCached) {
            showError('Unable to sync products right now. Try again shortly.');
          }
        }
      })();
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      console.error('Failed to load products for stocktaking:', err);
      showError('Failed to load inventory for stocktaking.');
    } finally {
      if (requestId === loadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    void loadProducts();
    void loadStocktakeHistory();
  }, [currentOutlet?.id]);

  useEffect(() => {
    setActiveHeldDraftId(null);
    setEdits({});
    if (!heldDraftStorageKey) {
      setHeldDrafts([]);
      return;
    }
    try {
      setHeldDrafts(parseHeldDrafts(localStorage.getItem(heldDraftStorageKey)));
    } catch (error) {
      console.error('Failed to load held stocktake drafts:', error);
      setHeldDrafts([]);
    }
  }, [heldDraftStorageKey]);

  const departments = useMemo(() => {
    const unique = new Set<string>();
    for (const department of departmentMaster) {
      if (department.is_active === false) continue;
      unique.add(getDepartmentName(department.name));
    }
    for (const product of products) {
      unique.add(getDepartmentName(product.category));
    }
    return Array.from(unique).sort((a, b) => a.localeCompare(b));
  }, [departmentMaster, products]);

  useEffect(() => {
    if (selectedDepartment === ALL_DEPARTMENTS) return;
    if (!departments.includes(selectedDepartment)) {
      setSelectedDepartment(ALL_DEPARTMENTS);
    }
  }, [departments, selectedDepartment]);

  const scopedProducts = useMemo(() => {
    if (selectedDepartment === ALL_DEPARTMENTS) {
      return products;
    }

    return products.filter(
      (product) => getDepartmentName(product.category) === selectedDepartment
    );
  }, [products, selectedDepartment]);

  const visibleProducts = useMemo(() => {
    const query = search.trim().toLowerCase();

    return scopedProducts.filter((product) => {
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
  }, [scopedProducts, edits, onlyChanged, search]);

  const productsById = useMemo(() => {
    const map = new Map<string, POSProduct>();
    for (const product of products) {
      map.set(product.id, product);
    }
    return map;
  }, [products]);

  const changedRows = useMemo(() => {
    return scopedProducts
      .map((product) => {
        const edit = edits[product.id];
        const counted = edit?.counted_quantity ?? product.quantity_on_hand;
        const delta = counted - product.quantity_on_hand;

        return {
          product,
          counted,
          delta,
          reason: edit?.reason || '',
        };
      })
      .filter((row) => row.delta !== 0);
  }, [scopedProducts, edits]);

  const netVariance = changedRows.reduce((sum, row) => sum + row.delta, 0);

  const updateEdit = (productId: string, patch: Partial<StocktakeEdit>) => {
    const product = products.find((item) => item.id === productId);
    if (!product) return;

    setEdits((prev) => {
      const existing = prev[productId] || {
        counted_quantity: product.quantity_on_hand,
        reason: '',
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

  const buildHeldDraft = (draftId: string, nextEdits: Record<string, StocktakeEdit>): HeldStocktakeDraft => ({
    id: draftId,
    outlet_id: currentOutlet?.id || '',
    selected_department: selectedDepartment,
    edits: Object.fromEntries(
      Object.entries(nextEdits)
        .filter(([, value]) => value && Number.isFinite(value.counted_quantity))
        .map(([productId, value]) => [
          productId,
          {
            counted_quantity: Math.max(0, Math.floor(Number(value.counted_quantity || 0))),
            reason: String(value.reason || '').trim(),
          },
        ])
    ),
    created_at: heldDrafts.find((draft) => draft.id === draftId)?.created_at || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  const handleHoldStocktake = () => {
    if (!currentOutlet?.id) return;

    const editCount = Object.keys(edits).length;
    if (editCount === 0) {
      warning('No stocktake progress to hold yet.');
      return;
    }

    const draftId = activeHeldDraftId || createHeldDraftId();
    const nextDraft = buildHeldDraft(draftId, edits);
    const nextDrafts = [nextDraft, ...heldDrafts.filter((draft) => draft.id !== draftId)];
    persistHeldDrafts(nextDrafts);

    setEdits({});
    setActiveHeldDraftId(null);
    setSelectedDepartment(ALL_DEPARTMENTS);
    setSearch('');
    setOnlyChanged(false);
    success('Stocktake progress held. You can resume it later.');
  };

  const handleLoadHeldDraft = (draft: HeldStocktakeDraft) => {
    setEdits(draft.edits);
    setSelectedDepartment(draft.selected_department || ALL_DEPARTMENTS);
    setSearch('');
    setOnlyChanged(false);
    setActiveHeldDraftId(draft.id);
    success('Held stocktake loaded.');
  };

  const handleDeleteHeldDraft = (draftId: string) => {
    if (!window.confirm('Delete this held stocktake?')) return;
    const nextDrafts = heldDrafts.filter((draft) => draft.id !== draftId);
    persistHeldDrafts(nextDrafts);
    if (activeHeldDraftId === draftId) {
      setActiveHeldDraftId(null);
    }
  };

  const handleApplyStocktake = async () => {
    if (!currentOutlet?.id) return;

    if (changedRows.length === 0) {
      warning('No stock differences to reconcile in this department scope.');
      return;
    }

    const rowMissingReason = changedRows.find((row) => !row.reason.trim());
    if (rowMissingReason) {
      warning(`Please select a reason for ${rowMissingReason.product.name}.`);
      return;
    }

    setIsSaving(true);
    try {
      const result = await posService.applyStocktake({
        outlet_id: currentOutlet.id,
        performed_by: activeStaffId,
        items: changedRows.map((row) => ({
          product_id: row.product.id,
          current_quantity: row.product.quantity_on_hand,
          counted_quantity: row.counted,
          reason: row.reason,
          unit_cost: row.product.cost_price,
        })),
      });

      success(
        `Stocktake completed: ${result.adjusted_count} adjusted, ${result.unchanged_count} unchanged.`
      );
      const nextEdits = { ...edits };
      for (const row of changedRows) {
        delete nextEdits[row.product.id];
      }
      setEdits(nextEdits);
      if (activeHeldDraftId) {
        if (Object.keys(nextEdits).length === 0) {
          persistHeldDrafts(heldDrafts.filter((draft) => draft.id !== activeHeldDraftId));
          setActiveHeldDraftId(null);
        } else {
          const updatedDraft = buildHeldDraft(activeHeldDraftId, nextEdits);
          persistHeldDrafts([
            updatedDraft,
            ...heldDrafts.filter((draft) => draft.id !== activeHeldDraftId),
          ]);
        }
      }
      const countedByProductId = new Map(
        changedRows.map((row) => [row.product.id, row.counted])
      );
      setProducts((prev) =>
        prev.map((product) => {
          const counted = countedByProductId.get(product.id);
          if (counted === undefined) return product;
          return {
            ...product,
            quantity_on_hand: counted,
          };
        })
      );
      await loadStocktakeHistory();
    } catch (err) {
      console.error('Stocktake failed:', err);
      const message = err instanceof Error ? err.message : 'Stocktake failed. Please try again.';
      showError(message.replace(/^Error:\s*/i, ''));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-stone-50">
      <div className="max-w-[1600px] mx-auto p-4 lg:p-6 space-y-4">
        <div className="rounded-2xl border border-stone-200 bg-white p-5 lg:p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={selectedDepartment}
                onChange={(event) => setSelectedDepartment(event.target.value)}
                className="h-12 min-w-[220px] rounded-xl border border-stone-300 bg-white px-3 text-base font-semibold text-slate-700 focus:ring-2 focus:ring-slate-400 focus:border-transparent"
              >
                <option value={ALL_DEPARTMENTS}>All Departments</option>
                {departments.map((department) => (
                  <option key={department} value={department}>
                    {department}
                  </option>
                ))}
              </select>
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
              <button
                type="button"
                onClick={handleHoldStocktake}
                className="h-12 px-4 rounded-xl border border-stone-300 bg-white text-slate-700 hover:bg-stone-100 text-base font-semibold inline-flex items-center gap-2"
              >
                <Archive className="w-5 h-5" />
                Hold Stocktake
              </button>
            </div>
          </div>

          {activeHeldDraftId && (
            <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Continuing a held stocktake. Save it again to update the held copy, or apply it to clear completed rows.
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-5">
            <div className="rounded-xl border border-stone-200 bg-stone-50 p-4">
              <div className="text-sm text-stone-500">Products in Scope</div>
              <div className="text-3xl font-semibold text-slate-900 mt-1">{scopedProducts.length}</div>
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
            <div className="flex items-center gap-2">
              <Archive className="w-5 h-5 text-slate-700" />
              <h3 className="text-lg font-semibold text-slate-900">Held Stocktakes</h3>
            </div>
            <div className="mt-4 space-y-3">
              {heldDrafts.length === 0 ? (
                <p className="text-sm text-stone-500">No held stocktakes yet.</p>
              ) : (
                heldDrafts.map((draft) => {
                  const draftEditIds = Object.keys(draft.edits);
                  const draftVarianceCount = draftEditIds.filter((productId) => {
                    const product = productsById.get(productId);
                    if (!product) return true;
                    return (draft.edits[productId]?.counted_quantity ?? product.quantity_on_hand) !== product.quantity_on_hand;
                  }).length;

                  return (
                    <div key={draft.id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900">
                            {draft.selected_department === ALL_DEPARTMENTS ? 'All Departments' : draft.selected_department}
                          </div>
                          <div className="text-sm text-stone-500 mt-1">
                            {draftEditIds.length} saved row{draftEditIds.length === 1 ? '' : 's'} • {draftVarianceCount} variance item{draftVarianceCount === 1 ? '' : 's'}
                          </div>
                          <div className="text-xs text-stone-500 mt-1">
                            Updated {formatDateTime(draft.updated_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleLoadHeldDraft(draft)}
                            className="h-10 px-3 rounded-lg border border-stone-300 bg-white text-slate-700 hover:bg-stone-100 text-sm font-semibold inline-flex items-center gap-2"
                          >
                            <Play className="w-4 h-4" />
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteHeldDraft(draft.id)}
                            className="h-10 w-10 rounded-lg border border-stone-300 bg-white text-rose-600 hover:bg-rose-50 inline-flex items-center justify-center"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white p-4 lg:p-5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <History className="w-5 h-5 text-slate-700" />
                <h3 className="text-lg font-semibold text-slate-900">Stocktake History</h3>
              </div>
              <button
                type="button"
                onClick={() => void loadStocktakeHistory()}
                className="h-10 px-3 rounded-lg border border-stone-300 bg-white text-slate-700 hover:bg-stone-100 text-sm font-semibold inline-flex items-center gap-2"
              >
                <RefreshCw className="w-4 h-4" />
                Refresh
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {isHistoryLoading ? (
                <p className="text-sm text-stone-500">Loading stocktake history...</p>
              ) : stocktakeHistory.length === 0 ? (
                <p className="text-sm text-stone-500">No stocktake history yet.</p>
              ) : (
                stocktakeHistory.map((entry) => (
                  <div key={entry.session_id} className="rounded-xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <div className="font-semibold text-slate-900">
                          {entry.performed_by_name || entry.performed_by || 'Staff'}
                        </div>
                        <div className="text-xs text-stone-500 mt-1">{formatDateTime(entry.completed_at || entry.started_at)}</div>
                      </div>
                      <div className={`text-sm font-semibold ${entry.net_quantity_variance > 0 ? 'text-emerald-700' : entry.net_quantity_variance < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                        {entry.net_quantity_variance > 0 ? `+${entry.net_quantity_variance}` : entry.net_quantity_variance}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-3 text-sm text-stone-600">
                      <div>{entry.adjusted_items} adjusted</div>
                      <div>{entry.unchanged_items} unchanged</div>
                      <div>+{entry.positive_variance_items} / -{entry.negative_variance_items}</div>
                      <div>Value {Number(entry.total_variance_value || 0).toLocaleString()}</div>
                    </div>
                    {entry.top_reasons && entry.top_reasons.length > 0 && (
                      <div className="flex flex-wrap gap-2 mt-3">
                        {entry.top_reasons.map((reason) => (
                          <span key={`${entry.session_id}-${reason}`} className="px-2.5 py-1 rounded-full bg-white border border-stone-200 text-xs font-medium text-stone-600">
                            {reason}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
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
              <table className="w-full min-w-[920px] text-sm lg:text-base">
                <thead className="bg-stone-100 text-stone-600">
                  <tr>
                    <th className="text-left font-semibold px-4 py-3">Product</th>
                    <th className="text-left font-semibold px-4 py-3">SKU</th>
                    <th className="text-right font-semibold px-4 py-3">System Qty</th>
                    <th className="text-right font-semibold px-4 py-3">Counted Qty</th>
                    <th className="text-right font-semibold px-4 py-3">Variance</th>
                    <th className="text-left font-semibold px-4 py-3">Reason</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-stone-200">
                  {isLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-500">Loading stock items...</td>
                    </tr>
                  )}

                  {!isLoading && visibleProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-stone-500">
                        {products.length === 0
                          ? 'No products found for this outlet.'
                          : scopedProducts.length === 0
                            ? 'No products found in this department.'
                            : 'No products match your filter.'}
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
                  <span className="text-stone-600">No stock differences pending in this scope.</span>
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
