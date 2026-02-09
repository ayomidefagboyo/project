/**
 * Offline Database Service - Dexie.js Implementation
 * Shared with POS for synchronized offline cache
 */

import Dexie, { type Table } from 'dexie';
import type { POSProduct, CreateTransactionRequest } from './posService';

// Extended Product type for indexing
interface IndexedPOSProduct extends POSProduct {
  name_tokens: string[]; // For full-text search
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

// Dexie Database Definition - SAME DATABASE NAME AS POS
export class POSDatabase extends Dexie {
  products!: Table<IndexedPOSProduct, string>;
  offlineTransactions!: Table<OfflineTransaction, string>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<SettingItem, string>;

  constructor() {
    super('CompazzPOS'); // SHARED DATABASE NAME WITH POS
    this.version(1).stores({
      products: 'id, outlet_id, [outlet_id+is_active], *name_tokens, barcode, sku, category',
      offlineTransactions: 'offline_id, outlet_id, created_at, status',
      syncQueue: '++id, type, status, created_at',
      settings: 'key'
    });
  }
}

// Singleton Dexie instance
const db = new POSDatabase();

// Tokenizer helper
const tokenize = (text: string): string[] => {
  return text.toLowerCase().split(/[\s\-_,.]+/).filter(t => t.length > 0);
};

// Interface compatible with previous implementation
interface OfflineDatabase {
  init(): Promise<void>;
  storeProducts(products: POSProduct[]): Promise<void>;
  getProducts(outletId: string): Promise<POSProduct[]>;
  searchProducts(outletId: string, query: string): Promise<POSProduct[]>;
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
    const indexedProducts: IndexedPOSProduct[] = products.map(p => ({
      ...p,
      name_tokens: tokenize(p.name),
      last_sync: new Date().toISOString()
    }));

    await db.products.bulkPut(indexedProducts);
  }

  async getProducts(outletId: string): Promise<POSProduct[]> {
    return await db.products
      .where('[outlet_id+is_active]')
      .equals([outletId, 1])
      .toArray();
  }

  async searchProducts(outletId: string, query: string): Promise<POSProduct[]> {
    const q = query.toLowerCase();

    // 1. Exact Barcode Match
    const barcodeMatch = await db.products
      .where('barcode').equals(query)
      .first();

    if (barcodeMatch) return [barcodeMatch];

    // 2. Exact SKU Match
    const skuMatch = await db.products.where('sku').equals(query).first();
    if (skuMatch) return [skuMatch];

    // 3. Name Search using Multi-Entry Index
    let results = await db.products
      .where('name_tokens')
      .startsWith(q)
      .distinct()
      .limit(50)
      .toArray();

    return results.filter(p => p.outlet_id === outletId && p.is_active);
  }

  async storeOfflineTransaction(transaction: CreateTransactionRequest): Promise<string> {
    const offlineId = `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

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
export const dexieDb = db;
export type { OfflineDatabase };
