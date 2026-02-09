/**
 * Real-time Products Hook for POS
 * Listens for product changes across all locations
 */

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { POSProduct } from '@/lib/posService';
import type { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeProductsOptions {
  outletId: string;
  enabled?: boolean;
  onProductAdded?: (product: POSProduct) => void;
  onProductUpdated?: (product: POSProduct) => void;
  onProductDeleted?: (productId: string) => void;
}

export function useRealtimeProducts({
  outletId,
  enabled = true,
  onProductAdded,
  onProductUpdated,
  onProductDeleted
}: UseRealtimeProductsOptions) {
  const [isConnected, setIsConnected] = useState(false);
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !outletId) {
      setIsConnected(false);
      return;
    }

    console.log('🔴 Starting real-time sync for products in outlet:', outletId);

    // Create a channel for this outlet's products
    const productChannel = supabase
      .channel(`products:${outletId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'pos_products',
          filter: `outlet_id=eq.${outletId}`
        },
        (payload) => {
          console.log('✅ Real-time: Product ADDED', payload.new);
          if (onProductAdded) {
            onProductAdded(payload.new as POSProduct);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'pos_products',
          filter: `outlet_id=eq.${outletId}`
        },
        (payload) => {
          console.log('✅ Real-time: Product UPDATED', payload.new);
          if (onProductUpdated) {
            onProductUpdated(payload.new as POSProduct);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'pos_products',
          filter: `outlet_id=eq.${outletId}`
        },
        (payload) => {
          console.log('✅ Real-time: Product DELETED', payload.old.id);
          if (onProductDeleted) {
            onProductDeleted(payload.old.id);
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
        setIsConnected(status === 'SUBSCRIBED');
      });

    setChannel(productChannel);

    // Cleanup
    return () => {
      console.log('🔴 Stopping real-time sync');
      productChannel.unsubscribe();
      setIsConnected(false);
    };
  }, [outletId, enabled, onProductAdded, onProductUpdated, onProductDeleted]);

  return { isConnected, channel };
}
