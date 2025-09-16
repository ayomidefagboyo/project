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
      // Check subscription for feature access
      const hasAccess = await subscriptionService.hasFeatureAccess(userId, feature);

      if (!hasAccess && onAccessDenied) {
        onAccessDenied();
      }

      return hasAccess;
    } catch (error) {
      console.error('Error checking feature access:', error);
      // Allow access during onboarding if subscription check fails
      return true;
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

    React.useEffect(() => {
      if (!userId) {
        setLoading(false);
        return;
      }

      // Check subscription for outlet limits
      Promise.all([
        subscriptionService.getUserOutletCount(userId),
        subscriptionService.getUserSubscription(userId)
      ]).then(([count, subscription]) => {
        setCurrentCount(count);

        if (!subscription) {
          // No subscription yet - give unlimited access during onboarding
          setMaxOutlets(-1);
          setCanAddOutlet(true);
        } else {
          // Use subscription limits
          const max = subscription.features.maxOutlets;
          setMaxOutlets(max);
          setCanAddOutlet(max === -1 || count < max);
        }
        setLoading(false);
      }).catch((error) => {
        console.warn('Error loading outlet limits, allowing access during onboarding:', error);
        // Fallback to unlimited access during onboarding
        setCurrentCount(0);
        setMaxOutlets(-1);
        setCanAddOutlet(true);
        setLoading(false);
      });
    }, [userId]);

    return { canAddOutlet, currentCount, maxOutlets, loading };
  }
}

