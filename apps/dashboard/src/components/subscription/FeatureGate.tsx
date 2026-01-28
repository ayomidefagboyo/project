import React from 'react';
import { SubscriptionMiddleware } from '@/lib/subscriptionMiddleware';
import { SubscriptionFeatures } from '@/types';

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