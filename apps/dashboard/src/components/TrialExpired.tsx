import React, { useState } from 'react';
import { Clock, CreditCard, Star, ArrowRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { paymentPlans } from '@/lib/stripe';
import stripeService from '@/lib/stripeService';
import { useNavigate } from 'react-router-dom';
import { trackEvent, trackTrialEvent, trackSubscriptionEvent } from '@/lib/posthog';
import { resolveApiBaseUrl } from '../../../../shared/services/urlResolver';

interface TrialExpiredProps {
  currentPlan?: string;
  daysRemaining?: number;
  onUpgrade?: () => void;
}

const TrialExpired: React.FC<TrialExpiredProps> = ({
  currentPlan = 'business',
  daysRemaining = 0,
  onUpgrade
}) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleUpgrade = async (planId: string) => {
    setLoadingPlan(planId);

    // Track upgrade attempt
    trackEvent('upgrade_attempt', {
      plan_id: planId,
      days_remaining: daysRemaining,
      is_expired: isExpired,
      current_plan: currentPlan
    });

    try {
      const backendUrl = resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL);
      const shouldUseLiveBilling = backendUrl.source !== 'local_fallback';

      if (shouldUseLiveBilling) {
        // Production: Use Stripe checkout for immediate billing
        const successUrl = `${window.location.origin}/dashboard?payment=success&upgrade=true`;
        const cancelUrl = `${window.location.origin}/dashboard?payment=cancelled`;

        const response = await stripeService.createSubscriptionCheckout(
          planId,
          successUrl,
          cancelUrl,
          0 // No trial for upgrades
        );

        // Track successful upgrade initiation
        trackSubscriptionEvent('created', planId);
        trackTrialEvent('upgraded', planId, daysRemaining);

        await stripeService.redirectToCheckout((response as any).sessionId);
      } else {
        // Development: Simulate upgrade success
        onUpgrade?.();
        navigate('/dashboard?upgrade=success');
      }
    } catch (error) {
      console.error('Error upgrading subscription:', error);
      alert('Failed to upgrade. Please try again.');
    } finally {
      setLoadingPlan(null);
    }
  };

  const isExpired = daysRemaining <= 0;
  const plan = paymentPlans[currentPlan as keyof typeof paymentPlans];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 max-w-2xl w-full p-8">
        <div className="text-center space-y-6">
          {/* Icon */}
          <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
            isExpired
              ? 'bg-red-50 dark:bg-red-900/20'
              : 'bg-orange-50 dark:bg-orange-900/20'
          }`}>
            <Clock className={`w-8 h-8 ${
              isExpired
                ? 'text-red-600 dark:text-red-400'
                : 'text-orange-600 dark:text-orange-400'
            }`} />
          </div>

          {/* Header */}
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {isExpired ? 'Your Trial Has Ended' : `${daysRemaining} Days Left in Trial`}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">
              {isExpired
                ? 'Continue using Compazz by choosing a plan below'
                : 'Upgrade now to ensure uninterrupted access to all features'
              }
            </p>
          </div>

          {/* Current Plan Highlight */}
          {plan && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-xl border-2 border-blue-200 dark:border-blue-800">
              <div className="flex items-center justify-center mb-3">
                <Star className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
                <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                  Recommended for You
                </span>
              </div>
              <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
                {plan.name} Plan
              </h3>
              <p className="text-3xl font-bold text-gray-900 dark:text-white mb-1">
                £{plan.priceGBP}
                <span className="text-lg font-normal text-gray-600 dark:text-gray-400">/month</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {plan.description}
              </p>

              <Button
                onClick={() => handleUpgrade(currentPlan)}
                disabled={loadingPlan === currentPlan}
                className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white py-3 text-lg"
              >
                {loadingPlan === currentPlan ? (
                  <>
                    <Loader2 className="mr-2 w-5 h-5 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CreditCard className="mr-2 w-5 h-5" />
                    Upgrade to {plan.name}
                    <ArrowRight className="ml-2 w-5 h-5" />
                  </>
                )}
              </Button>
            </div>
          )}

          {/* Other Plans */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(paymentPlans)
              .filter(([planId]) => planId !== currentPlan)
              .map(([planId, planData]) => (
                <div key={planId} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                    {planData.name}
                  </h4>
                  <p className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                    £{planData.priceGBP}/month
                  </p>
                  <Button
                    onClick={() => handleUpgrade(planId)}
                    disabled={loadingPlan === planId}
                    variant="outline"
                    className="w-full"
                  >
                    {loadingPlan === planId ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Choose Plan'
                    )}
                  </Button>
                </div>
              ))}
          </div>

          {/* Footer */}
          <div className="text-xs text-gray-500 dark:text-gray-400">
            <p>• Cancel anytime • No setup fees • 30-day money-back guarantee</p>
            {isExpired && (
              <p className="mt-2 text-red-600 dark:text-red-400">
                Your account is currently read-only. Upgrade to continue managing your finances.
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TrialExpired;
