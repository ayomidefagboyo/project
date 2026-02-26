import type { SaleUnit } from './posService';

export interface RefundExchangeIntentLine {
  product_id: string;
  product_name?: string;
  sku?: string;
  sale_unit?: SaleUnit;
  quantity: number;
  unit_price: number;
  discount_per_unit?: number;
  units_per_sale_unit?: number;
}

export interface RefundExchangeIntent {
  original_transaction_id: string;
  original_transaction_number?: string;
  outlet_id?: string;
  return_reason?: string;
  created_at: string;
  lines: RefundExchangeIntentLine[];
}

const STORAGE_KEY = 'pos_refund_exchange_intent_v1';

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const setRefundExchangeIntent = (intent: RefundExchangeIntent): void => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage failures.
  }
};

export const consumeRefundExchangeIntent = (): RefundExchangeIntent | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    window.sessionStorage.removeItem(STORAGE_KEY);
    const parsed = JSON.parse(raw) as RefundExchangeIntent;
    if (!parsed || typeof parsed.original_transaction_id !== 'string') {
      return null;
    }
    if (!Array.isArray(parsed.lines) || parsed.lines.length === 0) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

export const clearRefundExchangeIntent = (): void => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};
