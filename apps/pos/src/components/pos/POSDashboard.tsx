/**
 * POS Dashboard - Main POS Interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect, forwardRef, useImperativeHandle } from 'react';
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

export interface POSDashboardHandle {
  addToCart: (product: POSProduct, quantity?: number) => void;
}

interface HeldSale {
  id: string;
  cart: CartItem[];
  saved_at: string;
  total: number;
  cashier_id: string;
  cashier_name: string;
}

const POSDashboard = forwardRef<POSDashboardHandle, {}>((props, ref) => {
  // Context and state
  const { currentUser, currentOutlet } = useOutlet();

  // POS State
  const [products, setProducts] = useState<POSProduct[]>([]);
  const [displayedProducts, setDisplayedProducts] = useState<POSProduct[]>([]); // New state for search results
  const [searchQuery, setSearchQuery] = useState(''); // Search text for product lookup
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCategory] = useState<string>('');
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineTransactionCount, setOfflineTransactionCount] = useState(0);

  // UI State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCashInput, setShowCashInput] = useState(false);
  const [cashAmount, setCashAmount] = useState('');

  // Split Payment State
  const [activePayments, setActivePayments] = useState<{
    cash?: number;
    card?: number;
    transfer?: number;
  }>({});

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
        // silently reset count; UI stays ready for next sale
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

  // Expose addToCart method to parent component
  useImperativeHandle(ref, () => ({
    addToCart
  }));

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
    setRestoredHeldReceiptId(null);
  };

  /**
   * Track and manage held sales (multiple parked carts)
   */
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [expandedHeldIds, setExpandedHeldIds] = useState<string[]>([]);
  const [isLoadingHeldReceipts, setIsLoadingHeldReceipts] = useState(false);
  const [restoredHeldReceiptId, setRestoredHeldReceiptId] = useState<string | null>(null);

  const heldStorageKey = currentOutlet?.id
    ? `pos_hold_carts_${currentOutlet.id}`
    : null;

  // Load held sales from backend when outlet changes
  useEffect(() => {
    if (!currentOutlet?.id) {
      setHeldSales([]);
      return;
    }

    const loadHeldReceipts = async () => {
      setIsLoadingHeldReceipts(true);
      try {
        // Try to load from backend first
        if (isOnline) {
          const receipts = await posService.getHeldReceipts(currentOutlet.id);
          // Convert backend format to frontend format
          const convertedReceipts: HeldSale[] = receipts.map((r: any) => ({
            id: r.id,
            cart: r.items.map((item: any) => ({
              product: {
                id: item.product_id,
                name: item.product_name || 'Product',
                unit_price: item.unit_price,
                tax_rate: item.tax_rate || 0.075,
                quantity_on_hand: 0, // Will be fetched when needed
                reorder_level: 0,
                reorder_quantity: 0,
                is_active: true,
                display_order: 0,
                sku: item.sku || '',
                barcode: item.barcode,
                category: item.category,
                outlet_id: currentOutlet.id,
                created_at: '',
                updated_at: '',
              } as POSProduct,
              quantity: item.quantity,
              unitPrice: item.unit_price,
              discount: item.discount || 0,
            })),
            saved_at: r.saved_at,
            total: r.total,
            cashier_id: r.cashier_id,
            cashier_name: r.cashier_name,
          }));
          setHeldSales(convertedReceipts);
          
          // Also sync to localStorage as backup
          if (heldStorageKey) {
            localStorage.setItem(heldStorageKey, JSON.stringify(convertedReceipts));
          }
        } else {
          // Offline: load from localStorage
          if (heldStorageKey) {
            const raw = localStorage.getItem(heldStorageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                setHeldSales(parsed);
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to load held receipts:', err);
        // Fallback to localStorage
        if (heldStorageKey) {
          try {
            const raw = localStorage.getItem(heldStorageKey);
            if (raw) {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) {
                setHeldSales(parsed);
              }
            }
          } catch (localErr) {
            console.error('Failed to load from localStorage:', localErr);
            setHeldSales([]);
          }
        }
      } finally {
        setIsLoadingHeldReceipts(false);
      }
    };

    loadHeldReceipts();
  }, [currentOutlet?.id, isOnline, heldStorageKey]);

  const persistHeldSales = async (sales: HeldSale[]) => {
    if (!currentOutlet?.id) return;
    
    setHeldSales(sales);
    
    // Save to localStorage as backup
    if (heldStorageKey) {
      localStorage.setItem(heldStorageKey, JSON.stringify(sales));
    }
    
    // If online, sync to backend (but don't wait for it)
    if (isOnline) {
      // Note: We don't sync here because we create/delete individually
      // This is just for local state management
    }
  };

  const toggleHeldExpanded = (id: string) => {
    setExpandedHeldIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handlePutOnHold = async () => {
    if (!currentOutlet?.id || cart.length === 0 || !currentUser) return;

    try {
      const totals = calculateCartTotals();
      
      // Prepare items for backend - include full product data for restoration
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount: item.discount,
        // Include product details for easier restoration
        product_name: item.product.name,
        sku: item.product.sku,
        barcode: item.product.barcode,
        tax_rate: item.product.tax_rate,
        category: item.product.category,
      }));

      if (isOnline) {
        // Save to backend
        const receipt = await posService.createHeldReceipt({
          outlet_id: currentOutlet.id,
          cashier_id: currentUser.id,
          items,
          total: totals.total,
        });

        // Convert backend response to frontend format
        const newHeld: HeldSale = {
          id: receipt.id,
          cart, // Keep original cart with full product data
          saved_at: receipt.saved_at,
          total: receipt.total,
          cashier_id: receipt.cashier_id,
          cashier_name: receipt.cashier_name,
        };

        const updated = [...heldSales, newHeld];
        await persistHeldSales(updated);
      } else {
        // Offline: save to localStorage only
        const newHeld: HeldSale = {
          id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          cart,
          saved_at: new Date().toISOString(),
          total: totals.total,
          cashier_id: currentUser.id,
          cashier_name: currentUser.name || 'Cashier',
        };

        const updated = [...heldSales, newHeld];
        await persistHeldSales(updated);
      }

      clearCart();
    } catch (err) {
      console.error('Failed to put sale on hold:', err);
      // Fallback to localStorage
      try {
        const totals = calculateCartTotals();
        const newHeld: HeldSale = {
          id: `hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
          cart,
          saved_at: new Date().toISOString(),
          total: totals.total,
          cashier_id: currentUser?.id || '',
          cashier_name: currentUser?.name || 'Cashier',
        };
        const updated = [...heldSales, newHeld];
        await persistHeldSales(updated);
        clearCart();
      } catch (fallbackErr) {
        console.error('Failed to save to localStorage:', fallbackErr);
      }
    }
  };

  const handleRestoreHeldSale = async (id: string) => {
    const sale = heldSales.find((s) => s.id === id);
    if (!sale) return;

    // If cart items don't have full product data, fetch it
    let restoredCart = sale.cart;
    if (restoredCart.length > 0 && (!restoredCart[0].product.id || !restoredCart[0].product.name)) {
      // Fetch full product details for each item
      try {
        const productIds = restoredCart.map(item => {
          // Try to get product_id from the item (might be stored differently)
          return (item.product as any).product_id || item.product.id;
        });
        
        // Fetch products from local database or API
        const fetchedProducts = await Promise.all(
          productIds.map(async (productId: string) => {
            try {
              // Try to get from local products first
              const localProduct = products.find(p => p.id === productId);
              if (localProduct) return localProduct;
              
              // If not found locally and online, fetch from API
              if (isOnline && currentOutlet?.id) {
                const result = await posService.getProducts(currentOutlet.id, 1, 100, undefined, undefined, false);
                return result.products.find((p: POSProduct) => p.id === productId);
              }
              
              return null;
            } catch (err) {
              console.error(`Failed to fetch product ${productId}:`, err);
              return null;
            }
          })
        );
        
        // Rebuild cart with full product data
        restoredCart = restoredCart.map((item, index) => {
          const fullProduct = fetchedProducts[index];
          if (fullProduct) {
            return {
              ...item,
              product: fullProduct,
            };
          }
          return item;
        });
      } catch (err) {
        console.error('Failed to fetch product details for held receipt:', err);
        // Continue with existing cart data
      }
    }

    // Restore cart and track which held receipt was restored
    setCart(restoredCart);
    setRestoredHeldReceiptId(id);
    
    // Remove from list (so it doesn't show up again)
    const remaining = heldSales.filter((s) => s.id !== id);
    await persistHeldSales(remaining);
    
    setShowHeldModal(false);
  };

  const handleRemoveHeldSale = async (id: string) => {
    const remaining = heldSales.filter((s) => s.id !== id);
    await persistHeldSales(remaining);
    
    // Delete from backend if online
    if (isOnline) {
      try {
        await posService.deleteHeldReceipt(id);
      } catch (err) {
        console.error('Failed to delete held receipt from backend:', err);
        // Continue anyway - we've already removed it locally
      }
    }
  };

  const hasHeldSale = heldSales.length > 0;


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
   * Calculate remaining balance for split payments
   */
  const calculateRemainingBalance = () => {
    const totals = calculateCartTotals();
    const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);
    return Math.max(0, totals.total - totalPaid);
  };

  /**
   * Toggle payment method for split payments
   */
  const togglePaymentMethod = (method: 'cash' | 'card' | 'transfer') => {
    if (!cart.length) return;

    const totals = calculateCartTotals();
    setActivePayments(prev => {
      const updated = { ...prev };
      
      // Calculate current total paid (excluding the method being toggled)
      const currentPaid = (method === 'cash' ? 0 : (updated.cash || 0)) +
                          (method === 'card' ? 0 : (updated.card || 0)) +
                          (method === 'transfer' ? 0 : (updated.transfer || 0));
      const remaining = Math.max(0, totals.total - currentPaid);

      if (method === 'cash') {
        if (updated.cash) {
          delete updated.cash;
          setShowCashInput(false);
          setCashAmount('');
        } else {
          // Set cash amount to remaining balance
          updated.cash = remaining;
          setShowCashInput(true);
          setCashAmount(remaining.toString());
        }
      } else if (method === 'card') {
        if (updated.card) {
          delete updated.card;
        } else {
          // Set card amount to remaining balance
          updated.card = remaining;
        }
      } else if (method === 'transfer') {
        if (updated.transfer) {
          delete updated.transfer;
        } else {
          // Set transfer amount to remaining balance
          updated.transfer = remaining;
        }
      }

      return updated;
    });
  };

  /**
   * Update cash amount in split payment
   */
  const updateCashAmount = (amount: string) => {
    setCashAmount(amount);
    const numAmount = parseFloat(amount) || 0;
    
    if (numAmount > 0) {
      const totals = calculateCartTotals();
      // Calculate remaining balance excluding cash
      const otherPayments = (activePayments.card || 0) + (activePayments.transfer || 0);
      const remaining = Math.max(0, totals.total - otherPayments);
      
      // Cap cash amount at remaining balance
      const cappedAmount = Math.min(numAmount, remaining);
      setActivePayments(prev => ({ ...prev, cash: cappedAmount }));
      
      // Update cash amount display if it was capped
      if (cappedAmount < numAmount) {
        setCashAmount(cappedAmount.toString());
      }
    } else {
      setActivePayments(prev => {
        const updated = { ...prev };
        delete updated.cash;
        return updated;
      });
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
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
      }

      // Clear cart and close modal
      clearCart();
      setShowPaymentModal(false);

    } catch (error) {
      console.error('Payment error:', error);
      // keep cart as-is so cashier can retry or adjust
    }
  };



  /**
   * Handle split payment processing
   */
  const handleSplitPayment = async (mode: 'save' | 'save_and_print' = 'save') => {
    if (!currentUser?.id || !currentOutlet?.id) return;

    const totals = calculateCartTotals();
    const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);

    if (totalPaid < totals.total) {
      alert(`Total paid (${formatCurrency(totalPaid)}) is less than amount due (${formatCurrency(totals.total)})`);
      return;
    }

    try {
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discount * item.quantity
      }));

      // Build split payments array
      const splitPayments: Array<{ method: PaymentMethod; amount: number }> = [];
      if (activePayments.cash && activePayments.cash > 0) {
        splitPayments.push({ method: PaymentMethod.CASH, amount: activePayments.cash });
      }
      if (activePayments.card && activePayments.card > 0) {
        splitPayments.push({ method: PaymentMethod.POS, amount: activePayments.card });
      }
      if (activePayments.transfer && activePayments.transfer > 0) {
        splitPayments.push({ method: PaymentMethod.TRANSFER, amount: activePayments.transfer });
      }

      // Use enhanced transaction with split payments
      const transactionRequest: any = {
        outlet_id: currentOutlet.id,
        cashier_id: currentUser.id,
        items,
        payment_method: splitPayments.length === 1 ? splitPayments[0].method : PaymentMethod.CASH, // Primary method
        tendered_amount: totalPaid,
        discount_amount: totals.totalDiscount,
        split_payments: splitPayments.length > 1 ? splitPayments : undefined
      };

      if (isOnline) {
        const transaction = await posService.createTransaction(transactionRequest);
        if (mode === 'save_and_print' && transaction?.id) {
          try {
            await posService.printReceipt(transaction.id);
          } catch (printError) {
            console.error('Receipt print error:', printError);
          }
        }
      } else {
        await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
      }

      // Delete held receipt if this sale was restored from one
      if (restoredHeldReceiptId) {
        try {
          if (isOnline) {
            await posService.deleteHeldReceipt(restoredHeldReceiptId);
          }
          // Remove from local list if still there
          const remaining = heldSales.filter((s) => s.id !== restoredHeldReceiptId);
          await persistHeldSales(remaining);
        } catch (err) {
          console.error('Failed to delete held receipt after sale:', err);
          // Continue anyway - sale is complete
        }
      }

      // Reset and clear
      clearCart();
      setActivePayments({});
      setShowCashInput(false);
      setCashAmount('');
      setRestoredHeldReceiptId(null);

    } catch (error) {
      console.error('Split payment error:', error);
    }
  };

  /**
   * Handle cash payment with amount (legacy single payment)
   * mode: 'save' -> save only
   *       'save_and_print' -> save then print receipt (online only)
   */
  const handleCashPayment = async (mode: 'save' | 'save_and_print' = 'save') => {
    const amount = parseFloat(cashAmount);
    const totals = calculateCartTotals();

    if (isNaN(amount) || amount < totals.total) {
      // invalid amount: do nothing; cashier can correct and retry
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
        const transaction = await posService.createTransaction(transactionRequest);

        // Optionally print receipt
        if (mode === 'save_and_print' && transaction?.id) {
          try {
            await posService.printReceipt(transaction.id);
          } catch (printError) {
            console.error('Receipt print error:', printError);
          }
        }
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        setOfflineTransactionCount(prev => prev + 1);
      }

      // Delete held receipt if this sale was restored from one
      if (restoredHeldReceiptId) {
        try {
          if (isOnline) {
            await posService.deleteHeldReceipt(restoredHeldReceiptId);
          }
          // Remove from local list if still there
          const remaining = heldSales.filter((s) => s.id !== restoredHeldReceiptId);
          await persistHeldSales(remaining);
        } catch (err) {
          console.error('Failed to delete held receipt after sale:', err);
          // Continue anyway - sale is complete
        }
      }

      // Clear cart and close cash input
      clearCart();
      setShowCashInput(false);
      setCashAmount('');

    } catch (error) {
      console.error('Payment error:', error);
      // keep cart and cash input so cashier can retry
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


        {/* Main POS Interface - Full Width Cart */}
        <div className="h-[calc(100vh-10rem)] overflow-hidden">
          {/* Full Width Cart & Payment */}
          <div className="w-full h-full flex flex-col gap-4">

            {/* Cart Section - Scrollable */}
            <div className="bg-white rounded-lg shadow p-4 flex-1 overflow-hidden flex flex-col mb-4">

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
            <div className="bg-white rounded-lg shadow px-4 pt-4 pb-1 flex-shrink-0">
              {/* Total Section - at top of payment section */}
              <div className="mb-4 pb-4 border-b border-gray-200">
                <div className="flex flex-col items-end gap-1">
                  {/* Total */}
                  <div className="flex items-baseline gap-2">
                    <span className="text-sm font-medium text-gray-600">Total:</span>
                    <span className="text-4xl font-bold text-orange-600">{formatCurrency(cartTotals.total)}</span>
                  </div>
                  
                  {/* Payment Split Details - only show when multiple payment methods are active */}
                  {Object.keys(activePayments).length > 1 && (() => {
                    const remaining = calculateRemainingBalance();
                    const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);
                    return (
                      <div className="text-xs text-gray-600">
                        <span className="font-semibold">Split: </span>
                        {activePayments.cash && (
                          <span>Cash {formatCurrency(activePayments.cash)}</span>
                        )}
                        {activePayments.cash && (activePayments.card || activePayments.transfer) && <span> · </span>}
                        {activePayments.card && (
                          <span>Card {formatCurrency(activePayments.card)}</span>
                        )}
                        {activePayments.card && activePayments.transfer && <span> · </span>}
                        {activePayments.transfer && (
                          <span>Transfer {formatCurrency(activePayments.transfer)}</span>
                        )}
                        <span className="font-bold text-gray-900 ml-2">
                          ({formatCurrency(totalPaid)} / {formatCurrency(cartTotals.total)})
                        </span>
                        {remaining > 0 && (
                          <span className="text-orange-600 font-semibold ml-2">
                            · Remaining: {formatCurrency(remaining)}
                          </span>
                        )}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {showCashInput ? (() => {
                const otherPayments = (activePayments.card || 0) + (activePayments.transfer || 0);
                const remaining = Math.max(0, cartTotals.total - otherPayments);
                const currentCash = parseFloat(cashAmount) || 0;
                const change = currentCash > remaining ? currentCash - remaining : 0;
                
                return (
                  /* Cash Calculator Interface - Compact */
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-base font-semibold text-gray-900">Cash Payment</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm font-medium text-gray-600">Amount Due:</span>
                        <span className="text-lg font-bold text-orange-600">{formatCurrency(remaining)}</span>
                      </div>
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="flex gap-2 mb-3">
                      <button
                        onClick={() => updateCashAmount(remaining.toString())}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-900 text-sm font-bold rounded-lg transition-colors"
                      >
                        Exact
                      </button>
                      <button
                        onClick={() => updateCashAmount((Math.ceil(remaining / 1000) * 1000).toString())}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-900 text-sm font-bold rounded-lg transition-colors"
                      >
                        Round ₦1k
                      </button>
                      <button
                        onClick={() => updateCashAmount((Math.ceil(remaining / 5000) * 5000).toString())}
                        className="px-3 py-2 bg-orange-100 hover:bg-orange-200 text-orange-900 text-sm font-bold rounded-lg transition-colors"
                      >
                        Round ₦5k
                      </button>
                    </div>

                    {/* Manual Input */}
                    <div className="flex items-center space-x-3">
                      <div className="flex-1">
                        <input
                          type="number"
                          value={cashAmount}
                          onChange={(e) => updateCashAmount(e.target.value)}
                          placeholder={`Enter cash amount (max ${formatCurrency(remaining)})`}
                          max={remaining}
                          className="w-full px-3 py-2 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                          autoFocus
                        />
                      </div>

                      {/* Change Display */}
                      {change > 0 && (
                        <div className="flex-shrink-0 bg-green-50 px-3 py-2 rounded-lg">
                          <div className="text-xs text-green-600 font-medium">Change</div>
                          <div className="text-base font-bold text-green-900">
                            {formatCurrency(change)}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })() : null}

              {/* Permanent Payment Method Buttons - Always visible, show active state */}
              {(() => {
                const remaining = calculateRemainingBalance();
                const isFullyPaid = remaining <= 0;
                
                return (
                  <div className="flex items-center space-x-3 mb-4">
                    <button
                      onClick={() => togglePaymentMethod('cash')}
                      disabled={cart.length === 0 || (isFullyPaid && !activePayments.cash)}
                      className={`px-6 py-3 text-white text-lg font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        activePayments.cash
                          ? 'bg-orange-700 shadow-lg shadow-orange-500/50 ring-2 ring-orange-400'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      CASH
                    </button>
                    <button
                      onClick={() => togglePaymentMethod('card')}
                      disabled={cart.length === 0 || (isFullyPaid && !activePayments.card)}
                      className={`px-6 py-3 text-white text-lg font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        activePayments.card
                          ? 'bg-orange-700 shadow-lg shadow-orange-500/50 ring-2 ring-orange-400'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      CREDIT
                    </button>
                    <button
                      onClick={() => togglePaymentMethod('transfer')}
                      disabled={cart.length === 0 || (isFullyPaid && !activePayments.transfer)}
                      className={`px-6 py-3 text-white text-lg font-bold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                        activePayments.transfer
                          ? 'bg-orange-700 shadow-lg shadow-orange-500/50 ring-2 ring-orange-400'
                          : 'bg-orange-600 hover:bg-orange-700'
                      }`}
                    >
                      TRANSFER
                    </button>
                  </div>
                );
              })()}

              {/* Core sales-terminal actions: fixed row at bottom, not moving */}
              <div className="flex justify-end space-x-3">
                {/* Cancel button - permanent, beside Put on Hold */}
                <button
                  onClick={() => {
                    setActivePayments({});
                    setShowCashInput(false);
                    setCashAmount('');
                    clearCart();
                  }}
                  disabled={cart.length === 0 && Object.keys(activePayments).length === 0}
                  className="px-4 py-3 bg-gray-500 hover:bg-gray-600 text-white text-lg font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                {/*
                  Rule for label/behavior:
                  - If there are held sales AND current cart is empty => button shows "Held Receipts" (opens list)
                  - If cart has items (starting another sale) => button shows "Put on Hold" to create another held receipt
                */}
                <button
                  onClick={() => {
                    const canShowHeldList = hasHeldSale && cart.length === 0;
                    if (canShowHeldList) {
                      setShowHeldModal(true);
                    } else {
                      handlePutOnHold();
                    }
                  }}
                  disabled={!hasHeldSale && cart.length === 0}
                  className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {hasHeldSale && cart.length === 0 ? 'Held Receipts' : 'Put on Hold'}
                </button>
                {(() => {
                  const totals = calculateCartTotals();
                  const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);
                  const isTotalCovered = totalPaid >= totals.total;
                  const hasActivePayments = Object.keys(activePayments).length > 0;
                  
                  return (
                    <>
                      <button
                        onClick={() => handleSplitPayment('save')}
                        disabled={!hasActivePayments || !isTotalCovered}
                        className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save Only
                      </button>
                      <button
                        onClick={() => handleSplitPayment('save_and_print')}
                        disabled={!hasActivePayments || !isTotalCovered}
                        className="px-4 py-3 bg-orange-600 hover:bg-orange-700 text-white text-lg font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Save &amp; Print
                      </button>
                    </>
                  );
                })()}
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

        {/* Held Receipts Modal */}
        {showHeldModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
              {/* Header */}
              <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
                <h2 className="text-xl font-bold text-slate-900">Held Receipts</h2>
                <button
                  onClick={() => setShowHeldModal(false)}
                  className="px-3 py-1.5 text-base font-bold text-slate-600 hover:text-slate-900"
                >
                  Close
                </button>
              </div>

              {/* List */}
              <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
                {heldSales.length === 0 ? (
                  <p className="text-sm text-slate-500">No held receipts.</p>
                ) : (
                  heldSales.map((sale) => (
                  <div
                    key={sale.id}
                    className="border border-slate-200 rounded-lg p-3 bg-slate-50"
                  >
                      {/* Summary row */}
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">
                            {new Date(sale.saved_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-xs text-slate-500">
                            {sale.cart.length} item{sale.cart.length !== 1 ? 's' : ''} ·{' '}
                            Held by {sale.cashier_name}
                          </div>
                        </div>
                        <div className="flex items-center space-x-3">
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(sale.total)}
                          </span>
                          <button
                            onClick={() => handleRestoreHeldSale(sale.id)}
                            className="px-3 py-1.5 text-base font-bold bg-orange-600 hover:bg-orange-700 text-white rounded-lg"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleRemoveHeldSale(sale.id)}
                            className="px-3 py-1.5 text-sm font-bold text-red-600 hover:text-red-700"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Inline item details - expandable, one line per item */}
                      <button
                        type="button"
                        onClick={() => toggleHeldExpanded(sale.id)}
                        className="mb-1 text-xs font-semibold text-slate-600 hover:text-slate-900"
                      >
                        {expandedHeldIds.includes(sale.id) ? 'Hide items' : 'Show items'}
                      </button>

                      {expandedHeldIds.includes(sale.id) && (
                        <div className="mt-1 border-t border-slate-200 pt-2 space-y-1">
                          {sale.cart.map((item) => (
                            <div
                              key={item.product.id}
                              className="flex text-xs text-slate-700 justify-between"
                            >
                              <div className="truncate max-w-xs">
                                {item.product.name}
                              </div>
                              <div className="flex items-center space-x-3">
                                <span>x{item.quantity}</span>
                                <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
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
});

POSDashboard.displayName = 'POSDashboard';

export default POSDashboard;