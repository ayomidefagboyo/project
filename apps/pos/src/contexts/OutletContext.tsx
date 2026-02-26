import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import type { Outlet, Permission, BusinessSettings } from '@/types';
import { dataService } from '@/lib/dataService';
import { authService } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import {
  applyBrandColorToDocument,
  readBrandColorFromStorage,
  resolveBrandColorFromSettings,
} from '@/lib/brandTheme';

type CachedAuthState = { user: AuthUser; outlets: Outlet[]; outlet: Outlet | null; settings: BusinessSettings | null };

const buildDefaultOpeningHours = () => ({
  monday: { open: '08:00', close: '18:00', isOpen: true },
  tuesday: { open: '08:00', close: '18:00', isOpen: true },
  wednesday: { open: '08:00', close: '18:00', isOpen: true },
  thursday: { open: '08:00', close: '18:00', isOpen: true },
  friday: { open: '08:00', close: '18:00', isOpen: true },
  saturday: { open: '08:00', close: '18:00', isOpen: true },
  sunday: { open: '10:00', close: '16:00', isOpen: false },
});

const getTerminalConfiguredOutletSnapshot = (): Outlet | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('pos_terminal_config');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as { outlet_id?: string; outlet_name?: string };
    const outletId = typeof parsed?.outlet_id === 'string' ? parsed.outlet_id.trim() : '';
    const outletName = typeof parsed?.outlet_name === 'string' ? parsed.outlet_name.trim() : '';
    if (!outletId || !outletName) return null;

    const now = new Date().toISOString();
    return {
      id: outletId,
      name: outletName,
      businessType: 'retail',
      status: 'active',
      address: { street: '', city: '', state: '', zip: '', country: '' },
      phone: '',
      email: '',
      openingHours: buildDefaultOpeningHours(),
      taxRate: 0,
      currency: 'NGN',
      timezone: 'Africa/Lagos',
      createdAt: now,
      updatedAt: now,
    };
  } catch {
    return null;
  }
};

const getTerminalConfiguredOutletId = (): string | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('pos_terminal_config');
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { outlet_id?: string };
    const outletId = typeof parsed?.outlet_id === 'string' ? parsed.outlet_id.trim() : '';
    return outletId.length > 0 ? outletId : null;
  } catch {
    return null;
  }
};

const readCachedAuthState = (): CachedAuthState | null => {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem('pos_auth_cache');
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CachedAuthState;
    if (!parsed || !parsed.user || !Array.isArray(parsed.outlets)) return null;

    const terminalOutletId = getTerminalConfiguredOutletId();
    if (!terminalOutletId) return parsed;

    const terminalOutlet = parsed.outlets.find((outlet) => outlet.id === terminalOutletId) || null;

    // Guard against showing stale/wrong outlet on first paint.
    if (terminalOutlet) {
      return { ...parsed, outlet: terminalOutlet };
    }

    return { ...parsed, outlet: null };
  } catch {
    return null;
  }
};

interface OutletContextType {
  currentOutlet: Outlet | null;
  setCurrentOutlet: (outlet: Outlet | null) => void;
  userOutlets: Outlet[];
  setUserOutlets: (outlets: Outlet[]) => void;
  currentUser: AuthUser | null;
  setCurrentUser: (user: AuthUser | null) => void;
  businessSettings: BusinessSettings | null;
  setBusinessSettings: (settings: BusinessSettings | null) => void;
  hasPermission: (permission: Permission) => boolean;
  hasAnyPermission: (permissions: Permission[]) => boolean;
  isOutletAdmin: boolean;
  isSuperAdmin: boolean;
  isBusinessOwner: boolean;
  isLoading: boolean;
  refreshData: () => Promise<void>;
  loadOutletData: () => Promise<void>;
  reInitAuth: () => void; // Trigger re-init without full page reload
  // Multi-store helpers
  canViewAllOutlets: () => boolean;
  canCreateGlobalVendors: () => boolean;
  canApproveVendorInvoices: () => boolean;
  canViewConsolidatedReports: () => boolean;
  getAccessibleOutlets: () => string[];
}

const OutletContext = createContext<OutletContextType | undefined>(undefined);

interface OutletProviderProps {
  children: ReactNode;
}

export const OutletProvider: React.FC<OutletProviderProps> = ({ children }) => {
  // --- Instant restore from localStorage cache ---
  const terminalOutletSnapshot = getTerminalConfiguredOutletSnapshot();
  const cachedState = readCachedAuthState();
  const initialOutlet = cachedState?.outlet ?? terminalOutletSnapshot ?? null;
  const initialOutlets = cachedState?.outlet
    ? cachedState.outlets
    : initialOutlet
      ? [initialOutlet]
      : cachedState?.outlets ?? [];

  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(initialOutlet);
  const [userOutlets, setUserOutlets] = useState<Outlet[]>(initialOutlets);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(cachedState?.user ?? null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(cachedState?.settings ?? null);
  // Skip spinner only when cache includes a usable outlet snapshot.
  const [isLoading, setIsLoading] = useState(!initialOutlet);
  // Bump this to re-trigger initializeAuth (e.g. after login)
  const [authTrigger, setAuthTrigger] = useState(0);

  const pickPreferredOutlet = (outlets: Outlet[]): Outlet | null => {
    if (!outlets.length) return null;

    const terminalOutletId = getTerminalConfiguredOutletId();
    if (terminalOutletId) {
      const terminalOutlet = outlets.find((outlet) => outlet.id === terminalOutletId);
      if (terminalOutlet) return terminalOutlet;
    }

    const currentOutletMatch = currentOutlet?.id
      ? outlets.find((outlet) => outlet.id === currentOutlet.id)
      : null;
    if (currentOutletMatch) return currentOutletMatch;

    const cachedOutletMatch = cachedState?.outlet?.id
      ? outlets.find((outlet) => outlet.id === cachedState.outlet.id)
      : null;
    if (cachedOutletMatch) return cachedOutletMatch;

    const userOutletMatch = currentUser?.outletId
      ? outlets.find((outlet) => outlet.id === currentUser.outletId)
      : null;
    if (userOutletMatch) return userOutletMatch;

    return outlets[0];
  };

  // Apply cached/local brand color immediately for a consistent first paint.
  useEffect(() => {
    const initialColor = resolveBrandColorFromSettings(cachedState?.settings ?? null) || readBrandColorFromStorage();
    applyBrandColorToDocument(initialColor);
  }, []);

  // Callable from outside to re-initialize auth without page reload
  const reInitAuth = () => setAuthTrigger(prev => prev + 1);

  // Helper to persist auth cache
  const persistCache = (user: AuthUser, outlets: Outlet[], outlet: Outlet, settings: BusinessSettings | null) => {
    try {
      localStorage.setItem('pos_auth_cache', JSON.stringify({ user, outlets, outlet, settings }));
    } catch { /* quota exceeded, etc. */ }
  };

  // Check for existing session on mount (or when authTrigger changes)
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        const hasTerminalConfig = !!localStorage.getItem('pos_terminal_config');
        const canUseTerminalCache = hasTerminalConfig && !!(cachedState?.outlet || currentOutlet);

        // Only show spinner if we have NO cache AND no current user AND not just triggering a refresh
        if (!cachedState && !currentUser && authTrigger === 0) setIsLoading(true);

        // Handle OAuth callback if present
        if (window.location.hash.includes('access_token')) {
          try {
            const { error } = await authService.handleOAuthCallback();
            if (error) {
              console.error('OAuth callback error:', error);
            }
          } catch (error) {
            console.error('Error processing OAuth callback:', error);
          }
        }

        // Check if user is already authenticated
        const { session, error: sessionError } = await authService.getCurrentSession();

        // If there's a refresh token error, clear invalid session and continue
        if (sessionError && sessionError.includes('Invalid Refresh Token')) {
          if (canUseTerminalCache) {
            console.warn('Invalid refresh token detected; continuing in terminal mode with cached outlet context.');
            setCurrentUser(null);
            setIsLoading(false);
            return;
          }

          console.warn('Invalid refresh token detected, clearing session');
          await authService.signOut();
          localStorage.removeItem('pos_auth_cache');
          setCurrentUser(null);
          setIsLoading(false);
          return;
        }

        if (session?.user) {
          // Get current user profile (this handles OAuth user creation)
          const { user, error } = await authService.getCurrentUser();

          if (user && !error) {
            setCurrentUser(user);

            // Only load outlets and business data if user has completed onboarding
            if (user.outletId) {
              // Run outlets + settings queries in PARALLEL
              const [outletsResult, settingsResult] = await Promise.all([
                dataService.getUserOutlets(user.id),
                // Use cached outlet id for settings, or fetch after outlets
                cachedState?.outlet?.id
                  ? dataService.getBusinessSettings(cachedState.outlet.id)
                  : Promise.resolve({ data: null, error: null }),
              ]);

              const { data: outlets, error: outletsError } = outletsResult;

              if (outlets && !outletsError) {
                setUserOutlets(outlets);

                // Prefer terminal-configured outlet, then current/cached, then fallback.
                const targetOutlet = pickPreferredOutlet(outlets);
                if (targetOutlet) {
                  setCurrentOutlet(targetOutlet);

                  // If we didn't have a cached outlet id, fetch settings now
                  let settings = settingsResult?.data ?? null;
                  if (!settings && targetOutlet.id) {
                    const { data: freshSettings } = await dataService.getBusinessSettings(targetOutlet.id);
                    settings = freshSettings;
                  }
                  if (settings) {
                    setBusinessSettings(settings);
                  }

                  // Persist everything to cache for next instant load
                  persistCache(user, outlets, targetOutlet, settings);
                }
              } else if (outletsError) {
                console.error('Error loading outlets:', outletsError);
              }
            }
          } else if (error && error.includes('Invalid Refresh Token')) {
            if (canUseTerminalCache) {
              console.warn('Invalid refresh token in getCurrentUser; continuing in terminal mode with cached outlet context.');
              setCurrentUser(null);
              return;
            }

            console.warn('Invalid refresh token in getCurrentUser, clearing session');
            await authService.signOut();
            localStorage.removeItem('pos_auth_cache');
            setCurrentUser(null);
          } else if (error) {
            console.error('Error getting current user:', error);
            // If network error but we have cache, keep the cached state
            if (!cachedState) {
              setCurrentUser(null);
            }
          }
        } else {
          if (canUseTerminalCache) {
            // Terminal mode can continue with PIN-based staff auth even without manager session.
            setCurrentUser(null);
            return;
          }

          // No session and no terminal config cache: clear auth cache.
          localStorage.removeItem('pos_auth_cache');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (error instanceof Error && error.message.includes('Invalid Refresh Token')) {
          if (localStorage.getItem('pos_terminal_config') && (cachedState?.outlet || currentOutlet)) {
            console.warn('Clearing invalid refresh token error for terminal mode; keeping cached outlet context.');
            setCurrentUser(null);
            return;
          }
          console.warn('Clearing invalid session due to refresh token error');
          await authService.signOut();
          localStorage.removeItem('pos_auth_cache');
          setCurrentUser(null);
        }
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, [authTrigger]);

  // Load business settings when outlet changes
  useEffect(() => {
    const loadBusinessSettings = async () => {
      if (currentOutlet?.id) {
        try {
          const { data: settings, error } = await dataService.getBusinessSettings(currentOutlet.id);
          if (settings && !error) {
            setBusinessSettings(settings);
          } else {
            // Prevent stale settings from a different outlet remaining in memory.
            setBusinessSettings(null);
          }
        } catch (error) {
          console.error('Error loading business settings:', error);
          setBusinessSettings(null);
        }
      } else {
        setBusinessSettings(null);
      }
    };

    loadBusinessSettings();
  }, [currentOutlet]);

  useEffect(() => {
    applyBrandColorToDocument(resolveBrandColorFromSettings(businessSettings));
  }, [businessSettings]);

  const hasPermission = (permission: Permission): boolean => {
    if (!currentUser) return false;

    // Super admin and business owner have all permissions
    if (currentUser.role === 'super_admin' || currentUser.role === 'business_owner') return true;

    // Check if user has the specific permission
    return currentUser.permissions.includes(permission);
  };

  const hasAnyPermission = (permissions: Permission[]): boolean => {
    if (!currentUser) return false;

    // Super admin and business owner have all permissions
    if (currentUser.role === 'super_admin' || currentUser.role === 'business_owner') return true;

    // Check if user has any of the specified permissions
    return permissions.some(permission => currentUser.permissions.includes(permission));
  };

  // Multi-store permission helpers
  const canViewAllOutlets = (): boolean => {
    return hasPermission('view_all_outlets') || currentUser?.role === 'business_owner' || currentUser?.role === 'super_admin';
  };

  const canCreateGlobalVendors = (): boolean => {
    return hasPermission('create_global_vendors') || currentUser?.role === 'business_owner';
  };

  const canApproveVendorInvoices = (): boolean => {
    return hasPermission('approve_vendor_invoices') || currentUser?.role === 'business_owner';
  };

  const canViewConsolidatedReports = (): boolean => {
    return hasPermission('view_consolidated_reports') || currentUser?.role === 'business_owner' || currentUser?.role === 'super_admin';
  };

  const getAccessibleOutlets = (): string[] => {
    if (!currentUser) return [];

    // Business owners and super admins can see all outlets
    if (currentUser.role === 'business_owner' || currentUser.role === 'super_admin') {
      return userOutlets.map(outlet => outlet.id);
    }

    // Outlet admins and staff can only see their assigned outlets
    return userOutlets.filter(outlet =>
      // User is assigned to this outlet or it's the current outlet
      currentUser.outletId === outlet.id ||
      (currentUser as any).assignedOutlets?.includes(outlet.id)
    ).map(outlet => outlet.id);
  };

  const isOutletAdmin = currentUser?.role === 'outlet_admin';
  const isSuperAdmin = currentUser?.role === 'super_admin';
  const isBusinessOwner = currentUser?.role === 'business_owner';

  const loadOutletData = async () => {
    if (currentUser) {
      try {
        // Load user outlets after trial setup
        const { data: outlets, error: outletsError } = await dataService.getUserOutlets(currentUser.id);

        if (outlets && !outletsError) {
          setUserOutlets(outlets);

          const preferredOutlet = pickPreferredOutlet(outlets);
          if (preferredOutlet) {
            setCurrentOutlet(preferredOutlet);

            // Load business settings for the outlet
            if (preferredOutlet.id) {
              const { data: settings, error: settingsError } = await dataService.getBusinessSettings(preferredOutlet.id);
              if (settings && !settingsError) {
                setBusinessSettings(settings);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading outlet data:', error);
      }
    }
  };

  const refreshData = async () => {
    if (currentUser) {
      try {
        // Refresh user outlets
        const { data: outlets, error: outletsError } = await dataService.getUserOutlets(currentUser.id);

        if (outlets && !outletsError) {
          setUserOutlets(outlets);

          // Update current outlet if it still exists
          if (currentOutlet && !outlets.find(o => o.id === currentOutlet.id)) {
            setCurrentOutlet(pickPreferredOutlet(outlets));
          }
        }

        // Refresh business settings if outlet exists
        if (currentOutlet?.id) {
          const { data: settings, error: settingsError } = await dataService.getBusinessSettings(currentOutlet.id);
          if (settings && !settingsError) {
            setBusinessSettings(settings);
          }
        }
      } catch (error) {
        console.error('Error refreshing data:', error);
      }
    }
  };

  const value: OutletContextType = {
    currentOutlet,
    setCurrentOutlet,
    userOutlets,
    setUserOutlets,
    currentUser,
    setCurrentUser,
    businessSettings,
    setBusinessSettings,
    hasPermission,
    hasAnyPermission,
    isOutletAdmin,
    isSuperAdmin,
    isBusinessOwner,
    isLoading,
    refreshData,
    loadOutletData,
    reInitAuth,
    // Multi-store helpers
    canViewAllOutlets,
    canCreateGlobalVendors,
    canApproveVendorInvoices,
    canViewConsolidatedReports,
    getAccessibleOutlets,
  };

  return (
    <OutletContext.Provider value={value}>
      {children}
    </OutletContext.Provider>
  );
};

export const useOutlet = (): OutletContextType => {
  const context = useContext(OutletContext);
  if (context === undefined) {
    throw new Error('useOutlet must be used within an OutletProvider');
  }
  return context;
};
