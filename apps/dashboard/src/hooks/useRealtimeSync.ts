/**
 * Comprehensive Real-Time Sync Hook
 * Listens for changes across ALL POS tables
 */

import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeSyncOptions {
  outletId: string;
  enabled?: boolean;
  // Products
  onProductChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Transactions (Sales)
  onTransactionChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Inventory Movements
  onInventoryChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Stock Transfers
  onStockTransferChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Cash Drawer Sessions
  onCashDrawerChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Customers
  onCustomerChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Invoices
  onInvoiceChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
  // Staff
  onStaffChange?: (action: 'INSERT' | 'UPDATE' | 'DELETE', data: any) => void;
}

export function useRealtimeSync({
  outletId,
  enabled = true,
  onProductChange,
  onTransactionChange,
  onInventoryChange,
  onStockTransferChange,
  onCashDrawerChange,
  onCustomerChange,
  onInvoiceChange,
  onStaffChange
}: UseRealtimeSyncOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [channels, setChannels] = useState<RealtimeChannel[]>([]);
  const [syncStats, setSyncStats] = useState({
    products: 0,
    transactions: 0,
    inventory: 0,
    transfers: 0,
    cashDrawer: 0,
    customers: 0,
    invoices: 0,
    staff: 0
  });

  // Use refs to store callbacks so they don't trigger effect re-runs
  const callbacksRef = useRef({
    onProductChange,
    onTransactionChange,
    onInventoryChange,
    onStockTransferChange,
    onCashDrawerChange,
    onCustomerChange,
    onInvoiceChange,
    onStaffChange
  });

  // Update refs when callbacks change
  useEffect(() => {
    callbacksRef.current = {
      onProductChange,
      onTransactionChange,
      onInventoryChange,
      onStockTransferChange,
      onCashDrawerChange,
      onCustomerChange,
      onInvoiceChange,
      onStaffChange
    };
  });

  useEffect(() => {
    if (!enabled || !outletId) {
      setIsConnected(false);
      return;
    }

    console.log('🔴 Starting COMPREHENSIVE real-time sync for outlet:', outletId);
    const activeChannels: RealtimeChannel[] = [];

    // ==========================================
    // 1. PRODUCTS REAL-TIME
    // ==========================================
    if (callbacksRef.current.onProductChange) {
      const productChannel = supabase
        .channel(`products:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_products', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('📦 Product changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onProductChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, products: prev.products + 1 }));
          }
        )
        .subscribe((status) => {
          console.log('📡 Products channel:', status);
          setIsConnected(status === 'SUBSCRIBED');
        });
      activeChannels.push(productChannel);
    }

    // ==========================================
    // 2. TRANSACTIONS (SALES) REAL-TIME
    // ==========================================
    if (callbacksRef.current.onTransactionChange) {
      const transactionChannel = supabase
        .channel(`transactions:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_transactions', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('💰 Transaction changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onTransactionChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, transactions: prev.transactions + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Transactions channel:', status));
      activeChannels.push(transactionChannel);
    }

    // ==========================================
    // 3. INVENTORY MOVEMENTS REAL-TIME
    // ==========================================
    if (callbacksRef.current.onInventoryChange) {
      const inventoryChannel = supabase
        .channel(`inventory:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_stock_movements', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('📊 Inventory changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onInventoryChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, inventory: prev.inventory + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Inventory channel:', status));
      activeChannels.push(inventoryChannel);
    }

    // ==========================================
    // 4. STOCK TRANSFERS REAL-TIME
    // ==========================================
    if (callbacksRef.current.onStockTransferChange) {
      const transferChannel = supabase
        .channel(`transfers:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_stock_transfers', 
          filter: `from_outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('🚚 Stock transfer changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onStockTransferChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, transfers: prev.transfers + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Transfers channel:', status));
      activeChannels.push(transferChannel);
    }

    // ==========================================
    // 5. CASH DRAWER SESSIONS REAL-TIME
    // ==========================================
    if (callbacksRef.current.onCashDrawerChange) {
      const cashDrawerChannel = supabase
        .channel(`cash_drawer:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pos_cash_drawer_sessions', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('💵 Cash drawer changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onCashDrawerChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, cashDrawer: prev.cashDrawer + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Cash drawer channel:', status));
      activeChannels.push(cashDrawerChannel);
    }

    // ==========================================
    // 6. CUSTOMERS REAL-TIME
    // ==========================================
    if (callbacksRef.current.onCustomerChange) {
      const customerChannel = supabase
        .channel(`customers:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'customers', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('👤 Customer changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onCustomerChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, customers: prev.customers + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Customers channel:', status));
      activeChannels.push(customerChannel);
    }

    // ==========================================
    // 7. INVOICES REAL-TIME
    // ==========================================
    if (callbacksRef.current.onInvoiceChange) {
      const invoiceChannel = supabase
        .channel(`invoices:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'invoices', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('🧾 Invoice changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onInvoiceChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, invoices: prev.invoices + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Invoices channel:', status));
      activeChannels.push(invoiceChannel);
    }

    // ==========================================
    // 8. STAFF PROFILES REAL-TIME
    // ==========================================
    if (callbacksRef.current.onStaffChange) {
      const staffChannel = supabase
        .channel(`staff:${outletId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'staff_profiles', filter: `outlet_id=eq.${outletId}` },
          (payload) => {
            console.log('👥 Staff changed:', payload.eventType, payload.new || payload.old);
            callbacksRef.current.onStaffChange?.(payload.eventType as any, payload.eventType === 'DELETE' ? payload.old : payload.new);
            setSyncStats(prev => ({ ...prev, staff: prev.staff + 1 }));
          }
        )
        .subscribe((status) => console.log('📡 Staff channel:', status));
      activeChannels.push(staffChannel);
    }

    setChannels(activeChannels);

    // Cleanup all channels
    return () => {
      console.log('🔴 Stopping comprehensive real-time sync');
      activeChannels.forEach(channel => channel.unsubscribe());
      setIsConnected(false);
    };
  }, [outletId, enabled]); // Only depend on outletId and enabled, not callbacks

  return { 
    isConnected, 
    channels, 
    syncStats,
    totalSyncs: Object.values(syncStats).reduce((a, b) => a + b, 0)
  };
}
