/**
 * Offline Database Service - Local SQLite for POS offline capabilities
 * Nigerian Supermarket Focus
 */

import { POSProduct, POSTransaction, CreateTransactionRequest } from './posService';

// SQLite database interface using WebSQL or IndexedDB fallback
interface OfflineDatabase {
  init(): Promise<void>;
  storeProducts(products: POSProduct[]): Promise<void>;
  getProducts(outletId: string): Promise<POSProduct[]>;
  storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string>;
  getOfflineTransactions(): Promise<Array<CreateTransactionRequest & { offline_id: string; created_at: string }>>;
  removeOfflineTransaction(offlineId: string): Promise<void>;
  clearOfflineTransactions(): Promise<void>;
}

class IndexedDBOfflineDatabase implements OfflineDatabase {
  private dbName = 'pos_offline_db';
  private version = 1;
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;

        // Products store
        if (!db.objectStoreNames.contains('products')) {
          const productsStore = db.createObjectStore('products', { keyPath: 'id' });
          productsStore.createIndex('outlet_id', 'outlet_id', { unique: false });
          productsStore.createIndex('sku', 'sku', { unique: false });
          productsStore.createIndex('barcode', 'barcode', { unique: false });
          productsStore.createIndex('category', 'category', { unique: false });
          productsStore.createIndex('is_active', 'is_active', { unique: false });
        }

        // Offline transactions store
        if (!db.objectStoreNames.contains('offline_transactions')) {
          const transactionsStore = db.createObjectStore('offline_transactions', { keyPath: 'offline_id' });
          transactionsStore.createIndex('outlet_id', 'outlet_id', { unique: false });
          transactionsStore.createIndex('cashier_id', 'cashier_id', { unique: false });
          transactionsStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Sync queue store
        if (!db.objectStoreNames.contains('sync_queue')) {
          const syncStore = db.createObjectStore('sync_queue', { keyPath: 'id', autoIncrement: true });
          syncStore.createIndex('type', 'type', { unique: false });
          syncStore.createIndex('status', 'status', { unique: false });
          syncStore.createIndex('created_at', 'created_at', { unique: false });
        }

        // Settings store
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  private ensureDB(): IDBDatabase {
    if (!this.db) {
      throw new Error('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  async storeProducts(products: POSProduct[]): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['products'], 'readwrite');
    const store = transaction.objectStore('products');

    // Clear existing products for the outlet and store new ones
    const promises = products.map(product => {
      return new Promise<void>((resolve, reject) => {
        const request = store.put({
          ...product,
          last_sync: new Date().toISOString()
        });
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
      });
    });

    await Promise.all(promises);
  }

  async getProducts(outletId: string): Promise<POSProduct[]> {
    const db = this.ensureDB();
    const transaction = db.transaction(['products'], 'readonly');
    const store = transaction.objectStore('products');
    const index = store.index('outlet_id');

    return new Promise((resolve, reject) => {
      const request = index.getAll(outletId);
      request.onsuccess = () => {
        const products = request.result.filter((p: any) => p.is_active !== false);
        resolve(products);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string> {
    const db = this.ensureDB();
    const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const offlineTransaction = {
      ...transaction,
      offline_id: offlineId,
      created_at: new Date().toISOString(),
      status: 'offline'
    };

    return new Promise((resolve, reject) => {
      const dbTransaction = db.transaction(['offline_transactions'], 'readwrite');
      const store = dbTransaction.objectStore('offline_transactions');

      const request = store.add(offlineTransaction);
      request.onsuccess = () => resolve(offlineId);
      request.onerror = () => reject(request.error);
    });
  }

  async getOfflineTransactions(): Promise<Array<CreateTransactionRequest & { offline_id: string; created_at: string }>> {
    const db = this.ensureDB();
    const transaction = db.transaction(['offline_transactions'], 'readonly');
    const store = transaction.objectStore('offline_transactions');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async removeOfflineTransaction(offlineId: string): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['offline_transactions'], 'readwrite');
    const store = transaction.objectStore('offline_transactions');

    return new Promise((resolve, reject) => {
      const request = store.delete(offlineId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearOfflineTransactions(): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['offline_transactions'], 'readwrite');
    const store = transaction.objectStore('offline_transactions');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  // Additional utility methods
  async storeSetting(key: string, value: any): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['settings'], 'readwrite');
    const store = transaction.objectStore('settings');

    return new Promise((resolve, reject) => {
      const request = store.put({ key, value, updated_at: new Date().toISOString() });
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key: string): Promise<any> {
    const db = this.ensureDB();
    const transaction = db.transaction(['settings'], 'readonly');
    const store = transaction.objectStore('settings');

    return new Promise((resolve, reject) => {
      const request = store.get(key);
      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }

  async addToSyncQueue(type: string, data: any): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    const queueItem = {
      type,
      data,
      status: 'pending',
      created_at: new Date().toISOString(),
      attempts: 0
    };

    return new Promise((resolve, reject) => {
      const request = store.add(queueItem);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSyncQueue(): Promise<any[]> {
    const db = this.ensureDB();
    const transaction = db.transaction(['sync_queue'], 'readonly');
    const store = transaction.objectStore('sync_queue');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async clearSyncQueue(): Promise<void> {
    const db = this.ensureDB();
    const transaction = db.transaction(['sync_queue'], 'readwrite');
    const store = transaction.objectStore('sync_queue');

    return new Promise((resolve, reject) => {
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

// Fallback to LocalStorage if IndexedDB is not available
class LocalStorageOfflineDatabase implements OfflineDatabase {
  private readonly PRODUCTS_KEY = 'pos_offline_products';
  private readonly TRANSACTIONS_KEY = 'pos_offline_transactions';
  private readonly SETTINGS_KEY = 'pos_offline_settings';

  async init(): Promise<void> {
    // LocalStorage is synchronous, so no initialization needed
    console.log('Using LocalStorage fallback for offline database');
  }

  async storeProducts(products: POSProduct[]): Promise<void> {
    try {
      const productsWithSync = products.map(p => ({
        ...p,
        last_sync: new Date().toISOString()
      }));
      localStorage.setItem(this.PRODUCTS_KEY, JSON.stringify(productsWithSync));
    } catch (error) {
      throw new Error(`Failed to store products: ${error}`);
    }
  }

  async getProducts(outletId: string): Promise<POSProduct[]> {
    try {
      const stored = localStorage.getItem(this.PRODUCTS_KEY);
      if (!stored) return [];

      const allProducts: POSProduct[] = JSON.parse(stored);
      return allProducts.filter(p => p.outlet_id === outletId && p.is_active !== false);
    } catch (error) {
      console.error('Failed to get products:', error);
      return [];
    }
  }

  async storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string> {
    try {
      const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const stored = localStorage.getItem(this.TRANSACTIONS_KEY);
      const transactions = stored ? JSON.parse(stored) : [];

      const offlineTransaction = {
        ...transaction,
        offline_id: offlineId,
        created_at: new Date().toISOString(),
        status: 'offline'
      };

      transactions.push(offlineTransaction);
      localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(transactions));

      return offlineId;
    } catch (error) {
      throw new Error(`Failed to store offline transaction: ${error}`);
    }
  }

  async getOfflineTransactions(): Promise<Array<CreateTransactionRequest & { offline_id: string; created_at: string }>> {
    try {
      const stored = localStorage.getItem(this.TRANSACTIONS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error('Failed to get offline transactions:', error);
      return [];
    }
  }

  async removeOfflineTransaction(offlineId: string): Promise<void> {
    try {
      const stored = localStorage.getItem(this.TRANSACTIONS_KEY);
      if (!stored) return;

      const transactions = JSON.parse(stored);
      const filtered = transactions.filter((t: any) => t.offline_id !== offlineId);
      localStorage.setItem(this.TRANSACTIONS_KEY, JSON.stringify(filtered));
    } catch (error) {
      throw new Error(`Failed to remove offline transaction: ${error}`);
    }
  }

  async clearOfflineTransactions(): Promise<void> {
    try {
      localStorage.removeItem(this.TRANSACTIONS_KEY);
    } catch (error) {
      throw new Error(`Failed to clear offline transactions: ${error}`);
    }
  }
}

// Database factory
function createOfflineDatabase(): OfflineDatabase {
  if ('indexedDB' in window) {
    return new IndexedDBOfflineDatabase();
  } else {
    return new LocalStorageOfflineDatabase();
  }
}

// Export singleton instance
export const offlineDatabase = createOfflineDatabase();

// Export types
export type { OfflineDatabase };