import { subscriptionService } from './subscriptionService';
import { SubscriptionFeatures } from '@/types';
import { apiClient } from './apiClient';

const DEFAULT_OPENING_HOURS = {
  monday: { open: '09:00', close: '17:00', isOpen: true },
  tuesday: { open: '09:00', close: '17:00', isOpen: true },
  wednesday: { open: '09:00', close: '17:00', isOpen: true },
  thursday: { open: '09:00', close: '17:00', isOpen: true },
  friday: { open: '09:00', close: '17:00', isOpen: true },
  saturday: { open: '09:00', close: '17:00', isOpen: true },
  sunday: { open: '09:00', close: '17:00', isOpen: false },
};

const normalizeText = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : fallback;
};

const normalizeAddress = (address: unknown): Record<string, string> => {
  if (typeof address === 'string') {
    const city = address.trim();
    return {
      street: '',
      city,
      state: '',
      zip: '',
      country: '',
    };
  }

  if (address && typeof address === 'object') {
    const addressObject = address as Record<string, unknown>;
    return {
      street: normalizeText(addressObject.street, ''),
      city: normalizeText(addressObject.city, ''),
      state: normalizeText(addressObject.state, ''),
      zip: normalizeText(addressObject.zip ?? addressObject.zipCode, ''),
      country: normalizeText(addressObject.country, ''),
    };
  }

  return {
    street: '',
    city: '',
    state: '',
    zip: '',
    country: '',
  };
};

const normalizeOutletPayload = (outletData: Record<string, unknown>): Record<string, unknown> => {
  const businessType = normalizeText(outletData.business_type ?? outletData.businessType, 'retail');
  const openingHours = (outletData.opening_hours ?? outletData.openingHours) || DEFAULT_OPENING_HOURS;
  const timezone =
    normalizeText(outletData.timezone, '') || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

  const payload: Record<string, unknown> = {
    name: normalizeText(outletData.name, 'New Outlet'),
    business_type: businessType,
    status: normalizeText(outletData.status, 'active'),
    address: normalizeAddress(outletData.address),
    phone: normalizeText(outletData.phone, 'Not provided'),
    email: normalizeText(outletData.email, 'not-provided@compazz.app'),
    opening_hours: openingHours,
    timezone,
  };

  const taxRate = outletData.tax_rate ?? outletData.taxRate;
  if (typeof taxRate === 'number') {
    payload.tax_rate = taxRate;
  }

  const currency = normalizeText(outletData.currency, '');
  if (currency) {
    payload.currency = currency;
  }

  return payload;
};

export class ApiMiddleware {
  // Middleware to check feature access for API routes
  static async checkFeatureAccess(
    userId: string,
    feature: keyof SubscriptionFeatures
  ): Promise<{ allowed: boolean; error?: string }> {
    try {
      const hasAccess = await subscriptionService.hasFeatureAccess(userId, feature);

      if (!hasAccess) {
        return {
          allowed: false,
          error: `This feature (${feature}) is not available in your current plan. Please upgrade to access this functionality.`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking feature access:', error);
      return {
        allowed: false,
        error: 'Unable to verify feature access. Please try again.'
      };
    }
  }

  // Check outlet limit for API routes
  static async checkOutletLimit(userId: string): Promise<{ allowed: boolean; error?: string }> {
    try {
      const currentCount = await subscriptionService.getUserOutletCount(userId);
      const canAdd = await subscriptionService.canAddOutlet(userId, currentCount);

      if (!canAdd) {
        const subscription = await subscriptionService.getUserSubscription(userId);
        const maxOutlets = subscription?.features.maxOutlets || 1;

        return {
          allowed: false,
          error: `You have reached your outlet limit (${currentCount}/${maxOutlets === -1 ? 'unlimited' : maxOutlets}). Please upgrade your plan to add more outlets.`
        };
      }

      return { allowed: true };
    } catch (error) {
      console.error('Error checking outlet limit:', error);
      return {
        allowed: false,
        error: 'Unable to verify outlet limits. Please try again.'
      };
    }
  }

  // Enhanced API client wrapper with subscription checks
  static async makeApiCall(
    apiCall: () => Promise<any>,
    options: {
      userId: string;
      requiredFeature?: keyof SubscriptionFeatures;
      checkOutletLimit?: boolean;
    }
  ): Promise<{ data?: any; error?: string }> {
    try {
      // Check feature access if required
      if (options.requiredFeature) {
        const featureCheck = await this.checkFeatureAccess(options.userId, options.requiredFeature);
        if (!featureCheck.allowed) {
          return { error: featureCheck.error };
        }
      }

      // Check outlet limit if required
      if (options.checkOutletLimit) {
        const outletCheck = await this.checkOutletLimit(options.userId);
        if (!outletCheck.allowed) {
          return { error: outletCheck.error };
        }
      }

      // Make the API call
      const result = await apiCall();
      return { data: result };
    } catch (error) {
      console.error('API call error:', error);
      return {
        error: error instanceof Error ? error.message : 'An error occurred while processing your request.'
      };
    }
  }
}

// Feature-gated API functions
export const gatedApiCalls = {
  // Advanced analytics endpoints
  exportDashboardReport: async (userId: string, reportData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Export logic here
        return { success: true, data: reportData };
      },
      { userId, requiredFeature: 'advancedAnalytics' }
    );
  },

  // Multi-location management
  createGlobalVendor: async (userId: string, vendorData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Create global vendor logic
        return { success: true, vendor: vendorData };
      },
      { userId, requiredFeature: 'multiLocationManagement' }
    );
  },

  // Outlet creation
  createOutlet: async (userId: string, outletData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        const normalizedPayload = normalizeOutletPayload(outletData as Record<string, unknown>);
        const response = await apiClient.post<any>('/outlets', normalizedPayload);

        if (response.error || !response.data) {
          throw new Error(response.error || 'Failed to create outlet');
        }

        return { success: true, outlet: response.data };
      },
      { userId, checkOutletLimit: true }
    );
  },

  // Staff management features
  createStaffMember: async (userId: string, staffData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Create staff member logic
        return { success: true, staff: staffData };
      },
      { userId, requiredFeature: 'staffManagement' }
    );
  },

  // Advanced reporting
  generateCustomReport: async (userId: string, reportConfig: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Generate custom report logic
        return { success: true, report: reportConfig };
      },
      { userId, requiredFeature: 'customReports' }
    );
  },

  // API access
  createApiKey: async (userId: string, keyData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Create API key logic
        return { success: true, apiKey: keyData };
      },
      { userId, requiredFeature: 'apiAccess' }
    );
  },

  // Loyalty programs
  createLoyaltyProgram: async (userId: string, programData: any) => {
    return ApiMiddleware.makeApiCall(
      async () => {
        // Create loyalty program logic
        return { success: true, program: programData };
      },
      { userId, requiredFeature: 'loyaltyPrograms' }
    );
  }
};
