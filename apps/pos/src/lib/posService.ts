/**
 * POS Service - Nigerian Supermarket Focus
 * Handles all POS operations including offline capabilities
 */

import { apiClient } from './apiClient';
import { offlineDatabase } from './offlineDatabase';
import logger from './logger';

// ===============================================
// TYPES AND INTERFACES
// ===============================================

export interface POSProduct {
  id: string;
  outlet_id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unit_price: number;
  cost_price?: number;
  tax_rate: number;
  quantity_on_hand: number;
  reorder_level: number;
  reorder_quantity: number;
  is_active: boolean;
  vendor_id?: string;
  image_url?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
  // Enhanced fields
  expiry_date?: string;
  batch_number?: string;
  markup_percentage?: number;
  auto_pricing?: boolean;
  category_tax_rate?: number;
  reorder_notification_sent?: boolean;
  last_received?: string;
  min_shelf_life_days?: number;
}

export interface POSTransactionItem {
  product_id: string;
  quantity: number;
  unit_price?: number;
  discount_amount?: number;
}

export interface SplitPaymentLine {
  method: PaymentMethod;
  amount: number;
  reference?: string;
}

export interface POSTransaction {
  id: string;
  offline_id?: string;
  outlet_id: string;
  transaction_number: string;
  cashier_id: string;
  customer_id?: string;
  customer_name?: string;
  subtotal: number;
  tax_amount: number;
  discount_amount: number;
  total_amount: number;
  payment_method: PaymentMethod;
  tendered_amount?: number;
  change_amount: number;
  payment_reference?: string;
  status: TransactionStatus;
  transaction_date: string;
  items: POSTransactionItemResponse[];
  split_payments?: SplitPaymentLine[];
  notes?: string;
  receipt_printed: boolean;
  created_at: string;
}

export interface POSTransactionItemResponse {
  id: string;
  product_id: string;
  sku: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  discount_amount: number;
  tax_amount: number;
  line_total: number;
}

export interface CreateTransactionRequest {
  outlet_id: string;
  cashier_id: string;
  customer_id?: string;
  customer_name?: string;
  items: POSTransactionItem[];
  payment_method: PaymentMethod;
  tendered_amount?: number;
  payment_reference?: string;
  discount_amount?: number;
  discount_authorizer_session_token?: string;
  split_payments?: SplitPaymentLine[];
  notes?: string;
  offline_id?: string;
}

export interface PendingOfflineTransaction extends CreateTransactionRequest {
  offline_id: string;
  created_at: string;
  status?: 'offline' | 'synced';
}

export interface ProductCreateRequest {
  outlet_id: string;
  sku: string;
  barcode?: string;
  name: string;
  description?: string;
  category?: string;
  unit_price: number;
  cost_price?: number;
  tax_rate?: number;
  quantity_on_hand?: number;
  reorder_level?: number;
  reorder_quantity?: number;
  vendor_id?: string;
  image_url?: string;
  min_shelf_life_days?: number;
  batch_number?: string;
  expiry_date?: string;
  markup_percentage?: number;
  auto_pricing?: boolean;
}

export interface BulkImportProductsRequest {
  outlet_id: string;
  products: Array<ProductCreateRequest & {
    is_active?: boolean;
    display_order?: number;
  }>;
  dedupe_by?: 'sku_or_barcode' | 'sku' | 'barcode' | 'none';
  update_existing?: boolean;
  dry_run?: boolean;
}

export interface BulkImportProductsResult {
  total_received: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  errors: Array<{
    row: number;
    sku?: string;
    barcode?: string;
    name?: string;
    message: string;
  }>;
}

export interface ProductListResult {
  items: POSProduct[];
  total: number;
  page: number;
  size: number;
  offline?: boolean;
}

export interface POSDepartment {
  id: string;
  outlet_id: string;
  name: string;
  code?: string;
  description?: string;
  sort_order?: number;
  default_markup_percentage?: number;
  auto_pricing_enabled?: boolean;
  is_active: boolean;
  source?: 'master' | 'product_category';
  created_at?: string;
  updated_at?: string;
}

export interface DepartmentCreateRequest {
  outlet_id: string;
  name: string;
  code?: string;
  description?: string;
  sort_order?: number;
  default_markup_percentage?: number;
  auto_pricing_enabled?: boolean;
}

export interface DepartmentUpdateRequest {
  name?: string;
  code?: string;
  description?: string;
  sort_order?: number;
  default_markup_percentage?: number;
  auto_pricing_enabled?: boolean;
  is_active?: boolean;
}

export interface InventoryStats {
  total_products: number;
  active_products: number;
  low_stock_count: number;
  out_of_stock_count: number;
  total_inventory_value: number;
}

export interface SalesStats {
  total_sales: number;
  transaction_count: number;
  avg_transaction_value: number;
  cash_sales: number;
  transfer_sales: number;
  pos_sales: number;
  top_products: any[];
}

export interface ProductCatalogSyncProgress {
  mode: 'full' | 'delta';
  page: number;
  updated: number;
  batch_size: number;
  stage: 'syncing' | 'completed';
}

export enum PaymentMethod {
  CASH = 'cash',
  TRANSFER = 'transfer',
  POS = 'pos',
  CREDIT = 'credit',
  MOBILE = 'mobile'
}

export enum TransactionStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  VOIDED = 'voided',
  REFUNDED = 'refunded'
}

export enum POSRole {
  INVENTORY = 'inventory',
  CASHIER = 'cashier',
  MANAGER = 'manager',
  OWNER = 'owner',
  ADMIN = 'admin'
}

export enum TransferStatus {
  PENDING = 'pending',
  APPROVED = 'approved',
  IN_TRANSIT = 'in_transit',
  RECEIVED = 'received',
  CANCELLED = 'cancelled'
}

const createOfflineTransactionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${Date.now()}-${randomPart}`;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const toHex = (value: number): string => value.toString(16).padStart(8, '0');

const hashWithSeed = (value: string, seed: number): number => {
  let hash = seed >>> 0;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
    hash >>>= 0;
  }
  return hash >>> 0;
};

const normalizeOfflineIdForApi = (rawValue: string): string => {
  const value = rawValue.trim();
  if (!value) return createOfflineTransactionId();
  if (UUID_PATTERN.test(value)) return value.toLowerCase();

  // Deterministic UUID so retries for the same legacy offline_id keep the same idempotency key.
  const h1 = hashWithSeed(value, 2166136261);
  const h2 = hashWithSeed(`${value}|1`, 2166136261);
  const h3 = hashWithSeed(`${value}|2`, 2166136261);
  const h4 = hashWithSeed(`${value}|3`, 2166136261);

  const part1 = toHex(h1);
  const part2 = toHex(h2).slice(0, 4);
  const part3 = `4${toHex(h2).slice(5, 8)}`;
  const part4 = `${((h3 >>> 28) & 0x3 | 0x8).toString(16)}${toHex(h3).slice(1, 4)}`;
  const part5 = `${toHex(h3)}${toHex(h4)}`.slice(0, 12);

  return `${part1}-${part2}-${part3}-${part4}-${part5}`;
};

// ===============================================
// CUSTOMER LOYALTY INTERFACES
// ===============================================

export interface Customer {
  id: string;
  outlet_id: string;
  name: string;
  phone: string;
  email?: string;
  loyalty_points: number;
  total_spent: number;
  visit_count: number;
  last_visit?: string;
  date_of_birth?: string;
  address?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface CustomerCreateRequest {
  outlet_id: string;
  name: string;
  phone: string;
  email?: string;
  date_of_birth?: string;
  address?: string;
}

export interface PharmacyPatient {
  id: string;
  outlet_id: string;
  patient_code: string;
  full_name: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
  notes?: string;
  is_active: boolean;
  created_by?: string;
  last_visit_at?: string;
  created_at: string;
  updated_at: string;
}

export interface PharmacyPatientCreateRequest {
  outlet_id: string;
  full_name: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
  notes?: string;
}

export interface PharmacyPatientUpdateRequest {
  full_name?: string;
  phone?: string;
  gender?: 'male' | 'female' | 'other' | 'unspecified';
  date_of_birth?: string;
  address?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  allergies?: string;
  chronic_conditions?: string;
  current_medications?: string;
  notes?: string;
  is_active?: boolean;
}

export interface PatientVital {
  id: string;
  patient_id: string;
  outlet_id: string;
  recorded_at: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  pulse_bpm?: number;
  temperature_c?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  blood_glucose_mmol?: number;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
  recorded_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PatientVitalCreateRequest {
  recorded_at?: string;
  systolic_bp?: number;
  diastolic_bp?: number;
  pulse_bpm?: number;
  temperature_c?: number;
  respiratory_rate?: number;
  oxygen_saturation?: number;
  blood_glucose_mmol?: number;
  weight_kg?: number;
  height_cm?: number;
  notes?: string;
}

export interface LoyaltyTransaction {
  id: string;
  customer_id: string;
  transaction_id?: string;
  outlet_id: string;
  transaction_amount: number;
  points_earned: number;
  points_redeemed: number;
  transaction_type: 'earn' | 'redeem' | 'adjustment';
  notes?: string;
  created_at: string;
}

export interface LoyaltySettings {
  id: string;
  outlet_id: string;
  points_per_naira: number;
  redemption_rate: number;
  minimum_redemption_points: number;
  point_expiry_months: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ===============================================
// INVENTORY TRANSFER INTERFACES
// ===============================================

export interface InventoryTransfer {
  id: string;
  transfer_number: string;
  from_outlet_id: string;
  to_outlet_id: string;
  from_outlet_name: string;
  to_outlet_name: string;
  status: TransferStatus;
  transfer_reason?: string;
  total_items: number;
  total_value: number;
  requested_by: string;
  approved_by?: string;
  received_by?: string;
  notes?: string;
  requested_at: string;
  approved_at?: string;
  received_at?: string;
  items: TransferItem[];
}

export interface TransferItem {
  id: string;
  product_id: string;
  product_name: string;
  sku: string;
  quantity_requested: number;
  quantity_sent: number;
  quantity_received: number;
  unit_cost?: number;
  batch_number?: string;
  expiry_date?: string;
  notes?: string;
}

export interface CreateTransferRequest {
  from_outlet_id: string;
  to_outlet_id: string;
  transfer_reason?: string;
  items: {
    product_id: string;
    quantity_requested: number;
    batch_number?: string;
    expiry_date?: string;
    notes?: string;
  }[];
  notes?: string;
}

export interface StockMovement {
  id: string;
  product_id: string;
  outlet_id: string;
  movement_type: 'sale' | 'return' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'receive';
  quantity_change: number;
  quantity_before: number;
  quantity_after: number;
  reference_id?: string;
  reference_type?: string;
  unit_cost?: number;
  total_value?: number;
  notes?: string;
  performed_by: string;
  movement_date: string;
}

export interface StocktakeItem {
  product_id: string;
  current_quantity: number;
  counted_quantity: number;
  reason?: string;
  notes?: string;
  unit_cost?: number;
}

interface StocktakeCommitApiResponse {
  session_id: string;
  outlet_id: string;
  terminal_id?: string;
  performed_by: string;
  performed_by_name?: string;
  started_at: string;
  completed_at: string;
  status: string;
  total_items: number;
  adjusted_items: number;
  unchanged_items: number;
  positive_variance_items: number;
  negative_variance_items: number;
  net_quantity_variance: number;
  total_variance_value?: number;
  movement_ids: string[];
}

// ===============================================
// ENHANCED TRANSACTION INTERFACES
// ===============================================

export interface EnhancedCreateTransactionRequest extends CreateTransactionRequest {
  customer_id?: string;
  loyalty_points_redeemed?: number;
  loyalty_discount?: number;
  split_payments?: {
    method: PaymentMethod;
    amount: number;
    reference?: string;
  }[];
}

// ===============================================
// POS SERVICE CLASS
// ===============================================

class POSService {
  private baseUrl = '/pos';
  private isInitialized = false;
  private readonly initPromise: Promise<void>;
  private readonly productSyncPageSize = 100;
  private readonly productSyncRetryDelaysMs = [500, 1500, 3000];
  private readonly productSyncCooldownMs = 60_000;
  private readonly productSyncPauseUntilByOutlet = new Map<string, number>();
  private offlineSyncPromise: Promise<number> | null = null;
  private readonly inFlightTransactionCreates = new Map<string, Promise<POSTransaction>>();

  constructor() {
    this.initPromise = this.initializeOfflineDB();
  }

  private async initializeOfflineDB(): Promise<void> {
    try {
      await offlineDatabase.init();
      this.isInitialized = true;
      logger.log('Offline database initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize offline database:', error);
    }
  }

  private async ensureOfflineInitialized(): Promise<boolean> {
    if (this.isInitialized) return true;

    try {
      await this.initPromise;
    } catch (error) {
      logger.error('Offline database initialization wait failed:', error);
    }

    return this.isInitialized;
  }

  private getProductCursorSettingKey(outletId: string): string {
    return `pos_products_cursor_${outletId}`;
  }

  private getTerminalIdForOutlet(outletId: string): string | undefined {
    try {
      const value = localStorage.getItem(`pos_terminal_id_${outletId}`) || '';
      const trimmed = value.trim();
      return trimmed || undefined;
    } catch {
      return undefined;
    }
  }

  private toTimestamp(value?: string | null): number {
    if (!value) return 0;
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  private getLatestUpdatedAt(items: POSProduct[]): string | null {
    let latest: string | null = null;
    let latestTs = 0;

    for (const item of items) {
      const ts = this.toTimestamp(item.updated_at);
      if (ts > latestTs && item.updated_at) {
        latestTs = ts;
        latest = item.updated_at;
      }
    }

    return latest;
  }

  private normalizeLookupValue(value?: string | null): string {
    return String(value || '').trim();
  }

  private normalizeLookupValueLoose(value?: string | null): string {
    return this.normalizeLookupValue(value).toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  private isProductLookupMatch(product: POSProduct, needle: string): boolean {
    const strictNeedle = this.normalizeLookupValue(needle);
    if (!strictNeedle) return false;

    const strictBarcode = this.normalizeLookupValue(product.barcode);
    const strictSku = this.normalizeLookupValue(product.sku);
    if (strictBarcode === strictNeedle || strictSku === strictNeedle) {
      return true;
    }

    const looseNeedle = this.normalizeLookupValueLoose(strictNeedle);
    if (!looseNeedle) return false;

    return (
      this.normalizeLookupValueLoose(product.barcode) === looseNeedle ||
      this.normalizeLookupValueLoose(product.sku) === looseNeedle
    );
  }

  private pickBarcodeMatch(products: POSProduct[], outletId: string, barcode: string): POSProduct | null {
    return (
      products.find(
        (product) =>
          product.outlet_id === outletId &&
          product.is_active !== false &&
          this.isProductLookupMatch(product, barcode)
      ) || null
    );
  }

  private isNotFoundLookupMessage(message?: string | null): boolean {
    const normalized = String(message || '').toLowerCase();
    return normalized.includes('not found') || normalized.includes('404');
  }

  private isTransientNetworkError(error: unknown): boolean {
    const message = String((error as any)?.message || error || '').toLowerCase();
    return (
      message.includes('network error') ||
      message.includes('failed to fetch') ||
      message.includes('connection closed') ||
      message.includes('err_connection_closed') ||
      message.includes('err_connection_reset') ||
      message.includes('load failed')
    );
  }

  private async waitFor(ms: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, ms));
  }

  private async fetchProductsPageFromApi(
    outletId: string,
    options: {
      page: number;
      size: number;
      search?: string;
      category?: string;
      activeOnly?: boolean;
      updatedAfter?: string;
      includeTotal?: boolean;
    }
  ): Promise<ProductListResult> {
    const safeSize = Math.min(Math.max(options.size, 1), this.productSyncPageSize);
    const params = new URLSearchParams({
      outlet_id: outletId,
      page: options.page.toString(),
      size: safeSize.toString(),
      active_only: (options.activeOnly !== false).toString(),
      include_total: (options.includeTotal !== false).toString(),
      ...options.search && { search: options.search },
      ...options.category && { category: options.category },
      ...options.updatedAfter && { updated_after: options.updatedAfter }
    });

    const response = await apiClient.get<ProductListResult>(`${this.baseUrl}/products?${params}`);
    if (!response.data) {
      throw new Error(response.error || 'Failed to fetch products');
    }
    return response.data;
  }

  private async fetchProductsPageWithRetry(
    outletId: string,
    options: {
      page: number;
      size: number;
      search?: string;
      category?: string;
      activeOnly?: boolean;
      updatedAfter?: string;
      includeTotal?: boolean;
    }
  ): Promise<ProductListResult> {
    let attempt = 0;
    while (true) {
      try {
        return await this.fetchProductsPageFromApi(outletId, options);
      } catch (error) {
        if (!this.isTransientNetworkError(error) || attempt >= this.productSyncRetryDelaysMs.length) {
          throw error;
        }
        const delayMs = this.productSyncRetryDelaysMs[attempt];
        logger.warn(
          `Product page fetch failed (attempt ${attempt + 1}/${this.productSyncRetryDelaysMs.length + 1}), retrying in ${delayMs}ms`
        );
        await this.waitFor(delayMs);
        attempt += 1;
      }
    }
  }

  // ===============================================
  // PRODUCT MANAGEMENT
  // ===============================================

  async getDepartments(
    outletId: string,
    options: { includeInactive?: boolean } = {}
  ): Promise<POSDepartment[]> {
    try {
      const params = new URLSearchParams({
        outlet_id: outletId,
        include_inactive: (options.includeInactive === true).toString(),
      });
      const response = await apiClient.get<{ items: POSDepartment[]; total: number }>(
        `${this.baseUrl}/departments?${params.toString()}`
      );
      if (!response.data) {
        throw new Error(response.error || 'Failed to fetch departments');
      }
      return response.data.items || [];
    } catch (error) {
      logger.error('Error fetching departments:', error);
      throw this.handleError(error);
    }
  }

  async createDepartment(payload: DepartmentCreateRequest): Promise<POSDepartment> {
    try {
      const response = await apiClient.post<POSDepartment>(`${this.baseUrl}/departments`, payload);
      if (!response.data) {
        throw new Error(response.error || 'Failed to create department');
      }
      return response.data;
    } catch (error) {
      logger.error('Error creating department:', error);
      throw this.handleError(error);
    }
  }

  async updateDepartment(departmentId: string, payload: DepartmentUpdateRequest): Promise<POSDepartment> {
    try {
      const response = await apiClient.put<POSDepartment>(`${this.baseUrl}/departments/${departmentId}`, payload);
      if (!response.data) {
        throw new Error(response.error || 'Failed to update department');
      }
      return response.data;
    } catch (error) {
      logger.error('Error updating department:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all products for a specific outlet
   */
  async getProducts(
    outletId: string,
    options: {
      page?: number;
      size?: number;
      search?: string;
      category?: string;
      activeOnly?: boolean;
    } = {}
  ): Promise<ProductListResult> {
    const offlineReady = await this.ensureOfflineInitialized();

    try {
      const requestedSize = options.size || 20;
      const safeSize = Math.min(Math.max(requestedSize, 1), this.productSyncPageSize);
      const response = await this.fetchProductsPageFromApi(outletId, {
        page: options.page || 1,
        size: safeSize,
        search: options.search,
        category: options.category,
        activeOnly: options.activeOnly,
        includeTotal: true,
      });

      // Cache products offline for future use
      if (offlineReady && response.items) {
        await offlineDatabase.storeProducts(response.items);
      }

      return response;
    } catch (error) {
      // Silently handle API errors when backend is not available
      if ((error as any)?.message?.includes('Network error') ||
        (error as any)?.message?.includes('401') ||
        (error as any)?.message?.includes('Unauthorized')) {
        logger.debug('Backend not available, using offline data');
      } else {
        logger.error('Error fetching products online, trying offline cache:', error);
      }

      // Fallback to offline cache
      if (offlineReady) {
        try {
          let filteredProducts: POSProduct[] = [];

          if (options.search) {
            if (options.activeOnly === false) {
              const query = options.search.toLowerCase();
              const allProducts = await offlineDatabase.getAllProducts(outletId);
              filteredProducts = allProducts.filter((product) =>
                product.name.toLowerCase().includes(query) ||
                product.sku.toLowerCase().includes(query) ||
                (product.barcode || '').toLowerCase().includes(query)
              );
            } else {
              // Use optimized indexed search
              filteredProducts = await offlineDatabase.searchProducts(outletId, options.search);
            }
          } else {
            // Get all products (optimized in Dexie to return all for outlet)
            filteredProducts = options.activeOnly === false
              ? await offlineDatabase.getAllProducts(outletId)
              : await offlineDatabase.getProducts(outletId);
          }

          // Apply remaining filters (Category, Active)
          if (options.category) {
            filteredProducts = filteredProducts.filter(p => p.category === options.category);
          }

          if (options.activeOnly !== false) {
            filteredProducts = filteredProducts.filter(p => p.is_active);
          }

          // Simple pagination for offline results
          const page = options.page || 1;
          const size = safeSize;
          const start = (page - 1) * size;
          const paginatedProducts = filteredProducts.slice(start, start + size);

          return {
            items: paginatedProducts,
            total: filteredProducts.length,
            page,
            size,
            offline: true
          };
        } catch (offlineError) {
          logger.error('Error fetching products from offline cache:', offlineError);
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * Read products from local cache only (no network).
   */
  async getCachedProducts(
    outletId: string,
    options: {
      page?: number;
      size?: number;
      search?: string;
      category?: string;
      activeOnly?: boolean;
    } = {}
  ): Promise<ProductListResult> {
    const offlineReady = await this.ensureOfflineInitialized();
    if (!offlineReady) {
      return { items: [], total: 0, page: options.page || 1, size: options.size || 20, offline: true };
    }

    let filteredProducts: POSProduct[] = [];

    if (options.search && options.search.trim()) {
      if (options.activeOnly === false) {
        const query = options.search.trim().toLowerCase();
        const allProducts = await offlineDatabase.getAllProducts(outletId);
        filteredProducts = allProducts.filter((product) =>
          product.name.toLowerCase().includes(query) ||
          product.sku.toLowerCase().includes(query) ||
          (product.barcode || '').toLowerCase().includes(query)
        );
      } else {
        filteredProducts = await offlineDatabase.searchProducts(outletId, options.search.trim());
      }
    } else {
      filteredProducts = options.activeOnly === false
        ? await offlineDatabase.getAllProducts(outletId)
        : await offlineDatabase.getProducts(outletId);
    }

    if (options.category) {
      filteredProducts = filteredProducts.filter(p => p.category === options.category);
    }

    if (options.activeOnly !== false) {
      filteredProducts = filteredProducts.filter(p => p.is_active);
    }

    const page = options.page || 1;
    const size = options.size || 20;
    const start = (page - 1) * size;
    const items = filteredProducts.slice(start, start + size);

    return {
      items,
      total: filteredProducts.length,
      page,
      size,
      offline: true
    };
  }

  /**
   * Synchronize full product catalog into local cache.
   * - First sync for an outlet performs a full replace.
   * - Subsequent syncs pull only rows changed since last cursor.
   */
  async syncProductCatalog(
    outletId: string,
    options: {
      forceFull?: boolean;
      maxPages?: number;
      onProgress?: (progress: ProductCatalogSyncProgress) => void;
    } = {}
  ): Promise<{ mode: 'full' | 'delta'; updated: number }> {
    const offlineReady = await this.ensureOfflineInitialized();
    if (!offlineReady) {
      return { mode: options.forceFull ? 'full' : 'delta', updated: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { mode: options.forceFull ? 'full' : 'delta', updated: 0 };
    }

    const maxPages = options.maxPages || 300;
    const cursorKey = this.getProductCursorSettingKey(outletId);
    const existingCursor = await offlineDatabase.getSetting(cursorKey);
    const mode: 'full' | 'delta' = options.forceFull || !existingCursor ? 'full' : 'delta';
    const now = Date.now();
    const pausedUntil = this.productSyncPauseUntilByOutlet.get(outletId) || 0;
    if (pausedUntil > now) {
      return { mode, updated: 0 };
    }

    let page = 1;
    let updated = 0;
    let latestCursor = typeof existingCursor === 'string' ? existingCursor : '';
    const publishProgress = (page: number, batchSize: number, stage: 'syncing' | 'completed') => {
      options.onProgress?.({
        mode,
        page,
        updated,
        batch_size: batchSize,
        stage,
      });
    };

    try {
      if (mode === 'full') {
        const allItems: POSProduct[] = [];

        while (page <= maxPages) {
          const response = await this.fetchProductsPageWithRetry(outletId, {
            page,
            size: this.productSyncPageSize,
            activeOnly: false,
            includeTotal: false,
          });

          const items = response.items || [];
          if (items.length === 0) break;

          allItems.push(...items);
          updated = allItems.length;
          publishProgress(page, items.length, 'syncing');
          const latestInBatch = this.getLatestUpdatedAt(items);
          if (latestInBatch && this.toTimestamp(latestInBatch) > this.toTimestamp(latestCursor)) {
            latestCursor = latestInBatch;
          }

          if (items.length < this.productSyncPageSize) break;
          page += 1;
        }

        await offlineDatabase.replaceOutletProducts(outletId, allItems);
        updated = allItems.length;
      } else {
        while (page <= maxPages) {
          const response = await this.fetchProductsPageWithRetry(outletId, {
            page,
            size: this.productSyncPageSize,
            activeOnly: false,
            updatedAfter: existingCursor,
            includeTotal: false,
          });

          const items = response.items || [];
          if (items.length === 0) break;

          await offlineDatabase.storeProducts(items);
          updated += items.length;
          publishProgress(page, items.length, 'syncing');

          const latestInBatch = this.getLatestUpdatedAt(items);
          if (latestInBatch && this.toTimestamp(latestInBatch) > this.toTimestamp(latestCursor)) {
            latestCursor = latestInBatch;
          }

          if (items.length < this.productSyncPageSize) break;
          page += 1;
        }
      }

      if (latestCursor) {
        await offlineDatabase.storeSetting(cursorKey, latestCursor);
      }

      this.productSyncPauseUntilByOutlet.delete(outletId);
      publishProgress(page, 0, 'completed');
      return { mode, updated };
    } catch (error) {
      if (this.isTransientNetworkError(error)) {
        const pauseUntil = Date.now() + this.productSyncCooldownMs;
        this.productSyncPauseUntilByOutlet.set(outletId, pauseUntil);
        logger.warn(
          `Product catalog sync paused for ${Math.round(this.productSyncCooldownMs / 1000)}s due to transient network failure`
        );
        publishProgress(page, 0, 'completed');
        return { mode, updated };
      }
      throw error;
    }
  }

  /**
   * Fetch all products for an outlet using paginated API calls.
   */
  async getAllProducts(
    outletId: string,
    options: {
      activeOnly?: boolean;
      search?: string;
      category?: string;
    } = {}
  ): Promise<POSProduct[]> {
    const pageSize = 100;
    let page = 1;
    let items: POSProduct[] = [];

    while (page <= 200) {
      const response = await this.getProducts(outletId, {
        page,
        size: pageSize,
        activeOnly: options.activeOnly,
        search: options.search,
        category: options.category
      });

      const pageItems = response?.items || [];
      items = items.concat(pageItems);

      const total = response?.total || 0;
      if (pageItems.length < pageSize || (total > 0 && items.length >= total)) {
        break;
      }
      page += 1;
    }

    return items;
  }

  /**
   * Search products locally (Optimized for instant search)
   */
  async searchLocalProducts(outletId: string, query: string): Promise<POSProduct[]> {
    const offlineReady = await this.ensureOfflineInitialized();
    if (!offlineReady || !query) return [];
    return await offlineDatabase.searchProducts(outletId, query);
  }


  /**
   * Get product by barcode scan
   */
  async getProductByBarcode(barcode: string, outletId: string): Promise<POSProduct> {
    const normalizedBarcode = this.normalizeLookupValue(barcode);
    if (!normalizedBarcode) {
      throw new Error('Invalid barcode');
    }

    const offlineReady = await this.ensureOfflineInitialized();
    if (offlineReady) {
      try {
        const localMatches = await offlineDatabase.searchProducts(outletId, normalizedBarcode);
        const localMatch = this.pickBarcodeMatch(localMatches, outletId, normalizedBarcode);
        if (localMatch) {
          return localMatch;
        }
      } catch (localError) {
        logger.warn('Local barcode lookup failed:', localError);
      }
    }

    let notFound = false;
    let lookupError: Error | null = null;

    try {
      const response = await apiClient.get<POSProduct>(
        `${this.baseUrl}/products/search/barcode/${encodeURIComponent(normalizedBarcode)}?outlet_id=${outletId}`
      );

      if (response.data) {
        return response.data;
      }

      if (this.isNotFoundLookupMessage(response.error)) {
        notFound = true;
      } else if (response.error) {
        lookupError = new Error(response.error);
      }
    } catch (error) {
      lookupError = this.handleError(error);
    }

    try {
      const searchResult = await this.getProducts(outletId, {
        page: 1,
        size: 100,
        search: normalizedBarcode,
        activeOnly: true,
      });
      const matched = this.pickBarcodeMatch(searchResult.items || [], outletId, normalizedBarcode);
      if (matched) {
        return matched;
      }
      if ((searchResult.items || []).length === 1) {
        return searchResult.items[0];
      }
      notFound = true;
    } catch (error) {
      if (!lookupError) {
        lookupError = this.handleError(error);
      }
    }

    if (notFound) {
      throw new Error('Product not found for this barcode');
    }

    if (lookupError) {
      throw lookupError;
    }

    throw new Error('Product not found for this barcode');
  }

  /**
   * Create a new product
   */
  async createProduct(product: ProductCreateRequest): Promise<POSProduct> {
    try {
      const response = await apiClient.post<POSProduct>(`${this.baseUrl}/products`, product);
      if (!response.data) throw new Error(response.error || 'Failed to create product');
      return response.data;
    } catch (error) {
      logger.error('Error creating product:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Bulk import products with dedupe/upsert behavior.
   */
  async bulkImportProducts(request: BulkImportProductsRequest): Promise<BulkImportProductsResult> {
    try {
      const response = await apiClient.post<BulkImportProductsResult>(`${this.baseUrl}/products/import`, {
        outlet_id: request.outlet_id,
        products: request.products,
        dedupe_by: request.dedupe_by || 'sku_or_barcode',
        update_existing: request.update_existing !== false,
        dry_run: request.dry_run === true,
      });
      if (!response.data) throw new Error(response.error || 'Failed to import products');
      return response.data;
    } catch (error) {
      logger.error('Error bulk importing products:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, updates: Partial<ProductCreateRequest>): Promise<POSProduct> {
    try {
      const response = await apiClient.put<POSProduct>(`${this.baseUrl}/products/${productId}`, updates);
      if (!response.data) throw new Error(response.error || 'Failed to update product');

      if (this.isInitialized) {
        try {
          await offlineDatabase.storeProducts([response.data]);
        } catch (cacheError) {
          logger.warn('Failed to cache updated product locally:', cacheError);
        }
      }

      return response.data;
    } catch (error) {
      logger.error('Error updating product:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete (deactivate) a product
   */
  async deleteProduct(productId: string): Promise<void> {
    try {
      await apiClient.delete(`${this.baseUrl}/products/${productId}`);
    } catch (error) {
      logger.error('Error deleting product:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // TRANSACTION PROCESSING
  // ===============================================

  /**
   * Process a new POS transaction
   */
  async createTransaction(transaction: CreateTransactionRequest): Promise<POSTransaction> {
    const normalizedOfflineId = transaction.offline_id
      ? normalizeOfflineIdForApi(transaction.offline_id)
      : undefined;
    const requestPayload: CreateTransactionRequest = normalizedOfflineId
      ? { ...transaction, offline_id: normalizedOfflineId }
      : transaction;

    const offlineKey = normalizedOfflineId
      ? `${transaction.outlet_id}:${normalizedOfflineId}`
      : null;

    if (offlineKey) {
      const existingRequest = this.inFlightTransactionCreates.get(offlineKey);
      if (existingRequest) {
        return existingRequest;
      }
    }

    const requestPromise = (async () => {
      try {
        const response = await apiClient.post<POSTransaction>(`${this.baseUrl}/transactions`, requestPayload);
        if (!response.data) throw new Error(response.error || 'Failed to create transaction');

        // Immediately cache the new transaction for other terminals
        if (this.isInitialized && response.data) {
          try {
            await offlineDatabase.storeTransactions([response.data]);
            logger.log('📝 New transaction cached for multi-terminal access');
          } catch (cacheError) {
            logger.warn('Failed to cache new transaction:', cacheError);
          }
        }

        return response.data;
      } catch (error) {
        logger.error('Error creating transaction:', error);
        throw this.handleError(error);
      }
    })();

    if (offlineKey) {
      this.inFlightTransactionCreates.set(offlineKey, requestPromise);
    }

    try {
      return await requestPromise;
    } finally {
      if (offlineKey) {
        this.inFlightTransactionCreates.delete(offlineKey);
      }
    }
  }

  /**
   * Void a transaction
   */
  async voidTransaction(transactionId: string, reason: string): Promise<void> {
    try {
      const response = await apiClient.put<any>(`${this.baseUrl}/transactions/${transactionId}/void`, { void_reason: reason });
      if (response.error) throw new Error(response.error);
    } catch (error) {
      logger.error('Error voiding transaction:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Process a refund/return for a transaction.
   */
  async refundTransaction(
    transactionId: string,
    data: {
      return_reason?: string;
      amount?: number;
      items?: Array<{ product_id: string; quantity: number }>;
    } = {}
  ): Promise<{
    message: string;
    original_transaction_id: string;
    return_transaction_id: string;
    return_transaction_number: string;
    return_amount: number;
  }> {
    try {
      const response = await apiClient.put<any>(`${this.baseUrl}/transactions/${transactionId}/return`, data);
      if (!response.data) throw new Error(response.error || 'Failed to process refund');
      return response.data;
    } catch (error) {
      logger.error('Error processing refund:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get transactions with optional filtering
   */
  async getTransactions(
    outletId: string,
    options: {
      page?: number;
      size?: number;
      date_from?: string;
      date_to?: string;
      cashier_id?: string;
      payment_method?: PaymentMethod;
      split_only?: boolean;
      status?: string;
      search?: string;
    } = {}
  ): Promise<{ items: POSTransaction[]; total: number; page: number; size: number }> {
    try {
      const params = new URLSearchParams({
        outlet_id: outletId,
        page: (options.page || 1).toString(),
        size: (options.size || 50).toString(),
        ...options.date_from && { date_from: options.date_from },
        ...options.date_to && { date_to: options.date_to },
        ...options.cashier_id && { cashier_id: options.cashier_id },
        ...options.payment_method && { payment_method: options.payment_method },
        ...(options.split_only ? { split_only: 'true' } : {}),
        ...options.status && { status: options.status },
        ...options.search && { search: options.search.trim() }
      });

      const response = await apiClient.get<any>(`${this.baseUrl}/transactions?${params}`);
      if (response.error || !response.data) {
        throw new Error(response.error || 'Failed to fetch transactions');
      }

      // Always cache all fetched transactions for multiple terminal access
      if (this.isInitialized && response.data?.items && response.data.items.length > 0) {
        await offlineDatabase.storeTransactions(response.data.items);
      }

      return {
        items: response.data.items || [],
        total: response.data.total || 0,
        page: response.data.page || options.page || 1,
        size: response.data.size || options.size || 50,
      };
    } catch (error) {
      logger.error('Error fetching transactions:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(transactionId: string): Promise<POSTransaction> {
    try {
      const response = await apiClient.get<POSTransaction>(`${this.baseUrl}/transactions/${transactionId}`);
      if (!response.data) throw new Error(response.error || 'Transaction not found');
      return response.data;
    } catch (error) {
      logger.error('Error fetching transaction:', error);
      throw this.handleError(error);
    }
  }


  /**
   * Get local transactions for instant load
   */
  async getLocalTransactions(outletId: string, limit: number = 50): Promise<POSTransaction[]> {
    if (!this.isInitialized) return [];
    return await offlineDatabase.getTransactions(outletId, limit);
  }

  /**
   * Search local transactions
   */
  async searchLocalTransactions(outletId: string, query: string): Promise<POSTransaction[]> {
    if (!this.isInitialized || !query) return [];
    return await offlineDatabase.searchTransactions(outletId, query);
  }


  // ===============================================
  // STATISTICS AND REPORTING
  // ===============================================

  /**
   * Get inventory statistics
   */
  async getInventoryStats(outletId: string): Promise<InventoryStats> {
    try {
      const response = await apiClient.get<InventoryStats>(`${this.baseUrl}/stats/inventory?outlet_id=${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch stats');
      return response.data;
    } catch (error) {
      logger.error('Error fetching inventory stats:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get sales statistics
   */
  async getSalesStats(
    outletId: string,
    dateFrom?: string,
    dateTo?: string
  ): Promise<SalesStats> {
    try {
      const params = new URLSearchParams({ outlet_id: outletId });
      if (dateFrom) params.append('date_from', dateFrom);
      if (dateTo) params.append('date_to', dateTo);

      const response = await apiClient.get<SalesStats>(`${this.baseUrl}/stats/sales?${params}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch stats');
      return response.data;
    } catch (error) {
      logger.error('Error fetching sales stats:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // OFFLINE SUPPORT UTILITIES
  // ===============================================

  /**
   * Store transaction for offline processing
   */
  async storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string> {
    try {
      if (this.isInitialized) {
        // Use IndexedDB/SQLite
        return await offlineDatabase.storeOfflineTransaction(transaction);
      } else {
        // Fallback to localStorage
        const providedOfflineId = typeof transaction.offline_id === 'string' ? transaction.offline_id.trim() : '';
        const offlineId = providedOfflineId || createOfflineTransactionId();
        const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        offlineTransactions.push({
          id: offlineId,
          ...transaction,
          offline_id: offlineId,
          created_at: new Date().toISOString(),
          status: 'offline'
        });
        localStorage.setItem('offline_transactions', JSON.stringify(offlineTransactions));
        return offlineId;
      }
    } catch (error) {
      logger.error('Error storing offline transaction:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Sync offline transactions when back online
   */
  async syncOfflineTransactions(): Promise<number> {
    if (this.offlineSyncPromise) {
      return this.offlineSyncPromise;
    }

    this.offlineSyncPromise = (async () => {
      try {
        let offlineTransactions: any[] = [];

        if (this.isInitialized) {
          // Use IndexedDB/SQLite
          offlineTransactions = await offlineDatabase.getOfflineTransactions();
        } else {
          // Fallback to localStorage
          offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        }

        let syncedCount = 0;
        const failedTransactions: string[] = [];

        for (const transaction of offlineTransactions) {
          try {
            await this.createTransaction(transaction);
            syncedCount++;

            // Remove successfully synced transaction
            if (this.isInitialized && transaction.offline_id) {
              await offlineDatabase.removeOfflineTransaction(transaction.offline_id);
              await offlineDatabase.removeTransaction(transaction.offline_id);
            }
          } catch (error) {
            logger.error('Failed to sync offline transaction:', error);
            if (transaction.offline_id) {
              failedTransactions.push(transaction.offline_id);
            }
          }
        }

        // For localStorage fallback, remove all on success (simple approach)
        if (!this.isInitialized && syncedCount > 0 && failedTransactions.length === 0) {
          localStorage.removeItem('offline_transactions');
        }

        return syncedCount;
      } catch (error) {
        logger.error('Error syncing offline transactions:', error);
        return 0;
      }
    })();

    try {
      return await this.offlineSyncPromise;
    } finally {
      this.offlineSyncPromise = null;
    }
  }

  /**
   * Remove an offline transaction from queue/local cache by offline id.
   */
  async removeOfflineTransaction(offlineId: string): Promise<void> {
    if (!offlineId) return;

    if (this.isInitialized) {
      await offlineDatabase.removeOfflineTransaction(offlineId);
      await offlineDatabase.removeTransaction(offlineId);
      return;
    }

    const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
    const filtered = offlineTransactions.filter((tx: any) => {
      const id = typeof tx?.id === 'string' ? tx.id : '';
      const queueOfflineId = typeof tx?.offline_id === 'string' ? tx.offline_id : '';
      return id !== offlineId && queueOfflineId !== offlineId;
    });
    localStorage.setItem('offline_transactions', JSON.stringify(filtered));
  }

  /**
   * Get offline transaction count
   */
  async getOfflineTransactionCount(): Promise<number> {
    try {
      if (this.isInitialized) {
        const transactions = await offlineDatabase.getOfflineTransactions();
        return transactions.length;
      } else {
        // Fallback to localStorage
        const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
        return offlineTransactions.length;
      }
    } catch {
      return 0;
    }
  }

  /**
   * Get pending offline transactions for optimistic/local-first UIs
   */
  async getPendingOfflineTransactions(): Promise<PendingOfflineTransaction[]> {
    try {
      if (this.isInitialized) {
        const transactions = await offlineDatabase.getOfflineTransactions();
        return transactions as PendingOfflineTransaction[];
      }

      const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      return offlineTransactions as PendingOfflineTransaction[];
    } catch {
      return [];
    }
  }

  /**
   * Get offline transaction count (synchronous version for compatibility)
   */
  getOfflineTransactionCountSync(): number {
    try {
      // For immediate UI updates, use localStorage even if IndexedDB is available
      const offlineTransactions = JSON.parse(localStorage.getItem('offline_transactions') || '[]');
      return offlineTransactions.length;
    } catch {
      return 0;
    }
  }

  // ===============================================
  // UTILITY METHODS
  // ===============================================

  /**
   * Calculate transaction totals
   */
  calculateTransactionTotals(
    items: POSTransactionItem[],
    products: POSProduct[],
    discountAmount: number = 0
  ) {
    let subtotal = 0;
    let totalTax = 0;

    const itemTotals = items.map(item => {
      const product = products.find(p => p.id === item.product_id);
      if (!product) throw new Error(`Product ${item.product_id} not found`);

      const unitPrice = item.unit_price || product.unit_price;
      const lineSubtotal = unitPrice * item.quantity;
      const lineDiscount = item.discount_amount || 0;
      const taxableAmount = lineSubtotal - lineDiscount;
      const lineTax = taxableAmount * product.tax_rate;
      const lineTotal = taxableAmount + lineTax;

      subtotal += lineSubtotal;
      totalTax += lineTax;

      return {
        ...item,
        product_name: product.name,
        unit_price: unitPrice,
        line_subtotal: lineSubtotal,
        line_discount: lineDiscount,
        line_tax: lineTax,
        line_total: lineTotal
      };
    });

    const totalAmount = subtotal - discountAmount + totalTax;

    return {
      items: itemTotals,
      subtotal,
      totalTax,
      discountAmount,
      totalAmount
    };
  }

  /**
   * Format currency for Nigerian Naira
   */
  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  }

  // ===============================================
  // CUSTOMER LOYALTY MANAGEMENT
  // ===============================================

  /**
   * Get customers for an outlet
   */
  async getCustomers(
    outletId: string,
    options: {
      search?: string;
      activeOnly?: boolean;
      page?: number;
      size?: number;
    } = {}
  ): Promise<{ items: Customer[]; total: number; page: number; size: number }> {
    try {
      const page = options.page || 1;
      const size = options.size || 50;
      const params = new URLSearchParams({
        outlet_id: outletId,
        skip: ((page - 1) * size).toString(),
        limit: size.toString(),
        active_only: (options.activeOnly !== false).toString(),
        ...options.search && { search: options.search }
      });

      const response = await apiClient.get<{ items: Customer[]; total: number; page: number; size: number }>(`${this.baseUrl}/customers?${params}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch customers');
      return response.data;
    } catch (error) {
      logger.error('Error fetching customers:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a new customer
   */
  async createCustomer(customer: CustomerCreateRequest): Promise<Customer> {
    try {
      const response = await apiClient.post<Customer>(`${this.baseUrl}/customers`, customer);
      if (!response.data) throw new Error(response.error || 'Failed to create customer');
      return response.data;
    } catch (error) {
      logger.error('Error creating customer:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<Customer> {
    try {
      const response = await apiClient.get<Customer>(`${this.baseUrl}/customers/${customerId}`);
      if (!response.data) throw new Error(response.error || 'Customer not found');
      return response.data;
    } catch (error) {
      logger.error('Error fetching customer:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get pharmacy patients for an outlet.
   */
  async getPharmacyPatients(
    outletId: string,
    options: {
      search?: string;
      activeOnly?: boolean;
      page?: number;
      size?: number;
    } = {}
  ): Promise<{ items: PharmacyPatient[]; total: number; page: number; size: number }> {
    try {
      const page = options.page || 1;
      const size = options.size || 50;
      const params = new URLSearchParams({
        outlet_id: outletId,
        page: page.toString(),
        size: size.toString(),
        active_only: (options.activeOnly !== false).toString(),
      });
      if (options.search?.trim()) {
        params.append('search', options.search.trim());
      }

      const response = await apiClient.get<{ items: PharmacyPatient[]; total: number; page: number; size: number }>(
        `${this.baseUrl}/patients?${params.toString()}`
      );
      if (!response.data) throw new Error(response.error || 'Failed to fetch pharmacy patients');
      return response.data;
    } catch (error) {
      logger.error('Error fetching pharmacy patients:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a pharmacy patient profile.
   */
  async createPharmacyPatient(patient: PharmacyPatientCreateRequest): Promise<PharmacyPatient> {
    try {
      const response = await apiClient.post<PharmacyPatient>(`${this.baseUrl}/patients`, patient);
      if (!response.data) throw new Error(response.error || 'Failed to create pharmacy patient');
      return response.data;
    } catch (error) {
      logger.error('Error creating pharmacy patient:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get one pharmacy patient profile.
   */
  async getPharmacyPatient(patientId: string): Promise<PharmacyPatient> {
    try {
      const response = await apiClient.get<PharmacyPatient>(`${this.baseUrl}/patients/${patientId}`);
      if (!response.data) throw new Error(response.error || 'Pharmacy patient not found');
      return response.data;
    } catch (error) {
      logger.error('Error fetching pharmacy patient:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update a pharmacy patient profile.
   */
  async updatePharmacyPatient(patientId: string, updates: PharmacyPatientUpdateRequest): Promise<PharmacyPatient> {
    try {
      const response = await apiClient.put<PharmacyPatient>(`${this.baseUrl}/patients/${patientId}`, updates);
      if (!response.data) throw new Error(response.error || 'Failed to update pharmacy patient');
      return response.data;
    } catch (error) {
      logger.error('Error updating pharmacy patient:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get vitals history for a pharmacy patient.
   */
  async getPharmacyPatientVitals(
    patientId: string,
    options: { page?: number; size?: number } = {}
  ): Promise<{ items: PatientVital[]; total: number; page: number; size: number }> {
    try {
      const page = options.page || 1;
      const size = options.size || 50;
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
      });
      const response = await apiClient.get<{ items: PatientVital[]; total: number; page: number; size: number }>(
        `${this.baseUrl}/patients/${patientId}/vitals?${params.toString()}`
      );
      if (!response.data) throw new Error(response.error || 'Failed to fetch patient vitals');
      return response.data;
    } catch (error) {
      logger.error('Error fetching pharmacy patient vitals:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Record vitals for a pharmacy patient.
   */
  async createPharmacyPatientVital(patientId: string, vital: PatientVitalCreateRequest): Promise<PatientVital> {
    try {
      const response = await apiClient.post<PatientVital>(`${this.baseUrl}/patients/${patientId}/vitals`, vital);
      if (!response.data) throw new Error(response.error || 'Failed to record patient vitals');
      return response.data;
    } catch (error) {
      logger.error('Error recording pharmacy patient vitals:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Search customers by phone number
   */
  async searchCustomerByPhone(outletId: string, phone: string): Promise<Customer | null> {
    try {
      const matches = await this.searchCustomers(outletId, phone, 1);
      if (!matches.length) return null;
      const byPhone = matches.find((item) => `${item.phone || ''}`.replace(/\D/g, '') === phone.replace(/\D/g, ''));
      return (byPhone || matches[0]) as Customer;
    } catch (error) {
      logger.error('Error searching customer by phone:', error);
      return null;
    }
  }

  /**
   * Calculate loyalty points for transaction amount
   */
  async calculateLoyaltyPoints(outletId: string, amount: number): Promise<number> {
    try {
      const response = await apiClient.get<LoyaltySettings>(`${this.baseUrl}/loyalty/settings?outlet_id=${outletId}`);
      const settings = response.data;
      if (!settings) throw new Error('Loyalty settings not found');
      return Math.floor(amount * settings.points_per_naira);
    } catch (error) {
      logger.error('Error calculating loyalty points:', error);
      return Math.floor(amount * 0.01); // Default: 1 point per ₦100
    }
  }

  /**
   * Redeem loyalty points for discount
   */
  calculateLoyaltyDiscount(points: number, redemptionRate: number = 1.0): number {
    return points * redemptionRate;
  }

  // ===============================================
  // INVENTORY TRANSFERS
  // ===============================================

  /**
   * Get inventory transfers
   */
  async getInventoryTransfers(
    options: {
      outletId?: string;
      status?: TransferStatus;
      dateFrom?: string;
      dateTo?: string;
      page?: number;
      size?: number;
    } = {}
  ): Promise<{ items: InventoryTransfer[]; total: number; page: number; size: number }> {
    try {
      const page = options.page || 1;
      const size = options.size || 50;
      const params = new URLSearchParams({
        page: page.toString(),
        size: size.toString(),
        ...options.outletId && { outlet_id: options.outletId },
        ...options.status && { status: options.status },
        ...options.dateFrom && { date_from: options.dateFrom },
        ...options.dateTo && { date_to: options.dateTo }
      });

      const response = await apiClient.get<{ items: InventoryTransfer[]; total: number; page: number; size: number }>(`${this.baseUrl}/inventory/transfers?${params}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch transfers');
      return response.data;
    } catch (error) {
      logger.error('Error fetching inventory transfers:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create inventory transfer request
   */
  async createInventoryTransfer(transfer: CreateTransferRequest): Promise<InventoryTransfer> {
    try {
      const response = await apiClient.post<InventoryTransfer>(`${this.baseUrl}/inventory/transfers`, transfer);
      if (!response.data) throw new Error(response.error || 'Failed to create transfer');
      return response.data;
    } catch (error) {
      logger.error('Error creating inventory transfer:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Approve inventory transfer
   */
  async approveInventoryTransfer(
    transferId: string,
    approved: boolean,
    notes?: string
  ): Promise<InventoryTransfer> {
    try {
      const response = await apiClient.post<InventoryTransfer>(
        `${this.baseUrl}/inventory/transfers/${transferId}/approve`,
        { approved, notes }
      );
      if (!response.data) throw new Error(response.error || 'Failed to update transfer');
      return response.data;
    } catch (error) {
      logger.error('Error approving inventory transfer:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a single stock adjustment movement.
   */
  async createStockAdjustment(adjustment: {
    product_id: string;
    outlet_id: string;
    quantity_change: number;
    performed_by: string;
    notes?: string;
    reference_id?: string;
    reference_type?: string;
    unit_cost?: number;
  }): Promise<StockMovement> {
    try {
      const response = await apiClient.post<StockMovement>(
        `${this.baseUrl}/inventory/adjustment`,
        {
          product_id: adjustment.product_id,
          outlet_id: adjustment.outlet_id,
          movement_type: 'adjustment',
          quantity_change: adjustment.quantity_change,
          reference_id: adjustment.reference_id,
          reference_type: adjustment.reference_type || 'stocktake',
          unit_cost: adjustment.unit_cost,
          notes: adjustment.notes,
          performed_by: adjustment.performed_by
        }
      );
      if (!response.data) throw new Error(response.error || 'Failed to create stock adjustment');
      return response.data;
    } catch (error) {
      logger.error('Error creating stock adjustment:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Apply a full stocktake by posting adjustments only where counted differs from system quantity.
   */
  private async applyStocktakeLegacy(params: {
    outlet_id: string;
    performed_by: string;
    items: StocktakeItem[];
  }): Promise<{ adjusted_count: number; unchanged_count: number; movements: StockMovement[] }> {
    const movements: StockMovement[] = [];
    let adjusted_count = 0;
    let unchanged_count = 0;

    for (const item of params.items) {
      const quantity_change = item.counted_quantity - item.current_quantity;
      if (quantity_change === 0) {
        unchanged_count += 1;
        continue;
      }

      const reasonPrefix = item.reason ? `[${item.reason}] ` : '';
      const movement = await this.createStockAdjustment({
        product_id: item.product_id,
        outlet_id: params.outlet_id,
        quantity_change,
        performed_by: params.performed_by,
        notes: `${reasonPrefix}${item.notes || 'Stocktake reconciliation adjustment'}`,
        reference_type: 'stocktake',
        unit_cost: item.unit_cost
      });
      adjusted_count += 1;
      movements.push(movement);
    }

    return { adjusted_count, unchanged_count, movements };
  }

  async applyStocktake(params: {
    outlet_id: string;
    performed_by: string;
    items: StocktakeItem[];
  }): Promise<{
    session_id?: string;
    adjusted_count: number;
    unchanged_count: number;
    movements: StockMovement[];
    total_items?: number;
    positive_variance_items?: number;
    negative_variance_items?: number;
    net_quantity_variance?: number;
    total_variance_value?: number;
  }> {
    try {
      const response = await apiClient.post<StocktakeCommitApiResponse>(
        `${this.baseUrl}/inventory/stocktakes/commit`,
        {
          outlet_id: params.outlet_id,
          performed_by: params.performed_by,
          terminal_id: this.getTerminalIdForOutlet(params.outlet_id),
          started_at: new Date().toISOString(),
          items: params.items.map((item) => ({
            product_id: item.product_id,
            current_quantity: item.current_quantity,
            counted_quantity: item.counted_quantity,
            reason: item.reason,
            notes: item.notes,
            unit_cost: item.unit_cost
          }))
        }
      );

      if (!response.data) {
        if (response.status === 404) {
          logger.warn('Stocktake commit endpoint unavailable (404); falling back to legacy per-item adjustments');
          return this.applyStocktakeLegacy(params);
        }
        throw new Error(response.error || 'Failed to commit stocktake');
      }

      return {
        session_id: response.data.session_id,
        adjusted_count: response.data.adjusted_items ?? 0,
        unchanged_count: response.data.unchanged_items ?? 0,
        movements: [],
        total_items: response.data.total_items,
        positive_variance_items: response.data.positive_variance_items,
        negative_variance_items: response.data.negative_variance_items,
        net_quantity_variance: response.data.net_quantity_variance,
        total_variance_value: response.data.total_variance_value
      };
    } catch (error) {
      logger.error('Error committing stocktake:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get stock movement history for an outlet.
   */
  async getStockMovements(options: {
    outlet_id: string;
    product_id?: string;
    movement_type?: StockMovement['movement_type'];
    date_from?: string;
    date_to?: string;
    limit?: number;
  }): Promise<StockMovement[]> {
    try {
      const params = new URLSearchParams({
        outlet_id: options.outlet_id,
        ...options.product_id && { product_id: options.product_id },
        ...options.movement_type && { movement_type: options.movement_type },
        ...options.date_from && { date_from: options.date_from },
        ...options.date_to && { date_to: options.date_to },
        limit: String(options.limit || 100)
      });

      const response = await apiClient.get<StockMovement[]>(`${this.baseUrl}/inventory/movements?${params}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch stock movements');
      return response.data;
    } catch (error) {
      logger.error('Error fetching stock movements:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // ENHANCED PRODUCT MANAGEMENT
  // ===============================================

  /**
   * Get products expiring soon
   */
  async getExpiringProducts(
    outletId: string,
    daysAhead: number = 30
  ): Promise<Array<{
    product_id: string;
    product_name: string;
    sku: string;
    batch_number?: string;
    expiry_date?: string;
    days_until_expiry: number;
    quantity_on_hand: number;
  }>> {
    try {
      const response = await apiClient.get<Array<{
        product_id: string;
        product_name: string;
        sku: string;
        batch_number?: string;
        expiry_date?: string;
        days_until_expiry: number;
        quantity_on_hand: number;
      }>>(`${this.baseUrl}/inventory/expiring?outlet_id=${outletId}&days_threshold=${daysAhead}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch expiring inventory');
      return response.data;
    } catch (error) {
      logger.error('Error fetching expiring products:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get low stock products
   */
  async getLowStockProducts(outletId: string): Promise<Array<{
    product_id: string;
    product_name: string;
    sku: string;
    quantity_on_hand: number;
    reorder_level: number;
    reorder_quantity: number;
  }>> {
    try {
      const response = await apiClient.get<Array<{
        product_id: string;
        product_name: string;
        sku: string;
        quantity_on_hand: number;
        reorder_level: number;
        reorder_quantity: number;
      }>>(`${this.baseUrl}/inventory/low-stock?outlet_id=${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch low stock inventory');
      return response.data;
    } catch (error) {
      logger.error('Error fetching low stock products:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Receive stock shipment
   */
  async receiveStock(receipts: Array<{
    product_id: string;
    quantity_received: number;
    cost_price: number;
    batch_number?: string;
    expiry_date?: string;
    supplier_invoice?: string;
    received_by: string;
    notes?: string;
  }>): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/products/receive-stock`, receipts);
    } catch (error) {
      logger.error('Error receiving stock:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Adjust stock (for damage, loss, etc.)
   */
  async adjustStock(adjustments: Array<{
    product_id: string;
    quantity: number; // Positive for increase, negative for decrease
    type: 'adjustment_in' | 'adjustment_out' | 'received';
    reason?: string;
    notes?: string;
    batch_number?: string;
  }>): Promise<void> {
    try {
      await apiClient.post(`${this.baseUrl}/products/adjust-stock`, adjustments);
    } catch (error) {
      logger.error('Error adjusting stock:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // ENHANCED TRANSACTION PROCESSING
  // ===============================================

  /**
   * Create enhanced transaction with loyalty support
   */
  async createEnhancedTransaction(transaction: EnhancedCreateTransactionRequest): Promise<POSTransaction> {
    try {
      const response = await apiClient.post<POSTransaction>(`${this.baseUrl}/transactions/enhanced`, transaction);
      if (!response.data) throw new Error(response.error || 'Failed to create transaction');
      return response.data;
    } catch (error) {
      logger.error('Error creating enhanced transaction:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // RECEIPT CUSTOMIZATION
  // ===============================================

  /**
   * Get receipt settings for outlet
   */
  async getReceiptSettings(outletId: string): Promise<{
    id?: string;
    outlet_id: string;
    header_text?: string;
    footer_text?: string;
    logo_url?: string;
    show_qr_code: boolean;
    show_customer_points: boolean;
    show_tax_breakdown: boolean;
    receipt_width: number;
    font_size: string;
    created_at?: string;
    updated_at?: string;
  }> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/receipt-settings/${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch settings');
      return response.data;
    } catch (error) {
      logger.error('Error fetching receipt settings:', error);
      // Return default settings
      return {
        outlet_id: outletId,
        show_qr_code: true,
        show_customer_points: true,
        show_tax_breakdown: true,
        receipt_width: 58,
        font_size: 'normal'
      };
    }
  }

  /**
   * Update receipt settings for outlet
   */
  async updateReceiptSettings(
    outletId: string,
    settings: {
      header_text?: string;
      footer_text?: string;
      logo_url?: string;
      show_qr_code?: boolean;
      show_customer_points?: boolean;
      show_tax_breakdown?: boolean;
      receipt_width?: number;
      font_size?: string;
    }
  ): Promise<{
    id: string;
    outlet_id: string;
    header_text?: string;
    footer_text?: string;
    logo_url?: string;
    show_qr_code: boolean;
    show_customer_points: boolean;
    show_tax_breakdown: boolean;
    receipt_width: number;
    font_size: string;
    created_at: string;
    updated_at: string;
  }> {
    try {
      const response = await apiClient.put<any>(`${this.baseUrl}/receipt-settings/${outletId}`, settings);
      if (!response.data) throw new Error(response.error || 'Failed to update settings');
      return response.data;
    } catch (error) {
      logger.error('Error updating receipt settings:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get outlet business information
   */
  async getOutletInfo(outletId: string): Promise<{
    id: string;
    name: string;
    phone?: string;
    email?: string;
    website?: string;
    address?: string | {
      street?: string;
      city?: string;
      state?: string;
      zip?: string;
      country?: string;
    };
    [key: string]: any;
  }> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/outlets/${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch outlet info');
      return response.data;
    } catch (error) {
      logger.error('Error fetching outlet info:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update outlet business information (address, phone, email, website)
   */
  async updateOutletInfo(
    outletId: string,
    outletData: {
      name?: string;
      phone?: string;
      email?: string;
      website?: string;
      address?: string | {
        street?: string;
        city?: string;
        state?: string;
        zip?: string;
        country?: string;
      };
    }
  ): Promise<any> {
    try {
      const response = await apiClient.put<any>(`${this.baseUrl}/outlets/${outletId}`, outletData);
      if (!response.data) throw new Error(response.error || 'Failed to update outlet info');
      return response.data;
    } catch (error) {
      logger.error('Error updating outlet info:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Generate receipt preview
   */
  async generateReceiptPreview(transactionId: string): Promise<{
    receipt_data: string;
    qr_code: string;
    format: string;
  }> {
    try {
      const response = await apiClient.post<{
        receipt_data: string;
        qr_code: string;
        format: string;
      }>(`${this.baseUrl}/receipts/${transactionId}/preview`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch print data');
      return response.data;
    } catch (error) {
      logger.error('Error generating receipt preview:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Print receipt
   */
  async printReceipt(
    transactionId: string,
    copies: number = 1
  ): Promise<{ message: string; transaction_id: string; receipt_content: string; copies: number; format: string }> {
    try {
      const params = new URLSearchParams({
        copies: copies.toString()
      });

      const response = await apiClient.post<{ message: string; transaction_id: string; receipt_content: string; copies: number; format: string }>(`${this.baseUrl}/receipts/${transactionId}/print?${params}`);
      if (!response.data) throw new Error(response.error || 'Failed to create print job');
      return response.data;
    } catch (error) {
      logger.error('Error printing receipt:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // ROLE & PERMISSION MANAGEMENT
  // ===============================================

  /**
   * Check if user has specific permission
   */
  async hasPermission(
    _userId: string,
    outletId: string,
    permission: string
  ): Promise<boolean> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/auth/check-permission?outlet_id=${outletId}&permission=${permission}`);
      const permissions = response.data?.permissions || {};
      return permissions[permission] === true;
    } catch (error) {
      logger.error('Error checking user permission:', error);
      return false;
    }
  }

  /**
   * Get available permissions
   */
  async getAvailablePermissions(): Promise<Array<{
    name: string;
    description: string;
    category: string;
  }>> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/permissions`);
      return response.data.permissions;
    } catch (error) {
      logger.error('Error fetching permissions:', error);
      return [];
    }
  }

  // ===============================================
  // SYNC & CONNECTIVITY
  // ===============================================

  /**
   * Trigger manual sync
   */
  async triggerManualSync(
    outletId: string,
    syncType: 'full' | 'inventory' | 'transactions' = 'full'
  ): Promise<{ message: string; sync_id: string }> {
    try {
      const response = await apiClient.post<any>(
        `${this.baseUrl}/sync/trigger?outlet_id=${outletId}&sync_type=${syncType}`
      );
      if (!response.data) throw new Error(response.error || 'Sync failed');
      return response.data;
    } catch (error) {
      logger.error('Error triggering manual sync:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get sync status for outlet
   */
  async getSyncStatus(outletId: string): Promise<{
    last_sync: string;
    sync_status: string;
    pending_transactions: number;
    pending_inventory_updates: number;
    sync_errors: string[];
  }> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/sync/status?outlet_id=${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch status');
      return response.data;
    } catch (error) {
      logger.error('Error fetching sync status:', error);
      return {
        last_sync: 'unknown',
        sync_status: 'unknown',
        pending_transactions: 0,
        pending_inventory_updates: 0,
        sync_errors: []
      };
    }
  }

  /**
   * HELD RECEIPT METHODS
   */

  /**
   * Create a held receipt (put sale on hold)
   */
  async createHeldReceipt(data: {
    outlet_id: string;
    cashier_id: string;
    items: Array<{
      product_id: string;
      quantity: number;
      unit_price: number;
      discount: number;
    }>;
    total: number;
  }): Promise<any> {
    try {
      const response = await apiClient.post<any>(`${this.baseUrl}/held-receipts`, data);
      if (!response.data) throw new Error(response.error || 'Failed to create held receipt');
      return response.data;
    } catch (error) {
      logger.error('Error creating held receipt:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get all held receipts for an outlet
   */
  async getHeldReceipts(outletId: string): Promise<any[]> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/held-receipts?outlet_id=${outletId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch held receipts');
      return response.data.receipts || [];
    } catch (error) {
      logger.error('Error fetching held receipts:', error);
      // Propagate error so caller can decide how to fall back
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific held receipt
   */
  async getHeldReceipt(receiptId: string): Promise<any> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/held-receipts/${receiptId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch held receipt');
      return response.data;
    } catch (error) {
      logger.error('Error fetching held receipt:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete a held receipt
   */
  async deleteHeldReceipt(receiptId: string): Promise<void> {
    try {
      const response = await apiClient.delete<any>(`${this.baseUrl}/held-receipts/${receiptId}`);
      if (response.error) throw new Error(response.error);
    } catch (error) {
      logger.error('Error deleting held receipt:', error);
      throw this.handleError(error);
    }
  }

  /**
   * CASH DRAWER METHODS
   */

  /**
   * Open a cash drawer session
   */
  async openCashDrawerSession(data: {
    outlet_id: string;
    terminal_id: string;
    cashier_id: string;
    opening_balance: number;
    opening_notes?: string;
  }): Promise<any> {
    try {
      const response = await apiClient.post<any>(`${this.baseUrl}/cash-drawer/sessions`, data);
      if (!response.data) throw new Error(response.error || 'Failed to open cash drawer session');
      return response.data;
    } catch (error) {
      logger.error('Error opening cash drawer session:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get active cash drawer session
   */
  async getActiveCashDrawerSession(outletId: string, terminalId: string): Promise<any | null> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/cash-drawer/sessions/active?outlet_id=${outletId}&terminal_id=${terminalId}`);
      if (response.error && response.status !== 404) throw new Error(response.error);
      return response.data || null;
    } catch (error) {
      logger.error('Error fetching active cash drawer session:', error);
      return null;
    }
  }

  /**
   * Close a cash drawer session
   */
  async closeCashDrawerSession(sessionId: string, data: {
    actual_balance: number;
    closing_notes?: string;
  }): Promise<any> {
    try {
      const response = await apiClient.put<any>(`${this.baseUrl}/cash-drawer/sessions/${sessionId}/close`, data);
      if (!response.data) throw new Error(response.error || 'Failed to close cash drawer session');
      return response.data;
    } catch (error) {
      logger.error('Error closing cash drawer session:', error);
      throw this.handleError(error);
    }
  }

  /**
   * CUSTOMER METHODS
   */

  /**
   * Search customers by name or phone
   */
  async searchCustomers(outletId: string, query: string, limit: number = 10): Promise<any[]> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/customers/search?outlet_id=${outletId}&query=${encodeURIComponent(query)}&limit=${limit}`);
      if (response.error) throw new Error(response.error);
      return response.data || [];
    } catch (error) {
      logger.error('Error searching customers:', error);
      return [];
    }
  }


  /**
   * EOD SALES BREAKDOWN METHODS
   */

  /**
   * Get detailed sales breakdown for EOD reconciliation
   */
  async getSalesBreakdown(
    outletId: string,
    dateFrom: string,
    dateTo: string = dateFrom,
    cashierId?: string
  ): Promise<any> {
    try {
      let url = `${this.baseUrl}/sales-breakdown?outlet_id=${outletId}&date_from=${dateFrom}&date_to=${dateTo}`;
      if (cashierId) {
        url += `&cashier_id=${cashierId}`;
      }

      const response = await apiClient.get<any>(url);
      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      logger.error('Error getting sales breakdown:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get list of cashiers who had transactions on a specific date
   */
  async getCashiersForDate(outletId: string, date: string): Promise<any[]> {
    try {
      // Get breakdown for all cashiers, then extract unique cashiers
      const breakdown = await this.getSalesBreakdown(outletId, date);
      const cashiers = [];

      if (breakdown?.breakdown?.by_cashier) {
        for (const [cashierId, cashierData] of Object.entries(breakdown.breakdown.by_cashier)) {
          cashiers.push({
            id: cashierId,
            name: (cashierData as any).name,
            transaction_count: (cashierData as any).transaction_count,
            total_amount: (cashierData as any).total_amount
          });
        }
      }

      return cashiers.sort((a, b) => b.total_amount - a.total_amount);
    } catch (error) {
      logger.error('Error getting cashiers for date:', error);
      return [];
    }
  }

  /**
   * Handle API errors consistently
   */
  private handleError(error: any): Error {
    if (error.response) {
      // Server responded with error status
      const message = error.response.data?.detail || error.response.data?.message || 'Server error';
      return new Error(`POS Error: ${message}`);
    } else if (error.request) {
      // Network error
      return new Error('Network error: Please check your connection');
    } else {
      // Other error
      return new Error(`Error: ${error.message}`);
    }
  }
}

// Export singleton instance
export const posService = new POSService();
