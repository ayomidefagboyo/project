/**
 * POS Service - Nigerian Supermarket Focus
 * Handles all POS operations including offline capabilities
 */

import { apiClient } from './apiClient';
import { offlineDatabase } from './offlineDatabase';

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

// ===============================================
// POS SERVICE CLASS
// ===============================================

class POSService {
  private baseUrl = '/pos';
  private isInitialized = false;

  constructor() {
    this.initializeOfflineDB();
  }

  private async initializeOfflineDB(): Promise<void> {
    try {
      await offlineDatabase.init();
      this.isInitialized = true;
      console.log('Offline database initialized successfully');
    } catch (error) {
      console.error('Failed to initialize offline database:', error);
    }
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
  ) {
    try {
      // Try online first
      const params = new URLSearchParams({
        outlet_id: outletId,
        page: (options.page || 1).toString(),
        size: (options.size || 20).toString(),
        active_only: (options.activeOnly !== false).toString(),
        ...options.search && { search: options.search },
        ...options.category && { category: options.category }
      });

      const response = await apiClient.get(`${this.baseUrl}/products?${params}`);

      // Cache products offline for future use
      if (this.isInitialized && response.data.items) {
        await offlineDatabase.storeProducts(response.data.items);
      }

      return response.data;
    } catch (error) {
      console.error('Error fetching products online, trying offline cache:', error);

      // Fallback to offline cache
      if (this.isInitialized) {
        try {
          const offlineProducts = await offlineDatabase.getProducts(outletId);
          let filteredProducts = offlineProducts;

          // Apply filters
          if (options.search) {
            const searchLower = options.search.toLowerCase();
            filteredProducts = filteredProducts.filter(p =>
              p.name.toLowerCase().includes(searchLower) ||
              p.sku.toLowerCase().includes(searchLower) ||
              p.barcode?.toLowerCase().includes(searchLower)
            );
          }

          if (options.category) {
            filteredProducts = filteredProducts.filter(p => p.category === options.category);
          }

          if (options.activeOnly !== false) {
            filteredProducts = filteredProducts.filter(p => p.is_active);
          }

          // Simple pagination for offline results
          const page = options.page || 1;
          const size = options.size || 20;
          const start = (page - 1) * size;
          const paginatedProducts = filteredProducts.slice(start, start + size);

          return {
            items: paginatedProducts,
            total: filteredProducts.length,
            page: page,
            size: size,
            offline: true
          };
        } catch (offlineError) {
          console.error('Error fetching products from offline cache:', offlineError);
        }
      }

      throw this.handleError(error);
    }
  }

  /**
   * Get product by barcode scan
   */
  async getProductByBarcode(barcode: string, outletId: string): Promise<POSProduct> {
    try {
      const response = await apiClient.get(
        `${this.baseUrl}/products/search/barcode/${encodeURIComponent(barcode)}?outlet_id=${outletId}`
      );
      return response.data;
    } catch (error) {
      console.error('Error fetching product by barcode:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Create a new product
   */
  async createProduct(product: ProductCreateRequest): Promise<POSProduct> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/products`, product);
      return response.data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update an existing product
   */
  async updateProduct(productId: string, updates: Partial<ProductCreateRequest>): Promise<POSProduct> {
    try {
      const response = await apiClient.put(`${this.baseUrl}/products/${productId}`, updates);
      return response.data;
    } catch (error) {
      console.error('Error updating product:', error);
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
      console.error('Error deleting product:', error);
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
      const response = await apiClient.post(`${this.baseUrl}/transactions`, transaction);
      return response.data;
    } catch (error) {
      console.error('Error creating transaction:', error);
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
    } = {}
  ) {
    try {
      const params = new URLSearchParams({
        outlet_id: outletId,
        page: (options.page || 1).toString(),
        size: (options.size || 50).toString(),
        ...options.date_from && { date_from: options.date_from },
        ...options.date_to && { date_to: options.date_to },
        ...options.cashier_id && { cashier_id: options.cashier_id },
        ...options.payment_method && { payment_method: options.payment_method }
      });

      const response = await apiClient.get(`${this.baseUrl}/transactions?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific transaction by ID
   */
  async getTransaction(transactionId: string): Promise<POSTransaction> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/transactions/${transactionId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching transaction:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Void a transaction
   */
  async voidTransaction(transactionId: string, reason: string): Promise<void> {
    try {
      await apiClient.put(`${this.baseUrl}/transactions/${transactionId}/void`, {
        void_reason: reason
      });
    } catch (error) {
      console.error('Error voiding transaction:', error);
      throw this.handleError(error);
    }
  }

  // ===============================================
  // STATISTICS AND REPORTING
  // ===============================================

  /**
   * Get inventory statistics
   */
  async getInventoryStats(outletId: string): Promise<InventoryStats> {
    try {
      const response = await apiClient.get(`${this.baseUrl}/stats/inventory?outlet_id=${outletId}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching inventory stats:', error);
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

      const response = await apiClient.get(`${this.baseUrl}/stats/sales?${params}`);
      return response.data;
    } catch (error) {
      console.error('Error fetching sales stats:', error);
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
      console.error('Error storing offline transaction:', error);
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
          }
        } catch (error) {
          console.error('Failed to sync offline transaction:', error);
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
      console.error('Error syncing offline transactions:', error);
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