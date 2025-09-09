import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Building2, Shield, Bell, Palette, Globe, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import InviteTeamMember from '@/components/auth/InviteTeamMember';
import EditBusinessInfoModal from '@/components/modals/EditBusinessInfoModal';
import Toast from '@/components/ui/Toast';
import { currencyService, CurrencyInfo } from '@/lib/currencyService';
import { dataService } from '@/lib/services';
import { Outlet as OutletType } from '@/types';

const Settings: React.FC = () => {
  const { currentOutlet, currentUser, hasPermission, setCurrentOutlet, userOutlets, setUserOutlets } = useOutlet();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showEditBusinessModal, setShowEditBusinessModal] = useState(false);
  const [currentCurrency, setCurrentCurrency] = useState<CurrencyInfo>(currencyService.getCurrentCurrency());
  const [availableCurrencies, setAvailableCurrencies] = useState<CurrencyInfo[]>([]);
  const [isUpdating, setIsUpdating] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  if (!currentOutlet) {
    return (
      <div className="p-6">
        <div className="text-center text-gray-500">No outlet selected</div>
      </div>
    );
  }

  const canManageUsers = hasPermission('manage_users');
  const isOwner = currentUser?.isOwner;

  useEffect(() => {
    loadCurrencies();
  }, []);

  const loadCurrencies = () => {
    const currencies = currencyService.getAllCurrencies();
    setAvailableCurrencies(currencies);
  };

  const handleCurrencyChange = (currencyCode: string) => {
    currencyService.setCurrency(currencyCode);
    setCurrentCurrency(currencyService.getCurrentCurrency());
  };

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'info') => {
    setToast({
      message,
      type,
      isVisible: true
    });
  };

  const hideToast = () => {
    setToast(prev => ({
      ...prev,
      isVisible: false
    }));
  };

  const handleBusinessInfoSave = async (updatedData: Partial<OutletType>) => {
    if (!currentOutlet) return;

    try {
      setIsUpdating(true);
      console.log('Saving business info:', updatedData);
      console.log('Current outlet ID:', currentOutlet.id);

      const { data: updatedOutlet, error } = await dataService.updateOutlet(currentOutlet.id, updatedData);

      if (error) {
        console.error('Detailed error:', error);
        console.error('Failed to save business info:', error);
        showToast(`Failed to save business information: ${error}`, 'error');
        return;
      }

      if (updatedOutlet) {
        // Update the current outlet in context with the new data
        setCurrentOutlet(updatedOutlet);
        
        // Also update the outlet in the userOutlets array so dropdown reflects changes
        setUserOutlets(userOutlets.map(outlet => 
          outlet.id === updatedOutlet.id ? updatedOutlet : outlet
        ));
        
        console.log('Business info updated successfully:', updatedOutlet);
        showToast('Business information updated successfully!', 'success');
      }
    } catch (error) {
      console.error('Caught exception:', error);
      console.error('Failed to save business info:', error);
      showToast('Failed to save business information. Please try again.', 'error');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-gray-600 dark:text-gray-400 mt-2">
          Manage your business settings and preferences
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Business Information */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Building2 className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Business Info</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Name</label>
              <p className="text-gray-900 dark:text-white">{currentOutlet.name}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business Type</label>
              <p className="text-gray-900 dark:text-white capitalize">{currentOutlet.businessType}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Status</label>
              <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                currentOutlet.status === 'active' 
                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                  : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
              }`}>
                {currentOutlet.status}
              </span>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Currency</label>
              <select
                value={currentCurrency.code}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <Button 
            className="mt-4 w-full" 
            variant="outline"
            onClick={() => setShowEditBusinessModal(true)}
          >
            Edit Business Info
          </Button>
        </div>

        {/* Team Management */}
        {canManageUsers && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center">
                <Users className="h-6 w-6 text-green-600 dark:text-green-400 mr-3" />
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Management</h3>
              </div>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Your Role</label>
                <p className="text-gray-900 dark:text-white capitalize">{currentUser?.role?.replace('_', ' ')}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Permissions</label>
                <p className="text-gray-900 dark:text-white">{currentUser?.permissions?.length || 0} permissions</p>
              </div>
            </div>
            <Button 
              className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setShowInviteModal(true)}
            >
              <Users className="h-4 w-4 mr-2" />
              Invite Team Member
            </Button>
          </div>
        )}

        {/* Security & Privacy */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Shield className="h-6 w-6 text-purple-600 dark:text-purple-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Security</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Two-Factor Auth</label>
              <p className="text-gray-900 dark:text-white">Not enabled</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Last Login</label>
              <p className="text-gray-900 dark:text-white">Today</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="outline">
            Security Settings
          </Button>
        </div>

        {/* Notifications */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Bell className="h-6 w-6 text-orange-600 dark:text-orange-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Notifications</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Alerts</label>
              <p className="text-gray-900 dark:text-white">Enabled</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Push Notifications</label>
              <p className="text-gray-900 dark:text-white">Disabled</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="outline">
            Notification Settings
          </Button>
        </div>

        {/* Appearance */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center mb-4">
            <Palette className="h-6 w-6 text-pink-600 dark:text-pink-400 mr-3" />
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Appearance</h3>
          </div>
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Theme</label>
              <p className="text-gray-900 dark:text-white">Auto</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Language</label>
              <p className="text-gray-900 dark:text-white">English</p>
            </div>
          </div>
          <Button className="mt-4 w-full" variant="outline">
            Appearance Settings
          </Button>
        </div>

        {/* Billing */}
        {isOwner && (
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center mb-4">
              <CreditCard className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Billing</h3>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Plan</label>
                <p className="text-gray-900 dark:text-white">Free Plan</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Next Billing</label>
                <p className="text-gray-900 dark:text-white">Never</p>
              </div>
            </div>
            <Button className="mt-4 w-full" variant="outline">
              Billing Settings
            </Button>
          </div>
        )}

        {/* Team Management */}
        <div className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              <Users className="h-6 w-6 text-blue-600 dark:text-blue-400 mr-3" />
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Team Management</h3>
            </div>
            {canManageUsers && (
              <Button
                onClick={() => setShowInviteModal(true)}
                className="bg-blue-600 hover:bg-blue-700 text-white"
              >
                Invite Team Member
              </Button>
            )}
          </div>
          <p className="text-gray-600 dark:text-gray-400">
            {canManageUsers 
              ? "Invite team members to collaborate on your business operations."
              : "Contact your administrator to manage team members."
            }
          </p>
        </div>
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <InviteTeamMember onClose={() => setShowInviteModal(false)} />
      )}

      {/* Edit Business Info Modal */}
      {showEditBusinessModal && currentOutlet && (
        <EditBusinessInfoModal
          outlet={currentOutlet}
          isOpen={showEditBusinessModal}
          onClose={() => setShowEditBusinessModal(false)}
          onSave={handleBusinessInfoSave}
          isLoading={isUpdating}
        />
      )}

      {/* Toast Notification */}
      <Toast
        message={toast.message}
        type={toast.type}
        isVisible={toast.isVisible}
        onClose={hideToast}
        duration={4000}
      />
    </div>
  );
};

export default Settings;


