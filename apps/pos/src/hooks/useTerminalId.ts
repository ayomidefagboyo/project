import { useEffect, useState } from 'react';
import { useOutlet } from '@/contexts/OutletContext';

/**
 * Generate a stable-looking terminal ID for an outlet.
 * This is stored in localStorage so the same browser/device
 * keeps the same terminal identity across reloads.
 */
function generateTerminalId(outletId: string): string {
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `terminal-${outletId}-${random}`;
}

/**
 * Hook that returns a stable terminalId for the current outlet.
 * - Persists per-outlet in localStorage.
 * - Returns null while outlet is not yet known.
 */
export function useTerminalId(): { terminalId: string | null } {
  const { currentOutlet } = useOutlet();
  const outletId = currentOutlet?.id;
  const [terminalId, setTerminalId] = useState<string | null>(null);

  useEffect(() => {
    if (!outletId) {
      setTerminalId(null);
      return;
    }

    const storageKey = `pos_terminal_id_${outletId}`;

    try {
      const existing = localStorage.getItem(storageKey);
      if (existing) {
        setTerminalId(existing);
        return;
      }

      const created = generateTerminalId(outletId);
      localStorage.setItem(storageKey, created);
      setTerminalId(created);
    } catch {
      // If localStorage is unavailable, fall back to a non-persistent ID
      setTerminalId(generateTerminalId(outletId));
    }
  }, [outletId]);

  return { terminalId };
}

