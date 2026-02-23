/**
 * POS Dashboard - Main POS Interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Plus,
  RotateCcw,
  X,
  User,
  Check,
} from 'lucide-react';

interface TerminalConfig {
  outlet_id: string;
  outlet_name: string;
  initialized_by: string;
  initialized_at: string;
}
import { useOutlet } from '../../contexts/OutletContext';
import { posService, PaymentMethod } from '../../lib/posService';
import type { POSProduct } from '../../lib/posService';
import { staffService } from '../../lib/staffService';
import type { StaffProfile, StaffAuthResponse } from '../../types';
import { offlineDatabase } from '../../lib/offlineDatabase';
import { ToastContainer, useToast } from '../ui/Toast';
import logger from '../../lib/logger';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useTerminalId } from '../../hooks/useTerminalId';
import { getStaffSessionRaw, setStaffSessionRaw, clearStaffSession } from '../../lib/staffSessionStorage';

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

// Staff Management Modals
import StaffManagementModal from './modals/StaffManagementModal';
import ClockOutConfirmModal from '../modals/ClockOutConfirmModal';
import LoginForm from '../auth/LoginForm';
import TransactionHistory from './TransactionHistory';
import {
  loadHardwareState,
  resolvePrimaryCashDrawer,
  resolveReceiptPolicy,
  resolveReceiptPrinter,
} from '../../lib/hardwareProfiles';
import { readCachedReceiptTemplate } from '../../lib/receiptTemplate';
import { resolveAdapterCapabilities, supportsHardwareAction } from '../../lib/hardwareAdapters';
import { printReceiptContent } from '../../lib/receiptPrinter';
import type { ReceiptPrintStyle } from '../../lib/receiptPrinter';
import type { ReceiptTemplate } from '../settings/ReceiptEditor';

export interface CartItem {
  product: POSProduct;
  quantity: number;
  unitPrice: number;
  discount: number;
}

export interface POSDashboardHandle {
  addToCart: (product: POSProduct, quantity?: number) => void;
  openCustomerSearch: () => void;
  openTransactionHistory: () => void;
}

interface HeldSale {
  id: string;
  cart: CartItem[];
  saved_at: string;
  total: number;
  cashier_id: string;
  cashier_name: string;
  // Optional flag to indicate whether this held sale has been synced to the backend
  synced?: boolean;
}

interface POSDashboardProps {
  terminalConfig: TerminalConfig | null;
}

interface LocalReceiptLineItem {
  name: string;
  quantity: number;
  unitPrice: number;
  discount: number;
}

interface LocalReceiptPayload {
  receiptNumber: string;
  createdAtIso: string;
  outletName: string;
  cashierName: string;
  customerName?: string;
  items: LocalReceiptLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  totalPaid: number;
  payments: Array<{ method: PaymentMethod; amount: number }>;
  pendingSync: boolean;
}

const POSDashboard = forwardRef<POSDashboardHandle, POSDashboardProps>(({ terminalConfig }, ref) => {
  // Context and state
  const { currentUser, currentOutlet } = useOutlet();
  const navigate = useNavigate();
  const { terminalId } = useTerminalId();
  const { toasts, success, error, warning, removeToast } = useToast();

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
  const [showClearCartConfirm, setShowClearCartConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [posError, setPosError] = useState<string | null>(null);
  const [isFinalizingSale, setIsFinalizingSale] = useState(false);
  const finalizeSaleLockRef = useRef(false);
  const [tenderModal, setTenderModal] = useState<{
    method: 'cash' | 'card' | 'transfer';
    amount: string;
    error?: string;
  } | null>(null);
  const productLoadRequestRef = useRef(0);

  // Split Payment State
  const [activePayments, setActivePayments] = useState<{
    cash?: number;
    card?: number;
    transfer?: number;
  }>({});

  // Customer State
  const [selectedCustomer, setSelectedCustomer] = useState<{ id: string; name: string; phone?: string } | null>(null);
  const [showCustomerSearch, setShowCustomerSearch] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [isSearchingCustomers, setIsSearchingCustomers] = useState(false);

  // Inventory Management Modal States
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [showReceiveStockModal, setShowReceiveStockModal] = useState(false);
  const [showStockTransferModal, setShowStockTransferModal] = useState(false);
  const [showStockAdjustmentModal, setShowStockAdjustmentModal] = useState(false);
  const [showStockReportModal, setShowStockReportModal] = useState(false);

  // Transaction History
  const [showTransactionHistory, setShowTransactionHistory] = useState(false);

  // Staff Management States
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showStaffManagement, setShowStaffManagement] = useState(false);
  const [showManagerLogin, setShowManagerLogin] = useState(false);

  // Simple staff loading function
  const loadStaffProfiles = async () => {
    if (!currentOutlet?.id) return;
    try {
      const response = await staffService.getOutletStaff(currentOutlet.id);
      setStaffProfiles(response.profiles || []);
    } catch (err) {
      logger.warn('Could not load staff profiles:', err);
      setStaffProfiles([]);
    }
  };

  // Load staff profiles on mount
  useEffect(() => {
    if (currentOutlet?.id) {
      loadStaffProfiles();
    }
  }, [currentOutlet?.id]);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const paymentMethodLabel = (method: PaymentMethod): string => {
    if (method === PaymentMethod.CASH) return 'Cash';
    if (method === PaymentMethod.POS) return 'Card';
    if (method === PaymentMethod.TRANSFER) return 'Transfer';
    if (method === PaymentMethod.CREDIT) return 'Credit';
    if (method === PaymentMethod.MOBILE) return 'Mobile';
    return 'Payment';
  };

  const truncateReceiptText = (value: string, maxLength = 30): string =>
    value.length <= maxLength ? value : `${value.slice(0, Math.max(0, maxLength - 3))}...`;

  const buildLocalReceiptContent = (payload: LocalReceiptPayload): string => {
    const template = currentOutlet?.id ? readCachedReceiptTemplate(currentOutlet.id) : null;
    const lines: string[] = [];
    const createdAt = new Date(payload.createdAtIso);
    const overpayAmount = Math.max(0, payload.totalPaid - payload.total);
    const hasCashPayment = payload.payments.some((payment) => payment.method === PaymentMethod.CASH);
    const sep = '----------------------------------------';

    // --- Header ---
    lines.push(payload.outletName || 'Compazz POS');
    if (template?.header?.address) {
      lines.push(template.header.address);
    }
    if (template?.header?.phone) {
      lines.push(template.header.phone);
    }
    if (template?.header?.email) {
      lines.push(template.header.email);
    }
    lines.push('Sales Receipt');
    lines.push(sep);

    // --- Transaction info (respecting footer toggles) ---
    const showTxn = template?.footer?.showTransactionNumber ?? true;
    const showDateTime = template?.footer?.showDateTime ?? true;
    const showCashier = template?.footer?.showCashierName ?? true;

    if (showTxn) lines.push(`Receipt: ${payload.receiptNumber}`);
    if (showDateTime) lines.push(`Date: ${createdAt.toLocaleString('en-NG')}`);
    if (showCashier) lines.push(`Cashier: ${payload.cashierName}`);
    if (payload.customerName) {
      lines.push(`Customer: ${payload.customerName}`);
    }
    lines.push(sep);

    // --- Items ---
    const showDiscounts = template?.body?.showDiscounts ?? true;
    payload.items.forEach((item) => {
      const lineDiscount = Math.max(0, item.discount) * item.quantity;
      const lineTotal = item.quantity * item.unitPrice - lineDiscount;
      lines.push(truncateReceiptText(item.name || 'Item'));
      lines.push(
        `  ${item.quantity} x ${formatCurrency(item.unitPrice)} = ${formatCurrency(lineTotal)}`
      );
      if (showDiscounts && lineDiscount > 0) {
        lines.push(`  Discount: -${formatCurrency(lineDiscount)}`);
      }
    });

    // --- Totals ---
    lines.push(sep);
    lines.push(`Subtotal: ${formatCurrency(payload.subtotal)}`);
    if (showDiscounts && payload.totalDiscount > 0) {
      lines.push(`Discount: -${formatCurrency(payload.totalDiscount)}`);
    }
    const showTax = template?.body?.showTaxBreakdown ?? true;
    if (showTax && payload.totalTax > 0) {
      lines.push(`VAT (incl.): ${formatCurrency(payload.totalTax)}`);
    }
    lines.push(`Total: ${formatCurrency(payload.total)}`);
    lines.push(sep);

    // --- Payments ---
    if (payload.payments.length === 0) {
      lines.push(`Payment: ${formatCurrency(payload.totalPaid)}`);
    } else {
      payload.payments.forEach((payment) => {
        lines.push(`${paymentMethodLabel(payment.method)}: ${formatCurrency(payment.amount)}`);
      });
    }

    if (overpayAmount > 0) {
      lines.push(`${hasCashPayment ? 'Change' : 'Cashback'}: ${formatCurrency(overpayAmount)}`);
    }

    if (payload.pendingSync) {
      lines.push(sep);
      lines.push('Offline copy (pending sync)');
    }

    // --- Footer ---
    const thankYou = template?.footer?.thankYouMessage || 'Thank you';
    lines.push(thankYou);
    if (template?.footer?.returnPolicy) {
      lines.push(template.footer.returnPolicy);
    }
    if (template?.footer?.additionalInfo) {
      lines.push(template.footer.additionalInfo);
    }

    return lines.join('\n');
  };

  const openReceiptPrintWindow = async (
    receiptContent: string,
    options?: {
      title?: string;
      copies?: number;
    }
  ): Promise<boolean> => {
    let printerName: string | undefined;
    try {
      const runtimeOutletId = currentOutlet?.id;
      if (runtimeOutletId) {
        const runtime = getHardwareRuntimeForTerminal(runtimeOutletId, terminalId || undefined);
        printerName = runtime.receiptPrinter?.name;
      }
    } catch (runtimeError) {
      logger.warn('Failed to resolve hardware runtime for receipt print:', runtimeError);
    }

    // Read template styling for the print window
    const template = currentOutlet?.id ? readCachedReceiptTemplate(currentOutlet.id) : null;
    const printStyle: ReceiptPrintStyle | undefined = template?.styling
      ? {
          fontSize: template.styling.fontSize,
          fontFamily: template.styling.fontFamily,
          lineSpacing: template.styling.lineSpacing,
          paperWidth: template.styling.paperWidth,
        }
      : undefined;

    const result = await printReceiptContent(receiptContent, {
      title: options?.title || 'Receipt',
      copies: options?.copies || 1,
      printerName,
      style: printStyle,
    });
    return result.success;
  };

  const buildReceiptNumberFromOfflineId = (offlineId: string): string => {
    const stamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const suffix = (offlineId.split('_').pop() || 'LOCAL').slice(0, 6).toUpperCase();
    return `OFF-${stamp}-${suffix}`;
  };

  const createLocalOfflineId = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }
    return `offline_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };

  const buildLocalReceiptPayloadFromCart = (params: {
    offlineId: string;
    createdAtIso: string;
    cartSnapshot: CartItem[];
    totals: { subtotal: number; totalDiscount: number; totalTax: number; total: number };
    totalPaid: number;
    splitPayments: Array<{ method: PaymentMethod; amount: number }>;
    customerName?: string;
    pendingSync: boolean;
  }): LocalReceiptPayload => {
    const cashierName =
      currentStaff?.display_name ||
      currentUser?.name ||
      currentUser?.email ||
      'Cashier';

    return {
      receiptNumber: buildReceiptNumberFromOfflineId(params.offlineId),
      createdAtIso: params.createdAtIso,
      outletName: currentOutlet?.name || 'Compazz POS',
      cashierName,
      customerName: params.customerName,
      items: params.cartSnapshot.map((item) => ({
        name: item.product.name,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discount: item.discount,
      })),
      subtotal: params.totals.subtotal,
      totalDiscount: params.totals.totalDiscount,
      totalTax: params.totals.totalTax,
      total: params.totals.total,
      totalPaid: params.totalPaid,
      payments: params.splitPayments,
      pendingSync: params.pendingSync,
    };
  };

  const printLocalReceiptPayload = async (payload: LocalReceiptPayload, copies = 1): Promise<boolean> => {
    const receiptContent = buildLocalReceiptContent(payload);
    const opened = await openReceiptPrintWindow(receiptContent, {
      title: `Receipt ${payload.receiptNumber}`,
      copies,
    });
    if (!opened) {
      warning('Receipt print failed. Verify printer connection/mapping in Hardware Setup.', 5000);
    }
    return opened;
  };

  const getHardwareRuntimeForTerminal = (outletId?: string, activeTerminalId?: string) => {
    const hardwareState = loadHardwareState(outletId, activeTerminalId);
    const policy = resolveReceiptPolicy(hardwareState);
    const receiptPrinter = resolveReceiptPrinter(hardwareState);
    const drawer = resolvePrimaryCashDrawer(hardwareState, policy.id);

    const receiptPrinterCapabilities = receiptPrinter
      ? resolveAdapterCapabilities('printer', receiptPrinter.adapterId, receiptPrinter.capabilities)
      : null;
    const drawerCapabilities = drawer
      ? resolveAdapterCapabilities('drawer', drawer.adapterId, drawer.capabilities)
      : null;

    return {
      policy,
      receiptPrinter,
      receiptPrinterCapabilities,
      drawer,
      drawerCapabilities,
    };
  };

  // Determine what screen to show based on authentication state.
  // App.tsx already handles terminal setup + staff authentication, so POS should
  // never gate the Register screen on local staff-profile fetch timing.
  const getScreenToShow = (): 'manager_login' | 'pos_dashboard' => {
    // Terminal mode can continue with staff PIN auth when manager session is unavailable.
    // Only force manager/business-owner auth when terminal is not yet configured.
    const canRunWithTerminalSessionOnly = !!terminalConfig;

    // If no user is authenticated and terminal is not configured, show manager login
    if (!currentUser && !canRunWithTerminalSessionOnly) {
      return 'manager_login';
    }

    // Otherwise, show POS dashboard.
    return 'pos_dashboard';
  };


  // Load products on mount
  useEffect(() => {
    if (currentOutlet?.id) {
      loadProducts();
    }
  }, [currentOutlet?.id, selectedCategory]);

  // Handle global keyboard shortcuts and barcode scanning
  useEffect(() => {
    const handleKeyDown = async (e: KeyboardEvent) => {
      // Don't interfere with input fields
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // F1-F12 shortcuts (can be added later)
      // For now, focus search on F1
      if (e.key === 'F1') {
        e.preventDefault();
        // Focus search input (handled by App.tsx)
      }

      // Escape to clear cart
      if (e.key === 'Escape' && cart.length > 0) {
        e.preventDefault();
        setShowClearCartConfirm(true);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cart]);

  const refreshOfflineTransactionCount = async () => {
    try {
      const count = await posService.getOfflineTransactionCount();
      setOfflineTransactionCount(count);
    } catch (countError) {
      logger.warn('Failed to refresh offline transaction count:', countError);
    }
  };

  // Initialize cash drawer session on mount
  useEffect(() => {
    const initializeCashDrawer = async () => {
      if (!currentOutlet?.id || !currentUser?.id || !isOnline || !terminalId) return;

      try {
        // Check if there's an active session
        const activeSession = await posService.getActiveCashDrawerSession(currentOutlet.id, terminalId);
        
        if (!activeSession) {
          // Prompt to open session (can be made automatic later)
          // For now, we'll just check - UI can prompt user to open session
        }
      } catch (err) {
        logger.error('Error checking cash drawer session:', err);
      }
    };

    initializeCashDrawer();
  }, [currentOutlet?.id, currentUser?.id, isOnline]);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Check offline transactions count
    refreshOfflineTransactionCount();

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep retrying sync while online if pending transactions remain.
  useEffect(() => {
    if (!isOnline || offlineTransactionCount <= 0) return;

    syncOfflineTransactions();

    const intervalId = window.setInterval(() => {
      syncOfflineTransactions();
    }, 8000);

    return () => window.clearInterval(intervalId);
  }, [isOnline, offlineTransactionCount]);

  // Automatic clock-out on page unload/refresh
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      // Only trigger auto clock-out if staff is authenticated
      if (isStaffAuthenticated && currentStaff) {
        // Clear staff session to trigger automatic clock-out.
        clearStaffSession();

        // Store clock-out timestamp for potential recovery
        const clockOutData = {
          staff_id: currentStaff.id,
          clocked_out_at: new Date().toISOString(),
          auto_logout: true,
          outlet_id: currentOutlet?.id
        };

        // Use sessionStorage so it persists only for this browser session
        sessionStorage.setItem('pos_auto_clockout', JSON.stringify(clockOutData));

        // Optional: Show warning message (some browsers may not display this)
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [isStaffAuthenticated, currentStaff, currentOutlet?.id]);

  // Load staff profiles when outlet changes
  useEffect(() => {
    if (currentOutlet?.id) {
      loadStaffProfiles();
      checkExistingStaffSession();
    }
  }, [currentOutlet?.id]);

  // Clear staff session when outlet changes (but not on initial authentication)
  useEffect(() => {
    // Only trigger logout if staff is already authenticated and outlet actually changed
    if (isStaffAuthenticated && currentStaff && currentOutlet?.id && currentStaff.outlet_id !== currentOutlet.id) {
      handleStaffLogout();
    }
  }, [currentOutlet?.id]);

  // Comprehensive real-time sync for products, inventory, and transactions
  const { isConnected: isRealtimeConnected } = useRealtimeSync({
    outletId: currentOutlet?.id || '',
    enabled: !!currentOutlet?.id && isStaffAuthenticated,
    onProductChange: async (action, data) => {
      if (action === 'INSERT') {
        logger.log('🆕 Real-time: New product added', data.name);
        setProducts(prev => [data, ...prev]);
        await offlineDatabase.storeProducts([data]);
        success(`New product: ${data.name}`);
      } else if (action === 'UPDATE') {
        logger.log('🔄 Real-time: Product updated', data.name);
        setProducts(prev => prev.map(p => p.id === data.id ? data : p));
        await offlineDatabase.storeProducts([data]);
      } else if (action === 'DELETE') {
        logger.log('🗑️ Real-time: Product deleted', data.id);
        setProducts(prev => prev.filter(p => p.id !== data.id));
        await offlineDatabase.removeProduct(data.id);
      }
    },
    onInventoryChange: (action, data) => {
      logger.log(`📊 Real-time: Inventory ${action}`, data);
      // Refresh product list to reflect inventory changes
      if (action === 'INSERT' || action === 'UPDATE') {
        loadProducts();
      }
    },
    onHeldReceiptChange: () => {
      // Pull latest held receipts fast on any terminal when another terminal updates them.
      void loadHeldReceipts({ silent: true });
    }
  });

  /**
   * Load products from API
   */
  const loadProducts = async () => {
    if (!currentOutlet?.id) {
      logger.warn('No active outlet found for POS');
      setProducts([]);
      setIsLoading(false);
      return;
    }

    const outletId = currentOutlet.id;
    const requestId = ++productLoadRequestRef.current;

    try {
      setIsLoading(true);
      const localResult = await posService.getCachedProducts(outletId, {
        category: selectedCategory || undefined,
        activeOnly: true,
        page: 1,
        size: 5000
      });
      if (requestId !== productLoadRequestRef.current) return;

      const hasLocalProducts = (localResult.items || []).length > 0;
      setProducts(localResult.items || []);
      setPosError(null);
      setIsLoading(false);

      const isOnlineNow = typeof navigator === 'undefined' ? true : navigator.onLine;
      if (!isOnlineNow) {
        if (!hasLocalProducts) {
          setPosError('No products cached yet. Connect once to sync catalog.');
        }
        return;
      }

      void (async () => {
        try {
          await posService.syncProductCatalog(outletId, {
            forceFull: !hasLocalProducts
          });

          const refreshedLocal = await posService.getCachedProducts(outletId, {
            category: selectedCategory || undefined,
            activeOnly: true,
            page: 1,
            size: 5000
          });
          if (requestId !== productLoadRequestRef.current) return;

          if ((refreshedLocal.items || []).length > 0) {
            setProducts(refreshedLocal.items);
            setPosError(null);
            return;
          }

          if (!hasLocalProducts) {
            // Fallback: if sync produced nothing, attempt direct online read once.
            const response = await posService.getProducts(outletId, {
              category: selectedCategory || undefined,
              activeOnly: true,
              size: 100
            });
            if (requestId !== productLoadRequestRef.current) return;

            const onlineItems = response?.items || [];
            setProducts(onlineItems);
            setPosError(onlineItems.length > 0 ? null : 'No products found for this outlet.');
          }
        } catch (syncErr) {
          logger.error('Background product sync failed:', syncErr);
          if (requestId !== productLoadRequestRef.current) return;
          if (!hasLocalProducts) {
            setPosError('No products found. Connect to internet once to sync local catalog.');
          }
        }
      })();
    } catch (err) {
      if (requestId !== productLoadRequestRef.current) return;
      logger.error('Error loading products from cache/sync:', err);
      try {
        const offlineProducts = await posService.getCachedProducts(outletId, {
          category: selectedCategory || undefined,
          activeOnly: true,
          page: 1,
          size: 5000
        });
        if (requestId !== productLoadRequestRef.current) return;
        if (offlineProducts.items && offlineProducts.items.length > 0) {
          setProducts(offlineProducts.items);
          setPosError(null);
          logger.log('Loaded products from offline database');
        } else {
          setPosError('No products found. Connect to internet once to sync local catalog.');
        }
      } catch (offlineErr) {
        logger.error('Offline load failed:', offlineErr);
        setPosError('Failed to load products from both online and offline sources.');
      }
    } finally {
      if (requestId === productLoadRequestRef.current) {
        setIsLoading(false);
      }
    }
  };


  /**
   * Handle successful PIN authentication
   */
  const handleStaffAuthentication = (authResponse: StaffAuthResponse) => {
    setCurrentStaff(authResponse.staff_profile);
    setIsStaffAuthenticated(true);

    // Store staff session info
    setStaffSessionRaw(JSON.stringify({
      staff_profile: authResponse.staff_profile,
      session_token: authResponse.session_token,
      expires_at: authResponse.expires_at,
      outlet_id: currentOutlet?.id
    }));

    // Load products and initialize POS
    loadProducts();
  };

  /**
   * Handle staff logout/clock out
   */
  const handleStaffLogout = () => {
    setShowClockOutModal(true);
  };

  /**
   * Confirm staff logout
   */
  const confirmStaffLogout = () => {
    setCurrentStaff(null);
    setIsStaffAuthenticated(false);

    // Clear staff session
    clearStaffSession();

    // Clear any auto-clockout data since this is a manual logout
    sessionStorage.removeItem('pos_auto_clockout');

    // Clear cart and reset POS state
    setCart([]);
    setSelectedCustomer(null);
  };

  // Handle manager login success
  const handleManagerLoginSuccess = () => {
    setShowManagerLogin(false);
    // The OutletContext will update currentUser automatically
    // This will trigger a re-render with proper authentication state
  };

  /**
   * Check for existing staff session on load
   */
  const checkExistingStaffSession = () => {
    // Check if there was an auto-logout
    const autoClockout = sessionStorage.getItem('pos_auto_clockout');
    if (autoClockout) {
      try {
        const clockoutData = JSON.parse(autoClockout);
        logger.log(`Staff member was automatically clocked out at ${clockoutData.clocked_out_at}`);

        // Clear the auto-logout data
        sessionStorage.removeItem('pos_auto_clockout');
      } catch (err) {
        logger.error('Error parsing auto-clockout data:', err);
        sessionStorage.removeItem('pos_auto_clockout');
      }
    }

    const staffSession = getStaffSessionRaw();
    if (staffSession) {
      try {
        const session = JSON.parse(staffSession);
        const expiresAt = new Date(session.expires_at);
        const now = new Date();

        // Check if session is still valid and for current outlet
        if (expiresAt > now && session.outlet_id === currentOutlet?.id) {
          setCurrentStaff(session.staff_profile);
          setIsStaffAuthenticated(true);
        } else {
          // Session expired or different outlet, clear it
          clearStaffSession();
        }
      } catch (err) {
        logger.error('Error parsing staff session:', err);
        clearStaffSession();
      }
    }
  };

  /**
   * Sync offline transactions when back online
   */
  const syncOfflineTransactions = async () => {
    try {
      const synced = await posService.syncOfflineTransactions();
      await refreshOfflineTransactionCount();
      if (synced > 0) {
        loadProducts();
      }
    } catch (err) {
      logger.error('Error syncing offline transactions:', err);
      await refreshOfflineTransactionCount();
    }
  };

  // Centralized terminal re-sync whenever connectivity returns.
  useEffect(() => {
    if (!isOnline || !currentOutlet?.id) return;

    const runTerminalResync = async () => {
      await Promise.allSettled([
        syncOfflineTransactions(),
        loadProducts(),
        loadStaffProfiles(),
        loadHeldReceipts(),
      ]);
    };

    runTerminalResync();
  }, [isOnline, currentOutlet?.id]);

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
        // Add new item – treat product.unit_price as VAT-inclusive final price
        return [...prevCart, {
          product,
          quantity,
          // IMPORTANT: unitPrice is already VAT-inclusive; we DO NOT add tax again here.
          unitPrice: product.unit_price,
          discount: 0
        }];
      }
    });
  };

  // Expose addToCart method to parent component
  useImperativeHandle(ref, () => ({
    addToCart,
    openCustomerSearch: () => setShowCustomerSearch(true),
    openTransactionHistory: () => setShowTransactionHistory(true),
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
    // Reset tender state so held/cancelled sales don't carry payments to the next sale.
    setActivePayments({});
    setTenderModal(null);
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

  const loadHeldReceipts = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!currentOutlet?.id) {
      setHeldSales([]);
      return;
    }

    if (!silent) {
      setIsLoadingHeldReceipts(true);
    }
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
              // Older held receipts may store placeholder "Product". Resolve using loaded catalog if possible.
              name: (() => {
                const raw = (item.product_name || (item.product && item.product.name) || '').trim();
                if (raw && raw.toLowerCase() !== 'product') return raw;
                const matched = products.find((p) => p.id === item.product_id);
                return matched?.name || item.sku || 'Product';
              })(),
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
          synced: true,
        }));
        setHeldSales(convertedReceipts);

        // Also sync to localStorage as backup
        if (heldStorageKey) {
          localStorage.setItem(heldStorageKey, JSON.stringify(convertedReceipts));
        }
      } else if (heldStorageKey) {
        // Offline: load from localStorage
        const raw = localStorage.getItem(heldStorageKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            setHeldSales(parsed);
          }
        }
      }
    } catch (err) {
      logger.error('Failed to load held receipts:', err);
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
          logger.error('Failed to load from localStorage:', localErr);
          setHeldSales([]);
        }
      }
    } finally {
      if (!silent) {
        setIsLoadingHeldReceipts(false);
      }
    }
  }, [currentOutlet?.id, isOnline, heldStorageKey, products]);

  // Load held sales on outlet/network/catalog changes
  useEffect(() => {
    loadHeldReceipts();
  }, [loadHeldReceipts]);

  // Keep held receipts actively converged across terminals.
  // Uses fast polling as a fallback where table realtime events are delayed/misconfigured.
  useEffect(() => {
    if (!currentOutlet?.id || !isStaffAuthenticated || !isOnline) return;

    let disposed = false;
    let inFlight = false;
    const pollMs = showHeldModal ? 2500 : 5000;

    const refreshHeldReceipts = async () => {
      if (disposed || inFlight) return;
      inFlight = true;
      try {
        await loadHeldReceipts({ silent: true });
      } finally {
        inFlight = false;
      }
    };

    void refreshHeldReceipts();
    const intervalId = window.setInterval(() => {
      void refreshHeldReceipts();
    }, pollMs);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [currentOutlet?.id, isStaffAuthenticated, isOnline, showHeldModal, loadHeldReceipts]);

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
      prev.includes(id) ? [] : [id]
    );
  };

  const handlePutOnHold = async () => {
    if (!currentOutlet?.id || cart.length === 0 || !currentUser) return;

    const totals = calculateCartTotals();
    const holdCashierId = currentStaff?.id || currentUser.id;
    const holdCashierName = currentStaff?.display_name || currentUser.name || 'Cashier';

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

    // Create a local held sale immediately for instant UI feedback
    const localId = `hold_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const localHeld: HeldSale = {
      id: localId,
      cart,
      saved_at: new Date().toISOString(),
      total: totals.total,
      cashier_id: holdCashierId,
      cashier_name: holdCashierName,
      synced: false,
    };

    const updatedLocal = [...heldSales, localHeld];
    await persistHeldSales(updatedLocal);
    clearCart();

    // If online, attempt to sync to backend in the background
    if (isOnline) {
      (async () => {
        try {
          const receipt = await posService.createHeldReceipt({
            outlet_id: currentOutlet.id,
            cashier_id: holdCashierId,
            items,
            total: totals.total,
          });

          // Update the held sale only if it still exists in state.
          // If cashier already loaded/removed it, delete backend copy to avoid re-appearing rows.
          let removedBeforeSync = false;
          setHeldSales((prev) => {
            const exists = prev.some((held) => held.id === localId);
            if (!exists) {
              removedBeforeSync = true;
              return prev;
            }

            const next: HeldSale[] = prev.map((held) =>
              held.id === localId
                ? {
                    ...held,
                    id: receipt.id,
                    saved_at: receipt.saved_at,
                    total: receipt.total,
                    cashier_id: receipt.cashier_id,
                    cashier_name: receipt.cashier_name,
                    synced: true,
                  }
                : held
            );

            if (heldStorageKey) {
              localStorage.setItem(heldStorageKey, JSON.stringify(next));
            }
            return next;
          });

          if (removedBeforeSync) {
            try {
              await posService.deleteHeldReceipt(receipt.id);
            } catch (cleanupErr) {
              logger.error('Failed to cleanup synced held receipt after local restore/remove:', cleanupErr);
            }
          }
        } catch (err) {
          logger.error('Failed to sync held receipt to backend (kept locally):', err);
          // Keep the local held sale; it will remain visible on this terminal
        }
      })();
    }
  };

  const handleRestoreHeldSale = async (id: string) => {
    const sale = heldSales.find((s) => s.id === id);
    if (!sale) return;

    // If cart items don't have full product data, fetch it
    let restoredCart = sale.cart;
    const hasPlaceholderProducts = restoredCart.some((item) => {
      const name = (item.product.name || '').trim().toLowerCase();
      return !item.product.id || !item.product.name || name === 'product';
    });
    if (restoredCart.length > 0 && hasPlaceholderProducts) {
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
                const result = await posService.getProducts(currentOutlet.id, {
                  page: 1,
                  size: 100,
                  activeOnly: false,
                });
                return result?.items?.find((p: POSProduct) => p.id === productId);
              }
              
              return null;
            } catch (err) {
              logger.error(`Failed to fetch product ${productId}:`, err);
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
        logger.error('Failed to fetch product details for held receipt:', err);
        // Continue with existing cart data
      }
    }

    // Restore cart
    setCart(restoredCart);
    
    // Remove from list (so it doesn't show up again)
    const remaining = heldSales.filter((s) => s.id !== id);
    await persistHeldSales(remaining);

    // Try deleting backend copy immediately so it won't reappear after refresh/reload.
    // If it fails, keep ID for one retry after successful checkout.
    let retryDeleteAfterSale: string | null = null;
    if (isOnline && sale.synced) {
      try {
        await posService.deleteHeldReceipt(id);
      } catch (deleteErr) {
        logger.error('Failed to delete held receipt on load; will retry after sale:', deleteErr);
        retryDeleteAfterSale = id;
      }
    }
    setRestoredHeldReceiptId(retryDeleteAfterSale);
    
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
        logger.error('Failed to delete held receipt from backend:', err);
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
    let totalTax = 0; // VAT portion (for reporting only)
    let totalDiscount = 0;

    cart.forEach(item => {
      // unitPrice is VAT-inclusive, so lineSubtotal is the gross amount charged
      const lineSubtotal = item.unitPrice * item.quantity;
      const lineDiscount = item.discount * item.quantity;
      const lineGrossAfterDiscount = lineSubtotal - lineDiscount;

      // Derive VAT portion from VAT-inclusive price for reporting (do NOT add to total again)
      const rate = item.product.tax_rate || 0;
      let lineTax = 0;
      if (rate > 0) {
        // VAT portion from inclusive price: gross - net = gross * (rate / (1 + rate))
        lineTax = lineGrossAfterDiscount * (rate / (1 + rate));
      }

      subtotal += lineSubtotal;
      totalDiscount += lineDiscount;
      totalTax += lineTax;
    });

    // Total the customer pays is the VAT-inclusive amount already in unitPrice
    const total = subtotal - totalDiscount;

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
   * Helpers for split tendering (QuickBooks-style)
   */
  const getRemainingForMethod = (method: 'cash' | 'card' | 'transfer') => {
    const totals = calculateCartTotals();
    const otherPaid =
      (method === 'cash' ? 0 : (activePayments.cash || 0)) +
      (method === 'card' ? 0 : (activePayments.card || 0)) +
      (method === 'transfer' ? 0 : (activePayments.transfer || 0));
    return Math.max(0, totals.total - otherPaid);
  };

  const openTenderModal = (method: 'cash' | 'card' | 'transfer') => {
    if (!cart.length) return;
    const remaining = getRemainingForMethod(method);
    const existing = activePayments[method];
    setTenderModal({
      method,
      amount: (existing ?? remaining).toString(),
    });
  };

  const applyTender = () => {
    if (!tenderModal) return;

    const method = tenderModal.method;
    const numAmount = parseFloat(tenderModal.amount) || 0;

    // Validate
    if (numAmount <= 0) {
      // Remove this method if amount is cleared
      setActivePayments(prev => {
        const updated: { cash?: number; card?: number; transfer?: number } = { ...prev };
        delete updated[method];
        return updated;
      });
      setTenderModal(null);
      return;
    }

    // Allow all payment methods to exceed due for cashback use-cases.

    setActivePayments(prev => ({ ...prev, [method]: numAmount }));
    setTenderModal(null);
  };

  const closeTenderModal = () => setTenderModal(null);

  const updateTenderAmount = (amount: string) => {
    setTenderModal(prev => prev ? ({ ...prev, amount, error: undefined }) : prev);
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
        // We already send per-line discounts; keep transaction-level discount 0 for now
        discount_amount: 0
      };

      // Process transaction (online or offline)
      if (isOnline) {
        await posService.createTransaction(transactionRequest);
      } else {
        const offlineId = await posService.storeOfflineTransaction(transactionRequest);
        void offlineId;
        await refreshOfflineTransactionCount();
      }

      // Clear cart and close modal
      clearCart();
      setShowPaymentModal(false);

    } catch (err) {
      logger.error('Payment error:', err);
      // keep cart as-is so cashier can retry or adjust
    }
  };



  /**
   * Handle split payment processing
   */
  const handleSplitPayment = async (mode: 'save' | 'save_and_print' = 'save') => {
    if (!currentUser?.id || !currentOutlet?.id || isFinalizingSale || finalizeSaleLockRef.current) return;

    const outletId = currentOutlet.id;
    const cashierId = currentUser.id;
    const activeTerminalId = terminalId || undefined;
    const terminalHardware = getHardwareRuntimeForTerminal(outletId, activeTerminalId);
    const hardwarePolicy = terminalHardware.policy;

    const totals = calculateCartTotals();
    const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);

    if (totalPaid < totals.total) {
      error(`Total paid (${formatCurrency(totalPaid)}) is less than amount due (${formatCurrency(totals.total)})`);
      return;
    }

    const items = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: item.discount * item.quantity
    }));

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

    const cashbackAmount = Math.max(0, totalPaid - totals.total);
    if (cashbackAmount > 0 && splitPayments.length > 1) {
      error(
        `Cashback (${formatCurrency(cashbackAmount)}) is only supported with a single payment method. Use one method or keep split total at ${formatCurrency(totals.total)}.`
      );
      return;
    }

    const splitPaymentPayload =
      splitPayments.length > 1
        ? splitPayments.map((payment) => ({ method: payment.method, amount: payment.amount }))
        : undefined;
    const primaryPaymentMethod =
      splitPayments.length > 0 ? splitPayments[0].method : PaymentMethod.CASH;

    const hasCashComponent = (activePayments.cash || 0) > 0 || cashbackAmount > 0;
    const drawerCanOpen =
      !!terminalHardware.drawerCapabilities &&
      supportsHardwareAction(terminalHardware.drawerCapabilities, 'open-drawer');
    const shouldAutoOpenDrawer =
      drawerCanOpen &&
      (hardwarePolicy.autoOpenDrawerMode === 'on-sale' ||
        (hardwarePolicy.autoOpenDrawerMode === 'cash-only' && hasCashComponent));

    // Explicit button semantics:
    // - Save Only never prints
    // - Save & Print always attempts to print
    const shouldPrintReceipt = mode === 'save_and_print';

    const offlineId = createLocalOfflineId();
    const transactionRequest: any = {
      outlet_id: outletId,
      cashier_id: cashierId,
      items,
      payment_method: primaryPaymentMethod,
      tendered_amount: totalPaid,
      discount_amount: 0,
      split_payments: splitPaymentPayload,
      customer_id: selectedCustomer?.id,
      customer_name: selectedCustomer?.name,
      offline_id: offlineId,
    };

    const copies = hardwarePolicy.duplicateReceiptsEnabled ? 2 : 1;
    const cartSnapshot: CartItem[] = cart.map((item) => ({
      product: { ...item.product },
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discount: item.discount,
    }));
    const createdAtIso = new Date().toISOString();
    const localReceiptPayload = buildLocalReceiptPayloadFromCart({
      offlineId,
      createdAtIso,
      cartSnapshot,
      totals,
      totalPaid,
      splitPayments,
      customerName: selectedCustomer?.name,
      pendingSync: !isOnline,
    });

    finalizeSaleLockRef.current = true;
    setIsFinalizingSale(true);

    try {
      let printedAtCheckout = false;
      if (shouldPrintReceipt) {
        const canPrintReceipt =
          !!terminalHardware.receiptPrinterCapabilities &&
          supportsHardwareAction(terminalHardware.receiptPrinterCapabilities, 'print-receipt');
        if (!canPrintReceipt) {
          warning('Receipt printer is not configured for receipt printing on this terminal.', 5000);
        } else {
          printedAtCheckout = await printLocalReceiptPayload(localReceiptPayload, copies);
        }
      }

      await posService.storeOfflineTransaction(transactionRequest);

      await refreshOfflineTransactionCount();

      clearCart();
      setActivePayments({});
      setTenderModal(null);
      setRestoredHeldReceiptId(null);
      setSelectedCustomer(null);

      if (isOnline) {
        (async () => {
          try {
            if (shouldAutoOpenDrawer && activeTerminalId) {
              try {
                const activeSession = await posService.getActiveCashDrawerSession(outletId, activeTerminalId);
                if (!activeSession) {
                  await posService.openCashDrawerSession({
                    outlet_id: outletId,
                    terminal_id: activeTerminalId,
                    cashier_id: cashierId,
                    opening_balance: 0,
                    opening_notes: 'Auto-opened from sale based on hardware preferences'
                  });
                }
              } catch (drawerError) {
                logger.warn('Automatic cash drawer session open failed:', drawerError);
              }
            }

            // Single authoritative sync path: prevents duplicate create flows drifting.
            const synced = await posService.syncOfflineTransactions();
            await refreshOfflineTransactionCount();
            if (synced > 0) {
              loadProducts();
            }
          } catch (syncErr: any) {
            logger.error('Online sync for transaction failed, keeping offline copy:', syncErr);
            await refreshOfflineTransactionCount();
            if (shouldPrintReceipt && !printedAtCheckout) {
              await printLocalReceiptPayload(localReceiptPayload, copies);
            }
          }
        })();
      } else {
        await refreshOfflineTransactionCount();
      }

      if (restoredHeldReceiptId) {
        try {
          if (isOnline) {
            await posService.deleteHeldReceipt(restoredHeldReceiptId);
          }
          const remaining = heldSales.filter((s) => s.id !== restoredHeldReceiptId);
          await persistHeldSales(remaining);
        } catch (err) {
          logger.error('Failed to delete held receipt after sale:', err);
        }
      }
    } catch (err: any) {
      logger.error('Split payment error:', err);
      const errorMessage = err?.response?.data?.detail || err?.message || 'Transaction failed. Please try again.';
      error(errorMessage, 6000);
    } finally {
      setIsFinalizingSale(false);
      finalizeSaleLockRef.current = false;
    }
  };

  // NOTE: Legacy single-method cash flow removed.
  // All payments (cash/card/transfer, single or split) now use handleSplitPayment + tender popup.

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
          logger.error("Local search failed, falling back to memory:", err);
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

  // Determine what screen to show
  const screenToShow = getScreenToShow();
  const remainingBalance = calculateRemainingBalance();
  const isFullyPaid = remainingBalance <= 0;
  const hasActivePayments = Object.keys(activePayments).length > 0;
  const canFinalize = hasActivePayments && remainingBalance <= 0;

  // Show Manager Login Screen
  if (screenToShow === 'manager_login') {
    return (
      <div className="h-full min-h-0 bg-white">
        <LoginForm
          onSuccess={handleManagerLoginSuccess}
          onSwitchToSignup={() => {
            navigate('/auth?mode=signup');
          }}
        />
      </div>
    );
  }

  return (
    <div className="h-full min-h-0 bg-stone-50 p-3 sm:p-4 lg:p-5">
      <div className="h-full min-h-0 overflow-hidden">
        <div className="w-full h-full flex flex-col gap-4">
          <div className="rounded-2xl border border-stone-200 bg-white shadow-sm flex-1 min-h-0 flex flex-col">
            <div className="flex-1 min-h-0 overflow-y-auto p-3">
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

          <div className="rounded-2xl border border-stone-200 bg-white shadow-sm px-4 py-4 flex-shrink-0">
            {selectedCustomer && (
              <div className="mb-3 pb-3 border-b border-stone-200">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <span className="text-xs text-stone-500">Customer:</span>
                    <span className="ml-2 text-base font-semibold text-slate-900 truncate">
                      {selectedCustomer.name}
                    </span>
                    {selectedCustomer.phone && (
                      <span className="ml-2 text-xs text-stone-500">({selectedCustomer.phone})</span>
                    )}
                  </div>
                  <button
                    onClick={() => setSelectedCustomer(null)}
                    className="text-sm text-red-600 hover:text-red-700 font-medium"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="mb-4 pb-4 border-b border-stone-200 space-y-3">
              <div className="flex flex-wrap xl:flex-nowrap items-center xl:items-end justify-between gap-3">
                <div className="flex items-center gap-2 flex-wrap justify-start">
                  <button
                    onClick={() => openTenderModal('cash')}
                    disabled={cart.length === 0 || (isFullyPaid && !activePayments.cash)}
                    className={`min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] min-w-[112px] sm:min-w-[124px] xl:min-w-[138px] px-4 sm:px-5 xl:px-6 py-3 text-base sm:text-lg font-extrabold tracking-wide rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activePayments.cash
                        ? 'btn-brand border-transparent'
                        : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.cash ? <Check className="w-5 h-5" /> : null}
                      CASH
                      {activePayments.cash ? <span className="text-sm font-bold">{formatCurrency(activePayments.cash)}</span> : null}
                    </span>
                  </button>
                  <button
                    onClick={() => openTenderModal('card')}
                    disabled={cart.length === 0 || (isFullyPaid && !activePayments.card)}
                    className={`min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] min-w-[112px] sm:min-w-[124px] xl:min-w-[138px] px-4 sm:px-5 xl:px-6 py-3 text-base sm:text-lg font-extrabold tracking-wide rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activePayments.card
                        ? 'btn-brand border-transparent'
                        : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.card ? <Check className="w-5 h-5" /> : null}
                      CARD
                      {activePayments.card ? <span className="text-sm font-bold">{formatCurrency(activePayments.card)}</span> : null}
                    </span>
                  </button>
                  <button
                    onClick={() => openTenderModal('transfer')}
                    disabled={cart.length === 0 || (isFullyPaid && !activePayments.transfer)}
                    className={`min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] min-w-[112px] sm:min-w-[124px] xl:min-w-[138px] px-4 sm:px-5 xl:px-6 py-3 text-base sm:text-lg font-extrabold tracking-wide rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activePayments.transfer
                        ? 'btn-brand border-transparent'
                        : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.transfer ? <Check className="w-5 h-5" /> : null}
                      TRANSFER
                      {activePayments.transfer ? <span className="text-sm font-bold">{formatCurrency(activePayments.transfer)}</span> : null}
                    </span>
                  </button>
                </div>

                <div className="flex items-baseline gap-2 xl:ml-auto text-right">
                  <span className="text-sm sm:text-base font-bold uppercase tracking-wide text-stone-500">Amount Due</span>
                  <span className="text-3xl sm:text-4xl xl:text-5xl font-black leading-none text-slate-900">
                    {formatCurrency(cart.length === 0 ? 0 : remainingBalance)}
                  </span>
                </div>
              </div>

              {hasActivePayments && (() => {
                const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);
                return (
                  <div className="text-sm font-semibold text-stone-600 xl:text-right">
                    <span className="font-bold">Payments: </span>
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
                    <span className="font-bold text-slate-800 ml-2">
                      ({formatCurrency(totalPaid)} / {formatCurrency(cartTotals.total)})
                    </span>
                    {remainingBalance > 0 && (
                      <span className="text-amber-700 font-bold ml-2">
                        · Remaining: {formatCurrency(remainingBalance)}
                      </span>
                    )}
                  </div>
                );
              })()}
            </div>

            {tenderModal && (() => {
              const remaining = getRemainingForMethod(tenderModal.method);
              const entered = parseFloat(tenderModal.amount) || 0;
              const overAmount = entered > remaining ? entered - remaining : 0;
              const overAmountLabel = tenderModal.method === 'cash' ? 'Change' : 'Cashback';
              const overAmountContainerClass = tenderModal.method === 'cash' ? 'bg-emerald-50' : 'bg-amber-50';
              const overAmountLabelClass = tenderModal.method === 'cash' ? 'text-emerald-700' : 'text-amber-700';
              const overAmountValueClass = tenderModal.method === 'cash' ? 'text-emerald-900' : 'text-amber-900';
              const title = tenderModal.method === 'cash' ? 'Cash Payment' : tenderModal.method === 'card' ? 'Card Payment' : 'Transfer Payment';

              return (
                <>
                  <div className="fixed inset-0 z-40 bg-black/40" onClick={closeTenderModal} />
                  <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-[92vw] max-w-md rounded-2xl border border-stone-300 bg-white shadow-2xl overflow-hidden">
                    <div className="px-5 py-4 border-b border-stone-200 flex items-center justify-between">
                      <div>
                        <h3 className="text-lg font-bold text-slate-900">{title}</h3>
                        <p className="text-xs text-stone-500 mt-0.5">Amount due: {formatCurrency(remaining)}</p>
                      </div>
                      <button onClick={closeTenderModal} className="p-2 rounded-lg hover:bg-stone-100">
                        <X className="w-5 h-5 text-stone-500" />
                      </button>
                    </div>

                    <div className="p-5 space-y-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => updateTenderAmount(remaining.toString())}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 text-slate-800 text-sm font-semibold transition-colors"
                        >
                          Exact
                        </button>
                        <button
                          onClick={() => updateTenderAmount((Math.ceil(remaining / 1000) * 1000).toString())}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 text-slate-800 text-sm font-semibold transition-colors"
                        >
                          Round ₦1k
                        </button>
                        <button
                          onClick={() => updateTenderAmount((Math.ceil(remaining / 5000) * 5000).toString())}
                          className="flex-1 px-3 py-2.5 rounded-lg border border-stone-300 bg-stone-100 hover:bg-stone-200 text-slate-800 text-sm font-semibold transition-colors"
                        >
                          Round ₦5k
                        </button>
                      </div>

                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <label className="block text-xs font-medium text-stone-500 mb-1">Amount</label>
                          <input
                            type="number"
                            value={tenderModal.amount}
                            onChange={(e) => updateTenderAmount(e.target.value)}
                            className="w-full px-3 py-2.5 text-lg border border-stone-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                            autoFocus
                          />
                          {tenderModal.error && (
                            <p className="text-xs text-red-600 mt-1">{tenderModal.error}</p>
                          )}
                          {tenderModal.method !== 'cash' && (
                            <p className="text-[11px] text-stone-500 mt-1">You can enter above amount due to process cashback.</p>
                          )}
                        </div>

                        {overAmount > 0 && (
                          <div className={`flex-shrink-0 px-3 py-2 rounded-lg mt-6 ${overAmountContainerClass}`}>
                            <div className={`text-xs font-medium ${overAmountLabelClass}`}>{overAmountLabel}</div>
                            <div className={`text-base font-bold ${overAmountValueClass}`}>
                              {formatCurrency(overAmount)}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="px-5 py-4 border-t border-stone-200 flex items-center justify-between">
                      <button
                        onClick={() => {
                          setActivePayments(prev => {
                            const updated: { cash?: number; card?: number; transfer?: number } = { ...prev };
                            delete updated[tenderModal.method];
                            return updated;
                          });
                          setTenderModal(null);
                        }}
                        className="px-4 py-2.5 text-sm font-semibold text-stone-600 hover:text-slate-900 hover:bg-stone-100 rounded-lg transition-colors"
                      >
                        Clear
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={closeTenderModal}
                          className="px-4 py-2.5 text-sm font-semibold text-slate-700 bg-stone-100 hover:bg-stone-200 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={applyTender}
                          className="px-4 py-2.5 text-sm font-semibold rounded-lg transition-colors btn-brand"
                        >
                          OK
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              );
            })()}

            <div className="flex items-center gap-2 ml-auto flex-wrap justify-end">
              <button
                onClick={() => {
                  setActivePayments({});
                  setTenderModal(null);
                  clearCart();
                }}
                disabled={cart.length === 0 && Object.keys(activePayments).length === 0}
                className="min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] px-4 sm:px-5 xl:px-6 py-3 bg-stone-600 hover:bg-stone-700 text-stone-100 text-base sm:text-lg font-extrabold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
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
                className="min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] px-4 sm:px-5 xl:px-6 py-3 bg-slate-200 hover:bg-slate-300 text-slate-800 text-base sm:text-lg font-extrabold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {hasHeldSale && cart.length === 0 ? 'Held Receipts' : 'Put on Hold'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSplitPayment('save');
                }}
                disabled={!canFinalize || isFinalizingSale}
                className="min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] px-4 sm:px-5 xl:px-6 py-3 text-stone-100 text-base sm:text-lg font-extrabold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
              >
                {isFinalizingSale ? 'Saving...' : 'Save Only'}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  void handleSplitPayment('save_and_print');
                }}
                disabled={!canFinalize || isFinalizingSale}
                className="min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] px-4 sm:px-5 xl:px-6 py-3 text-stone-100 text-base sm:text-lg font-extrabold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed btn-brand"
              >
                {isFinalizingSale ? 'Printing...' : 'Save & Print'}
              </button>
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
            <div className="bg-white rounded-xl shadow-xl w-full max-w-5xl max-h-[92vh] flex flex-col">
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
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="text-xs font-medium text-slate-500">
                            {new Date(sale.saved_at).toLocaleDateString([], {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                            })}{' '}
                            ·{' '}
                            {new Date(sale.saved_at).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </div>
                          <div className="text-sm text-slate-700 truncate">
                            {sale.cart.length} item{sale.cart.length !== 1 ? 's' : ''} ·{' '}
                            Held by {sale.cashier_name}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-sm font-bold text-slate-900">
                            {formatCurrency(sale.total)}
                          </span>
                          <button
                            onClick={() => handleRestoreHeldSale(sale.id)}
                            className="px-3 py-1.5 text-sm font-bold bg-slate-900 hover:bg-slate-800 text-stone-100 rounded-lg"
                          >
                            Load
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleHeldExpanded(sale.id)}
                            className="px-2 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900"
                          >
                            {expandedHeldIds.includes(sale.id) ? 'Hide items' : 'Show items'}
                          </button>
                          <button
                            onClick={() => handleRemoveHeldSale(sale.id)}
                            className="p-1.5 text-slate-500 hover:text-red-600 hover:bg-red-50 rounded"
                            title="Remove"
                            aria-label="Remove"
                          >
                            <span className="text-lg leading-none">×</span>
                          </button>
                        </div>
                      </div>

                      {expandedHeldIds.includes(sale.id) && (
                        <div className="mt-1.5 border-t border-slate-200 pt-1.5 space-y-0.5">
                          {sale.cart.map((item, index) => (
                            <div
                              key={`${sale.id}-${item.product.id}-${index}`}
                              className="flex text-[11px] text-slate-700 justify-between"
                            >
                              <div className="truncate max-w-[70%]">
                                {(() => {
                                  const rawName = (item.product.name || '').trim();
                                  if (rawName && rawName.toLowerCase() !== 'product') return rawName;
                                  const matched = products.find((p) => p.id === item.product.id);
                                  return matched?.name || item.product.sku || 'Product';
                                })()}
                              </div>
                              <div className="flex items-center gap-2">
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

        {/* Transaction History Modal */}
        {showTransactionHistory && currentOutlet?.id && (
          <TransactionHistory
            outletId={currentOutlet.id}
            isOpen={showTransactionHistory}
            onClose={() => setShowTransactionHistory(false)}
          />
        )}

        {/* Staff Management Modal */}
        <StaffManagementModal
          isOpen={showStaffManagement}
          onClose={() => {
            setShowStaffManagement(false);
            // Reload staff profiles after modal closes to update the UI
            loadStaffProfiles();
          }}
        />

        {/* Clock Out Confirmation Modal */}
        <ClockOutConfirmModal
          isOpen={showClockOutModal}
          onClose={() => setShowClockOutModal(false)}
          onConfirm={confirmStaffLogout}
          staffName={currentStaff?.display_name || 'staff member'}
        />

        {/* Manager Login Modal */}
        {showManagerLogin && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-lg w-full max-w-md p-6">
              <div className="flex justify-end mb-4">
                <button
                  onClick={() => setShowManagerLogin(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <LoginForm
                isModal={true}
                onSuccess={handleManagerLoginSuccess}
                onSwitchToSignup={() => {
                  setShowManagerLogin(false);
                  navigate('/auth?mode=signup');
                }}
              />
            </div>
          </div>
        )}

        {showClearCartConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
              <h3 className="text-lg font-bold text-gray-900">Clear cart?</h3>
              <p className="mt-2 text-sm text-gray-600">
                This will remove all items from the current sale.
              </p>
              <div className="mt-5 flex justify-end gap-2">
                <button
                  onClick={() => setShowClearCartConfirm(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    clearCart();
                    setShowClearCartConfirm(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
                >
                  Clear Cart
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Toast Notifications */}
        <ToastContainer toasts={toasts} onClose={removeToast} />

        {/* Customer Search Modal */}
        {showCustomerSearch && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-gray-900">Search Customer</h2>
                <button
                  onClick={() => {
                    setShowCustomerSearch(false);
                    setCustomerSearchQuery('');
                    setCustomerSearchResults([]);
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mb-4">
                <input
                  type="text"
                  value={customerSearchQuery}
                  onChange={async (e) => {
                    const query = e.target.value;
                    setCustomerSearchQuery(query);
                    if (query.length >= 2 && currentOutlet?.id) {
                      setIsSearchingCustomers(true);
                      try {
                        const results = await posService.searchCustomers(currentOutlet.id, query);
                        setCustomerSearchResults(results);
                      } catch (err) {
                        logger.error('Customer search error:', err);
                      } finally {
                        setIsSearchingCustomers(false);
                      }
                    } else {
                      setCustomerSearchResults([]);
                    }
                  }}
                  placeholder="Search by name or phone..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-slate-400 focus:border-transparent"
                  autoFocus
                />
              </div>

              {isSearchingCustomers && (
                <div className="text-center py-4 text-sm text-gray-500">Searching...</div>
              )}

              {customerSearchResults.length > 0 && (
                <div className="max-h-60 overflow-y-auto space-y-2">
                  {customerSearchResults.map((customer) => (
                    <button
                      key={customer.id}
                      onClick={() => {
                        setSelectedCustomer({
                          id: customer.id,
                          name: customer.name,
                          phone: customer.phone
                        });
                        setShowCustomerSearch(false);
                        setCustomerSearchQuery('');
                        setCustomerSearchResults([]);
                      }}
                      className="w-full text-left px-4 py-2 hover:bg-gray-50 rounded-lg border border-gray-200"
                    >
                      <div className="font-semibold text-gray-900">{customer.name}</div>
                      {customer.phone && (
                        <div className="text-sm text-gray-500">{customer.phone}</div>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {customerSearchQuery.length >= 2 && !isSearchingCustomers && (
                <div className="text-center py-4">
                  <p className="text-sm text-gray-500 mb-3">
                    {customerSearchResults.length === 0
                      ? 'No customers found'
                      : 'Can’t find the right customer?'}
                  </p>
                  <button
                    onClick={async () => {
                      if (currentOutlet?.id) {
                        try {
                          const newCustomer = await posService.createCustomer({
                            outlet_id: currentOutlet.id,
                            name: customerSearchQuery,
                            phone: customerSearchQuery.replace(/\D/g, '').slice(0, 11) || customerSearchQuery
                          });
                          setSelectedCustomer({
                            id: newCustomer.id,
                            name: newCustomer.name,
                            phone: newCustomer.phone
                          });
                          setShowCustomerSearch(false);
                          setCustomerSearchQuery('');
                          setCustomerSearchResults([]);
                          success('Customer created successfully!');
                        } catch (err: any) {
                          error(err.message || 'Failed to create customer');
                        }
                      }
                    }}
                    className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-stone-100 rounded-lg font-semibold text-sm"
                  >
                    Create New Customer
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
  );
});

POSDashboard.displayName = 'POSDashboard';

export default POSDashboard;
