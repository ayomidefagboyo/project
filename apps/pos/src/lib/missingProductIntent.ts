export interface MissingProductIntent {
  barcode: string;
  created_at: string;
  source?: 'register_scan' | 'receive_scan';
}

const STORAGE_KEY = 'pos_missing_product_intent_v1';

const canUseSessionStorage = (): boolean =>
  typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined';

export const setMissingProductIntent = (intent: MissingProductIntent): void => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(intent));
  } catch {
    // Ignore storage failures (private mode/quota exceeded).
  }
};

export const peekMissingProductIntent = (): MissingProductIntent | null => {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as MissingProductIntent;
    if (!parsed?.barcode || typeof parsed.barcode !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
};

export const clearMissingProductIntent = (): void => {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
};
