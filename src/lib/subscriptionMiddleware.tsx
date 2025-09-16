import React from 'react';
import { subscriptionService } from './subscriptionService';
import { SubscriptionFeatures } from '@/types';

export class SubscriptionMiddleware {
  // Check if user has access to a specific feature
  static async checkFeatureAccess(
    userId: string,
    feature: keyof SubscriptionFeatures,
    onAccessDenied?: () => void
  ): Promise<boolean> {
    try {
      // First check if user has started trial
      const { supabase } = await import('../lib/supabase');
      const { data: userProfile, error: userError } = await supabase
        .from('users')
        .select('trial_started_at')
        .eq('id', userId)
        .single();

      const trialStarted = !userError && userProfile?.trial_started_at;

      if (!trialStarted) {
        // User hasn't started trial yet - give them access to all features during onboarding
        return true;
      }

      // User has started trial - check their subscription
      const hasAccess = await subscriptionService.hasFeatureAccess(userId, feature);

      if (!hasAccess && onAccessDenied) {
        onAccessDenied();
      }

      return hasAccess;
    } catch (error) {
      console.error('Error checking feature access:', error);
      return false;
    }
  }

  // Check outlet limit before creating new outlet
  static async checkOutletLimit(
    userId: string,
    onLimitExceeded?: () => void
  ): Promise<boolean> {
    try {
      const currentCount = await subscriptionService.getUserOutletCount(userId);
      const canAdd = await subscriptionService.canAddOutlet(userId, currentCount);

      if (!canAdd && onLimitExceeded) {
        onLimitExceeded();
      }

      return canAdd;
    } catch (error) {
      console.error('Error checking outlet limit:', error);
      return false;
    }
  }

  // Higher-order component for feature gating
  static withFeatureGate<T extends Record<string, any>>(
    feature: keyof SubscriptionFeatures,
    fallbackComponent?: React.ComponentType<T>
  ) {
    return function (WrappedComponent: React.ComponentType<T>) {
      return function FeatureGatedComponent(props: T & { userId: string }) {
        const [hasAccess, setHasAccess] = React.useState<boolean | null>(null);

        React.useEffect(() => {
          SubscriptionMiddleware.checkFeatureAccess(props.userId, feature)
            .then(setHasAccess);
        }, [props.userId, feature]);

        if (hasAccess === null) {
          return React.createElement('div', null, 'Loading...');
        }

        if (!hasAccess) {
          if (fallbackComponent) {
            const FallbackComponent = fallbackComponent;
            return React.createElement(FallbackComponent, props);
          }
          return React.createElement('div', null, 'Feature not available in your current plan');
        }

        return React.createElement(WrappedComponent, props);
      };
    };
  }

  // React hook for feature access
  static useFeatureAccess(userId: string, feature: keyof SubscriptionFeatures) {
    const [hasAccess, setHasAccess] = React.useState<boolean | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
      if (!userId) {
        setLoading(false);
        return;
      }

      SubscriptionMiddleware.checkFeatureAccess(userId, feature)
        .then((access) => {
          setHasAccess(access);
          setLoading(false);
        })
        .catch(() => {
          setHasAccess(false);
          setLoading(false);
        });
    }, [userId, feature]);

    return { hasAccess, loading };
  }

  // React hook for outlet limit checking
  static useOutletLimit(userId: string) {
    const [canAddOutlet, setCanAddOutlet] = React.useState<boolean | null>(null);
    const [currentCount, setCurrentCount] = React.useState<number>(0);
    const [maxOutlets, setMaxOutlets] = React.useState<number>(0);
    const [loading, setLoading] = React.useState(true);
    const [hasStartedTrial, setHasStartedTrial] = React.useState<boolean | null>(null);

    React.useEffect(() => {
      if (!userId) {
        setLoading(false);
        return;
      }

      // First check if user has started trial or has subscription
      import('../lib/supabase').then(({ supabase }) => {
        supabase
          .from('users')
          .select('trial_started_at')
          .eq('id', userId)
          .single()
          .then(({ data: userProfile, error: userError }) => {
            const trialStarted = !userError && userProfile?.trial_started_at;
            setHasStartedTrial(!!trialStarted);

            if (!trialStarted) {
              // User hasn't started trial yet - give them unlimited access during onboarding
              setCurrentCount(0);
              setMaxOutlets(-1); // Unlimited during onboarding
              setCanAddOutlet(true);
              setLoading(false);
              return;
            }

            // User has started trial - check their subscription
            Promise.all([
              subscriptionService.getUserOutletCount(userId),
              subscriptionService.getUserSubscription(userId)
            ]).then(([count, subscription]) => {
              setCurrentCount(count);
              // Default to startup plan features if no subscription
              const max = subscription?.features.maxOutlets || subscriptionService.getPlanConfig('startup').features.maxOutlets;
              setMaxOutlets(max);
              setCanAddOutlet(max === -1 || count < max);
              setLoading(false);
            }).catch((error) => {
              console.warn('Error loading outlet limits, defaulting to startup plan:', error);
              // Fallback to startup plan limits on error
              setCurrentCount(0);
              setMaxOutlets(1);
              setCanAddOutlet(true);
              setLoading(false);
            });
          });
      });
    }, [userId]);

    return { canAddOutlet, currentCount, maxOutlets, loading, hasStartedTrial };
  }
}

