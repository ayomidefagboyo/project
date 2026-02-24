/**
 * Product Management - Excel-like bulk product management
 * Swiss Premium Design with touch optimization
 */

import React, { useState, useEffect, useRef, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import {
  Plus,
  Save,
  Upload,
  Download,
  Search,
  Filter,
  RefreshCw,
  Trash2,
  Edit3,
  Package,
  MoreHorizontal,
  ArrowLeft,
  X,
  Building2,
  History,
} from 'lucide-react';
import { posService, type POSProduct, type POSDepartment } from '../../lib/posService';
import ItemHistoryModal from './modals/ItemHistoryModal';
import { clearMissingProductIntent, peekMissingProductIntent } from '../../lib/missingProductIntent';
import { useOutlet } from '../../contexts/OutletContext';
import { useLocation, useNavigate } from 'react-router-dom';

interface ProductManagementProps {
  onShowNewRow?: () => void;
}

interface DepartmentPolicyDraft {
  default_markup_percentage: string;
  auto_pricing_enabled: boolean;
}

export interface ProductManagementHandle {
  handleShowNewRow: () => void;
  refresh: () => void;
}

const DEFAULT_DEPARTMENTS = [
  'Beverages',
  'Food & Groceries',
  'Household Items',
  'Personal Care',
  'Electronics',
  'Clothing',
  'Office Supplies',
  'Pharmacy',
  'Other',
];
const PRODUCT_PAGE_SIZE = 120;

const normalizeDepartmentName = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return normalized;
};

const formatDepartmentError = (error: unknown, fallback: string): string => {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message.replace(/^Error:\s*/i, '').replace(/^POS Error:\s*/i, '');
  }
  return fallback;
};

const ProductManagement = forwardRef<ProductManagementHandle, ProductManagementProps>(({ onShowNewRow }, ref) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOutlet } = useOutlet();
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [departments, setDepartments] = useState<POSDepartment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [editingRows, setEditingRows] = useState<Set<string>>(new Set());
  const [editDrafts, setEditDrafts] = useState<Record<string, Partial<POSProduct>>>({});
  const [newProduct, setNewProduct] = useState<Partial<POSProduct>>({});
  const [newProductSellingPriceManuallyEdited, setNewProductSellingPriceManuallyEdited] = useState(false);
  const [showNewRow, setShowNewRow] = useState(false);
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [showDepartmentModal, setShowDepartmentModal] = useState(false);
  const [itemHistoryProduct, setItemHistoryProduct] = useState<POSProduct | null>(null);
  const [departmentModalError, setDepartmentModalError] = useState<string | null>(null);
  const [departmentCreateForm, setDepartmentCreateForm] = useState({
    name: '',
    code: '',
    description: '',
    default_markup_percentage: '30',
    auto_pricing_enabled: true,
  });
  const [departmentPolicyDrafts, setDepartmentPolicyDrafts] = useState<Record<string, DepartmentPolicyDraft>>({});
  const [departmentSavingId, setDepartmentSavingId] = useState<string | null>(null);
  const [hasDeferredCatalogRefresh, setHasDeferredCatalogRefresh] = useState(false);
  const loadRequestRef = useRef(0);
  const newBarcodeInputRef = useRef<HTMLInputElement | null>(null);
  const hasActiveEditorRef = useRef(false);

  const categoryOptions = useMemo(() => {
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

    if (byKey.size === 0) {
      DEFAULT_DEPARTMENTS.forEach((department) => addValue(department));
    }

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

  const calculateAutoSellingPrice = useCallback(
    (costPrice: number, category?: string): number => {
      const normalizedCost = Number.isFinite(costPrice) ? Math.max(0, costPrice) : 0;
      if (normalizedCost <= 0) return 0;
      const key = normalizeDepartmentName(category).toLowerCase();
      const policy = key ? departmentPolicyByName.get(key) : undefined;
      const autoEnabled = policy?.auto_pricing_enabled !== false;
      const markup = Number(policy?.default_markup_percentage ?? 30);
      if (!autoEnabled) {
        return Number(normalizedCost.toFixed(2));
      }
      const factor = 1 + Math.max(0, markup) / 100;
      return Number((normalizedCost * factor).toFixed(2));
    },
    [departmentPolicyByName]
  );

  const loadDepartments = useCallback(async () => {
    if (!currentOutlet?.id) {
      setDepartments([]);
      return;
    }

    try {
      const rows = await posService.getDepartments(currentOutlet.id);
      setDepartments(rows || []);
    } catch (err) {
      console.error('Failed to load departments:', err);
      setDepartments([]);
    }
  }, [currentOutlet?.id]);

  useEffect(() => {
    void loadProducts('cache-only');
  }, [currentOutlet?.id]);

  useEffect(() => {
    const handleProductsSynced = () => {
      if (hasActiveEditorRef.current) {
        setHasDeferredCatalogRefresh(true);
        return;
      }
      void loadProducts('cache-only', { silent: true });
    };
    window.addEventListener('pos-products-synced', handleProductsSynced);
    return () => window.removeEventListener('pos-products-synced', handleProductsSynced);
  }, [currentOutlet?.id]);

  useEffect(() => {
    void loadDepartments();
  }, [loadDepartments]);

  useEffect(() => {
    if (!selectedCategory) return;
    if (categoryOptions.includes(selectedCategory)) return;
    setSelectedCategory('');
  }, [categoryOptions, selectedCategory]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, currentOutlet?.id]);

  const openNewRowForScannedBarcode = (rawBarcode: string) => {
    const barcode = rawBarcode.trim();
    if (!barcode) return;
    setShowNewRow(true);
    setNewProductSellingPriceManuallyEdited(false);
    setNewProduct((prev) => ({
      ...prev,
      barcode,
      sku: prev.sku || barcode,
    }));
    requestAnimationFrame(() => newBarcodeInputRef.current?.focus());
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auto_create') !== '1') return;

    const barcode = (params.get('barcode') || '').trim();
    if (!barcode) return;

    openNewRowForScannedBarcode(barcode);
    clearMissingProductIntent();
    navigate('/products', { replace: true });
  }, [location.search, navigate]);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('auto_create') === '1') return;

    const intent = peekMissingProductIntent();
    if (!intent?.barcode) return;

    openNewRowForScannedBarcode(intent.barcode);
    clearMissingProductIntent();
  }, [location.search]);

  const loadProducts = useCallback(async (
    mode: 'sync' | 'cache-only' = 'cache-only',
    options?: { silent?: boolean }
  ) => {
    if (!currentOutlet?.id) {
      setProducts([]);
      if (!options?.silent) setIsLoading(false);
      return;
    }

    const outletId = currentOutlet.id;
    const requestId = ++loadRequestRef.current;

    try {
      if (!options?.silent) setIsLoading(true);
      const cached = await posService.getCachedProducts(outletId, {
        activeOnly: false, // Show all products including inactive
        page: 1,
        size: 20000
      });
      if (requestId !== loadRequestRef.current) return;

      const hasCached = (cached.items || []).length > 0;
      setProducts(cached.items || []);
      setError(null);
      if (!options?.silent) setIsLoading(false);

      if (mode !== 'sync') {
        return;
      }

      const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!isOnlineNow) return;

      void (async () => {
        try {
          await posService.syncProductCatalog(outletId, { forceFull: !hasCached });
          const refreshed = await posService.getCachedProducts(outletId, {
            activeOnly: false,
            page: 1,
            size: 20000
          });
          if (requestId !== loadRequestRef.current) return;
          setProducts(refreshed.items || []);
        } catch (syncErr) {
          if (requestId !== loadRequestRef.current) return;
          console.error('Background product sync failed:', syncErr);
          if (!hasCached) {
            setError('No products found for this outlet. Add your first product to begin.');
          }
        }
      })();
    } catch (err) {
      if (requestId !== loadRequestRef.current) return;
      console.error('Failed to load products:', err);
      setError('Failed to load products from server/cache. Check connection and try again.');
      if (!options?.silent) setIsLoading(false);
    }
  }, [currentOutlet?.id]);

  const formatCurrency = useCallback((amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  }, []);

  const filteredProducts = useMemo(() => {
    const normalizedSearch = searchQuery.trim().toLowerCase();
    const normalizedCategory = selectedCategory.trim().toLowerCase();

    return products.filter((product) => {
      if (
        normalizedCategory &&
        String(product.category || '').trim().toLowerCase() !== normalizedCategory
      ) {
        return false;
      }

      if (!normalizedSearch) return true;

      const name = String(product.name || '').toLowerCase();
      const sku = String(product.sku || '').toLowerCase();
      const barcode = String(product.barcode || '').toLowerCase();
      const category = String(product.category || '').toLowerCase();
      return (
        name.includes(normalizedSearch) ||
        sku.includes(normalizedSearch) ||
        barcode.includes(normalizedSearch) ||
        category.includes(normalizedSearch)
      );
    });
  }, [products, searchQuery, selectedCategory]);

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(filteredProducts.length / PRODUCT_PAGE_SIZE)),
    [filteredProducts.length]
  );

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCT_PAGE_SIZE;
    return filteredProducts.slice(start, start + PRODUCT_PAGE_SIZE);
  }, [filteredProducts, currentPage]);

  const selectedOnPageCount = useMemo(
    () => paginatedProducts.reduce((count, product) => (selectedProducts.has(product.id) ? count + 1 : count), 0),
    [paginatedProducts, selectedProducts]
  );
  const hasActiveEditor = showNewRow || editingRows.size > 0;

  useEffect(() => {
    hasActiveEditorRef.current = hasActiveEditor;
  }, [hasActiveEditor]);

  useEffect(() => {
    if (hasActiveEditor || !hasDeferredCatalogRefresh) return;
    setHasDeferredCatalogRefresh(false);
    void loadProducts('cache-only', { silent: true });
  }, [hasActiveEditor, hasDeferredCatalogRefresh]);

  const handleCellEdit = useCallback((productId: string, field: keyof POSProduct, value: any) => {
    setEditDrafts((prev) => ({
      ...prev,
      [productId]: {
        ...(prev[productId] || {}),
        [field]: value,
      },
    }));
  }, []);

  const startEditingProduct = useCallback((productId: string) => {
    setEditingRows((prev) => {
      const next = new Set(prev);
      next.add(productId);
      return next;
    });
  }, []);

  const cancelEditingProduct = useCallback((productId: string) => {
    setEditingRows((prev) => {
      const next = new Set(prev);
      next.delete(productId);
      return next;
    });
    setEditDrafts((prev) => {
      if (!prev[productId]) return prev;
      const next = { ...prev };
      delete next[productId];
      return next;
    });
  }, []);

  const handleNewProductChange = (field: keyof POSProduct, value: any) => {
    setNewProduct((prev) => {
      const next = { ...prev, [field]: value };

      if (field === 'unit_price') {
        setNewProductSellingPriceManuallyEdited(true);
      }

      if ((field === 'cost_price' || field === 'category') && !newProductSellingPriceManuallyEdited) {
        const costPrice = Number(next.cost_price || 0);
        const category = String(next.category || '');
        next.unit_price = calculateAutoSellingPrice(costPrice, category);
      }

      return next;
    });
  };

  const openDepartmentModal = () => {
    const drafts: Record<string, DepartmentPolicyDraft> = {};
    departments.forEach((department) => {
      drafts[department.id] = {
        default_markup_percentage: String(Number(department.default_markup_percentage ?? 30)),
        auto_pricing_enabled: department.auto_pricing_enabled !== false,
      };
    });
    setDepartmentPolicyDrafts(drafts);
    setDepartmentModalError(null);
    setShowDepartmentModal(true);
  };

  const handleCreateDepartment = async () => {
    if (!currentOutlet?.id) return;

    const name = normalizeDepartmentName(departmentCreateForm.name);
    if (!name) {
      setDepartmentModalError('Department name is required.');
      return;
    }

    const markup = Math.max(0, Number(departmentCreateForm.default_markup_percentage || 0));

    try {
      const created = await posService.createDepartment({
        outlet_id: currentOutlet.id,
        name,
        code: departmentCreateForm.code.trim() || undefined,
        description: departmentCreateForm.description.trim() || undefined,
        default_markup_percentage: markup,
        auto_pricing_enabled: departmentCreateForm.auto_pricing_enabled,
      });
      setDepartments((prev) => {
        const next = [...prev];
        const key = created.name.trim().toLowerCase();
        const existingIndex = next.findIndex((item) => item.name.trim().toLowerCase() === key);
        if (existingIndex >= 0) {
          next[existingIndex] = created;
        } else {
          next.push(created);
        }
        return next;
      });
      setSelectedCategory(created.name);
      setDepartmentPolicyDrafts((prev) => ({
        ...prev,
        [created.id]: {
          default_markup_percentage: String(
            Number(created.default_markup_percentage ?? (markup || 30))
          ),
          auto_pricing_enabled: created.auto_pricing_enabled !== false,
        },
      }));
      setDepartmentCreateForm({
        name: '',
        code: '',
        description: '',
        default_markup_percentage: '30',
        auto_pricing_enabled: true,
      });
      setDepartmentModalError(null);
      setError(null);
    } catch (err) {
      console.error('Failed to create department:', err);
      setDepartmentModalError(
        formatDepartmentError(err, 'Failed to create department. Please try again.')
      );
    }
  };

  const handleSaveDepartmentPolicy = async (departmentId: string) => {
    const draft = departmentPolicyDrafts[departmentId];
    if (!draft) return;
    const markup = Math.max(0, Number(draft.default_markup_percentage || 0));
    const department = departments.find((item) => item.id === departmentId);
    if (!department) return;

    try {
      setDepartmentSavingId(departmentId);

      if (department.source === 'product_category') {
        if (!currentOutlet?.id) {
          setDepartmentModalError('Select an outlet before saving department policy.');
          return;
        }

        // Category-only entries do not yet have a master policy row.
        // Promote to a real department record so margin/auto-pricing can be persisted.
        const created = await posService.createDepartment({
          outlet_id: currentOutlet.id,
          name: department.name,
          code: department.code || undefined,
          description: department.description || undefined,
          default_markup_percentage: markup,
          auto_pricing_enabled: draft.auto_pricing_enabled,
        });

        setDepartments((prev) => {
          const key = created.name.trim().toLowerCase();
          return prev.map((item) =>
            item.id === departmentId || item.name.trim().toLowerCase() === key
              ? { ...item, ...created, source: 'master' }
              : item
          );
        });

        setDepartmentPolicyDrafts((prev) => {
          const next = { ...prev };
          delete next[departmentId];
          next[created.id] = {
            default_markup_percentage: String(Number(created.default_markup_percentage ?? markup)),
            auto_pricing_enabled: created.auto_pricing_enabled !== false,
          };
          return next;
        });
      } else {
        const updated = await posService.updateDepartment(departmentId, {
          default_markup_percentage: markup,
          auto_pricing_enabled: draft.auto_pricing_enabled,
        });
        setDepartments((prev) =>
          prev.map((item) => (item.id === departmentId ? { ...item, ...updated } : item))
        );
      }

      setDepartmentModalError(null);
      setError(null);
    } catch (err) {
      console.error('Failed to save department policy:', err);
      setDepartmentModalError(
        formatDepartmentError(err, 'Could not save department margin policy. Please retry.')
      );
    } finally {
      setDepartmentSavingId(null);
    }
  };

  const saveProduct = useCallback(async (productId: string) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;
    const draft = editDrafts[productId] || {};
    const merged = { ...product, ...draft };
    const unitsPerPack = Math.floor(Number(merged.units_per_pack || 0));
    const packPrice = Number(merged.pack_price || 0);
    const packEnabled =
      Boolean(merged.pack_enabled) ||
      (Number.isFinite(unitsPerPack) && unitsPerPack >= 2 && Number.isFinite(packPrice) && packPrice > 0);
    if (packEnabled && (!Number.isFinite(unitsPerPack) || unitsPerPack < 2 || !Number.isFinite(packPrice) || packPrice <= 0)) {
      setError('Pack setup requires units per pack (>=2) and pack price (>0).');
      return;
    }

    try {
      const updatedProduct = await posService.updateProduct(productId, {
        sku: merged.sku,
        barcode: merged.barcode,
        name: merged.name,
        description: merged.description,
        category: merged.category,
        unit_price: merged.unit_price,
        cost_price: merged.cost_price,
        tax_rate: merged.tax_rate,
        quantity_on_hand: merged.quantity_on_hand,
        reorder_level: merged.reorder_level,
        reorder_quantity: merged.reorder_quantity,
        is_active: merged.is_active,
        vendor_id: merged.vendor_id,
        image_url: merged.image_url,
        display_order: merged.display_order,
        base_unit_name: merged.base_unit_name || 'Unit',
        pack_enabled: packEnabled,
        pack_name: packEnabled ? (merged.pack_name || 'Pack') : undefined,
        units_per_pack: packEnabled ? unitsPerPack : undefined,
        pack_price: packEnabled ? packPrice : undefined,
        pack_barcode: packEnabled ? merged.pack_barcode : undefined,
      });
      setProducts((prev) =>
        prev.map((row) => (row.id === productId ? { ...row, ...updatedProduct } : row))
      );
      setEditingRows((prev) => {
        const next = new Set(prev);
        next.delete(productId);
        return next;
      });
      setEditDrafts((prev) => {
        if (!prev[productId]) return prev;
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      setError(null);
    } catch (error) {
      console.error('Failed to save product:', error);
      setError('Failed to save product changes. Please try again.');
    }
  }, [products, editDrafts]);

  const addNewProduct = async () => {
    if (!currentOutlet?.id || !newProduct.name) return;

    try {
      const category = normalizeDepartmentName(newProduct.category) || 'Other';
      const departmentPolicy = departmentPolicyByName.get(category.toLowerCase());
      const defaultMarkup = Number(departmentPolicy?.default_markup_percentage ?? 30);
      const autoPricingEnabled = departmentPolicy?.auto_pricing_enabled !== false;
      const costPrice = Number(newProduct.cost_price || 0);
      const typedUnitPrice = Number(newProduct.unit_price || 0);
      const calculatedUnitPrice = calculateAutoSellingPrice(costPrice, category);
      const finalUnitPrice = Math.max(
        0,
        typedUnitPrice > 0 ? typedUnitPrice : calculatedUnitPrice
      );
      const unitsPerPack = Math.floor(Number(newProduct.units_per_pack || 0));
      const packPrice = Number(newProduct.pack_price || 0);
      const packEnabled =
        Boolean(newProduct.pack_enabled) ||
        (Number.isFinite(unitsPerPack) && unitsPerPack >= 2 && Number.isFinite(packPrice) && packPrice > 0);
      if (packEnabled && (!Number.isFinite(unitsPerPack) || unitsPerPack < 2 || !Number.isFinite(packPrice) || packPrice <= 0)) {
        setError('Pack setup requires units per pack (>=2) and pack price (>0).');
        return;
      }

      const productToCreate = {
        outlet_id: currentOutlet.id,
        sku: newProduct.sku || `SKU-${Date.now()}`,
        name: newProduct.name!,
        description: newProduct.description,
        category,
        unit_price: finalUnitPrice,
        cost_price: costPrice,
        quantity_on_hand: newProduct.quantity_on_hand || 0,
        reorder_level: newProduct.reorder_level || 0,
        reorder_quantity: newProduct.reorder_quantity || 0,
        tax_rate: 0.075,
        barcode: newProduct.barcode,
        markup_percentage: defaultMarkup,
        auto_pricing: autoPricingEnabled,
        base_unit_name: newProduct.base_unit_name || 'Unit',
        pack_enabled: packEnabled,
        pack_name: packEnabled ? (newProduct.pack_name || 'Pack') : undefined,
        units_per_pack: packEnabled ? unitsPerPack : undefined,
        pack_price: packEnabled ? packPrice : undefined,
        pack_barcode: packEnabled ? newProduct.pack_barcode : undefined,
      };

      const createdProduct = await posService.createProduct(productToCreate);
      setProducts((prev) => {
        const existingIndex = prev.findIndex((row) => row.id === createdProduct.id);
        if (existingIndex >= 0) {
          const next = [...prev];
          next[existingIndex] = { ...prev[existingIndex], ...createdProduct };
          return next;
        }
        return [createdProduct, ...prev];
      });
      setCurrentPage(1);

      setNewProduct({});
      setNewProductSellingPriceManuallyEdited(false);
      setShowNewRow(false);
      setError(null);
    } catch (error) {
      console.error('Failed to add product:', error);
      setError('Failed to add product. Please check required fields and try again.');
    }
  };

  const toggleSelectProduct = useCallback((productId: string) => {
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

  const selectAllProducts = useCallback(() => {
    if (paginatedProducts.length === 0) return;
    setSelectedProducts((prev) => {
      const next = new Set(prev);
      const pageIds = paginatedProducts.map((product) => product.id);
      const allOnPageSelected = pageIds.every((id) => next.has(id));

      if (allOnPageSelected) {
        pageIds.forEach((id) => next.delete(id));
      } else {
        pageIds.forEach((id) => next.add(id));
      }

      return next;
    });
  }, [paginatedProducts]);

  // Handle add product via prop or internal state
  const handleShowNewRow = () => {
    if (onShowNewRow) {
      onShowNewRow();
    }
    setNewProductSellingPriceManuallyEdited(false);
    setShowNewRow(true);
  };

  // Expose methods to parent component
  useImperativeHandle(ref, () => ({
    handleShowNewRow,
    refresh: () => {
      void loadProducts('sync');
    },
  }));

  const productRows = useMemo(
    () =>
      paginatedProducts.map((product) => {
        const isEditing = editingRows.has(product.id);
        const isSelected = selectedProducts.has(product.id);
        const draft = editDrafts[product.id] || {};

        const barcodeValue = String(draft.barcode ?? product.barcode ?? '');
        const nameValue = String(draft.name ?? product.name ?? '');
        const categoryValue = String(draft.category ?? product.category ?? '');
        const costPriceValue = Number(draft.cost_price ?? product.cost_price ?? 0);
        const unitPriceValue = Number(draft.unit_price ?? product.unit_price ?? 0);
        const unitsPerPackValue = Number(draft.units_per_pack ?? product.units_per_pack ?? 0);
        const packPriceValue = Number(draft.pack_price ?? product.pack_price ?? 0);
        const quantityValue = Number(draft.quantity_on_hand ?? product.quantity_on_hand ?? 0);
        const reorderLevelValue = Number(draft.reorder_level ?? product.reorder_level ?? 0);
        const isActiveValue =
          typeof draft.is_active === 'boolean' ? draft.is_active : product.is_active;

        return (
          <tr key={product.id} className={`hover:bg-slate-50 ${isSelected ? 'bg-indigo-50' : ''}`}>
            <td className="p-4">
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelectProduct(product.id)}
                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
            </td>
            <td className="p-4 font-mono text-sm text-slate-600">{product.sku}</td>
            <td className="p-4">
              {isEditing ? (
                <input
                  type="text"
                  defaultValue={barcodeValue}
                  onBlur={(e) => handleCellEdit(product.id, 'barcode', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 font-mono text-sm"
                />
              ) : (
                <span className="font-mono text-sm text-slate-500">{product.barcode || '—'}</span>
              )}
            </td>
            <td className="p-4">
              {isEditing ? (
                <input
                  type="text"
                  defaultValue={nameValue}
                  onBlur={(e) => handleCellEdit(product.id, 'name', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                />
              ) : (
                <div>
                  <div className="font-medium text-slate-900">{product.name}</div>
                  {product.description && (
                    <div className="text-sm text-slate-500">{product.description}</div>
                  )}
                </div>
              )}
            </td>
            <td className="p-4">
              {isEditing ? (
                <select
                  value={categoryValue}
                  onChange={(e) => handleCellEdit(product.id, 'category', e.target.value)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="">Uncategorized</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              ) : (
                <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded-full text-sm">
                  {product.category || 'Uncategorized'}
                </span>
              )}
            </td>
            <td className="p-4 text-right font-mono">
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={costPriceValue}
                  onBlur={(e) => handleCellEdit(product.id, 'cost_price', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                formatCurrency(product.cost_price || 0)
              )}
            </td>
            <td className="p-4 text-right font-mono font-semibold">
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={unitPriceValue}
                  onBlur={(e) => handleCellEdit(product.id, 'unit_price', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                formatCurrency(product.unit_price)
              )}
            </td>
            <td className="p-4 text-right font-mono">
              {isEditing ? (
                <input
                  type="number"
                  min={0}
                  defaultValue={unitsPerPackValue}
                  onBlur={(e) => handleCellEdit(product.id, 'units_per_pack', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                unitsPerPackValue >= 2 ? `${unitsPerPackValue}x` : '—'
              )}
            </td>
            <td className="p-4 text-right font-mono font-semibold">
              {isEditing ? (
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  defaultValue={packPriceValue}
                  onBlur={(e) => handleCellEdit(product.id, 'pack_price', parseFloat(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                packPriceValue > 0 ? formatCurrency(packPriceValue) : '—'
              )}
            </td>
            <td className="p-4 text-right">
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={quantityValue}
                  onBlur={(e) => handleCellEdit(product.id, 'quantity_on_hand', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                <span
                  className={`font-semibold ${
                    product.quantity_on_hand <= product.reorder_level
                      ? 'text-red-600'
                      : 'text-slate-900'
                  }`}
                >
                  {product.quantity_on_hand}
                </span>
              )}
            </td>
            <td className="p-4 text-right">
              {isEditing ? (
                <input
                  type="number"
                  defaultValue={reorderLevelValue}
                  onBlur={(e) => handleCellEdit(product.id, 'reorder_level', parseInt(e.target.value) || 0)}
                  className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-right"
                />
              ) : (
                product.reorder_level
              )}
            </td>
            <td className="p-4 text-center">
              <span
                className={`px-2 py-1 rounded-full text-xs font-medium ${
                  !isActiveValue
                    ? 'bg-red-100 text-red-800'
                    : product.quantity_on_hand === 0
                      ? 'bg-red-100 text-red-800'
                      : product.quantity_on_hand <= product.reorder_level
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-green-100 text-green-800'
                }`}
              >
                {!isActiveValue
                  ? 'Inactive'
                  : product.quantity_on_hand === 0
                    ? 'Out of Stock'
                    : product.quantity_on_hand <= product.reorder_level
                      ? 'Low Stock'
                      : 'In Stock'}
              </span>
            </td>
            <td className="p-4">
              <div className="flex items-center space-x-1">
                {isEditing ? (
                  <>
                    <button
                      onClick={() => void saveProduct(product.id)}
                      className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                      title="Save"
                    >
                      <Save className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => cancelEditingProduct(product.id)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                      title="Cancel"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => startEditingProduct(product.id)}
                      className="p-1 text-slate-600 hover:bg-slate-100 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => setItemHistoryProduct(product)}
                      className="p-1 text-blue-500 hover:bg-blue-100 rounded transition-colors"
                      title="View item history"
                    >
                      <History className="w-4 h-4" />
                    </button>
                  </>
                )}
              </div>
            </td>
          </tr>
        );
      }),
    [
      paginatedProducts,
      editingRows,
      selectedProducts,
      editDrafts,
      categoryOptions,
      formatCurrency,
      handleCellEdit,
      toggleSelectProduct,
      saveProduct,
      startEditingProduct,
      cancelEditingProduct,
    ]
  );

  return (
    <div className="h-full min-h-0 bg-slate-50 flex flex-col">
      {/* Filters */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 lg:gap-4">
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search products, SKU, or barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="min-w-[200px] max-w-full px-4 py-3 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            >
              <option value="">All Departments</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={openDepartmentModal}
              className="touch-target-sm px-3 py-2.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium"
            >
              <span className="inline-flex items-center gap-1.5">
                <Building2 className="w-4 h-4" />
                Departments
              </span>
            </button>

            <button
              onClick={() => {
                void loadProducts('sync');
              }}
              className="touch-target-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            >
              <RefreshCw className={`w-5 h-5 text-slate-600 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
        {hasDeferredCatalogRefresh && hasActiveEditor && (
          <div className="mt-2 text-xs font-medium text-amber-700">
            Catalog updated in background. Changes will apply after you finish editing.
          </div>
        )}
      </div>

      {/* Excel-like Table */}
      <div className="flex-1 min-h-0 overflow-y-auto p-4 sm:p-6 lg:p-8">
        {error && (
          <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}
        <div className="bg-white rounded-xl shadow-medium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="w-12 p-4">
                    <input
                      type="checkbox"
                      checked={selectedOnPageCount === paginatedProducts.length && paginatedProducts.length > 0}
                      onChange={selectAllProducts}
                      className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                    />
                  </th>
                  <th className="text-left p-4 font-semibold text-slate-900">SKU</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Barcode</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Product Name</th>
                  <th className="text-left p-4 font-semibold text-slate-900">Department</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Cost Price</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Selling Price</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Pack Size</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Pack Price</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Stock</th>
                  <th className="text-right p-4 font-semibold text-slate-900">Reorder Level</th>
                  <th className="text-center p-4 font-semibold text-slate-900">Status</th>
                  <th className="w-16 p-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* New Product Row */}
                {showNewRow && (
                  <tr className="bg-blue-50 border-2 border-blue-200">
                    <td className="p-4">
                      <Package className="w-5 h-5 text-blue-600" />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Auto-generated"
                        value={newProduct.sku || ''}
                        onChange={(e) => handleNewProductChange('sku', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        ref={newBarcodeInputRef}
                        type="text"
                        placeholder="Scan or type barcode"
                        value={newProduct.barcode || ''}
                        onChange={(e) => handleNewProductChange('barcode', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm font-mono"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        placeholder="Product name *"
                        value={newProduct.name || ''}
                        onChange={(e) => handleNewProductChange('name', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                        required
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={newProduct.category || ''}
                        onChange={(e) => handleNewProductChange('category', e.target.value)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm"
                      >
                        <option value="">Select Department</option>
                        {categoryOptions.map((cat) => (
                          <option key={cat} value={cat}>{cat}</option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newProduct.cost_price || ''}
                        onChange={(e) => handleNewProductChange('cost_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0.00"
                        value={newProduct.unit_price || ''}
                        onChange={(e) => handleNewProductChange('unit_price', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={newProduct.quantity_on_hand || ''}
                        onChange={(e) => handleNewProductChange('quantity_on_hand', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        placeholder="0"
                        value={newProduct.reorder_level || ''}
                        onChange={(e) => handleNewProductChange('reorder_level', parseInt(e.target.value) || 0)}
                        className="w-full px-2 py-1 border border-slate-200 rounded focus:ring-1 focus:ring-indigo-500 text-sm text-right"
                      />
                    </td>
                    <td className="p-4 text-center">
                      <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                        New
                      </span>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={addNewProduct}
                          className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                          title="Save"
                        >
                          <Save className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setShowNewRow(false);
                            setNewProduct({});
                            setNewProductSellingPriceManuallyEdited(false);
                          }}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Cancel"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )}

                {/* Existing Products */}
                {productRows}
              </tbody>
            </table>
          </div>

          {filteredProducts.length > 0 && (
            <div className="px-4 py-3 border-t border-slate-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="text-sm text-slate-600">
                Showing {(currentPage - 1) * PRODUCT_PAGE_SIZE + 1}
                {' '}to{' '}
                {Math.min(currentPage * PRODUCT_PAGE_SIZE, filteredProducts.length)}
                {' '}of {filteredProducts.length} products
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage <= 1}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-sm font-medium text-slate-700 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Prev
                </button>
                <span className="text-sm font-medium text-slate-700">
                  Page {currentPage} / {totalPages}
                </span>
                <button
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage >= totalPages}
                  className="px-3 py-1.5 rounded-md border border-slate-300 text-sm font-medium text-slate-700 bg-white disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Empty State */}
          {products.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <Package className="w-16 h-16 text-slate-300 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-slate-900 mb-2">No products found</h3>
              <p className="text-slate-600 mb-6">Start by adding your first product to the inventory</p>
              <button
                onClick={handleShowNewRow}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-semibold"
              >
                Add First Product
              </button>
            </div>
          )}

          {products.length > 0 && filteredProducts.length === 0 && !isLoading && (
            <div className="p-12 text-center">
              <Search className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-lg font-semibold text-slate-900 mb-1">No matching products</h3>
              <p className="text-slate-600">Try a different search or clear department filter.</p>
            </div>
          )}

          {/* Loading State */}
          {isLoading && (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 text-indigo-600 animate-spin mx-auto mb-4" />
              <p className="text-slate-600">Loading products...</p>
            </div>
          )}
        </div>

        {/* Bulk Actions */}
        {selectedProducts.size > 0 && (
          <div className="mt-6 bg-white rounded-lg border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-700">
                {selectedProducts.size} product{selectedProducts.size !== 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center space-x-2">
                <button className="px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors">
                  Bulk Edit
                </button>
                <button className="px-4 py-2 text-sm font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded-lg transition-colors">
                  Delete Selected
                </button>
              </div>
            </div>
          </div>
        )}

        {showDepartmentModal && (
          <div className="fixed inset-0 z-50 bg-black/45 flex items-center justify-center p-4">
            <div className="w-full max-w-4xl max-h-[90vh] overflow-hidden rounded-2xl border border-stone-200 bg-white shadow-2xl flex flex-col">
              <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-900">Department Setup</h3>
                  <p className="text-xs text-stone-500 mt-0.5">
                    Create departments and set default margin for auto sale pricing.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowDepartmentModal(false)}
                  className="p-2 rounded-lg text-stone-500 hover:text-slate-900 hover:bg-stone-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 overflow-y-auto flex-1 min-h-0 space-y-4">
                {departmentModalError && (
                  <div className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
                    {departmentModalError}
                  </div>
                )}

                <div className="rounded-xl border border-stone-200 p-4 bg-stone-50">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3">Add Department</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <input
                      value={departmentCreateForm.name}
                      onChange={(e) =>
                        setDepartmentCreateForm((prev) => ({ ...prev, name: e.target.value }))
                      }
                      placeholder="Department name"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm"
                    />
                    <input
                      value={departmentCreateForm.code}
                      onChange={(e) =>
                        setDepartmentCreateForm((prev) => ({ ...prev, code: e.target.value }))
                      }
                      placeholder="Code (optional)"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={departmentCreateForm.default_markup_percentage}
                      onChange={(e) =>
                        setDepartmentCreateForm((prev) => ({
                          ...prev,
                          default_markup_percentage: e.target.value,
                        }))
                      }
                      placeholder="Default margin %"
                      className="w-full px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm"
                    />
                    <label className="inline-flex items-center gap-2 px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={departmentCreateForm.auto_pricing_enabled}
                        onChange={(e) =>
                          setDepartmentCreateForm((prev) => ({
                            ...prev,
                            auto_pricing_enabled: e.target.checked,
                          }))
                        }
                        className="rounded border-stone-300"
                      />
                      Auto pricing enabled
                    </label>
                  </div>
                  <textarea
                    value={departmentCreateForm.description}
                    onChange={(e) =>
                      setDepartmentCreateForm((prev) => ({ ...prev, description: e.target.value }))
                    }
                    placeholder="Description (optional)"
                    rows={2}
                    className="w-full mt-3 px-3 py-2.5 rounded-lg border border-stone-300 bg-white text-sm"
                  />
                  <div className="mt-3 flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateDepartment}
                      className="px-4 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-stone-100 text-sm font-semibold"
                    >
                      Create Department
                    </button>
                  </div>
                </div>

                <div className="rounded-xl border border-stone-200 overflow-hidden">
                  <table className="w-full text-sm">
                    <thead className="bg-stone-100 text-stone-600 text-[11px] uppercase tracking-wide">
                      <tr>
                        <th className="px-3 py-2 text-left">Department</th>
                        <th className="px-3 py-2 text-right w-44">Default Margin %</th>
                        <th className="px-3 py-2 text-center w-44">Auto Pricing</th>
                        <th className="px-3 py-2 text-right w-28">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100">
                      {departments
                        .slice()
                        .sort((a, b) => a.name.localeCompare(b.name))
                        .map((department) => {
                          const draft = departmentPolicyDrafts[department.id] || {
                            default_markup_percentage: String(Number(department.default_markup_percentage ?? 30)),
                            auto_pricing_enabled: department.auto_pricing_enabled !== false,
                          };
                          return (
                            <tr key={department.id}>
                              <td className="px-3 py-2">
                                <div className="font-medium text-slate-900">{department.name}</div>
                                {department.source === 'product_category' && (
                                  <div className="text-[11px] text-stone-500">From existing items</div>
                                )}
                              </td>
                              <td className="px-3 py-2">
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={draft.default_markup_percentage}
                                  onChange={(e) =>
                                    setDepartmentPolicyDrafts((prev) => ({
                                      ...prev,
                                      [department.id]: {
                                        ...draft,
                                        default_markup_percentage: e.target.value,
                                      },
                                    }))
                                  }
                                  className="w-full px-2.5 py-2 rounded-lg border border-stone-300 bg-white text-right"
                                />
                              </td>
                              <td className="px-3 py-2 text-center">
                                <input
                                  type="checkbox"
                                  checked={draft.auto_pricing_enabled}
                                  onChange={(e) =>
                                    setDepartmentPolicyDrafts((prev) => ({
                                      ...prev,
                                      [department.id]: {
                                        ...draft,
                                        auto_pricing_enabled: e.target.checked,
                                      },
                                    }))
                                  }
                                  className="rounded border-stone-300"
                                />
                              </td>
                              <td className="px-3 py-2 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleSaveDepartmentPolicy(department.id)}
                                  disabled={departmentSavingId === department.id}
                                  className="px-3 py-2 rounded-lg border border-stone-300 bg-white hover:bg-stone-100 text-xs font-semibold text-slate-700 disabled:opacity-60"
                                >
                                  {departmentSavingId === department.id
                                    ? 'Saving...'
                                    : department.source === 'product_category'
                                      ? 'Create Policy'
                                      : 'Save'}
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
          </div>
        )}

        <ItemHistoryModal
          isOpen={!!itemHistoryProduct}
          onClose={() => setItemHistoryProduct(null)}
          product={itemHistoryProduct}
        />
      </div>
    </div>
  );
});

ProductManagement.displayName = 'ProductManagement';

export default ProductManagement;
