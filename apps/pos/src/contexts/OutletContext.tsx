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
  const cachedState = (() => {
    try {
      const raw = localStorage.getItem('pos_auth_cache');
      if (raw) return JSON.parse(raw) as { user: AuthUser; outlets: Outlet[]; outlet: Outlet; settings: BusinessSettings | null };
    } catch { /* ignore */ }
    return null;
  })();

  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(cachedState?.outlet ?? null);
  const [userOutlets, setUserOutlets] = useState<Outlet[]>(cachedState?.outlets ?? []);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(cachedState?.user ?? null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(cachedState?.settings ?? null);
  // If we have a cache, skip the loading spinner entirely
  const [isLoading, setIsLoading] = useState(!cachedState);
  // Bump this to re-trigger initializeAuth (e.g. after login)
  const [authTrigger, setAuthTrigger] = useState(0);

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
        // Only show spinner if we have NO cache
        if (!cachedState) setIsLoading(true);

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

                // Set first outlet as current if none selected
                const targetOutlet = outlets[0];
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
          // No session — clear cache and user
          localStorage.removeItem('pos_auth_cache');
          setCurrentUser(null);
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
        if (error instanceof Error && error.message.includes('Invalid Refresh Token')) {
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
          }
        } catch (error) {
          console.error('Error loading business settings:', error);
        }
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

          // Set first outlet as current
          if (outlets.length > 0) {
            setCurrentOutlet(outlets[0]);

            // Load business settings for the outlet
            if (outlets[0]?.id) {
              const { data: settings, error: settingsError } = await dataService.getBusinessSettings(outlets[0].id);
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
            setCurrentOutlet(outlets[0] || null);
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
