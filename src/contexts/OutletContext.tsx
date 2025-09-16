import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Outlet, User, Permission, BusinessSettings } from '@/types';
import { dataService } from '@/lib/dataService';
import { authService, AuthUser } from '@/lib/auth';

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
  const [currentOutlet, setCurrentOutlet] = useState<Outlet | null>(null);
  const [userOutlets, setUserOutlets] = useState<Outlet[]>([]);
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [businessSettings, setBusinessSettings] = useState<BusinessSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Check for existing session on mount
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        setIsLoading(true);

        // Handle OAuth callback if present
        if (window.location.hash.includes('access_token')) {
          try {
            const { data, error } = await authService.handleOAuthCallback();
            if (error) {
              console.error('OAuth callback error:', error);
            }
          } catch (error) {
            console.error('Error processing OAuth callback:', error);
          }
        }

        // Check if user is already authenticated
        const { session } = await authService.getCurrentSession();
        
        if (session?.user) {
          // Get current user profile
          const { user, error } = await authService.getCurrentUser();
          
          if (user && !error) {
            setCurrentUser(user);

            // Only load outlets and business data if user has completed onboarding
            // This prevents loading issues for new users who haven't set up their trial yet
            if (user.outletId) {
              // Get user's outlets
              const { data: outlets, error: outletsError } = await dataService.getUserOutlets(user.id);

              if (outlets && !outletsError) {
                setUserOutlets(outlets);

                // Set first outlet as current if none selected
                if (outlets.length > 0 && !currentOutlet) {
                  setCurrentOutlet(outlets[0]);

                  // Load business settings for the outlet
                  const { data: settings, error: settingsError } = await dataService.getBusinessSettings(outlets[0].id);
                  if (settings && !settingsError) {
                    setBusinessSettings(settings);
                  }
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeAuth();
  }, []);

  // Load business settings when outlet changes
  useEffect(() => {
    const loadBusinessSettings = async () => {
      if (currentOutlet) {
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
            const { data: settings, error: settingsError } = await dataService.getBusinessSettings(outlets[0].id);
            if (settings && !settingsError) {
              setBusinessSettings(settings);
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
        if (currentOutlet) {
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
