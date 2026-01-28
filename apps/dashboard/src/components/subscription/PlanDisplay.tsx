import React from 'react';
import { Check, X, Crown, Building2, Users, CreditCard } from 'lucide-react';
import { subscriptionService } from '@/lib/subscriptionService';
import { SubscriptionPlan, SubscriptionFeatures } from '@/types';

interface PlanDisplayProps {
  currentPlan: SubscriptionPlan;
  features: SubscriptionFeatures;
  onUpgrade?: () => void;
}

const PlanDisplay: React.FC<PlanDisplayProps> = ({ currentPlan, features, onUpgrade }) => {
  const planConfig = subscriptionService.getPlanConfig(currentPlan);

  const getFeatureIcon = (enabled: boolean) => {
    return enabled ? (
      <Check className="w-4 h-4 text-green-600" />
    ) : (
      <X className="w-4 h-4 text-gray-400" />
    );
  };

  const getPlanIcon = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'startup':
        return <Building2 className="w-6 h-6 text-blue-600" />;
      case 'business':
        return <Users className="w-6 h-6 text-purple-600" />;
      case 'enterprise':
        return <Crown className="w-6 h-6 text-yellow-600" />;
      default:
        return <Building2 className="w-6 h-6 text-gray-600" />;
    }
  };

  const getPlanColor = (plan: SubscriptionPlan) => {
    switch (plan) {
      case 'startup':
        return 'from-blue-500 to-blue-600';
      case 'business':
        return 'from-purple-500 to-purple-600';
      case 'enterprise':
        return 'from-yellow-500 to-yellow-600';
      default:
        return 'from-gray-500 to-gray-600';
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className={`bg-gradient-to-r ${getPlanColor(currentPlan)} p-6 rounded-t-lg text-white`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {getPlanIcon(currentPlan)}
            <div>
              <h3 className="text-xl font-semibold">{planConfig.name}</h3>
              <p className="text-blue-100 text-sm">{planConfig.description}</p>
            </div>
          </div>
          {onUpgrade && currentPlan !== 'enterprise' && (
            <button
              onClick={onUpgrade}
              className="bg-white/20 hover:bg-white/30 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              Upgrade
            </button>
          )}
        </div>
      </div>

      {/* Features */}
      <div className="p-6">
        <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">Current Plan Features</h4>
        <div className="space-y-3">
          {/* Outlet Limit */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Outlets</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.maxOutlets === -1 ? 'Unlimited' : features.maxOutlets}
              </span>
              {getFeatureIcon(true)}
            </div>
          </div>

          {/* Core Features */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Core POS</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.corePos ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.corePos)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Basic Inventory</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.basicInventory ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.basicInventory)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Standard Reporting</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.standardReporting ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.standardReporting)}
            </div>
          </div>

          {/* Advanced Features */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Multi-Location Management</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.multiLocationManagement ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.multiLocationManagement)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Advanced Analytics</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.advancedAnalytics ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.advancedAnalytics)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Staff Management</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.staffManagement ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.staffManagement)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">API Access</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.apiAccess ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.apiAccess)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Custom Branding</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.customBranding ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.customBranding)}
            </div>
          </div>

          {/* Support */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Priority Support</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.prioritySupport ? 'Included' : 'Email Only'}
              </span>
              {getFeatureIcon(features.prioritySupport)}
            </div>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-700 dark:text-gray-300">Phone Support</span>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                {features.phoneSupport ? 'Included' : 'Not Available'}
              </span>
              {getFeatureIcon(features.phoneSupport)}
            </div>
          </div>
        </div>

        {/* Upgrade CTA */}
        {onUpgrade && currentPlan !== 'enterprise' && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-600">
            <div className="text-center">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                Want more features? Upgrade your plan to unlock additional capabilities.
              </p>
              <button
                onClick={onUpgrade}
                className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <CreditCard className="w-4 h-4 mr-2" />
                View Upgrade Options
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlanDisplay;