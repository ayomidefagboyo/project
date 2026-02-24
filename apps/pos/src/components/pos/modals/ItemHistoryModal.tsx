import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  X,
  Clock,
  Download,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Package,
  ArrowRightLeft,
} from 'lucide-react';
import type { POSProduct, StockMovement } from '@/lib/posService';
import { posService } from '@/lib/posService';
import { useOutlet } from '@/contexts/OutletContext';
import { useToast } from '../../ui/Toast';

type MovementFilter = 'all' | 'sale' | 'receive' | 'adjustment' | 'transfer' | 'return';

interface ItemHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  product: POSProduct | null;
}

const parsePositiveCost = (value: unknown): number | null => {
  const next = Number(value);
  if (!Number.isFinite(next) || next <= 0) return null;
  return next;
};

const ItemHistoryModal: React.FC<ItemHistoryModalProps> = ({ isOpen, onClose, product }) => {
  const { currentOutlet } = useOutlet();
  const { error: showError } = useToast();
  const showErrorRef = useRef(showError);
  const [isLoading, setIsLoading] = useState(false);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [selectedFilter, setSelectedFilter] = useState<MovementFilter>('all');
  const [dateRange, setDateRange] = useState({
    startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    showErrorRef.current = showError;
  }, [showError]);

  const loadMovements = useCallback(async () => {
    if (!currentOutlet?.id || !product?.id) return;

    setIsLoading(true);
    try {
      const data = await posService.getStockMovements({
        outlet_id: currentOutlet.id,
        product_id: product.id,
        date_from: dateRange.startDate,
        date_to: dateRange.endDate,
        limit: 500,
      });
      setMovements(data || []);
    } catch (err) {
      console.error('Error fetching item history:', err);
      showErrorRef.current('Failed to load item history');
      setMovements([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentOutlet?.id, product?.id, dateRange.startDate, dateRange.endDate]);

  useEffect(() => {
    if (!isOpen || !product?.id) return;
    setSelectedFilter('all');
  }, [isOpen, product?.id]);

  useEffect(() => {
    if (!isOpen || !product?.id) return;
    void loadMovements();
  }, [isOpen, product?.id, loadMovements]);

  // --- Helpers ---

  const formatCurrency = (amount: number): string =>
    new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2,
    }).format(amount);

  const formatDate = (dateStr: string): string => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-NG', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getMovementTypeBadge = (type: StockMovement['movement_type']) => {
    const configs: Record<StockMovement['movement_type'], { label: string; color: string }> = {
      sale: { label: 'Sale', color: 'bg-red-100 text-red-800' },
      receive: { label: 'Received', color: 'bg-green-100 text-green-800' },
      adjustment: { label: 'Adjustment', color: 'bg-yellow-100 text-yellow-800' },
      transfer_in: { label: 'Transfer In', color: 'bg-blue-100 text-blue-800' },
      transfer_out: { label: 'Transfer Out', color: 'bg-orange-100 text-orange-800' },
      return: { label: 'Return', color: 'bg-purple-100 text-purple-800' },
    };
    const config = configs[type] || { label: type, color: 'bg-gray-100 text-gray-800' };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full whitespace-nowrap ${config.color}`}>
        {config.label}
      </span>
    );
  };

  const formatReference = (movement: StockMovement): string => {
    if (!movement.reference_type && !movement.reference_id) return '-';
    const typeLabels: Record<string, string> = {
      pos_transaction: 'Sale',
      vendor_invoice: 'Invoice',
      stocktake_session: 'Stocktake',
      stock_transfer: 'Transfer',
    };
    const label = movement.reference_type
      ? typeLabels[movement.reference_type] || movement.reference_type
      : '';
    const shortId = movement.reference_id ? movement.reference_id.slice(-8) : '';
    return `${label} #${shortId}`;
  };

  // --- Filtered data ---

  const filteredMovements = movements.filter((m) => {
    if (selectedFilter === 'all') return true;
    if (selectedFilter === 'transfer') return m.movement_type === 'transfer_in' || m.movement_type === 'transfer_out';
    return m.movement_type === selectedFilter;
  });

  const costMetaByMovementId = useMemo(() => {
    const map = new Map<string, { current: number | null; previous: number | null; delta: number | null }>();
    for (let index = 0; index < filteredMovements.length; index += 1) {
      const movement = filteredMovements[index];
      const current = parsePositiveCost(movement.unit_cost);
      let previous: number | null = null;

      if (current !== null) {
        for (let olderIndex = index + 1; olderIndex < filteredMovements.length; olderIndex += 1) {
          const olderCost = parsePositiveCost(filteredMovements[olderIndex].unit_cost);
          if (olderCost !== null) {
            previous = olderCost;
            break;
          }
        }
      }

      map.set(movement.id, {
        current,
        previous,
        delta: current !== null && previous !== null ? Number((current - previous).toFixed(2)) : null,
      });
    }
    return map;
  }, [filteredMovements]);

  // --- Summary ---

  const totalIn = movements
    .filter((m) => m.quantity_change > 0)
    .reduce((sum, m) => sum + m.quantity_change, 0);

  const totalOut = movements
    .filter((m) => m.quantity_change < 0)
    .reduce((sum, m) => sum + Math.abs(m.quantity_change), 0);

  // --- Export ---

  const exportCSV = () => {
    if (!product || filteredMovements.length === 0) return;

    let csv = `Item History - ${product.name} (${product.sku || 'No SKU'})\n`;
    csv += `Outlet: ${currentOutlet?.name || ''}\n`;
    csv += `Date Range: ${dateRange.startDate} to ${dateRange.endDate}\n`;
    csv += `Generated: ${new Date().toLocaleString()}\n\n`;
    csv += `Date,Type,Qty Change,Balance After,Unit Cost,Cost Change,Reference,Notes\n`;

    filteredMovements.forEach((m) => {
      const change = m.quantity_change > 0 ? `+${m.quantity_change}` : `${m.quantity_change}`;
      const notes = (m.notes || '').replace(/,/g, ';').replace(/\n/g, ' ');
      const costMeta = costMetaByMovementId.get(m.id);
      const unitCost = costMeta?.current !== null && costMeta?.current !== undefined
        ? costMeta.current.toFixed(2)
        : '';
      const costChange = costMeta?.delta !== null && costMeta?.delta !== undefined
        ? costMeta.delta.toFixed(2)
        : '';
      csv += `${formatDate(m.movement_date)},${m.movement_type},${change},${m.quantity_after},${unitCost},${costChange},${formatReference(m)},${notes}\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.setAttribute('href', URL.createObjectURL(blob));
    link.setAttribute(
      'download',
      `item-history-${(product.sku || product.name).replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.csv`
    );
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- Tabs ---

  const tabs: { id: MovementFilter; name: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'all', name: 'All', icon: Clock },
    { id: 'sale', name: 'Sales', icon: TrendingDown },
    { id: 'receive', name: 'Received', icon: TrendingUp },
    { id: 'adjustment', name: 'Adjustments', icon: Package },
    { id: 'transfer', name: 'Transfers', icon: ArrowRightLeft },
    { id: 'return', name: 'Returns', icon: RefreshCw },
  ];

  if (!isOpen || !product) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-6xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b flex-shrink-0">
          <div className="flex items-center space-x-3 min-w-0">
            <Clock className="w-6 h-6 text-blue-600 flex-shrink-0" />
            <div className="min-w-0">
              <h2 className="text-xl font-bold text-gray-900 truncate">Item History</h2>
              <p className="text-sm text-gray-500 truncate">
                {product.name}
                {product.sku ? ` · ${product.sku}` : ''}
              </p>
            </div>
            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800 whitespace-nowrap flex-shrink-0">
              Stock: {product.quantity_on_hand ?? 0}
            </span>
          </div>
          <div className="flex items-center space-x-3 flex-shrink-0">
            <button
              onClick={loadMovements}
              disabled={isLoading}
              className="flex items-center px-3 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              onClick={exportCSV}
              disabled={filteredMovements.length === 0}
              className="flex items-center px-3 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4 mr-1" />
              Export CSV
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-green-600">Total In</p>
                  <p className="text-2xl font-bold text-green-900">+{totalIn}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-600" />
              </div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-red-600">Total Out</p>
                  <p className="text-2xl font-bold text-red-900">-{totalOut}</p>
                </div>
                <TrendingDown className="w-8 h-8 text-red-600" />
              </div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-600">Current Stock</p>
                  <p className="text-2xl font-bold text-blue-900">{product.quantity_on_hand ?? 0}</p>
                </div>
                <Package className="w-8 h-8 text-blue-600" />
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Movements</p>
                  <p className="text-2xl font-bold text-gray-900">{movements.length}</p>
                </div>
                <Clock className="w-8 h-8 text-gray-500" />
              </div>
            </div>
          </div>

          {/* Date Range Filter */}
          <div className="mb-6 flex items-center space-x-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From</label>
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, startDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To</label>
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange((prev) => ({ ...prev, endDate: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
              />
            </div>
          </div>

          {/* Tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="flex space-x-8">
              {tabs.map((tab) => {
                const TabIcon = tab.icon;
                const count =
                  tab.id === 'all'
                    ? movements.length
                    : tab.id === 'transfer'
                      ? movements.filter((m) => m.movement_type === 'transfer_in' || m.movement_type === 'transfer_out').length
                      : movements.filter((m) => m.movement_type === tab.id).length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSelectedFilter(tab.id)}
                    className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                      selectedFilter === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <TabIcon className="w-4 h-4" />
                    <span>{tab.name}</span>
                    <span
                      className={`px-2 py-0.5 text-xs rounded-full ${
                        selectedFilter === tab.id
                          ? 'bg-blue-100 text-blue-600'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {count}
                    </span>
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Content */}
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600">Loading item history...</p>
              </div>
            </div>
          ) : filteredMovements.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-12 h-12 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500">No movement history found for this item.</p>
              <p className="text-sm text-gray-400 mt-1">Try adjusting the date range or filter.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Date
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Type
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Qty Change
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Balance
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Reference
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Unit Cost
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Cost Change
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Notes
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredMovements.map((movement) => {
                    const costMeta = costMetaByMovementId.get(movement.id);
                    const hasCostChange =
                      costMeta?.delta !== null &&
                      costMeta?.delta !== undefined &&
                      Math.abs(costMeta.delta) > 0;
                    return (
                    <tr key={movement.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-700">
                        {formatDate(movement.movement_date)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {getMovementTypeBadge(movement.movement_type)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right">
                        <span
                          className={`font-semibold ${
                            movement.quantity_change > 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {movement.quantity_change > 0 ? '+' : ''}
                          {movement.quantity_change}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {movement.quantity_after}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                        {formatReference(movement)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-700">
                        {costMeta?.current !== null && costMeta?.current !== undefined
                          ? formatCurrency(costMeta.current)
                          : '-'}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        {costMeta?.current === null || costMeta?.current === undefined ? (
                          <span className="text-gray-400">-</span>
                        ) : costMeta.previous === null || costMeta.previous === undefined ? (
                          <span className="text-gray-500">Initial cost</span>
                        ) : hasCostChange ? (
                          <span className={costMeta.delta! > 0 ? 'text-red-600 font-medium' : 'text-green-600 font-medium'}>
                            {formatCurrency(costMeta.previous)} → {formatCurrency(costMeta.current)}
                          </span>
                        ) : (
                          <span className="text-gray-500">No change</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-[200px] truncate">
                        {movement.notes || '-'}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ItemHistoryModal;
