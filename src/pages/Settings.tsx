import React, { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Users, Building2, Shield, Bell, Palette, CreditCard, ChevronRight } from 'lucide-react';
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
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <Building2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No outlet selected</p>
        </div>
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
    <div className="container-width section-padding">
      {/* Header */}
      <div className="mb-12">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl flex items-center justify-center">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
            <p className="text-muted-foreground mt-1">
              Manage your business settings and preferences
            </p>
          </div>
        </div>
      </div>

      {/* Settings Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Business Information */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg flex items-center justify-center">
                <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Business Information</h2>
            </div>
            <button
              onClick={() => setShowEditBusinessModal(true)}
              className="btn-secondary px-4 py-2 text-sm"
            >
              Edit
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Business Name</label>
              <p className="text-foreground font-medium">{currentOutlet.name}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Business Type</label>
              <p className="text-foreground font-medium capitalize">{currentOutlet.businessType}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Status</label>
              <span className={`inline-flex items-center px-3 py-1 text-xs font-medium rounded-full ${
                currentOutlet.status === 'active' 
                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400'
                  : 'bg-secondary text-secondary-foreground'
              }`}>
                {currentOutlet.status}
              </span>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Currency</label>
              <select
                value={currentCurrency.code}
                onChange={(e) => handleCurrencyChange(e.target.value)}
                className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground focus:ring-2 focus:ring-ring focus:border-ring transition-colors"
              >
                {availableCurrencies.map((currency) => (
                  <option key={currency.code} value={currency.code}>
                    {currency.symbol} {currency.name} ({currency.code})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Team Management */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-emerald-50 to-emerald-100 dark:from-emerald-900/20 dark:to-emerald-800/20 rounded-lg flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Team Management</h2>
            </div>
            {canManageUsers && (
              <button
                onClick={() => setShowInviteModal(true)}
                className="btn-primary px-4 py-2 text-sm"
              >
                Invite Member
              </button>
            )}
          </div>

          <div className="space-y-6">
            {canManageUsers ? (
              <>
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Your Role</label>
                  <p className="text-foreground font-medium capitalize">{currentUser?.role?.replace('_', ' ')}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-muted-foreground mb-2">Permissions</label>
                  <p className="text-foreground font-medium">{currentUser?.permissions?.length || 0} permissions</p>
                </div>
                
                <p className="text-muted-foreground text-sm">
                  Invite team members to collaborate on your business operations.
                </p>
              </>
            ) : (
              <div className="flex flex-col items-center text-center py-8">
                <Users className="w-12 h-12 text-muted-foreground mb-4" />
                <p className="text-muted-foreground">Contact your administrator to manage team members.</p>
              </div>
            )}
          </div>
        </div>

        {/* Security */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/20 dark:to-purple-800/20 rounded-lg flex items-center justify-center">
                <Shield className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Security</h2>
            </div>
            <button className="btn-secondary px-4 py-2 text-sm">
              Configure
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Two-Factor Authentication</label>
              <div className="flex items-center justify-between">
                <p className="text-foreground font-medium">Not enabled</p>
                <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
                  Recommended
                </span>
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Last Login</label>
              <p className="text-foreground font-medium">Today</p>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-lg flex items-center justify-center">
                <Bell className="w-5 h-5 text-orange-600 dark:text-orange-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Notifications</h2>
            </div>
            <button className="btn-secondary px-4 py-2 text-sm">
              Manage
            </button>
          </div>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Email Alerts</label>
                <p className="text-xs text-muted-foreground">Receive email notifications for important events</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400">
                Enabled
              </span>
            </div>
            
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-1">Push Notifications</label>
                <p className="text-xs text-muted-foreground">Get real-time browser notifications</p>
              </div>
              <span className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-secondary text-secondary-foreground">
                Disabled
              </span>
            </div>
          </div>
        </div>

        {/* Appearance */}
        <div className="card p-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-pink-50 to-pink-100 dark:from-pink-900/20 dark:to-pink-800/20 rounded-lg flex items-center justify-center">
                <Palette className="w-5 h-5 text-pink-600 dark:text-pink-400" />
              </div>
              <h2 className="text-xl font-semibold text-foreground">Appearance</h2>
            </div>
            <button className="btn-secondary px-4 py-2 text-sm">
              Customize
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Theme</label>
              <p className="text-foreground font-medium">Auto</p>
              <p className="text-xs text-muted-foreground mt-1">Follows your system preference</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-muted-foreground mb-2">Language</label>
              <p className="text-foreground font-medium">English</p>
            </div>
          </div>
        </div>

        {/* Billing */}
        {isOwner && (
          <div className="card p-8">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900/20 dark:to-indigo-800/20 rounded-lg flex items-center justify-center">
                  <CreditCard className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-xl font-semibold text-foreground">Billing</h2>
              </div>
              <button className="btn-secondary px-4 py-2 text-sm">
                Upgrade
              </button>
            </div>

            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Current Plan</label>
                <p className="text-foreground font-medium">Free Plan</p>
                <p className="text-xs text-muted-foreground mt-1">Perfect for getting started</p>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-muted-foreground mb-2">Next Billing Date</label>
                <p className="text-foreground font-medium">Never</p>
              </div>
            </div>
          </div>
        )}
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


