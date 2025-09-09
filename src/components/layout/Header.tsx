import React, { useState } from 'react';
import { Bell, Search, Sun, Moon, User, LogOut, Settings as SettingsIcon, UserPlus, Menu } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import OutletSelector from './OutletSelector';
import { useOutlet } from '@/contexts/OutletContext';
import { authService } from '@/lib/auth';
import InviteTeamMember from '@/components/auth/InviteTeamMember';
import CreateStoreModal, { StoreFormData } from '@/components/modals/CreateStoreModal';
import Toast from '@/components/ui/Toast';
import { dataService } from '@/lib/services';

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode, onToggleSidebar }) => {
  const { currentUser, setCurrentUser, setCurrentOutlet, setUserOutlets, hasPermission } = useOutlet();
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const handleLogout = async () => {
    try {
      const { error } = await authService.signOut();
      if (error) {
        console.error('Logout error:', error);
      } else {
        setCurrentUser(null);
        setCurrentOutlet(null);
        setUserOutlets([]);
      }
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const canInviteUsers = hasPermission('manage_users');

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

  const handleCreateStore = async (storeData: StoreFormData) => {
    try {
      console.log('Creating store:', storeData);
      
      // Convert the form data to match the Outlet interface
      const outletData = {
        name: storeData.name,
        businessType: storeData.businessType,
        status: 'active' as const,
        address: {
          street: storeData.address.street || '',
          city: storeData.address.city || '',
          state: storeData.address.state || '',
          zip: storeData.address.zipCode || '', // Note: converting zipCode to zip
          country: storeData.address.country || ''
        },
        phone: storeData.phone || '',
        email: storeData.email || '',
        // Default values for required fields
        openingHours: {
          monday: { open: '09:00', close: '17:00', isOpen: true },
          tuesday: { open: '09:00', close: '17:00', isOpen: true },
          wednesday: { open: '09:00', close: '17:00', isOpen: true },
          thursday: { open: '09:00', close: '17:00', isOpen: true },
          friday: { open: '09:00', close: '17:00', isOpen: true },
          saturday: { open: '09:00', close: '17:00', isOpen: true },
          sunday: { open: '09:00', close: '17:00', isOpen: false }
        },
        taxRate: 0.10, // 10% default tax rate
        currency: 'USD',
        timezone: 'UTC'
      };

      const { data: newOutlet, error } = await dataService.createOutlet(outletData);

      if (error) {
        console.error('Failed to create store:', error);
        showToast(`Failed to create store: ${error}`, 'error');
        return;
      }

      if (newOutlet) {
        console.log('Store created successfully:', newOutlet);
        showToast('Store created successfully!', 'success');
        
        // TODO: Refresh user outlets list to include the new store
        // This would require accessing setUserOutlets from context
        // For now, user can refresh the page to see the new store
      }
    } catch (error) {
      console.error('Failed to create store:', error);
      showToast('Failed to create store. Please try again.', 'error');
    }
  };
  
  return (
    <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-600 h-16 px-3 sm:px-4 flex items-center justify-between">
      <div className="flex items-center gap-3 sm:gap-4">
        {/* Mobile sidebar toggle */}
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleSidebar}
          className="lg:hidden p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Menu size={20} />
        </Button>
        
        <OutletSelector onCreateStore={() => setShowCreateStoreModal(true)} />
        
        <div className="relative hidden sm:block">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search invoices, expenses, vendors..."
            className="pl-10 pr-4 py-2 w-80 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        {/* Quick Invite Button - Only show for users who can invite */}
        {canInviteUsers && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowInviteModal(true)}
            className="flex items-center gap-2 hidden sm:flex border-gray-300 dark:border-gray-500 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <UserPlus size={16} />
            <span className="hidden sm:inline">Invite Team</span>
          </Button>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={toggleDarkMode}
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          {isDarkMode ? <Sun size={20} /> : <Moon size={20} />}
        </Button>

        <Button
          variant="ghost"
          size="sm"
          className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
        >
          <Bell size={20} />
        </Button>

        {/* User Menu */}
        <div className="relative">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
            className="flex items-center gap-2 p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <User size={20} />
            <span className="hidden sm:inline">{currentUser?.name || 'User'}</span>
          </Button>

          {isUserMenuOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-md shadow-lg py-1 z-50 border border-gray-200 dark:border-gray-600">
              <div className="px-4 py-2 text-sm text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-600">
                <div className="font-medium">{currentUser?.name}</div>
                <div className="text-gray-500 dark:text-gray-400">{currentUser?.email}</div>
              </div>
              
              <a
                href="/settings"
                className="flex items-center gap-2 px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600"
              >
                <SettingsIcon size={16} />
                Settings
              </a>
              
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 text-left"
              >
                <LogOut size={16} />
                Sign out
              </button>
            </div>
          )}
        </div>
        
        {/* Click outside to close user menu */}
        {isUserMenuOpen && (
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsUserMenuOpen(false)}
          />
        )}
      </div>

      {/* Invite Team Member Modal */}
      {showInviteModal && (
        <InviteTeamMember onClose={() => setShowInviteModal(false)} />
      )}

      {/* Create Store Modal */}
      {showCreateStoreModal && (
        <CreateStoreModal
          isOpen={showCreateStoreModal}
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
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
    </header>
  );
};

export default Header;
