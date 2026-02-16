/**
 * Offline Database Service - Dexie.js Implementation
 * Nigerian Supermarket Focus
 */

import Dexie, { type Table } from 'dexie';
import type { POSProduct, CreateTransactionRequest, POSTransaction } from './posService';

// Extended Product type for indexing
interface IndexedPOSProduct extends POSProduct {
  name_tokens: string[]; // For full-text search
  last_sync: string;
}

interface IndexedPOSTransaction extends POSTransaction {
  search_tokens: string[]; // For full-text search (receipt #, customer name)
  last_sync: string;
}

interface OfflineTransaction extends CreateTransactionRequest {
  offline_id: string;
  created_at: string;
  status: 'offline' | 'synced';
}

interface SyncQueueItem {
  id?: number;
  type: string;
  data: any;
  status: 'pending' | 'processing' | 'failed';
  created_at: string;
  attempts: number;
}

interface SettingItem {
  key: string;
  value: any;
  updated_at: string;
}

// Dexie Database Definition
export class POSDatabase extends Dexie {
  products!: Table<IndexedPOSProduct, string>;
  transactions!: Table<IndexedPOSTransaction, string>;
  offlineTransactions!: Table<OfflineTransaction, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<SettingItem, string>;

  constructor() {
    super('CompazzPOS');
    this.version(1).stores({
      products: 'id, outlet_id, [outlet_id+is_active], *name_tokens, barcode, sku, category',
      offlineTransactions: 'offline_id, outlet_id, created_at, status',
      syncQueue: '++id, type, status, created_at',
      settings: 'key'
    });

    // Version 2: Add transactions table
    this.version(2).stores({
      transactions: 'id, outlet_id, [outlet_id+transaction_date], transaction_number, *search_tokens, status, payment_method'
    });
  }
}

// Singleton Dexie instance
const db = new POSDatabase();

// Tokenizer helper
const tokenize = (text: string): string[] => {
  return text.toLowerCase().split(/[\s\-_,.]+/).filter(t => t.length > 0);
};

const createOfflineTransactionId = (): string => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // Fallback for older runtimes without randomUUID.
  const randomPart = Math.random().toString(36).slice(2, 12);
  return `${Date.now()}-${randomPart}`;
};

// Interface compatible with previous implementation
interface OfflineDatabase {
  init(): Promise<void>;
  storeProducts(products: POSProduct[]): Promise<void>;
  replaceOutletProducts(outletId: string, products: POSProduct[]): Promise<void>;
  removeProduct(productId: string): Promise<void>;
  getAllProducts(outletId: string): Promise<POSProduct[]>;
  getProducts(outletId: string): Promise<POSProduct[]>;
  // Transaction History Methods
  storeTransactions(transactions: POSTransaction[]): Promise<void>;
  removeTransaction(transactionId: string): Promise<void>;
  getTransactions(outletId: string, limit?: number): Promise<POSTransaction[]>;
  searchTransactions(outletId: string, query: string): Promise<POSTransaction[]>;

  // Offline Transaction Queue Methods
  storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string>;
  getOfflineTransactions(): Promise<Array<CreateTransactionRequest & { offline_id: string; created_at: string }>>;
  removeOfflineTransaction(offlineId: string): Promise<void>;
  clearOfflineTransactions(): Promise<void>;
  // Utility methods
  storeSetting(key: string, value: any): Promise<void>;
  getSetting(key: string): Promise<any>;
  addToSyncQueue(type: string, data: any): Promise<void>;
  getSyncQueue(): Promise<any[]>;
  clearSyncQueue(): Promise<void>;
}


class DexieOfflineDatabase implements OfflineDatabase {

  async init(): Promise<void> {
    // Dexie opens automatically on first query
    // We can explicitly open to handle errors early
    try {
      if (!db.isOpen()) {
        await db.open();
      }
    } catch (err) {
      console.error('Failed to open Dexie DB:', err);
      throw err;
    }
  }

  async storeProducts(products: POSProduct[]): Promise<void> {
    // Bulk put is much faster than individual adds
    const indexedProducts: IndexedPOSProduct[] = products.map(p => ({
      ...p,
      name_tokens: tokenize(p.name),
      last_sync: new Date().toISOString()
    }));

    await db.products.bulkPut(indexedProducts);
  }

  async replaceOutletProducts(outletId: string, products: POSProduct[]): Promise<void> {
    const indexedProducts: IndexedPOSProduct[] = products.map(p => ({
      ...p,
      name_tokens: tokenize(p.name),
      last_sync: new Date().toISOString()
    }));

    await db.transaction('rw', db.products, async () => {
      await db.products.where('outlet_id').equals(outletId).delete();
      if (indexedProducts.length > 0) {
        await db.products.bulkPut(indexedProducts);
      }
    });
  }

  async removeProduct(productId: string): Promise<void> {
    await db.products.delete(productId);
  }

  async getProducts(outletId: string): Promise<POSProduct[]> {
    // Return all active products for outlet
    // Use simple outlet_id index and filter is_active client-side for reliability
    return await db.products
      .where('outlet_id')
      .equals(outletId)
      .filter(p => p.is_active)
      .toArray();
  }

  async getAllProducts(outletId: string): Promise<POSProduct[]> {
    return await db.products
      .where('outlet_id')
      .equals(outletId)
      .toArray();
  }

  // Optimized Search Method
  async searchProducts(outletId: string, query: string): Promise<POSProduct[]> {
    const q = query.toLowerCase();

    // 1. Exact Barcode Match (Fastest)
    const barcodeMatch = await db.products
      .where('barcode').equals(query)
      .first();

    if (barcodeMatch) return [barcodeMatch];

    // 2. Exact SKU Match
    const skuMatch = await db.products.where('sku').equals(query).first();
    if (skuMatch) return [skuMatch];

    // 3. Name Search using Multi-Entry Index (Fast "StartsWith")
    // This finds any token that starts with query.
    // e.g. "coc" matches "coca cola" via "coca" token.
    let results = await db.products
      .where('name_tokens')
      .startsWith(q)
      .distinct() // Remove duplicates if multiple tokens match
      .limit(50) // Limit results for speed
      .toArray();

    // Filter by outlet if needed (client side filter is fast on 50 items)
    return results.filter(p => p.outlet_id === outletId && p.is_active);
  }

  // ==========================================
  // TRANSACTION HISTORY (NEW)
  // ==========================================

  async storeTransactions(transactions: POSTransaction[]): Promise<void> {
    const indexedTransactions: IndexedPOSTransaction[] = transactions.map(t => ({
      ...t,
      search_tokens: [
        ...tokenize(t.transaction_number),
        ...tokenize(t.customer_name || ''),
        ...tokenize(t.payment_method)
      ],
      last_sync: new Date().toISOString()
    }));

    await db.transactions.bulkPut(indexedTransactions);
  }

  async getTransactions(outletId: string, limit: number = 200): Promise<POSTransaction[]> {
    // Get latest transactions for specific outlet using compound index for performance
    return await db.transactions
      .where('[outlet_id+transaction_date]')
      .between([outletId, '0'], [outletId, '\uffff'])
      .reverse() // Newest first
      .limit(limit)
      .toArray();
  }

  async removeTransaction(transactionId: string): Promise<void> {
    await db.transactions.delete(transactionId);
  }

  async searchTransactions(outletId: string, query: string): Promise<POSTransaction[]> {
    const q = query.toLowerCase();

    // 1. Exact Receipt Number Match
    const receiptMatch = await db.transactions
      .where('transaction_number').equals(query)
      .first();

    if (receiptMatch && receiptMatch.outlet_id === outletId) return [receiptMatch];

    // 2. Token Search (Customer Name, Receipt parts, Payment Method)
    let results = await db.transactions
      .where('search_tokens')
      .startsWith(q)
      .distinct()
      .limit(50)
      .toArray();

    // Filter by outlet and sort by date desc
    return results
      .filter(t => t.outlet_id === outletId)
      .sort((a, b) => new Date(b.transaction_date).getTime() - new Date(a.transaction_date).getTime());
  }

  async storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string> {
    const offlineId = createOfflineTransactionId();

    const offlineItem: OfflineTransaction = {
      ...transaction,
      offline_id: offlineId,
      created_at: new Date().toISOString(),
      status: 'offline'
    };

    await db.offlineTransactions.add(offlineItem);
    return offlineId;
  }

  async getOfflineTransactions(): Promise<Array<CreateTransactionRequest & { offline_id: string; created_at: string }>> {
    return await db.offlineTransactions.toArray();
  }

  async removeOfflineTransaction(offlineId: string): Promise<void> {
    await db.offlineTransactions.delete(offlineId);
  }

  async clearOfflineTransactions(): Promise<void> {
    await db.offlineTransactions.clear();
  }

  // Settings & Sync Queue
  async storeSetting(key: string, value: any): Promise<void> {
    await db.settings.put({ key, value, updated_at: new Date().toISOString() });
  }

  async getSetting(key: string): Promise<any> {
    const item = await db.settings.get(key);
    return item?.value;
  }

  async addToSyncQueue(type: string, data: any): Promise<void> {
    await db.syncQueue.add({
      type,
      data,
      status: 'pending',
      created_at: new Date().toISOString(),
      attempts: 0
    });
  }

  async getSyncQueue(): Promise<any[]> {
    return await db.syncQueue.orderBy('created_at').toArray();
  }

  async clearSyncQueue(): Promise<void> {
    await db.syncQueue.clear();
  }
}

// Export singleton
export const offlineDatabase = new DexieOfflineDatabase();
export const dexieDb = db; // Export raw instance if needed for hooks
export type { OfflineDatabase };
