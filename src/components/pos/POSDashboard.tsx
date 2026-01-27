/**
 * POS Dashboard - Main POS Interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  ShoppingCart,
  Package,
  BarChart3,
  Users,
  Settings,
  Wifi,
  WifiOff,
  AlertCircle
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { posService, POSProduct, PaymentMethod } from '@/lib/posService';

// Sub-components (we'll create these next)
import POSProductGrid from './POSProductGrid';
import POSShoppingCart from './POSShoppingCart';
import POSPaymentModal from './POSPaymentModal';
import POSStatsWidget from './POSStatsWidget';

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
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineTransactionCount, setOfflineTransactionCount] = useState(0);

  // UI State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

      setProducts(response.items || []);
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
   * Process checkout
   */
  const handleCheckout = () => {
    if (cart.length === 0) {
      alert('Cart is empty');
      return;
    }

    setShowPaymentModal(true);
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
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean)));

  const cartTotals = calculateCartTotals();

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">POS Terminal</h1>
            <p className="text-gray-600">
              {currentOutlet?.name} • {currentUser?.name}
            </p>
          </div>

          {/* Status indicators */}
          <div className="flex items-center space-x-4">
            {/* Online/Offline status */}
            <div className={`flex items-center space-x-2 px-3 py-1 rounded-full text-sm font-medium ${
              isOnline
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
                <span>{offlineTransactionCount} offline transactions</span>
              </div>
            )}
          </div>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <POSStatsWidget
            title="Products"
            value={products.length}
            icon={Package}
            color="blue"
          />
          <POSStatsWidget
            title="Cart Items"
            value={cart.length}
            icon={ShoppingCart}
            color="green"
          />
          <POSStatsWidget
            title="Cart Total"
            value={posService.formatCurrency(cartTotals.total)}
            icon={BarChart3}
            color="purple"
          />
          <POSStatsWidget
            title="Today's Sales"
            value="₦0"
            icon={Users}
            color="orange"
          />
        </div>
      </div>

      {/* Main POS Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left side - Product selection */}
        <div className="lg:col-span-2 space-y-4">
          {/* Search and filters */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
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
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Press Enter after scanning barcode to add to cart
                </p>
              </div>

              {/* Category filter */}
              <div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Product grid */}
          <POSProductGrid
            products={products}
            onProductSelect={(product) => addToCart(product)}
            isLoading={isLoading}
            error={error}
          />
        </div>

        {/* Right side - Shopping cart */}
        <div className="lg:col-span-1">
          <POSShoppingCart
            cart={cart}
            totals={cartTotals}
            onUpdateQuantity={updateCartItemQuantity}
            onUpdateDiscount={updateCartItemDiscount}
            onRemoveItem={removeFromCart}
            onClearCart={clearCart}
            onCheckout={handleCheckout}
          />
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
    </div>
  );
};

export default POSDashboard;