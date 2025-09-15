import { supabase } from './supabase';
import { SubscriptionPlan, Subscription, SubscriptionFeatures, PlanConfig } from '@/types';

export class SubscriptionService {
  // Plan configurations
  private planConfigs: Record<SubscriptionPlan, PlanConfig> = {
    startup: {
      name: 'Startup Plan',
      description: 'Perfect for single-location businesses. Includes core POS functionality, basic inventory management, and standard reporting for 1 outlet.',
      features: {
        maxOutlets: 1,
        corePos: true,
        basicInventory: true,
        standardReporting: true,
        emailSupport: true,
        mobileApp: true,
        basicPayments: true,
        multiLocationManagement: false,
        advancedAnalytics: false,
        staffManagement: false,
        inventorySync: false,
        prioritySupport: false,
        loyaltyPrograms: false,
        advancedPayments: false,
        apiAccess: false,
        customBranding: false,
        dedicatedAccountManager: false,
        advancedSecurity: false,
        customReports: false,
        phoneSupport: false,
        priorityFeatures: false,
      },
      pricing: {
        monthly: {
          USD: 29,
          EUR: 25,
          GBP: 22,
        },
      },
      stripePriceIds: {
        monthly: {
          USD: 'price_startup_usd_monthly',
          EUR: 'price_startup_eur_monthly',
          GBP: 'price_startup_gbp_monthly',
        },
      },
    },
    business: {
      name: 'Business Plan',
      description: 'Ideal for growing businesses with up to 5 locations. Features multi-location management, advanced analytics, staff permissions, and priority support.',
      features: {
        maxOutlets: 5,
        corePos: true,
        basicInventory: true,
        standardReporting: true,
        emailSupport: true,
        mobileApp: true,
        basicPayments: true,
        multiLocationManagement: true,
        advancedAnalytics: true,
        staffManagement: true,
        inventorySync: true,
        prioritySupport: true,
        loyaltyPrograms: true,
        advancedPayments: true,
        apiAccess: false,
        customBranding: false,
        dedicatedAccountManager: false,
        advancedSecurity: false,
        customReports: false,
        phoneSupport: false,
        priorityFeatures: false,
      },
      pricing: {
        monthly: {
          USD: 79,
          EUR: 69,
          GBP: 59,
        },
      },
      stripePriceIds: {
        monthly: {
          USD: 'price_business_usd_monthly',
          EUR: 'price_business_eur_monthly',
          GBP: 'price_business_gbp_monthly',
        },
      },
    },
    enterprise: {
      name: 'Enterprise Plan',
      description: 'Comprehensive solution for large businesses with unlimited outlets. Includes API access, custom branding, dedicated support, and advanced integrations.',
      features: {
        maxOutlets: -1, // Unlimited
        corePos: true,
        basicInventory: true,
        standardReporting: true,
        emailSupport: true,
        mobileApp: true,
        basicPayments: true,
        multiLocationManagement: true,
        advancedAnalytics: true,
        staffManagement: true,
        inventorySync: true,
        prioritySupport: true,
        loyaltyPrograms: true,
        advancedPayments: true,
        apiAccess: true,
        customBranding: true,
        dedicatedAccountManager: true,
        advancedSecurity: true,
        customReports: true,
        phoneSupport: true,
        priorityFeatures: true,
      },
      pricing: {
        monthly: {
          USD: 199,
          EUR: 179,
          GBP: 149,
        },
      },
      stripePriceIds: {
        monthly: {
          USD: 'price_enterprise_usd_monthly',
          EUR: 'price_enterprise_eur_monthly',
          GBP: 'price_enterprise_gbp_monthly',
        },
      },
    },
  };

  // Get user's current subscription
  async getUserSubscription(userId: string): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.error('Error fetching subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in getUserSubscription:', error);
      return null;
    }
  }

  // Get plan configuration
  getPlanConfig(plan: SubscriptionPlan): PlanConfig {
    return this.planConfigs[plan];
  }

  // Get all plan configurations
  getAllPlanConfigs(): Record<SubscriptionPlan, PlanConfig> {
    return this.planConfigs;
  }

  // Check if user has feature access
  async hasFeatureAccess(userId: string, feature: keyof SubscriptionFeatures): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      // Default to startup plan features if no subscription
      return this.planConfigs.startup.features[feature];
    }

    return subscription.features[feature];
  }

  // Check outlet limit
  async canAddOutlet(userId: string, currentOutletCount: number): Promise<boolean> {
    const subscription = await this.getUserSubscription(userId);

    if (!subscription) {
      // Default to startup plan limit
      return currentOutletCount < this.planConfigs.startup.features.maxOutlets;
    }

    const maxOutlets = subscription.features.maxOutlets;
    return maxOutlets === -1 || currentOutletCount < maxOutlets;
  }

  // Get current outlet count for user
  async getUserOutletCount(userId: string): Promise<number> {
    try {
      // Query users table to find outlets associated with this user
      const { data, error } = await supabase
        .from('users')
        .select('outlet_id')
        .eq('id', userId)
        .not('outlet_id', 'is', null);

      if (error) {
        console.error('Error counting outlets:', error);
        return 0;
      }

      // Count unique outlet_ids for this user
      const uniqueOutlets = new Set(data?.map(user => user.outlet_id));
      return uniqueOutlets.size;
    } catch (error) {
      console.error('Error in getUserOutletCount:', error);
      return 0;
    }
  }

  // Create or update subscription
  async createSubscription(subscriptionData: Partial<Subscription>): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .insert(subscriptionData)
        .select()
        .single();

      if (error) {
        console.error('Error creating subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in createSubscription:', error);
      return null;
    }
  }

  // Update subscription
  async updateSubscription(subscriptionId: string, updates: Partial<Subscription>): Promise<Subscription | null> {
    try {
      const { data, error } = await supabase
        .from('subscriptions')
        .update(updates)
        .eq('id', subscriptionId)
        .select()
        .single();

      if (error) {
        console.error('Error updating subscription:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error in updateSubscription:', error);
      return null;
    }
  }

  // Cancel subscription
  async cancelSubscription(subscriptionId: string): Promise<boolean> {
    try {
      const { error } = await supabase
        .from('subscriptions')
        .update({ status: 'cancelled' })
        .eq('id', subscriptionId);

      if (error) {
        console.error('Error cancelling subscription:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error in cancelSubscription:', error);
      return false;
    }
  }

  // Get pricing for region
  getPricingForRegion(plan: SubscriptionPlan, currency: 'USD' | 'EUR' | 'GBP'): number {
    return this.planConfigs[plan].pricing.monthly[currency];
  }

  // Get Stripe price ID for region
  getStripePriceId(plan: SubscriptionPlan, currency: 'USD' | 'EUR' | 'GBP'): string {
    return this.planConfigs[plan].stripePriceIds.monthly[currency];
  }

  // Detect user's currency based on location (basic implementation)
  detectUserCurrency(countryCode?: string): 'USD' | 'EUR' | 'GBP' {
    if (!countryCode) return 'USD';

    const europeanCountries = ['DE', 'FR', 'IT', 'ES', 'NL', 'BE', 'AT', 'PT', 'IE', 'FI', 'GR', 'LU', 'MT', 'CY', 'SK', 'SI', 'EE', 'LV', 'LT'];
    const gbpCountries = ['GB', 'UK'];

    if (gbpCountries.includes(countryCode)) return 'GBP';
    if (europeanCountries.includes(countryCode)) return 'EUR';

    return 'USD';
  }
}

export const subscriptionService = new SubscriptionService();