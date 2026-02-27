/**
 * POS Dashboard - Main POS Interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect, useRef, useCallback, useMemo, forwardRef, useImperativeHandle } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Plus,
  RotateCcw,
  X,
  User,
  Check,
  ShieldCheck,
} from 'lucide-react';

interface TerminalConfig {
  outlet_id: string;
  outlet_name: string;
  initialized_by: string;
  initialized_at: string;
}
import { useOutlet } from '../../contexts/OutletContext';
import { posService, PaymentMethod, type SaleUnit } from '../../lib/posService';
import type { POSProduct } from '../../lib/posService';
import { staffService } from '../../lib/staffService';
import type { StaffProfile, StaffAuthResponse } from '../../types';
import { offlineDatabase } from '../../lib/offlineDatabase';
import { ToastContainer, useToast } from '../ui/Toast';
import logger from '../../lib/logger';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { useTerminalId } from '../../hooks/useTerminalId';
import { getStaffSessionRaw, setStaffSessionRaw, clearStaffSession } from '../../lib/staffSessionStorage';
import { consumeRefundExchangeIntent, type RefundExchangeIntentLine } from '../../lib/refundExchangeIntent';

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
  lineId: string;
  product: POSProduct;
  quantity: number;
  unitPrice: number;
  discount: number;
  saleUnit: SaleUnit;
  unitsPerSaleUnit: number;
  isReturnLine?: boolean;
  maxQuantity?: number;
}

export interface POSDashboardHandle {
  addToCart: (
    product: POSProduct,
    quantity?: number,
    options?: { saleUnit?: SaleUnit }
  ) => void;
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

interface DiscountOverrideGrant {
  sessionToken: string;
  expiresAt: string;
  approver: Pick<StaffProfile, 'id' | 'display_name' | 'role' | 'permissions'>;
}

interface ExchangeModeContext {
  originalTransactionId: string;
  originalTransactionNumber?: string;
  originalPaymentMethod?: PaymentMethod;
  returnReason: string;
  loadedAt: string;
}

interface ExchangeBreakdown {
  returnedItems: Array<{ product_id: string; sale_unit: SaleUnit; quantity: number }>;
  saleLines: CartItem[];
  returnTotal: number;
  saleTotal: number;
  netDue: number;
  refundDue: number;
}

const DEFAULT_BASE_UNIT_NAME = 'Unit';
const DEFAULT_PACK_NAME = 'Pack';

const normalizeSaleUnit = (value?: string | null): SaleUnit => {
  return String(value || '').trim().toLowerCase() === 'pack' ? 'pack' : 'unit';
};

const getUnitsPerPack = (product: POSProduct): number => {
  const raw = Number(product.units_per_pack || 0);
  return Number.isFinite(raw) && raw >= 2 ? Math.floor(raw) : 1;
};

const isPackSaleConfigured = (product: POSProduct): boolean => {
  return Boolean(product.pack_enabled) && getUnitsPerPack(product) >= 2 && Number(product.pack_price || 0) > 0;
};

const getLineUnitPrice = (product: POSProduct, saleUnit: SaleUnit): number => {
  if (saleUnit === 'pack' && isPackSaleConfigured(product)) {
    return Number(product.pack_price || 0);
  }
  return Number(product.unit_price || 0);
};

const getLineUnitsPerSaleUnit = (product: POSProduct, saleUnit: SaleUnit): number => {
  if (saleUnit === 'pack' && isPackSaleConfigured(product)) {
    return getUnitsPerPack(product);
  }
  return 1;
};

const getSaleUnitLabel = (product: POSProduct, saleUnit: SaleUnit): string => {
  if (saleUnit === 'pack') {
    return String(product.pack_name || DEFAULT_PACK_NAME).trim() || DEFAULT_PACK_NAME;
  }
  return String(product.base_unit_name || DEFAULT_BASE_UNIT_NAME).trim() || DEFAULT_BASE_UNIT_NAME;
};

const buildCartLineId = (productId: string, saleUnit: SaleUnit): string => `${productId}:${saleUnit}`;
const roundMoney = (amount: number): number => Math.round((amount + Number.EPSILON) * 100) / 100;
const lineUnitNet = (unitPrice: number, discountPerUnit: number): number =>
  Math.max(0, Number(unitPrice || 0) - Number(discountPerUnit || 0));
const DISCOUNT_APPROVER_ROLES = new Set([
  'manager',
  'pharmacist',
  'accountant',
  'outlet_admin',
  'business_owner',
  'super_admin',
  'admin',
]);

const canStaffApproveDiscount = (profile: Pick<StaffProfile, 'role' | 'permissions'> | null | undefined): boolean => {
  if (!profile) return false;
  const role = String(profile.role || '').toLowerCase();
  if (DISCOUNT_APPROVER_ROLES.has(role)) return true;
  const permissions = (profile.permissions || []).map((permission) => String(permission || '').trim().toLowerCase());
  return permissions.includes('apply_discounts') || permissions.includes('manage_discounts');
};

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
    credit?: number;
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
  const [exchangeContext, setExchangeContext] = useState<ExchangeModeContext | null>(null);

  // Staff Management States
  const [staffProfiles, setStaffProfiles] = useState<StaffProfile[]>([]);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [isStaffAuthenticated, setIsStaffAuthenticated] = useState(false);
  const [showClockOutModal, setShowClockOutModal] = useState(false);
  const [showStaffManagement, setShowStaffManagement] = useState(false);
  const [showManagerLogin, setShowManagerLogin] = useState(false);
  const [showDiscountApprovalModal, setShowDiscountApprovalModal] = useState(false);
  const [discountApprovalApproverId, setDiscountApprovalApproverId] = useState('');
  const [discountApprovalPin, setDiscountApprovalPin] = useState('');
  const [discountApprovalError, setDiscountApprovalError] = useState<string | null>(null);
  const [isDiscountApprovalLoading, setIsDiscountApprovalLoading] = useState(false);
  const [discountOverrideGrant, setDiscountOverrideGrant] = useState<DiscountOverrideGrant | null>(null);

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

  useEffect(() => {
    // Discount approvals are transaction-scoped for safety.
    setDiscountOverrideGrant(null);
    setExchangeContext(null);
  }, [currentOutlet?.id, currentStaff?.id]);

  const discountApprovers = useMemo(
    () =>
      (staffProfiles || [])
        .filter((profile) => profile.is_active && canStaffApproveDiscount(profile))
        .sort((a, b) => a.display_name.localeCompare(b.display_name)),
    [staffProfiles]
  );

  useEffect(() => {
    if (!showDiscountApprovalModal) return;

    if (!discountApprovers.length) {
      setDiscountApprovalError('No authorized manager/pharmacist profile is available for discount approval.');
      return;
    }

    const stillValidSelection = discountApprovers.some((profile) => profile.id === discountApprovalApproverId);
    if (!stillValidSelection) {
      setDiscountApprovalApproverId(discountApprovers[0].id);
    }
  }, [showDiscountApprovalModal, discountApprovers, discountApprovalApproverId]);

  // Helper function to format currency
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const normalizeCartLine = useCallback((input: any): CartItem => {
    const product = input.product as POSProduct;
    const requestedSaleUnit = normalizeSaleUnit(input.saleUnit || input.sale_unit);
    const saleUnit: SaleUnit =
      requestedSaleUnit === 'pack' && isPackSaleConfigured(product) ? 'pack' : 'unit';
    const isReturnLine = Boolean(input.isReturnLine || input.line_type === 'return');
    const quantity = Math.max(
      1,
      Number(input.quantity || input.sale_quantity || 1)
    );
    const fallbackUnitPrice = getLineUnitPrice(product, saleUnit);
    const parsedUnitPrice = Number(
      input.unitPrice ?? input.sale_unit_price ?? input.unit_price ?? fallbackUnitPrice
    );
    let unitPrice = Number.isFinite(parsedUnitPrice) ? parsedUnitPrice : fallbackUnitPrice;
    if (!isReturnLine && unitPrice < 0) {
      unitPrice = fallbackUnitPrice;
    }
    if (isReturnLine && unitPrice > 0) {
      unitPrice = -unitPrice;
    }
    const unitsPerSaleUnit = Math.max(
      1,
      Number(
        input.unitsPerSaleUnit ??
        input.units_per_sale_unit ??
        getLineUnitsPerSaleUnit(product, saleUnit)
      ) || 1
    );
    const resolvedMaxQuantity = isReturnLine
      ? Math.max(
          quantity,
          Number(input.maxQuantity ?? input.max_quantity ?? quantity) || quantity
        )
      : undefined;

    return {
      lineId: String(
        input.lineId ||
          (isReturnLine ? `return:${buildCartLineId(product.id, saleUnit)}` : buildCartLineId(product.id, saleUnit))
      ),
      product,
      quantity,
      unitPrice,
      discount: isReturnLine ? 0 : Math.max(0, Number(input.discount || 0)),
      saleUnit,
      unitsPerSaleUnit,
      isReturnLine,
      maxQuantity: resolvedMaxQuantity,
    };
  }, []);

  useEffect(() => {
    if (!currentOutlet?.id) return;

    const intent = consumeRefundExchangeIntent();
    if (!intent) return;

    if (intent.outlet_id && intent.outlet_id !== currentOutlet.id) {
      warning('Return request belongs to a different outlet.', 5000);
      return;
    }

    const cartByLineId = new Map<string, CartItem>();

    const resolveProduct = (line: RefundExchangeIntentLine): POSProduct => {
      const matchedProduct = products.find((product) => product.id === line.product_id);
      if (matchedProduct) return matchedProduct;

      const saleUnit = line.sale_unit === 'pack' ? 'pack' : 'unit';
      const unitsPerSaleUnit = Math.max(1, Number(line.units_per_sale_unit || (saleUnit === 'pack' ? 2 : 1)));
      const saleUnitPrice = Number(line.unit_price || 0);
      const fallbackUnitPrice =
        saleUnit === 'pack' && unitsPerSaleUnit > 1
          ? roundMoney(saleUnitPrice / unitsPerSaleUnit)
          : saleUnitPrice;

      return {
        id: line.product_id,
        outlet_id: currentOutlet.id,
        sku: line.sku || '',
        barcode: undefined,
        name: line.product_name || line.sku || 'Product',
        description: undefined,
        category: undefined,
        unit_price: fallbackUnitPrice,
        cost_price: undefined,
        tax_rate: 0,
        quantity_on_hand: 0,
        reorder_level: 0,
        reorder_quantity: 0,
        is_active: true,
        vendor_id: undefined,
        image_url: undefined,
        display_order: 0,
        created_at: '',
        updated_at: '',
        base_unit_name: DEFAULT_BASE_UNIT_NAME,
        pack_enabled: saleUnit === 'pack' && unitsPerSaleUnit >= 2,
        pack_name: saleUnit === 'pack' ? DEFAULT_PACK_NAME : undefined,
        units_per_pack: saleUnit === 'pack' ? unitsPerSaleUnit : undefined,
        pack_price: saleUnit === 'pack' ? saleUnitPrice : undefined,
      };
    };

    for (const line of intent.lines || []) {
      const productId = String(line.product_id || '').trim();
      if (!productId) continue;

      const quantity = Math.max(0, Math.round(Number(line.quantity || 0)));
      if (quantity <= 0) continue;

      const saleUnit: SaleUnit = line.sale_unit === 'pack' ? 'pack' : 'unit';
      const unitsPerSaleUnit = Math.max(1, Number(line.units_per_sale_unit || 1));
      const discountPerUnit = Math.max(0, Number(line.discount_per_unit || 0));
      const listedUnitPrice = Math.max(0, Number(line.unit_price || 0));
      const refundUnitPrice = roundMoney(Math.max(0, listedUnitPrice - discountPerUnit));
      const resolvedProduct = resolveProduct(line);
      const returnLineId = `return:${buildCartLineId(productId, saleUnit)}`;

      const normalizedLine = normalizeCartLine({
        lineId: returnLineId,
        product: resolvedProduct,
        quantity,
        unitPrice: -refundUnitPrice,
        discount: 0,
        saleUnit,
        unitsPerSaleUnit,
        isReturnLine: true,
        maxQuantity: quantity,
      });

      const existingCartLine = cartByLineId.get(normalizedLine.lineId);
      if (existingCartLine) {
        existingCartLine.quantity += normalizedLine.quantity;
        existingCartLine.maxQuantity = Math.max(
          existingCartLine.maxQuantity || 0,
          existingCartLine.quantity
        );
      } else {
        cartByLineId.set(normalizedLine.lineId, { ...normalizedLine });
      }
    }

    const preloadedCart = Array.from(cartByLineId.values());
    if (preloadedCart.length === 0) {
      warning('No returnable lines were found in the selected transaction.', 5000);
      return;
    }

    const originalPaymentMethodRaw = String(intent.original_payment_method || '').trim().toLowerCase();
    const resolvedOriginalPaymentMethod =
      originalPaymentMethodRaw === PaymentMethod.CASH ||
      originalPaymentMethodRaw === PaymentMethod.POS ||
      originalPaymentMethodRaw === PaymentMethod.TRANSFER ||
      originalPaymentMethodRaw === PaymentMethod.CREDIT ||
      originalPaymentMethodRaw === PaymentMethod.MOBILE
        ? (originalPaymentMethodRaw as PaymentMethod)
        : undefined;

    setCart(preloadedCart);
    setExchangeContext({
      originalTransactionId: intent.original_transaction_id,
      originalTransactionNumber: intent.original_transaction_number,
      originalPaymentMethod: resolvedOriginalPaymentMethod,
      returnReason: intent.return_reason || 'Customer return',
      loadedAt: intent.created_at,
    });
    setActivePayments({});
    setTenderModal(null);
    setSelectedCustomer(null);
    setDiscountOverrideGrant(null);
  }, [currentOutlet?.id, products, normalizeCartLine, warning]);

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
        name:
          item.saleUnit === 'pack'
            ? `${item.product.name} (${getSaleUnitLabel(item.product, item.saleUnit)})`
            : item.product.name,
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

  const printServerTransactionReceipt = async (
    transactionId: string,
    title: string,
    copies = 1
  ): Promise<boolean> => {
    try {
      const printResult = await posService.printReceipt(transactionId, copies);
      const receiptContent = printResult?.receipt_content;
      if (!receiptContent) {
        warning('Receipt content was empty for print request.', 5000);
        return false;
      }
      const printed = await openReceiptPrintWindow(receiptContent, { title, copies });
      if (!printed) {
        warning('Receipt print failed. Verify printer connection/mapping in Hardware Setup.', 5000);
      }
      return printed;
    } catch (printError) {
      logger.error('Server receipt print failed:', printError);
      warning('Receipt print failed. Verify printer connection/mapping in Hardware Setup.', 5000);
      return false;
    }
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
    setDiscountOverrideGrant(null);
  };

  // Handle manager login success
  const handleManagerLoginSuccess = () => {
    setShowManagerLogin(false);
    // The OutletContext will update currentUser automatically
    // This will trigger a re-render with proper authentication state
  };

  const closeDiscountApprovalModal = () => {
    setShowDiscountApprovalModal(false);
    setDiscountApprovalError(null);
    setDiscountApprovalApproverId('');
    setDiscountApprovalPin('');
    setIsDiscountApprovalLoading(false);
  };

  const requestDiscountApproval = () => {
    if (!discountApprovers.length) {
      error('No authorized manager/pharmacist profile is available for discount approval.', 5000);
      return;
    }
    setDiscountApprovalError(null);
    if (!discountApprovalApproverId) {
      setDiscountApprovalApproverId(discountApprovers[0].id);
    }
    setShowDiscountApprovalModal(true);
  };

  const authorizeDiscountForCurrentSale = async () => {
    if (!currentOutlet?.id) return;

    const selectedApprover = discountApprovers.find((profile) => profile.id === discountApprovalApproverId);
    const pin = discountApprovalPin.trim();
    if (!selectedApprover) {
      setDiscountApprovalError('Select an authorized staff profile.');
      return;
    }
    if (!pin) {
      setDiscountApprovalError('PIN is required.');
      return;
    }

    setIsDiscountApprovalLoading(true);
    setDiscountApprovalError(null);
    try {
      const authResponse = await staffService.authenticateWithPin({
        staff_code: selectedApprover.staff_code,
        pin,
        outlet_id: currentOutlet.id,
      });

      if (authResponse.staff_profile.id !== selectedApprover.id) {
        setDiscountApprovalError('PIN does not match selected staff profile.');
        return;
      }

      const canApproveDiscount = canStaffApproveDiscount(authResponse.staff_profile);

      if (!canApproveDiscount) {
        setDiscountApprovalError('Selected staff cannot authorize discounts.');
        return;
      }

      setDiscountOverrideGrant({
        sessionToken: authResponse.session_token,
        expiresAt: authResponse.expires_at,
        approver: {
          id: authResponse.staff_profile.id,
          display_name: authResponse.staff_profile.display_name,
          role: authResponse.staff_profile.role,
          permissions: authResponse.staff_profile.permissions,
        },
      });
      closeDiscountApprovalModal();
      success(`Discount approved by ${authResponse.staff_profile.display_name}`);
    } catch (err) {
      logger.error('Discount approval failed:', err);
      setDiscountApprovalError('Invalid PIN.');
    } finally {
      setIsDiscountApprovalLoading(false);
    }
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
  const addToCart = (
    product: POSProduct,
    quantity: number = 1,
    options?: { saleUnit?: SaleUnit }
  ) => {
    const requestedUnit = normalizeSaleUnit(options?.saleUnit);
    const saleUnit: SaleUnit =
      requestedUnit === 'pack' && isPackSaleConfigured(product) ? 'pack' : 'unit';
    const lineId = buildCartLineId(product.id, saleUnit);
    const unitPrice = getLineUnitPrice(product, saleUnit);
    const unitsPerSaleUnit = getLineUnitsPerSaleUnit(product, saleUnit);

    setCart(prevCart => {
      const existingItem = prevCart.find(item => item.lineId === lineId);

      if (existingItem) {
        // Update quantity
        return prevCart.map(item =>
          item.lineId === lineId
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      } else {
        // Add new item – treat product.unit_price as VAT-inclusive final price
        return [...prevCart, {
          lineId,
          product,
          quantity,
          // IMPORTANT: unitPrice is already VAT-inclusive; we DO NOT add tax again here.
          unitPrice,
          discount: 0,
          saleUnit,
          unitsPerSaleUnit,
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
  const removeFromCart = (lineId: string) => {
    setCart(prevCart => prevCart.filter(item => item.lineId !== lineId));
  };

  /**
   * Update cart item quantity
   */
  const updateCartItemQuantity = (lineId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(lineId);
      return;
    }

    setCart(prevCart =>
      prevCart.map(item =>
        item.lineId === lineId
          ? {
              ...item,
              quantity: item.isReturnLine
                ? Math.min(
                    Math.max(1, Math.round(quantity)),
                    Math.max(1, Math.round(Number(item.maxQuantity || item.quantity || 1)))
                  )
                : Math.max(1, Math.round(quantity)),
            }
          : item
      )
    );
  };

  /**
   * Update cart item discount
   */
  const updateCartItemDiscount = (lineId: string, discount: number) => {
    setCart(prevCart =>
      prevCart.map(item =>
        item.lineId === lineId && !item.isReturnLine
          ? { ...item, discount }
          : item
      )
    );
  };

  /**
   * Switch cart line between unit and pack sale mode.
   */
  const updateCartItemSaleUnit = (lineId: string, nextSaleUnit: SaleUnit) => {
    setCart((prevCart) => {
      const sourceLine = prevCart.find((item) => item.lineId === lineId);
      if (!sourceLine) return prevCart;
      if (sourceLine.isReturnLine) return prevCart;

      const normalizedNext = normalizeSaleUnit(nextSaleUnit);
      const resolvedNext: SaleUnit =
        normalizedNext === 'pack' && isPackSaleConfigured(sourceLine.product) ? 'pack' : 'unit';
      const targetLineId = buildCartLineId(sourceLine.product.id, resolvedNext);
      if (targetLineId === lineId) return prevCart;

      const nextUnitPrice = getLineUnitPrice(sourceLine.product, resolvedNext);
      const nextUnitsPerSaleUnit = getLineUnitsPerSaleUnit(sourceLine.product, resolvedNext);

      const withoutSource = prevCart.filter((item) => item.lineId !== lineId);
      const targetIndex = withoutSource.findIndex((item) => item.lineId === targetLineId);

      if (targetIndex >= 0) {
        const merged = [...withoutSource];
        merged[targetIndex] = {
          ...merged[targetIndex],
          quantity: merged[targetIndex].quantity + sourceLine.quantity,
          unitPrice: nextUnitPrice,
          saleUnit: resolvedNext,
          unitsPerSaleUnit: nextUnitsPerSaleUnit,
          discount: 0,
        };
        return merged;
      }

      return [
        ...withoutSource,
        {
          ...sourceLine,
          lineId: targetLineId,
          saleUnit: resolvedNext,
          unitsPerSaleUnit: nextUnitsPerSaleUnit,
          unitPrice: nextUnitPrice,
          discount: 0,
        },
      ];
    });
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
    setDiscountOverrideGrant(null);
    setExchangeContext(null);
  };

  /**
   * Track and manage held sales (multiple parked carts)
   */
  const [heldSales, setHeldSales] = useState<HeldSale[]>([]);
  const [showHeldModal, setShowHeldModal] = useState(false);
  const [expandedHeldIds, setExpandedHeldIds] = useState<string[]>([]);
  const [isLoadingHeldReceipts, setIsLoadingHeldReceipts] = useState(false);
  const [restoredHeldReceiptId, setRestoredHeldReceiptId] = useState<string | null>(null);
  const heldSalesRef = useRef<HeldSale[]>([]);

  const heldStorageKey = currentOutlet?.id
    ? `pos_hold_carts_${currentOutlet.id}`
    : null;

  useEffect(() => {
    heldSalesRef.current = heldSales;
  }, [heldSales]);

  const readHeldSalesFromStorage = useCallback((): HeldSale[] => {
    if (!heldStorageKey) return [];
    try {
      const raw = localStorage.getItem(heldStorageKey);
      if (!raw) return [];

      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];

      return parsed
        .map((entry: any) => ({
          ...entry,
          synced: entry?.synced === false ? false : true,
          cart: Array.isArray(entry?.cart)
            ? entry.cart
                .map((line: any) => (line?.product ? normalizeCartLine(line) : null))
                .filter(Boolean)
            : [],
        }))
        .filter((entry: HeldSale) => Boolean(entry?.id));
    } catch (err) {
      logger.error('Failed to load held receipts from localStorage:', err);
      return [];
    }
  }, [heldStorageKey, normalizeCartLine]);

  const mergeBackendWithLocalUnsynced = useCallback((backendReceipts: HeldSale[]): HeldSale[] => {
    const mergedById = new Map<string, HeldSale>();
    backendReceipts.forEach((sale) => {
      mergedById.set(sale.id, sale);
    });

    const unsyncedLocalCandidates = [
      ...heldSalesRef.current,
      ...readHeldSalesFromStorage(),
    ];
    unsyncedLocalCandidates.forEach((sale) => {
      if (!sale?.id || sale.synced !== false) return;
      if (!mergedById.has(sale.id)) {
        mergedById.set(sale.id, { ...sale, synced: false });
      }
    });

    return Array.from(mergedById.values()).sort((a, b) => {
      const aTime = new Date(a.saved_at || 0).getTime();
      const bTime = new Date(b.saved_at || 0).getTime();
      return bTime - aTime;
    });
  }, [readHeldSalesFromStorage]);

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
          cart: r.items.map((item: any) => {
            const matched = products.find((p) => p.id === item.product_id);
            const fallbackProduct = {
              id: item.product_id,
              // Older held receipts may store placeholder "Product". Resolve using loaded catalog if possible.
              name: (() => {
                const raw = (item.product_name || (item.product && item.product.name) || '').trim();
                if (raw && raw.toLowerCase() !== 'product') return raw;
                return matched?.name || item.sku || 'Product';
              })(),
              unit_price: Number(item.unit_price || matched?.unit_price || 0),
              tax_rate: Number(item.tax_rate || matched?.tax_rate || 0.075),
              quantity_on_hand: Number(matched?.quantity_on_hand || 0),
              reorder_level: Number(matched?.reorder_level || 0),
              reorder_quantity: Number(matched?.reorder_quantity || 0),
              is_active: true,
              display_order: 0,
              sku: item.sku || matched?.sku || '',
              barcode: item.barcode || matched?.barcode,
              category: item.category || matched?.category,
              outlet_id: currentOutlet.id,
              created_at: '',
              updated_at: '',
              base_unit_name: matched?.base_unit_name || item.base_unit_name || DEFAULT_BASE_UNIT_NAME,
              pack_enabled: matched?.pack_enabled ?? item.pack_enabled,
              pack_name: matched?.pack_name || item.pack_name,
              units_per_pack: matched?.units_per_pack ?? item.units_per_pack,
              pack_price: matched?.pack_price ?? item.pack_price,
              pack_barcode: matched?.pack_barcode || item.pack_barcode,
            } as POSProduct;

            return normalizeCartLine({
              ...item,
              product: matched || fallbackProduct,
            });
          }),
          saved_at: r.saved_at,
          total: r.total,
          cashier_id: r.cashier_id,
          cashier_name: r.cashier_name,
          synced: true,
        }));
        const mergedReceipts = mergeBackendWithLocalUnsynced(convertedReceipts);
        setHeldSales(mergedReceipts);

        // Also sync to localStorage as backup
        if (heldStorageKey) {
          localStorage.setItem(heldStorageKey, JSON.stringify(mergedReceipts));
        }
      } else {
        // Offline: load from localStorage
        setHeldSales(readHeldSalesFromStorage());
      }
    } catch (err) {
      logger.error('Failed to load held receipts:', err);
      // Fallback to localStorage
      setHeldSales(readHeldSalesFromStorage());
    } finally {
      if (!silent) {
        setIsLoadingHeldReceipts(false);
      }
    }
  }, [currentOutlet?.id, isOnline, heldStorageKey, products, normalizeCartLine, readHeldSalesFromStorage, mergeBackendWithLocalUnsynced]);

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
      sale_unit: item.saleUnit,
      units_per_sale_unit: item.unitsPerSaleUnit,
      sale_quantity: item.quantity,
      sale_unit_price: item.unitPrice,
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
          warning('Held receipt saved locally. Cloud sync failed; it will retry when connection is stable.', 6000);
        }
      })();
    }
  };

  const handleRestoreHeldSale = async (id: string) => {
    const sale = heldSales.find((s) => s.id === id);
    if (!sale) return;

    // Close modal immediately and restore cart instantly for cashier flow.
    setShowHeldModal(false);
    setExpandedHeldIds([]);
    setExchangeContext(null);

    const restoredCart = (sale.cart || []).map((line: any) => normalizeCartLine(line));
    const restoreSignature = restoredCart.map((line) => `${line.lineId}:${line.quantity}`).join('|');
    setCart(restoredCart);

    // Remove from list (so it doesn't show up again)
    const remaining = heldSales.filter((s) => s.id !== id);
    void persistHeldSales(remaining).catch((persistErr) => {
      logger.error('Failed to persist held receipt removal after load:', persistErr);
    });

    // Try deleting backend copy immediately so it won't reappear after refresh/reload.
    // If it fails, keep ID for one retry after successful checkout.
    setRestoredHeldReceiptId(null);
    if (isOnline && sale.synced) {
      void (async () => {
        try {
          await posService.deleteHeldReceipt(id);
        } catch (deleteErr) {
          logger.error('Failed to delete held receipt on load; will retry after sale:', deleteErr);
          setRestoredHeldReceiptId(id);
        }
      })();
    }

    // If lines contain placeholder product records, hydrate names/prices in background
    // without blocking the load interaction.
    const hasPlaceholderProducts = restoredCart.some((item) => {
      const name = (item.product.name || '').trim().toLowerCase();
      return !item.product.id || !item.product.name || name === 'product';
    });

    if (hasPlaceholderProducts) {
      void (async () => {
        try {
          const localLookup = new Map<string, POSProduct>();
          products.forEach((product) => localLookup.set(product.id, product));

          if (currentOutlet?.id) {
            const cached = await posService.getCachedProducts(currentOutlet.id, {
              activeOnly: false,
              page: 1,
              size: 5000,
            });
            (cached.items || []).forEach((product) => localLookup.set(product.id, product));
          }

          setCart((prevCart) => {
            const prevSignature = prevCart.map((line) => `${line.lineId}:${line.quantity}`).join('|');
            if (prevSignature !== restoreSignature) {
              // Cashier already edited the restored cart; do not override.
              return prevCart;
            }

            return prevCart.map((line) => {
              const resolvedProduct = localLookup.get(line.product.id);
              if (!resolvedProduct) return line;
              return normalizeCartLine({
                ...line,
                product: resolvedProduct,
              });
            });
          });
        } catch (hydrateErr) {
          logger.error('Failed to hydrate product details for held receipt load:', hydrateErr);
        }
      })();
    }
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

  const exchangeBreakdown = useMemo<ExchangeBreakdown>(() => {
    if (!exchangeContext) {
      return {
        returnedItems: [],
        saleLines: [],
        returnTotal: 0,
        saleTotal: 0,
        netDue: 0,
        refundDue: 0,
      };
    }

    const returnedItems: Array<{ product_id: string; sale_unit: SaleUnit; quantity: number }> = [];
    const saleLines: CartItem[] = [];
    let returnTotal = 0;
    let saleTotal = 0;

    cart.forEach((line) => {
      const quantity = Math.max(0, Math.round(Number(line.quantity || 0)));
      if (quantity <= 0) return;

      if (line.isReturnLine) {
        returnedItems.push({
          product_id: line.product.id,
          sale_unit: line.saleUnit,
          quantity,
        });
        returnTotal += Math.max(0, Math.abs(Number(line.unitPrice || 0)) - Number(line.discount || 0)) * quantity;
        return;
      }

      saleLines.push({ ...line, quantity });
      saleTotal += lineUnitNet(line.unitPrice, line.discount) * quantity;
    });

    returnTotal = roundMoney(returnTotal);
    saleTotal = roundMoney(saleTotal);
    const netDue = roundMoney(Math.max(0, saleTotal - returnTotal));
    const refundDue = roundMoney(Math.max(0, returnTotal - saleTotal));

    return {
      returnedItems,
      saleLines,
      returnTotal,
      saleTotal,
      netDue,
      refundDue,
    };
  }, [cart, exchangeContext]);


  /**
   * Calculate remaining balance for split payments
   */
  const calculateRemainingBalance = () => {
    const totals = calculateCartTotals();
    const dueTotal = exchangeContext ? exchangeBreakdown.netDue : totals.total;
    const totalPaid =
      (activePayments.cash || 0) +
      (activePayments.card || 0) +
      (activePayments.transfer || 0) +
      (activePayments.credit || 0);
    return Math.max(0, dueTotal - totalPaid);
  };

  /**
   * Helpers for split tendering (QuickBooks-style)
   */
  const getRemainingForMethod = (method: 'cash' | 'card' | 'transfer') => {
    const totals = calculateCartTotals();
    const dueTotal = exchangeContext ? exchangeBreakdown.netDue : totals.total;
    const otherPaid =
      (method === 'cash' ? 0 : (activePayments.cash || 0)) +
      (method === 'card' ? 0 : (activePayments.card || 0)) +
      (method === 'transfer' ? 0 : (activePayments.transfer || 0)) +
      (activePayments.credit || 0);
    return Math.max(0, dueTotal - otherPaid);
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
        const updated: { cash?: number; card?: number; transfer?: number; credit?: number } = { ...prev };
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
    if (!currentUser?.id || !currentStaff?.id || !currentOutlet?.id) return;

    try {
      const totals = calculateCartTotals();
      const hasDiscountedItems = cart.some((item) => item.discount > 0);
      if (hasDiscountedItems && !canApplyDiscount) {
        error('Discount approval is required from manager/pharmacist before payment.', 5000);
        requestDiscountApproval();
        return;
      }
      const discountAuthorizerSessionToken =
        hasDiscountedItems && !hasRoleDiscountPrivilege
          ? discountOverrideGrant?.sessionToken
          : undefined;

      // Prepare transaction items
      const items = cart.map(item => ({
        product_id: item.product.id,
        quantity: item.quantity,
        unit_price: item.unitPrice,
        discount_amount: item.discount * item.quantity,
        sale_unit: item.saleUnit,
        units_per_sale_unit: item.unitsPerSaleUnit,
      }));

      // Create transaction request
      const transactionRequest = {
        outlet_id: currentOutlet.id,
        cashier_id: currentStaff.id,
        customer_name: customerName,
        items,
        payment_method: paymentMethod,
        tendered_amount: tenderedAmount,
        // We already send per-line discounts; keep transaction-level discount 0 for now
        discount_amount: 0,
        discount_authorizer_session_token: discountAuthorizerSessionToken,
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
   * Process return/exchange in one action.
   * - Saves return transaction immediately.
   * - If replacement lines exist, saves replacement sale in the same action.
   */
  const processExchangeReturn = async (mode: 'save' | 'save_and_print' = 'save'): Promise<void> => {
    if (!currentOutlet?.id || !currentStaff?.id || !exchangeContext) return;

    if (!isOnline) {
      error('Exchange returns require an internet connection.', 5000);
      return;
    }

    if (exchangeBreakdown.returnedItems.length === 0) {
      error('Remove at least one original item to process a return.', 5000);
      return;
    }

    const hasDiscountedSaleLines = exchangeBreakdown.saleLines.some((line) => line.discount > 0);
    if (hasDiscountedSaleLines && !canApplyDiscount) {
      error('Discount approval is required from manager/pharmacist before completing sale.', 5000);
      requestDiscountApproval();
      return;
    }

    const discountAuthorizerSessionToken =
      hasDiscountedSaleLines && !hasRoleDiscountPrivilege
        ? discountOverrideGrant?.sessionToken
        : undefined;

    const customerPaid =
      (activePayments.cash || 0) +
      (activePayments.card || 0) +
      (activePayments.transfer || 0);
    const exchangeCreditApplied = roundMoney(
      Math.min(exchangeBreakdown.returnTotal, exchangeBreakdown.saleTotal)
    );
    const requiredCustomerPayment = exchangeBreakdown.netDue;
    if (exchangeBreakdown.saleLines.length > 0) {
      if (requiredCustomerPayment > 0 && customerPaid + 0.01 < requiredCustomerPayment) {
        error(
          `Collect ${formatCurrency(requiredCustomerPayment)} before processing this exchange return.`,
          6000
        );
        return;
      }
    }

    const totalPaidWithCredit = customerPaid + exchangeCreditApplied;
    const cashbackAmount = Math.max(0, totalPaidWithCredit - exchangeBreakdown.saleTotal);
    const customerSplitCount =
      ((activePayments.cash || 0) > 0 ? 1 : 0) +
      ((activePayments.card || 0) > 0 ? 1 : 0) +
      ((activePayments.transfer || 0) > 0 ? 1 : 0);
    if (cashbackAmount > 0 && customerSplitCount > 1) {
      error(
        `Cashback (${formatCurrency(cashbackAmount)}) is only supported with a single payment method. Use one method or keep split total at ${formatCurrency(exchangeBreakdown.saleTotal)}.`,
        6000
      );
      return;
    }

    finalizeSaleLockRef.current = true;
    setIsFinalizingSale(true);

    try {
      const returnResult = await posService.refundTransaction(exchangeContext.originalTransactionId, {
        return_reason: exchangeContext.returnReason || 'Customer return',
        amount: exchangeBreakdown.returnTotal,
        items: exchangeBreakdown.returnedItems.map((line) => ({
          product_id: line.product_id,
          sale_unit: line.sale_unit,
          quantity: line.quantity,
        })),
      });

      let replacementSaleId: string | null = null;
      if (exchangeBreakdown.saleLines.length > 0) {
        const replacementItems = exchangeBreakdown.saleLines.map((item) => ({
          product_id: item.product.id,
          quantity: item.quantity,
          unit_price: item.unitPrice,
          discount_amount: item.discount * item.quantity,
          sale_unit: item.saleUnit,
          units_per_sale_unit: item.unitsPerSaleUnit,
        }));

        const splitPayments: Array<{ method: PaymentMethod; amount: number }> = [];
        if ((activePayments.cash || 0) > 0) {
          splitPayments.push({ method: PaymentMethod.CASH, amount: activePayments.cash || 0 });
        }
        if ((activePayments.card || 0) > 0) {
          splitPayments.push({ method: PaymentMethod.POS, amount: activePayments.card || 0 });
        }
        if ((activePayments.transfer || 0) > 0) {
          splitPayments.push({ method: PaymentMethod.TRANSFER, amount: activePayments.transfer || 0 });
        }
        if (exchangeCreditApplied > 0) {
          splitPayments.push({ method: PaymentMethod.CREDIT, amount: exchangeCreditApplied });
        }

        const primaryPaymentMethod =
          splitPayments.find((payment) => payment.method !== PaymentMethod.CREDIT)?.method
          || splitPayments[0]?.method
          || PaymentMethod.CASH;

        const replacementSale = await posService.createTransaction({
          outlet_id: currentOutlet.id,
          cashier_id: currentStaff.id,
          customer_id: selectedCustomer?.id,
          customer_name: selectedCustomer?.name,
          items: replacementItems,
          payment_method: primaryPaymentMethod,
          tendered_amount: totalPaidWithCredit,
          discount_amount: 0,
          discount_authorizer_session_token: discountAuthorizerSessionToken,
          split_payments: splitPayments.length > 1 ? splitPayments : undefined,
          notes: `Exchange replacement for ${exchangeContext.originalTransactionNumber || exchangeContext.originalTransactionId}`,
        });
        replacementSaleId = replacementSale.id;
      }

      clearCart();
      setSelectedCustomer(null);

      if (mode === 'save_and_print') {
        const returnTitle = returnResult?.return_transaction_number
          ? `Return ${returnResult.return_transaction_number}`
          : 'Return Receipt';
        await printServerTransactionReceipt(returnResult.return_transaction_id, returnTitle, 1);
        if (replacementSaleId) {
          await printServerTransactionReceipt(replacementSaleId, 'Replacement Sale', 1);
        }
      }

      if (replacementSaleId) {
        success(
          exchangeBreakdown.refundDue > 0
            ? `Return and replacement sale saved. Change due: ${formatCurrency(exchangeBreakdown.refundDue)}.`
            : 'Return and replacement sale saved.'
        );
      } else {
        success(
          exchangeBreakdown.refundDue > 0
            ? `Return posted. Refund customer ${formatCurrency(exchangeBreakdown.refundDue)}.`
            : 'Return saved successfully.'
        );
      }

      await Promise.allSettled([
        loadProducts(),
        refreshOfflineTransactionCount(),
      ]);
    } catch (err: any) {
      logger.error('Exchange return processing failed:', err);
      error(err?.message || 'Failed to save return/exchange. No local sale changes were saved.', 6000);
    } finally {
      setIsFinalizingSale(false);
      finalizeSaleLockRef.current = false;
    }
  };

  /**
   * Handle split payment processing
   */
  const handleSplitPayment = async (mode: 'save' | 'save_and_print' = 'save') => {
    if (!currentUser?.id || !currentStaff?.id || !currentOutlet?.id || isFinalizingSale || finalizeSaleLockRef.current) return;

    if (exchangeContext) {
      await processExchangeReturn(mode);
      return;
    }

    const outletId = currentOutlet.id;
    const cashierUserId = currentUser.id;
    const cashierStaffId = currentStaff.id;
    const activeTerminalId = terminalId || undefined;
    const terminalHardware = getHardwareRuntimeForTerminal(outletId, activeTerminalId);
    const hardwarePolicy = terminalHardware.policy;

    const totals = calculateCartTotals();
    const hasDiscountedItems = cart.some((item) => item.discount > 0);
    if (hasDiscountedItems && !canApplyDiscount) {
      error('Discount approval is required from manager/pharmacist before completing sale.', 5000);
      requestDiscountApproval();
      return;
    }
    const discountAuthorizerSessionToken =
      hasDiscountedItems && !hasRoleDiscountPrivilege
        ? discountOverrideGrant?.sessionToken
        : undefined;
    const totalPaid = (activePayments.cash || 0) + (activePayments.card || 0) + (activePayments.transfer || 0);
    const creditPaid = activePayments.credit || 0;
    const totalPaidWithCredit = totalPaid + creditPaid;

    if (totalPaidWithCredit < totals.total) {
      error(`Total paid (${formatCurrency(totalPaidWithCredit)}) is less than amount due (${formatCurrency(totals.total)})`);
      return;
    }

    const items = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      discount_amount: item.discount * item.quantity,
      sale_unit: item.saleUnit,
      units_per_sale_unit: item.unitsPerSaleUnit,
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
    if (activePayments.credit && activePayments.credit > 0) {
      splitPayments.push({ method: PaymentMethod.CREDIT, amount: activePayments.credit });
    }

    const cashbackAmount = Math.max(0, totalPaidWithCredit - totals.total);
    const customerSplitCount = splitPayments.filter((payment) => payment.method !== PaymentMethod.CREDIT).length;
    if (cashbackAmount > 0 && customerSplitCount > 1) {
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
      splitPayments.find((payment) => payment.method !== PaymentMethod.CREDIT)?.method
      || splitPayments[0]?.method
      || PaymentMethod.CASH;

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
      cashier_id: cashierStaffId,
      items,
      payment_method: primaryPaymentMethod,
      tendered_amount: totalPaidWithCredit,
      discount_amount: 0,
      discount_authorizer_session_token: discountAuthorizerSessionToken,
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
      totalPaid: totalPaidWithCredit,
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
                    cashier_id: cashierUserId,
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
  const hasRoleDiscountPrivilege = canStaffApproveDiscount({
    role: (currentStaff?.role || currentUser?.role || '') as StaffProfile['role'],
    permissions: (currentStaff?.permissions || (currentUser as any)?.permissions || []) as StaffProfile['permissions'],
  });
  const hasValidDiscountOverride = Boolean(
    discountOverrideGrant && new Date(discountOverrideGrant.expiresAt).getTime() > Date.now()
  );
  const canApplyDiscount = hasRoleDiscountPrivilege || hasValidDiscountOverride;

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
  const exchangeModeActive = Boolean(exchangeContext);
  const exchangeOriginalPayment = exchangeContext?.originalPaymentMethod;
  const exchangeOriginalPaymentLabel = exchangeOriginalPayment
    ? paymentMethodLabel(exchangeOriginalPayment)
    : null;
  const exchangeCustomerPaid =
    (activePayments.cash || 0) +
    (activePayments.card || 0) +
    (activePayments.transfer || 0);
  const exchangePaymentReady = exchangeCustomerPaid + 0.01 >= exchangeBreakdown.netDue;
  const exchangeCashPreferred = exchangeModeActive && exchangeOriginalPayment === PaymentMethod.CASH && !activePayments.cash;
  const exchangeCardPreferred = exchangeModeActive && exchangeOriginalPayment === PaymentMethod.POS && !activePayments.card;
  const exchangeTransferPreferred = exchangeModeActive && exchangeOriginalPayment === PaymentMethod.TRANSFER && !activePayments.transfer;
  const canFinalize =
    exchangeModeActive
      ? (exchangeBreakdown.returnedItems.length > 0 && exchangePaymentReady)
      : hasActivePayments && remainingBalance <= 0;

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
                canApplyDiscount={canApplyDiscount}
                discountApprovalActive={hasValidDiscountOverride}
                onUpdateQuantity={updateCartItemQuantity}
                onUpdateSaleUnit={updateCartItemSaleUnit}
                onUpdateDiscount={updateCartItemDiscount}
                onRequestDiscountApproval={requestDiscountApproval}
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

            {exchangeModeActive && exchangeContext && (
              <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5">
                <div className="text-xs font-semibold uppercase tracking-wide text-amber-700">
                  Return Loaded
                </div>
                <div className="mt-1 text-sm text-amber-900">
                  {exchangeContext.originalTransactionNumber || exchangeContext.originalTransactionId}
                </div>
                <div className="mt-1 text-xs text-amber-800">
                  Return value: {formatCurrency(exchangeBreakdown.returnTotal)} · Replacement value: {formatCurrency(exchangeBreakdown.saleTotal)} · Net due: {formatCurrency(exchangeBreakdown.netDue)}
                  {exchangeBreakdown.refundDue > 0 && (
                    <span> · Change due: {formatCurrency(exchangeBreakdown.refundDue)}</span>
                  )}
                </div>
                {exchangeOriginalPaymentLabel && (
                  <div className="mt-1 text-xs text-amber-900">
                    Original payment: {exchangeOriginalPaymentLabel}
                  </div>
                )}
                {exchangeBreakdown.netDue > 0 && !exchangePaymentReady && (
                  <div className="mt-1 text-xs font-semibold text-amber-900">
                    Collect {formatCurrency(exchangeBreakdown.netDue)} before processing this return.
                  </div>
                )}
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
                        : exchangeCashPreferred
                          ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.cash ? <Check className="w-5 h-5" /> : null}
                      CASH
                      {!activePayments.cash && exchangeCashPreferred ? <span className="text-xs font-bold">(Default)</span> : null}
                      {activePayments.cash ? <span className="text-sm font-bold">{formatCurrency(activePayments.cash)}</span> : null}
                    </span>
                  </button>
                  <button
                    onClick={() => openTenderModal('card')}
                    disabled={cart.length === 0 || (isFullyPaid && !activePayments.card)}
                    className={`min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] min-w-[112px] sm:min-w-[124px] xl:min-w-[138px] px-4 sm:px-5 xl:px-6 py-3 text-base sm:text-lg font-extrabold tracking-wide rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activePayments.card
                        ? 'btn-brand border-transparent'
                        : exchangeCardPreferred
                          ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.card ? <Check className="w-5 h-5" /> : null}
                      CARD
                      {!activePayments.card && exchangeCardPreferred ? <span className="text-xs font-bold">(Default)</span> : null}
                      {activePayments.card ? <span className="text-sm font-bold">{formatCurrency(activePayments.card)}</span> : null}
                    </span>
                  </button>
                  <button
                    onClick={() => openTenderModal('transfer')}
                    disabled={cart.length === 0 || (isFullyPaid && !activePayments.transfer)}
                    className={`min-h-[56px] sm:min-h-[60px] xl:min-h-[64px] min-w-[112px] sm:min-w-[124px] xl:min-w-[138px] px-4 sm:px-5 xl:px-6 py-3 text-base sm:text-lg font-extrabold tracking-wide rounded-xl border transition-all disabled:opacity-50 disabled:cursor-not-allowed ${
                      activePayments.transfer
                        ? 'btn-brand border-transparent'
                        : exchangeTransferPreferred
                          ? 'border-amber-300 bg-amber-100 text-amber-900 hover:bg-amber-200'
                          : 'btn-brand-soft hover:brightness-[0.97]'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {activePayments.transfer ? <Check className="w-5 h-5" /> : null}
                      TRANSFER
                      {!activePayments.transfer && exchangeTransferPreferred ? <span className="text-xs font-bold">(Default)</span> : null}
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

              {exchangeModeActive && exchangeBreakdown.refundDue > 0 && (
                <div className="text-sm font-semibold text-emerald-700 xl:text-right">
                  Change Due: {formatCurrency(exchangeBreakdown.refundDue)}
                </div>
              )}

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
                    {activePayments.credit && (
                      <>
                        {activePayments.cash || activePayments.card || activePayments.transfer ? <span> · </span> : null}
                        <span>Credit {formatCurrency(activePayments.credit)}</span>
                      </>
                    )}
                    <span className="font-bold text-slate-800 ml-2">
                      ({formatCurrency(totalPaid + (activePayments.credit || 0))} / {formatCurrency(exchangeModeActive ? exchangeBreakdown.netDue : cartTotals.total)})
                    </span>
                    {remainingBalance > 0 && (
                      <span className="text-amber-700 font-bold ml-2">
                        · Remaining: {formatCurrency(remainingBalance)}
                      </span>
                    )}
                  </div>
                );
              })()}

              {hasValidDiscountOverride && !hasRoleDiscountPrivilege && discountOverrideGrant && (
                <div className="text-xs font-semibold text-blue-700">
                  Discount approved by {discountOverrideGrant.approver.display_name}
                  <button
                    type="button"
                    onClick={() => setDiscountOverrideGrant(null)}
                    className="ml-2 text-blue-800 hover:text-blue-900 underline"
                  >
                    Clear
                  </button>
                </div>
              )}

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
                            const updated: { cash?: number; card?: number; transfer?: number; credit?: number } = { ...prev };
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
                disabled={exchangeModeActive || (!hasHeldSale && cart.length === 0)}
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
                {exchangeModeActive
                  ? (isFinalizingSale ? 'Saving...' : 'Save Return')
                  : (isFinalizingSale ? 'Saving...' : 'Save Only')}
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
                {exchangeModeActive
                  ? (isFinalizingSale ? 'Printing...' : 'Save & Print Return')
                  : (isFinalizingSale ? 'Printing...' : 'Save & Print')}
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
                                <span>x{item.quantity} {getSaleUnitLabel(item.product, item.saleUnit).toLowerCase()}</span>
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

        {/* Discount Approval Modal (cashier override) */}
        {showDiscountApprovalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-base font-bold text-slate-900 inline-flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-blue-600" />
                  Discount Approval
                </h3>
                <button
                  type="button"
                  onClick={closeDiscountApprovalModal}
                  className="text-stone-500 hover:text-stone-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-xs text-stone-600 mb-3">
                Manager/Pharmacist should select their profile and enter PIN to authorize this sale discount.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">Authorizer</label>
                  <select
                    value={discountApprovalApproverId}
                    onChange={(event) => setDiscountApprovalApproverId(event.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm bg-white"
                    autoFocus
                  >
                    {discountApprovers.length === 0 ? (
                      <option value="">No authorized profiles</option>
                    ) : (
                      discountApprovers.map((profile) => (
                        <option key={profile.id} value={profile.id}>
                          {profile.display_name} ({profile.staff_code}) · {String(profile.role || '').replace(/_/g, ' ')}
                        </option>
                      ))
                    )}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-stone-600 mb-1">PIN</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    value={discountApprovalPin}
                    onChange={(event) => setDiscountApprovalPin(event.target.value)}
                    className="w-full px-3 py-2 border border-stone-300 rounded-lg text-sm"
                    placeholder="••••••"
                  />
                </div>
                {discountApprovalError && (
                  <p className="text-xs text-red-600">{discountApprovalError}</p>
                )}
              </div>

              <div className="mt-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeDiscountApprovalModal}
                  className="px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white hover:bg-stone-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={authorizeDiscountForCurrentSale}
                  disabled={isDiscountApprovalLoading || discountApprovers.length === 0}
                  className="px-3 py-2 text-sm rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
                >
                  {isDiscountApprovalLoading ? 'Authorizing...' : 'Authorize Discount'}
                </button>
              </div>
            </div>
          </div>
        )}

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
