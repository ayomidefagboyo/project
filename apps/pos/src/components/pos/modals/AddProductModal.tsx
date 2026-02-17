import React, { useEffect, useMemo, useState } from 'react';
import { X, Save } from 'lucide-react';
import { posService, type POSDepartment } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';
import { useToast } from '../../ui/Toast';

interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
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

const normalizeDepartmentName = (value?: string | null): string => String(value || '').trim();

const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const { currentOutlet } = useOutlet();
  const { success, error: showError } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [departments, setDepartments] = useState<POSDepartment[]>([]);
  const [unitPriceManuallyEdited, setUnitPriceManuallyEdited] = useState(false);
  const [showDepartmentForm, setShowDepartmentForm] = useState(false);
  const [isCreatingDepartment, setIsCreatingDepartment] = useState(false);
  const [departmentForm, setDepartmentForm] = useState({
    name: '',
    code: '',
    description: '',
    default_markup_percentage: '30',
    auto_pricing_enabled: true,
  });
  const [formData, setFormData] = useState({
    name: '',
    barcode: '',
    category: '',
    unit_price: '',
    cost_price: '',
    stock_quantity: '',
    min_stock_level: '',
    supplier_name: '',
    has_expiry: false,
    shelf_life_days: '',
    description: ''
  });

  const departmentOptions = useMemo(() => {
    const byKey = new Map<string, string>();
    const add = (value?: string | null) => {
      const normalized = normalizeDepartmentName(value);
      if (!normalized) return;
      const key = normalized.toLowerCase();
      if (!byKey.has(key)) {
        byKey.set(key, normalized);
      }
    };

    departments
      .filter((department) => department.is_active !== false)
      .forEach((department) => add(department.name));

    if (byKey.size === 0) {
      DEFAULT_DEPARTMENTS.forEach((department) => add(department));
    }

    return Array.from(byKey.values()).sort((a, b) => a.localeCompare(b));
  }, [departments]);

  const departmentByName = useMemo(() => {
    const map = new Map<string, POSDepartment>();
    departments.forEach((department) => {
      const key = normalizeDepartmentName(department.name).toLowerCase();
      if (!key) return;
      map.set(key, department);
    });
    return map;
  }, [departments]);

  const calculateAutoUnitPrice = (costPriceRaw: string | number, categoryRaw: string): string => {
    const costPrice = Math.max(0, Number(costPriceRaw || 0));
    if (costPrice <= 0) return '0';
    const key = normalizeDepartmentName(categoryRaw).toLowerCase();
    const policy = key ? departmentByName.get(key) : undefined;
    const autoPricingEnabled = policy?.auto_pricing_enabled !== false;
    if (!autoPricingEnabled) {
      return costPrice.toFixed(2);
    }
    const markup = Math.max(0, Number(policy?.default_markup_percentage ?? 30));
    const calculated = costPrice * (1 + markup / 100);
    return calculated.toFixed(2);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    const nextValue = type === 'checkbox' ? (e.target as HTMLInputElement).checked : value;

    setFormData(prev => {
      const next = {
        ...prev,
        [name]: nextValue
      } as typeof prev;

      if (name === 'unit_price') {
        setUnitPriceManuallyEdited(true);
      }

      if ((name === 'cost_price' || name === 'category') && !unitPriceManuallyEdited) {
        next.unit_price = calculateAutoUnitPrice(
          name === 'cost_price' ? String(nextValue) : prev.cost_price,
          name === 'category' ? String(nextValue) : prev.category
        );
      }

      return next;
    });
  };

  const loadDepartments = async () => {
    if (!currentOutlet?.id) {
      setDepartments([]);
      return;
    }
    try {
      const rows = await posService.getDepartments(currentOutlet.id);
      setDepartments(rows || []);
    } catch (err) {
      console.error('Failed to load departments for Add Product modal:', err);
      setDepartments([]);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void loadDepartments();
  }, [isOpen, currentOutlet?.id]);

  const handleCreateDepartment = async () => {
    if (!currentOutlet?.id) return;
    const name = normalizeDepartmentName(departmentForm.name);
    if (!name) {
      showError('Department name is required.');
      return;
    }

    try {
      setIsCreatingDepartment(true);
      const markup = Math.max(0, Number(departmentForm.default_markup_percentage || 0));
      const created = await posService.createDepartment({
        outlet_id: currentOutlet.id,
        name,
        code: departmentForm.code.trim() || undefined,
        description: departmentForm.description.trim() || undefined,
        default_markup_percentage: markup,
        auto_pricing_enabled: departmentForm.auto_pricing_enabled,
      });
      setDepartments((prev) => {
        const next = [...prev];
        const key = created.name.trim().toLowerCase();
        if (!next.some((item) => item.name.trim().toLowerCase() === key)) {
          next.push(created);
        }
        return next;
      });
      setFormData((prev) => ({ ...prev, category: created.name }));
      if (!unitPriceManuallyEdited && Number(formData.cost_price || 0) > 0) {
        setFormData((prev) => ({
          ...prev,
          unit_price: calculateAutoUnitPrice(prev.cost_price, created.name),
        }));
      }
      setDepartmentForm({
        name: '',
        code: '',
        description: '',
        default_markup_percentage: '30',
        auto_pricing_enabled: true,
      });
      setShowDepartmentForm(false);
    } catch (err) {
      console.error('Failed to create department from Add Product modal:', err);
      showError('Failed to create department. Ensure migration is applied and try again.');
    } finally {
      setIsCreatingDepartment(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentOutlet?.id) return;

    setIsLoading(true);
    try {
      const category = normalizeDepartmentName(formData.category);
      const policy = departmentByName.get(category.toLowerCase());
      const markup = Math.max(0, Number(policy?.default_markup_percentage ?? 30));
      const autoPricingEnabled = policy?.auto_pricing_enabled !== false;

      await posService.createProduct({
        outlet_id: currentOutlet.id,
        name: formData.name,
        description: formData.description || undefined,
        category,
        unit_price: parseFloat(formData.unit_price) || 0,
        cost_price: parseFloat(formData.cost_price) || 0,
        quantity_on_hand: parseInt(formData.stock_quantity) || 0,
        reorder_level: parseInt(formData.min_stock_level) || 0,
        reorder_quantity: parseInt(formData.min_stock_level) || 0, // Set reorder quantity same as reorder level
        tax_rate: 0.075, // 7.5% VAT for Nigeria
        min_shelf_life_days: formData.has_expiry && formData.shelf_life_days ? parseInt(formData.shelf_life_days) : undefined,
        sku: formData.barcode || `SKU-${Date.now()}`, // Generate SKU if not provided
        barcode: formData.barcode || undefined,
        markup_percentage: markup,
        auto_pricing: autoPricingEnabled,
      });

      success('Product added successfully!');
      onSuccess();
      onClose();

      // Reset form
      setFormData({
        name: '',
        barcode: '',
        category: '',
        unit_price: '',
        cost_price: '',
        stock_quantity: '',
        min_stock_level: '',
        supplier_name: '',
        has_expiry: false,
        shelf_life_days: '',
        description: ''
      });
      setUnitPriceManuallyEdited(false);
      setShowDepartmentForm(false);
    } catch (err) {
      console.error('Error adding product:', err);
      showError('Failed to add product. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-bold text-gray-900">Add New Product</h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Product Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Product Name *
              </label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter product name"
              />
            </div>

            {/* Barcode */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Barcode *
              </label>
              <input
                type="text"
                name="barcode"
                value={formData.barcode}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter barcode"
              />
            </div>

            {/* Category */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-sm font-medium text-gray-700">
                  Department *
                </label>
                <button
                  type="button"
                  onClick={() => setShowDepartmentForm((prev) => !prev)}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700"
                >
                  {showDepartmentForm ? 'Hide' : '+ New department'}
                </button>
              </div>
              <select
                name="category"
                value={formData.category}
                onChange={handleInputChange}
                required
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Select department</option>
                {departmentOptions.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
              {showDepartmentForm && (
                <div className="mt-2 p-3 rounded-lg border border-gray-200 bg-gray-50 space-y-2">
                  <input
                    type="text"
                    value={departmentForm.name}
                    onChange={(e) => setDepartmentForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Department name"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={departmentForm.code}
                      onChange={(e) => setDepartmentForm((prev) => ({ ...prev, code: e.target.value }))}
                      placeholder="Code (optional)"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={departmentForm.default_markup_percentage}
                      onChange={(e) =>
                        setDepartmentForm((prev) => ({
                          ...prev,
                          default_markup_percentage: e.target.value,
                        }))
                      }
                      placeholder="Default margin %"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                    />
                  </div>
                  <label className="flex items-center gap-2 text-sm text-gray-700">
                    <input
                      type="checkbox"
                      checked={departmentForm.auto_pricing_enabled}
                      onChange={(e) =>
                        setDepartmentForm((prev) => ({
                          ...prev,
                          auto_pricing_enabled: e.target.checked,
                        }))
                      }
                      className="rounded border-gray-300"
                    />
                    Auto pricing enabled
                  </label>
                  <textarea
                    value={departmentForm.description}
                    onChange={(e) => setDepartmentForm((prev) => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={handleCreateDepartment}
                      disabled={isCreatingDepartment}
                      className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold disabled:opacity-60"
                    >
                      {isCreatingDepartment ? 'Saving...' : 'Create Department'}
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Unit Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Unit Price (₦) *
              </label>
              <input
                type="number"
                name="unit_price"
                value={formData.unit_price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            {/* Cost Price */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Cost Price (₦) *
              </label>
              <input
                type="number"
                name="cost_price"
                value={formData.cost_price}
                onChange={handleInputChange}
                required
                min="0"
                step="0.01"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0.00"
              />
            </div>

            {/* Stock Quantity */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Initial Stock Quantity *
              </label>
              <input
                type="number"
                name="stock_quantity"
                value={formData.stock_quantity}
                onChange={handleInputChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            {/* Min Stock Level */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimum Stock Level *
              </label>
              <input
                type="number"
                name="min_stock_level"
                value={formData.min_stock_level}
                onChange={handleInputChange}
                required
                min="0"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            {/* Supplier Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Supplier Name
              </label>
              <input
                type="text"
                name="supplier_name"
                value={formData.supplier_name}
                onChange={handleInputChange}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Enter supplier name"
              />
            </div>
          </div>

          {/* Has Expiry */}
          <div className="flex items-center space-x-2">
            <input
              type="checkbox"
              name="has_expiry"
              checked={formData.has_expiry}
              onChange={handleInputChange}
              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <label className="text-sm font-medium text-gray-700">
              Product has expiry date
            </label>
          </div>

          {/* Shelf Life (conditional) */}
          {formData.has_expiry && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Shelf Life (days)
              </label>
              <input
                type="number"
                name="shelf_life_days"
                value={formData.shelf_life_days}
                onChange={handleInputChange}
                min="1"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="365"
              />
            </div>
          )}

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Enter product description"
            />
          </div>

          {/* Submit Button */}
          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 bg-gray-200 hover:bg-gray-300 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {isLoading ? (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Add Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
