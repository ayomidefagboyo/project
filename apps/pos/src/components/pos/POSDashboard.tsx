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
  RotateCcw,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useOutlet } from '../../contexts/OutletContext';
import { posService, PaymentMethod } from '../../lib/posService';
import type { POSProduct } from '../../lib/posService';
import { offlineDatabase } from '../../lib/offlineDatabase';

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
  const [displayedProducts, setDisplayedProducts] = useState<POSProduct[]>([]); // New state for search results
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineTransactionCount, setOfflineTransactionCount] = useState(0);

  // UI State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCashInput, setShowCashInput] = useState(false);
  const [cashAmount, setCashAmount] = useState('');
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchResults, setSearchResults] = useState<POSProduct[]>([]);

  // Inventory Management Modal States
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showReceiveStockModal, setShowReceiveStockModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);
  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [showStockReportModal, setShowStockReportModal] = useState(false);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Search function
  const handleSearchChange = async (query: string) => {
    setSearchQuery(query);
    if (query.length > 2 && currentOutlet?.id) {
      try {
        const response = await posService.getProducts(currentOutlet.id, {
          search: query,
          size: 10
        });
        setSearchResults(response?.items || []);
        setShowSearchDropdown(true);
      } catch (error) {
        console.error('Search error:', error);
        setSearchResults([]);
      }
    } else {
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  };

  // Add product from search dropdown
  const addProductFromSearch = (product: POSProduct) => {
    addToCart(product);
    setSearchQuery('');
    setShowSearchDropdown(false);
    setSearchResults([]);
  };

  // Load products on mount
  useEffect(() => {
    if (currentOutlet?.id) {
      loadProducts();
    }
  }, [currentOutlet?.id, selectedCategory]);

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
    if (!currentOutlet?.id) {
      console.warn('No active outlet found for POS');
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      const response = await posService.getProducts(currentOutlet.id, {
        category: selectedCategory || undefined,
        activeOnly: true,
        size: 1000 // Load more products for local search
      });

      setProducts(response?.items || []);
      setError(null);
    } catch (err) {
      console.error('Error loading products online, trying offline:', err);
      // Fallback to offline DB explicitly
      try {
        const offlineProducts = await offlineDatabase.getProducts(currentOutlet.id);
        if (offlineProducts && offlineProducts.length > 0) {
          setProducts(offlineProducts);
          setError(null);
          console.log('Loaded products from offline database');
        } else {
          setError('No products found. Please connect to internet to sync.');
        }
      } catch (offlineErr) {
        console.error('Offline load failed:', offlineErr);
        setError('Failed to load products from both online and offline sources.');
      }
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
        // Add new item with tax-inclusive pricing
        return [...prevCart, {
          product,
          quantity,
          unitPrice: product.unit_price * (1 + product.tax_rate),
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

    // For cash payments, show calculator interface
    if (paymentMethod === PaymentMethod.CASH) {
      setShowCashInput(true);
      return;
    }

    // For CARD and TRANSFER, auto-process with exact amount
    try {
      const totals = calculateCartTotals();

      // Prepare transaction items
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discount * item.quantity
      }));

      // Create transaction request with exact amount
      const transactionRequest = {
        outlet_id: currentOutlet.id,
        cashier_id: currentUser.id,
        items,
        payment_method: paymentMethod,
        tendered_amount: totals.total, // Exact amount for card/transfer
        discount_amount: totals.totalDiscount
      };

      // Process transaction (online or offline)
      if (isOnline) {
        await posService.createTransaction(transactionRequest);
        alert(`${paymentMethod.toUpperCase()} payment completed successfully!`);
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
        alert(`Transaction stored offline (ID: ${offlineId})`);
      }

      // Clear cart
      clearCart();

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
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



  /**
   * Handle cash payment with amount
   */
  const handleCashPayment = async () => {
    const amount = parseFloat(cashAmount);
    const totals = calculateCartTotals();

    if (isNaN(amount) || amount < totals.total) {
      alert('Invalid amount or insufficient cash');
      return;
    }

    if (!currentUser?.id || !currentOutlet?.id) return;

    try {
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
        items,
        payment_method: PaymentMethod.CASH,
        tendered_amount: amount,
        discount_amount: totals.totalDiscount
      };

      // Process transaction (online or offline)
      if (isOnline) {
        await posService.createTransaction(transactionRequest);
        alert('Cash payment completed successfully!');
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
        alert(`Transaction stored offline (ID: ${offlineId})`);
      }

      // Clear cart and close cash input
      clearCart();
      setShowCashInput(false);
      setCashAmount('');

    } catch (error) {
      console.error('Payment error:', error);
      alert('Payment failed. Please try again.');
    }
  };

  // Get unique categories for filter

  const cartTotals = calculateCartTotals();

  // Handle search with Debounce and Hybrid Strategy (Memory + Dexie)
  useEffect(() => {
    const performSearch = async () => {
      if (!searchQuery.trim()) {
        // No search: Show top 50 from loaded products
        setDisplayedProducts(products.slice(0, 50));
        return;
      }

      if (currentOutlet?.id) {
        try {
          // Query Dexie for fast indexed search
          const results = await posService.searchLocalProducts(currentOutlet.id, searchQuery);
          setDisplayedProducts(results);
        } catch (err) {
          console.error("Local search failed, falling back to memory:", err);
          // Fallback: Filter in-memory products
          const lowerQuery = searchQuery.toLowerCase();
          setDisplayedProducts(
            products.filter(p =>
              p.name.toLowerCase().includes(lowerQuery) ||
              p.sku.toLowerCase().includes(lowerQuery) ||
              p.barcode?.includes(lowerQuery)
            ).slice(0, 50)
          );
        }
      }
    };

    const timeoutId = setTimeout(performSearch, 150); // 150ms debounce for typing comfort
    return () => clearTimeout(timeoutId);
  }, [searchQuery, products, currentOutlet?.id]);

  /* 
  // Old memory-only filter (Removed in favor of hybrid approach)
  const displayedProducts = searchQuery
    ? products.filter(product =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.barcode?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase())
    ).slice(0, 50)
    : products.slice(0, 50);
  */

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
        {/* Search Bar */}
        <div className="mb-4">
          <div className="bg-white rounded-lg shadow p-4">
            {/* Center: Search Bar with Dropdown */}
            <div className="relative">
              <input
                type="text"
                placeholder="Find Products - Enter barcode or product name..."
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter' && searchQuery.length > 8) {
                    handleBarcodeScan(searchQuery);
                    setSearchQuery('');
                    setShowSearchDropdown(false);
                  }
                }}
                onFocus={() => {
                  if (searchResults.length > 0) setShowSearchDropdown(true);
                }}
                className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                autoFocus
              />

              {/* Search Dropdown */}
              {showSearchDropdown && searchResults.length > 0 && (
                <>
                  {/* Overlay to close dropdown */}
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowSearchDropdown(false)}
                  />

                  {/* Dropdown Results */}
                  <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 max-h-80 overflow-y-auto">
                    {searchResults.map((product) => (
                      <button
                        key={product.id}
                        onClick={() => addProductFromSearch(product)}
                        className="w-full flex items-center p-3 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                      >
                        <div className="flex-1">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="text-sm font-medium text-gray-900">{product.name}</h4>
                              <p className="text-xs text-gray-600">{product.sku}</p>
                              {product.barcode && (
                                <p className="text-xs text-gray-500">Barcode: {product.barcode}</p>
                              )}
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-orange-600">{formatCurrency(product.unit_price)}</p>
                              <p className="text-xs text-gray-500">Stock: {product.quantity_on_hand}</p>
                            </div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}

              {/* Status Indicators */}
              <div className="flex items-center justify-end space-x-3 mt-3">
                {/* Online/Offline status */}
                <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-full text-sm font-medium ${isOnline
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
                  }`}>
                  {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
                  <span>{isOnline ? 'Online' : 'Offline'}</span>
                </div>

                {/* Offline transaction count */}
                {offlineTransactionCount > 0 && (
                  <div className="flex items-center space-x-2 px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded-full text-sm font-medium">
                    <AlertCircle className="h-4 w-4" />
                    <span>{offlineTransactionCount} offline</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>


        {/* Main POS Interface - Full Width Cart */}
        <div className="h-[calc(100vh-10rem)] overflow-hidden">
          {/* Full Width Cart & Payment */}
          <div className="w-full h-full flex flex-col gap-4">

            {/* Cart Section - Scrollable */}
            <div className="bg-white rounded-lg shadow p-4 flex-1 overflow-hidden flex flex-col mb-4">
              <div className="flex items-center justify-end mb-4">
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-medium text-gray-600">Amount Due:</span>
                  <span className="text-2xl font-bold text-orange-600">{formatCurrency(cartTotals.total)}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto">
                <POSShoppingCart
                  cart={cart}
                  totals={cartTotals}
                  onUpdateQuantity={updateCartItemQuantity}
                  onUpdateDiscount={updateCartItemDiscount}
                  onRemoveItem={removeFromCart}
                  onClearCart={clearCart}
                />
              </div>
            </div>

            {/* Fixed Payment Section */}
            <div className="bg-white rounded-lg shadow p-4 flex-shrink-0">
              {showCashInput ? (
                /* Cash Calculator Interface */
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold text-gray-900">Cash Payment</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-sm font-medium text-gray-600">Amount Due:</span>
                      <span className="text-xl font-bold text-orange-600">{formatCurrency(cartTotals.total)}</span>
                    </div>
                  </div>

                  {/* Quick Amount Buttons */}
                  <div className="grid grid-cols-4 gap-2">
                    {/* Exact Amount */}
                    <button
                      onClick={() => setCashAmount(cartTotals.total.toString())}
                      className="px-4 py-3 bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold rounded-lg transition-colors"
                    >
                      Exact
                    </button>

                    {/* Common denominations */}
                    {[1000, 2000, 5000, 10000, 20000].map((amount) => (
                      <button
                        key={amount}
                        onClick={() => setCashAmount(amount.toString())}
                        className="px-4 py-3 bg-green-100 hover:bg-green-200 text-green-900 font-semibold rounded-lg transition-colors"
                      >
                        ₦{amount.toLocaleString()}
                      </button>
                    ))}

                    {/* Round up options */}
                    <button
                      onClick={() => setCashAmount((Math.ceil(cartTotals.total / 1000) * 1000).toString())}
                      className="px-4 py-3 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg transition-colors"
                    >
                      Round ₦1k
                    </button>
                    <button
                      onClick={() => setCashAmount((Math.ceil(cartTotals.total / 5000) * 5000).toString())}
                      className="px-4 py-3 bg-purple-100 hover:bg-purple-200 text-purple-900 font-semibold rounded-lg transition-colors"
                    >
                      Round ₦5k
                    </button>
                  </div>

                  {/* Manual Input */}
                  <div className="flex items-center space-x-4">
                    <div className="flex-1">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Amount Tendered
                      </label>
                      <input
                        type="number"
                        value={cashAmount}
                        onChange={(e) => setCashAmount(e.target.value)}
                        placeholder="Enter cash amount"
                        className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                        autoFocus
                      />
                    </div>

                    {/* Change Display */}
                    {cashAmount && parseFloat(cashAmount) >= cartTotals.total && (
                      <div className="flex-shrink-0 bg-green-50 px-4 py-3 rounded-lg">
                        <div className="text-xs text-green-600 font-medium">Change</div>
                        <div className="text-lg font-bold text-green-900">
                          {formatCurrency(parseFloat(cashAmount) - cartTotals.total)}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setShowCashInput(false);
                        setCashAmount('');
                      }}
                      className="px-4 py-3 bg-gray-500 text-white font-medium rounded-lg hover:bg-gray-600 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleCashPayment}
                      disabled={!cashAmount || parseFloat(cashAmount) < cartTotals.total}
                      className="flex-1 px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Complete Payment
                    </button>
                  </div>
                </div>
              ) : (
                /* Regular Payment Buttons */
                <div className="flex items-center justify-between space-x-4">
                  {/* Payment Methods */}
                  <div className="flex space-x-3">
                    <button
                      onClick={() => handleDirectPayment(PaymentMethod.CASH)}
                      disabled={cart.length === 0}
                      className="px-6 py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      CASH
                    </button>
                    <button
                      onClick={() => handleDirectPayment(PaymentMethod.TRANSFER)}
                      disabled={cart.length === 0}
                      className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      TRANSFER
                    </button>
                    <button
                      onClick={() => handleDirectPayment(PaymentMethod.POS)}
                      disabled={cart.length === 0}
                      className="px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      CARD
                    </button>
                  </div>
                </div>
              )}
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
    </div >
  );
};

export default POSDashboard;