const STAFF_SESSION_STORAGE_KEY = 'pos_staff_session';

const getSessionStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
};

const getLocalStorageSafe = (): Storage | null => {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
};

export const getStaffSessionRaw = (): string | null => {
  const sessionStorage = getSessionStorageSafe();
  const raw = sessionStorage?.getItem(STAFF_SESSION_STORAGE_KEY) || null;
  if (raw) return raw;

  // Ensure legacy persistent sessions do not bypass staff auth after app restart.
  const localStorage = getLocalStorageSafe();
  try {
    localStorage?.removeItem(STAFF_SESSION_STORAGE_KEY);
  } catch {
    // ignore
  }

  return null;
};

export const setStaffSessionRaw = (value: string): void => {
  const sessionStorage = getSessionStorageSafe();
  const localStorage = getLocalStorageSafe();
  sessionStorage?.setItem(STAFF_SESSION_STORAGE_KEY, value);
  // Explicitly clear legacy persistent key.
  localStorage?.removeItem(STAFF_SESSION_STORAGE_KEY);
};

export const clearStaffSession = (): void => {
  const sessionStorage = getSessionStorageSafe();
  const localStorage = getLocalStorageSafe();
  sessionStorage?.removeItem(STAFF_SESSION_STORAGE_KEY);
  localStorage?.removeItem(STAFF_SESSION_STORAGE_KEY);
};

export const getParsedStaffSession = <T = any>(): T | null => {
  const raw = getStaffSessionRaw();
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    clearStaffSession();
    return null;
  }
};

