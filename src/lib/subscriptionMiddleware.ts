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
          return <div>Loading...</div>;
        }

        if (!hasAccess) {
          if (fallbackComponent) {
            const FallbackComponent = fallbackComponent;
            return <FallbackComponent {...props} />;
          }
          return <div>Feature not available in your current plan</div>;
        }

        return <WrappedComponent {...props} />;
      };
    };
  }

  // React hook for feature access
  static useFeatureAccess(userId: string, feature: keyof SubscriptionFeatures) {
    const [hasAccess, setHasAccess] = React.useState<boolean | null>(null);
    const [loading, setLoading] = React.useState(true);

    React.useEffect(() => {
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
      Promise.all([
        subscriptionService.getUserOutletCount(userId),
        subscriptionService.getUserSubscription(userId)
      ]).then(([count, subscription]) => {
        setCurrentCount(count);
        const max = subscription?.features.maxOutlets || 1;
        setMaxOutlets(max);
        setCanAddOutlet(max === -1 || count < max);
        setLoading(false);
      }).catch(() => {
        setLoading(false);
      });
    }, [userId]);

    return { canAddOutlet, currentCount, maxOutlets, loading };
  }
}

// Feature gate component
export function FeatureGate({
  userId,
  feature,
  children,
  fallback
}: {
  userId: string;
  feature: keyof SubscriptionFeatures;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { hasAccess, loading } = SubscriptionMiddleware.useFeatureAccess(userId, feature);

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!hasAccess) {
    return fallback || (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          This feature is not available in your current plan.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}

// Outlet limit component
export function OutletLimitGate({
  userId,
  children,
  fallback
}: {
  userId: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}) {
  const { canAddOutlet, currentCount, maxOutlets, loading } = SubscriptionMiddleware.useOutletLimit(userId);

  if (loading) {
    return <div className="animate-pulse">Loading...</div>;
  }

  if (!canAddOutlet) {
    return fallback || (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-sm text-gray-600">
          You've reached your outlet limit ({currentCount}/{maxOutlets === -1 ? 'unlimited' : maxOutlets}).
          Upgrade your plan to add more outlets.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}