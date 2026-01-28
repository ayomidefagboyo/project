/**
 * POS Dashboard - Main POS Interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  Wifi,
  WifiOff,
  AlertCircle,
  Plus,
  TruckIcon,
  RotateCcw,
  Package2,
  ClipboardList,
  Menu,
  X,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, PaymentMethod } from '@/lib/posService';
import type { POSProduct } from '@/lib/posService';

// Sub-components (we'll create these next)
import POSProductGrid from './POSProductGrid';
import POSShoppingCart from './POSShoppingCart';
import POSPaymentModal from './POSPaymentModal';


// Inventory Management Modals
import AddProductModal from './modals/AddProductModal';
import ReceiveStockModal from './modals/ReceiveStockModal';
import StockTransferModal from './modals/StockTransferModal';
import StockAdjustmentModal from './modals/StockAdjustmentModal';
import StockReportModal from './modals/StockReportModal';

export interface CartItem {
  product: POSProduct;
  quantity: number;
  unitPrice: number;
  discount: number;
}

const POSDashboard: React.FC = () => {
  // Context and state
  const { currentUser, currentOutlet } = useOutlet();

  // POS State
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineTransactionCount, setOfflineTransactionCount] = useState(0);

  // UI State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAdminSidebar, setShowAdminSidebar] = useState(false);

  // Inventory Management Modal States
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showReceiveStockModal, setShowReceiveStockModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);
  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [showStockReportModal, setShowStockReportModal] = useState(false);

  // Load products on mount
  useEffect(() => {
    if (currentOutlet?.id) {
      loadProducts();
    }
  }, [currentOutlet?.id, selectedCategory, searchQuery]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineTransactions();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check offline transactions count
    setOfflineTransactionCount(posService.getOfflineTransactionCountSync());

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  /**
   * Load products from API
   */
  const loadProducts = async () => {
    if (!currentOutlet?.id) return;

    try {
      setIsLoading(true);
      const response = await posService.getProducts(currentOutlet.id, {
        search: searchQuery || undefined,
        category: selectedCategory || undefined,
        activeOnly: true,
        size: 100
      });

      setProducts(response?.items || []);
      setError(null);
    } catch (err) {
      setError('Failed to load products. Please try again.');
      console.error('Error loading products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Sync offline transactions when back online
   */
  const syncOfflineTransactions = async () => {
    try {
      const synced = await posService.syncOfflineTransactions();
      if (synced > 0) {
        setOfflineTransactionCount(0);
        alert(`${synced} offline transactions synced successfully!`);
      }
    } catch (error) {
      console.error('Error syncing offline transactions:', error);
    }
  };

  /**
   * Add product to cart
   */
  const addToCart = (product: POSProduct, quantity: number = 1) => {
    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.product.id === product.id);

      if (existingItem) {
        // Update quantity
        return prevCart.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item
        return [...prevCart, {
          product,
          quantity,
          unitPrice: product.unit_price,
          discount: 0
        }];
      }
    });
  };

  /**
   * Remove item from cart
   */
  const removeFromCart = (productId: string) => {
    setCart(prevCart => prevCart.filter(item => item.product.id !== productId));
  };

  /**
   * Update cart item quantity
   */
  const updateCartItemQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  /**
   * Update cart item discount
   */
  const updateCartItemDiscount = (productId: string, discount: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.product.id === productId
          ? { ...item, discount }
          : item
      )
    );
  };

  /**
   * Clear cart
   */
  const clearCart = () => {
    setCart([]);
  };

  /**
   * Handle barcode scan
   */
  const handleBarcodeScan = async (barcode: string) => {
    if (!currentOutlet?.id) return;

    try {
      const product = await posService.getProductByBarcode(barcode, currentOutlet.id);
      addToCart(product);
    } catch (error) {
      alert('Product not found for this barcode');
    }
  };

  /**
   * Calculate cart totals
   */
  const calculateCartTotals = () => {
    let subtotal = 0;
    let totalTax = 0;
    let totalDiscount = 0;

    cart.forEach(item => {
      const lineSubtotal = item.unitPrice * item.quantity;
      const lineDiscount = item.discount * item.quantity;
      const lineTaxableAmount = lineSubtotal - lineDiscount;
      const lineTax = lineTaxableAmount * item.product.tax_rate;

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      totalTax += lineTax;
    });

    const total = subtotal - totalDiscount + totalTax;

    return {
      subtotal,
      totalDiscount,
      totalTax,
      total
    };
  };


  /**
   * Handle direct payment without modal
   */
  const handleDirectPayment = async (paymentMethod: PaymentMethod) => {
    if (!currentUser?.id || !currentOutlet?.id) return;

    try {
      const totals = calculateCartTotals();

      // For cash payments, we might want to ask for tendered amount
      let tenderedAmount: number | undefined;
      if (paymentMethod === 'cash') {
        const input = prompt(`Total: ₦${totals.total.toLocaleString()}\nEnter cash amount received:`);
        if (input === null) return; // User cancelled
        tenderedAmount = parseFloat(input);
        if (isNaN(tenderedAmount) || tenderedAmount < totals.total) {
          alert('Invalid amount or insufficient cash');
          return;
        }
      }

      await handlePayment(paymentMethod, tenderedAmount);
    } catch (error) {
      console.error('Direct payment error:', error);
      alert('Payment failed. Please try again.');
    }
  };

  /**
   * Handle receipt printing
   */
  const handlePrintReceipt = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    // Create a simple receipt for printing
    const totals = calculateCartTotals();
    const receiptContent = `
=== ${currentOutlet?.name} ===
Date: ${new Date().toLocaleString()}
Cashier: ${currentUser?.name}

${cart.map(item =>
      `${item.product.name}\n${item.quantity} x ₦${item.unitPrice} = ₦${(item.quantity * item.unitPrice).toLocaleString()}`
    ).join('\n\n')}

----------------------------
Subtotal: ₦${totals.subtotal.toLocaleString()}
Discount: -₦${totals.totalDiscount.toLocaleString()}
Tax (7.5%): ₦${totals.totalTax.toLocaleString()}
----------------------------
TOTAL: ₦${totals.total.toLocaleString()}

Thank you for shopping with us!
    `;

    // Open print dialog
    const printWindow = window.open('', '_blank', 'width=300,height=600');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Receipt</title>
            <style>
              body {
                font-family: 'Courier New', monospace;
                font-size: 12px;
                white-space: pre-line;
                margin: 10px;
              }
            </style>
          </head>
          <body>${receiptContent}</body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
      printWindow.close();
    }
  };

  /**
   * Process payment
   */
  const handlePayment = async (
    paymentMethod: PaymentMethod,
    tenderedAmount?: number,
    customerName?: string
  ) => {
    if (!currentUser?.id || !currentOutlet?.id) return;

    try {
      const totals = calculateCartTotals();

      // Prepare transaction items
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discount * item.quantity
      }));

      // Create transaction request
      const transactionRequest = {
        outlet_id: currentOutlet.id,
        cashier_id: currentUser.id,
        customer_name: customerName,
        items,
        payment_method: paymentMethod,
        tendered_amount: tenderedAmount,
        discount_amount: totals.totalDiscount
      };

      // Process transaction (online or offline)
      if (isOnline) {
        await posService.createTransaction(transactionRequest);
        alert('Transaction completed successfully!');
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
        alert(`Transaction stored offline (ID: ${offlineId})`);
      }

      // Clear cart and close modal
      clearCart();
      setShowPaymentModal(false);

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    }
  };

  // Get unique categories for filter


  const cartTotals = calculateCartTotals();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Admin Sidebar - Hidden by default */}
      {showAdminSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowAdminSidebar(false)}
          />

          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-lg z-50 transform transition-transform">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Admin Panel</h2>
                <button
                  onClick={() => setShowAdminSidebar(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Inventory Management */}
              <div className="mb-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Inventory Management</h3>
                <div className="space-y-3">
                  <Link
                    to="/dashboard/products"
                    className="w-full flex items-center p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                  >
                    <Plus className="w-5 h-5 text-blue-600 mr-3" />
                    <span className="text-sm font-medium text-blue-900">Manage Products (Excel View)</span>
                  </Link>

                  <button
                    onClick={() => {
                      setShowReceiveStockModal(true);
                      setShowAdminSidebar(false);
                    }}
                    className="w-full flex items-center p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
                  >
                    <TruckIcon className="w-5 h-5 text-green-600 mr-3" />
                    <span className="text-sm font-medium text-green-900">Receive Stock Delivery</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowStockTransferModal(true);
                      setShowAdminSidebar(false);
                    }}
                    className="w-full flex items-center p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left"
                  >
                    <RotateCcw className="w-5 h-5 text-purple-600 mr-3" />
                    <span className="text-sm font-medium text-purple-900">Transfer Between Outlets</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowStockAdjustmentModal(true);
                      setShowAdminSidebar(false);
                    }}
                    className="w-full flex items-center p-3 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left"
                  >
                    <Package2 className="w-5 h-5 text-orange-600 mr-3" />
                    <span className="text-sm font-medium text-orange-900">Stock Adjustment</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowStockReportModal(true);
                      setShowAdminSidebar(false);
                    }}
                    className="w-full flex items-center p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors text-left"
                  >
                    <ClipboardList className="w-5 h-5 text-gray-600 mr-3" />
                    <span className="text-sm font-medium text-gray-900">Inventory Reports</span>
                  </button>
                </div>
              </div>

              {/* Admin Stats */}
              <div className="space-y-4">
                <h3 className="text-lg font-semibold text-gray-900">Quick Stats</h3>
                <div className="space-y-3">
                  <div className="bg-blue-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-blue-600">Products</span>
                      <span className="text-lg font-bold text-blue-900">{products.length}</span>
                    </div>
                  </div>
                  <div className="bg-green-50 p-3 rounded-lg">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-green-600">Today's Sales</span>
                      <span className="text-lg font-bold text-green-900">₦0</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Sales Terminal */}
      <div className="flex-1 p-4">
        {/* Simple Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              {/* Admin Menu Button */}
              <button
                onClick={() => setShowAdminSidebar(true)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>

              <div>
                <h1 className="text-2xl font-bold text-gray-900">Sales Terminal</h1>
                <p className="text-gray-600">{currentOutlet?.name}</p>
              </div>
            </div>

            {/* Status indicators */}
            <div className="flex items-center space-x-4">
              {/* Online/Offline status */}
              <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${isOnline
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}>
                {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                <span>{isOnline ? 'Online' : 'Offline'}</span>
              </div>

              {/* Offline transaction count */}
              {offlineTransactionCount > 0 && (
                <div className="flex items-center space-x-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                  <AlertCircle className="h-4 w-4" />
                  <span>{offlineTransactionCount} offline</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Main POS Interface - No Scroll Layout */}
        <div className="grid grid-cols-12 gap-4 h-[calc(100vh-12rem)]">
          {/* Left side - Product selection + Payment */}
          <div className="col-span-8 space-y-4">
            {/* Search only */}
            <div className="bg-white rounded-lg shadow p-3">
              <input
                type="text"
                placeholder="Search products or scan barcode..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.length > 8) {
                    handleBarcodeScan(searchQuery);
                    setSearchQuery('');
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>

            {/* Product grid - fixed height with scroll */}
            <div className="bg-white rounded-lg shadow flex-1 overflow-hidden">
              <POSProductGrid
                products={products}
                onProductSelect={(product) => addToCart(product)}
                isLoading={isLoading}
                error={error}
              />
            </div>

            {/* Payment buttons under products */}
            <div className="bg-white rounded-lg shadow p-4">
              {/* Payment Method Buttons */}
              <div className="grid grid-cols-3 gap-4">
                <button
                  onClick={() => handleDirectPayment(PaymentMethod.CASH)}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center p-6 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">CASH</span>
                </button>

                <button
                  onClick={() => handleDirectPayment(PaymentMethod.POS)}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center p-6 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">CARD</span>
                </button>

                <button
                  onClick={() => handleDirectPayment(PaymentMethod.TRANSFER)}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center p-6 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="text-lg">TRANSFER</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right side - Cart only */}
          <div className="col-span-4 flex flex-col space-y-4">
            {/* Shopping cart with integrated payment info */}
            <div className="bg-white rounded-lg shadow flex-1 overflow-hidden">
              <POSShoppingCart
                cart={cart}
                totals={cartTotals}
                onUpdateQuantity={updateCartItemQuantity}
                onUpdateDiscount={updateCartItemDiscount}
                onRemoveItem={removeFromCart}
                onClearCart={clearCart}
              />
            </div>

            {/* Action Buttons */}
            <div className="bg-white rounded-lg shadow p-4">
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={handlePrintReceipt}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center p-4 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="text-sm">PRINT RECEIPT</span>
                </button>

                <button
                  onClick={clearCart}
                  disabled={cart.length === 0}
                  className="flex items-center justify-center p-4 bg-orange-600 text-white font-bold rounded-lg hover:bg-orange-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
                >
                  <span className="text-sm">CLEAR CART</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Payment Modal */}
      {showPaymentModal && (
        <POSPaymentModal
          totals={cartTotals}
          isOnline={isOnline}
          onPayment={handlePayment}
          onCancel={() => setShowPaymentModal(false)}
        />
      )}

      {/* Inventory Management Modals */}
      <AddProductModal
        isOpen={showAddProductModal}
        onClose={() => setShowAddProductModal(false)}
        onSuccess={() => {
          loadProducts(); // Reload products after adding
        }}
      />

      <ReceiveStockModal
        isOpen={showReceiveStockModal}
        onClose={() => setShowReceiveStockModal(false)}
        onSuccess={() => {
          loadProducts(); // Reload products after stock receipt
        }}
      />

      <StockTransferModal
        isOpen={showStockTransferModal}
        onClose={() => setShowStockTransferModal(false)}
        onSuccess={() => {
          loadProducts(); // Reload products after transfer
        }}
      />

      <StockAdjustmentModal
        isOpen={showStockAdjustmentModal}
        onClose={() => setShowStockAdjustmentModal(false)}
        onSuccess={() => {
          loadProducts(); // Reload products after adjustment
        }}
      />

      <StockReportModal
        isOpen={showStockReportModal}
        onClose={() => setShowStockReportModal(false)}
      />
    </div>
  );
};

export default POSDashboard;