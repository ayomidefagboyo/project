import React, { useState, useEffect } from 'react';
import { CreditCard, Calendar, AlertCircle, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import stripeService, { Subscription, Customer } from '@/lib/stripeService';
import { paymentPlans } from '@/lib/stripe';

interface SubscriptionManagerProps {
  customerId: string;
  onSubscriptionChange?: (subscription: Subscription | null) => void;
}

const SubscriptionManager: React.FC<SubscriptionManagerProps> = ({
  customerId,
  onSubscriptionChange
}) => {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadCustomerData();
  }, [customerId]);

  const loadCustomerData = async () => {
    try {
      setLoading(true);
      const customerData = await stripeService.getCustomer(customerId);
      setCustomer(customerData);
      
      if (customerData.subscriptions.length > 0) {
        onSubscriptionChange?.(customerData.subscriptions[0]);
      }
    } catch (error) {
      setError('Failed to load subscription information');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelSubscription = async (subscriptionId: string) => {
    if (!window.confirm('Are you sure you want to cancel your subscription? You will lose access to premium features at the end of your current billing period.')) {
      return;
    }

    try {
      setActionLoading('cancel');
      await stripeService.cancelSubscription(subscriptionId);
      await loadCustomerData();
    } catch (error) {
      setError('Failed to cancel subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpgrade = async (newPlanId: string) => {
    if (!customer?.subscriptions[0]) return;

    const newPlan = stripeService.getPlan(newPlanId);
    if (!newPlan) return;

    try {
      setActionLoading('upgrade');
      await stripeService.updateSubscription(
        customer.subscriptions[0].id,
        newPlan.priceId
      );
      await loadCustomerData();
    } catch (error) {
      setError('Failed to upgrade subscription');
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-green-600 bg-green-100';
      case 'past_due':
        return 'text-yellow-600 bg-yellow-100';
      case 'canceled':
        return 'text-red-600 bg-red-100';
      default:
        return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active':
        return <CheckCircle className="w-4 h-4" />;
      case 'past_due':
        return <AlertCircle className="w-4 h-4" />;
      case 'canceled':
        return <XCircle className="w-4 h-4" />;
      default:
        return <AlertCircle className="w-4 h-4" />;
    }
  };

  const getCurrentPlan = () => {
    if (!customer?.subscriptions[0]) return null;
    
    const subscription = customer.subscriptions[0];
    const planAmount = subscription.plan.amount / 100; // Convert from cents
    
    // Find matching plan by price
    return Object.values(paymentPlans).find(plan => plan.price === planAmount);
  };

  const getAvailableUpgrades = () => {
    const currentPlan = getCurrentPlan();
    if (!currentPlan) return [];

    return Object.values(paymentPlans).filter(plan => plan.price > currentPlan.price);
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
          <span className="ml-2 text-gray-600">Loading subscription details...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl border border-red-200 p-8">
        <div className="flex items-center text-red-600">
          <AlertCircle className="w-5 h-5 mr-2" />
          <span>{error}</span>
        </div>
        <button
          onClick={loadCustomerData}
          className="mt-4 text-sm text-red-600 hover:text-red-700 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  const activeSubscription = customer?.subscriptions.find(sub => sub.status === 'active');
  const currentPlan = getCurrentPlan();
  const availableUpgrades = getAvailableUpgrades();

  return (
    <div className="space-y-6">
      {/* Current Subscription */}
      <div className="bg-white rounded-2xl border border-gray-200 p-8">
        <div className="flex items-center mb-6">
          <CreditCard className="w-6 h-6 text-gray-400 mr-3" />
          <h3 className="text-xl font-medium text-gray-900">Current Subscription</h3>
        </div>

        {activeSubscription ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-lg font-medium text-gray-900">
                  {currentPlan?.name || 'Custom Plan'}
                </h4>
                <p className="text-gray-600 text-sm">
                  {stripeService.formatCurrency(activeSubscription.plan.amount / 100)} per {activeSubscription.plan.interval}
                </p>
              </div>
              <div className={`flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(activeSubscription.status)}`}>
                {getStatusIcon(activeSubscription.status)}
                <span className="ml-1 capitalize">{activeSubscription.status}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-gray-200">
              <div>
                <p className="text-sm text-gray-500">Current Period</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(activeSubscription.current_period_start)} - {formatDate(activeSubscription.current_period_end)}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Next Billing Date</p>
                <p className="text-sm font-medium text-gray-900">
                  {formatDate(activeSubscription.current_period_end)}
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={() => handleCancelSubscription(activeSubscription.id)}
                disabled={actionLoading === 'cancel'}
                className="px-4 py-2 border border-red-300 text-red-700 rounded-lg text-sm font-medium hover:bg-red-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {actionLoading === 'cancel' ? 'Canceling...' : 'Cancel Subscription'}
              </button>
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <p className="text-gray-500 mb-4">No active subscription found</p>
            <a
              href="/pricing"
              className="bg-gray-900 text-white px-6 py-3 rounded-xl font-medium text-sm hover:bg-gray-800 transition-colors"
            >
              View Plans
            </a>
          </div>
        )}
      </div>

      {/* Upgrade Options */}
      {activeSubscription && availableUpgrades.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-200 p-8">
          <div className="flex items-center mb-6">
            <Calendar className="w-6 h-6 text-gray-400 mr-3" />
            <h3 className="text-xl font-medium text-gray-900">Upgrade Your Plan</h3>
          </div>

          <div className="space-y-4">
            {availableUpgrades.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-xl hover:border-gray-300 transition-colors">
                <div>
                  <h4 className="font-medium text-gray-900">{plan.name}</h4>
                  <p className="text-sm text-gray-600">{plan.description}</p>
                  <p className="text-sm font-medium text-gray-900 mt-1">
                    {stripeService.formatCurrency(plan.price)}/month
                  </p>
                </div>
                <button
                  onClick={() => handleUpgrade(plan.id)}
                  disabled={actionLoading === 'upgrade'}
                  className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {actionLoading === 'upgrade' ? 'Upgrading...' : 'Upgrade'}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SubscriptionManager;
