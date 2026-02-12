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

export interface POSTransaction {
  id: string;
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
}

export interface ProductListResult {
  items: POSProduct[];
  total: number;
  page: number;
  size: number;
  offline?: boolean;
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
  private readonly productSyncPageSize = 100;

  constructor() {
    this.initializeOfflineDB();
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

  private getProductCursorSettingKey(outletId: string): string {
    return `pos_products_cursor_${outletId}`;
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

  private async fetchProductsPageFromApi(
    outletId: string,
    options: {
      page: number;
      size: number;
      search?: string;
      category?: string;
      activeOnly?: boolean;
      updatedAfter?: string;
    }
  ): Promise<ProductListResult> {
    const safeSize = Math.min(Math.max(options.size, 1), this.productSyncPageSize);
    const params = new URLSearchParams({
      outlet_id: outletId,
      page: options.page.toString(),
      size: safeSize.toString(),
      active_only: (options.activeOnly !== false).toString(),
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

  // ===============================================
  // PRODUCT MANAGEMENT
  // ===============================================

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
    try {
      const requestedSize = options.size || 20;
      const safeSize = Math.min(Math.max(requestedSize, 1), this.productSyncPageSize);
      const response = await this.fetchProductsPageFromApi(outletId, {
        page: options.page || 1,
        size: safeSize,
        search: options.search,
        category: options.category,
        activeOnly: options.activeOnly
      });

      // Cache products offline for future use
      if (this.isInitialized && response.items) {
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
      if (this.isInitialized) {
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
    if (!this.isInitialized) {
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
    } = {}
  ): Promise<{ mode: 'full' | 'delta'; updated: number }> {
    if (!this.isInitialized) {
      return { mode: options.forceFull ? 'full' : 'delta', updated: 0 };
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return { mode: options.forceFull ? 'full' : 'delta', updated: 0 };
    }

    const maxPages = options.maxPages || 300;
    const cursorKey = this.getProductCursorSettingKey(outletId);
    const existingCursor = await offlineDatabase.getSetting(cursorKey);
    const mode: 'full' | 'delta' = options.forceFull || !existingCursor ? 'full' : 'delta';

    let page = 1;
    let updated = 0;
    let latestCursor = typeof existingCursor === 'string' ? existingCursor : '';

    if (mode === 'full') {
      const allItems: POSProduct[] = [];

      while (page <= maxPages) {
        const response = await this.fetchProductsPageFromApi(outletId, {
          page,
          size: this.productSyncPageSize,
          activeOnly: false
        });

        const items = response.items || [];
        if (items.length === 0) break;

        allItems.push(...items);
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
        const response = await this.fetchProductsPageFromApi(outletId, {
          page,
          size: this.productSyncPageSize,
          activeOnly: false,
          updatedAfter: existingCursor
        });

        const items = response.items || [];
        if (items.length === 0) break;

        await offlineDatabase.storeProducts(items);
        updated += items.length;

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

    return { mode, updated };
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
    if (!this.isInitialized || !query) return [];
    return await offlineDatabase.searchProducts(outletId, query);
  }


  /**
   * Get product by barcode scan
   */
  async getProductByBarcode(barcode: string, outletId: string): Promise<POSProduct> {
    try {
      const response = await apiClient.get<POSProduct>(
        `${this.baseUrl}/products/search/barcode/${encodeURIComponent(barcode)}?outlet_id=${outletId}`
      );
      if (response.error || !response.data) throw new Error(response.error || 'Product not found');
      return response.data;
    } catch (error) {
      logger.error('Error fetching product by barcode:', error);
      throw this.handleError(error);
    }
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
   * Update an existing product
   */
  async updateProduct(productId: string, updates: Partial<ProductCreateRequest>): Promise<POSProduct> {
    try {
      const response = await apiClient.put<POSProduct>(`${this.baseUrl}/products/${productId}`, updates);
      if (!response.data) throw new Error(response.error || 'Failed to update product');
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
    try {
      const response = await apiClient.post<POSTransaction>(`${this.baseUrl}/transactions`, transaction);
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
        const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
      const params = new URLSearchParams({
        outlet_id: outletId,
        skip: ((options.page || 1) - 1 * (options.size || 50)).toString(),
        limit: (options.size || 50).toString(),
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
   * Search customers by phone number
   */
  async searchCustomerByPhone(phone: string): Promise<Customer | null> {
    try {
      const customers = await this.getCustomers('', { search: phone, size: 1 });
      return customers.items.length > 0 ? customers.items[0] : null;
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
  async applyStocktake(params: {
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
