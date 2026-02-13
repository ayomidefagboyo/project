import React, { useState } from 'react';
import {
  Bell,
  Search,
  Sun,
  Moon,
  User,
  LogOut,
  Settings as SettingsIcon,
  UserPlus,
  Menu,
  ChevronDown,
  Building2
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { authService } from '@/lib/auth';
import InviteTeamMember from '@/components/auth/InviteTeamMember';
import CreateStoreModal, { StoreFormData } from '@/components/modals/CreateStoreModal';
import Toast from '@/components/ui/Toast';
import { dataService } from '@/lib/services';
import { subscriptionService } from '@/lib/subscriptionService';
import { resolvePosAppUrl } from '../../../../../shared/services/urlResolver';

interface HeaderProps {
  isDarkMode: boolean;
  toggleDarkMode: () => void;
  onToggleSidebar: () => void;
}

const Header: React.FC<HeaderProps> = ({ isDarkMode, toggleDarkMode, onToggleSidebar }) => {
  const { currentUser, setCurrentUser, setCurrentOutlet, setUserOutlets, hasPermission, currentOutlet, userOutlets } = useOutlet();
  const posAppUrl = resolvePosAppUrl(import.meta.env.VITE_POS_APP_URL);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [showCreateStoreModal, setShowCreateStoreModal] = useState(false);
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [toast, setToast] = useState<{
    message: string;
    type: 'success' | 'error' | 'warning' | 'info';
    isVisible: boolean;
  }>({
    message: '',
    type: 'info',
    isVisible: false
  });

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const handleLogout = async () => {
    try {
      await authService.signOut();
      setCurrentUser(null);
      setCurrentOutlet(null);
      setUserOutlets([]);
      window.location.href = '/';
    } catch (error) {
      console.error('Logout error:', error);
      showToast('Failed to logout', 'error');
    }
  };

  const handleInviteSuccess = () => {
    showToast('Team member invited successfully!', 'success');
    setShowInviteModal(false);
  };

  const handleCreateStore = async (storeData: StoreFormData) => {
    if (!currentUser) return;

    try {
      // Check outlet limit before creating (gracefully handle missing subscription data)
      try {
        const currentCount = await subscriptionService.getUserOutletCount(currentUser.id);
        const canAdd = await subscriptionService.canAddOutlet(currentUser.id, currentCount);

        if (!canAdd) {
          showToast('You have reached your outlet limit. Please upgrade your plan to add more outlets.', 'warning');
          return;
        }
      } catch (subscriptionError) {
        console.warn('Subscription check failed, allowing outlet creation:', subscriptionError);
        // Continue with outlet creation if subscription check fails
      }

      const { data: newOutlet, error: createError } = await dataService.createOutlet(storeData, currentUser.id);
      if (createError || !newOutlet) {
        showToast(createError || 'Failed to create store. Please try again.', 'error');
        return;
      }

      const outletExists = userOutlets.some(outlet => outlet.id === newOutlet.id);
      setUserOutlets(outletExists ? userOutlets : [...userOutlets, newOutlet]);
      setShowCreateStoreModal(false);
      showToast('New store created successfully!', 'success');
    } catch (error) {
      console.error('Error creating store:', error);
      showToast('Failed to create store. Please try again.', 'error');
    }
  };

  return (
    <>
      <header className="bg-white/80 backdrop-blur-xl border-b border-gray-100 dark:bg-gray-900/80 dark:border-gray-800 sticky top-0 z-30">
        <div className="flex items-center justify-between h-16 px-6">
          {/* Left Section */}
          <div className="flex items-center space-x-4">
            {/* Mobile menu button */}
            <button
              onClick={onToggleSidebar}
              className="lg:hidden p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <Menu className="w-5 h-5 text-gray-600 dark:text-gray-300" />
            </button>

          </div>

          {/* Center Section - Search */}
          <div className="flex-1 max-w-md mx-8">
            <div className="relative">
              <div
                className={`
                  flex items-center bg-gray-50 dark:bg-gray-800 rounded-xl transition-all duration-200
                  ${isSearchFocused
                    ? 'ring-2 ring-gray-900 dark:ring-white bg-white dark:bg-gray-700'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                  w-full
                `}
              >
                <Search className="w-4 h-4 text-gray-400 ml-4" />
                <input
                  type="text"
                  placeholder="Search transactions, invoices..."
                  className="w-full px-4 py-3 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none"
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                />
                {isSearchFocused && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 p-4">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Start typing to search...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Section */}
          <div className="flex items-center space-x-3">

            {/* Launch POS Button */}
            <a
              href={posAppUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden md:flex items-center space-x-2 px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg transition-colors font-medium text-sm"
            >
              <span>Launch POS</span>
            </a>

            {/* Notifications */}
            <button className="relative p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group">
              <Bell className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white transition-colors" />
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full flex items-center justify-center">
                <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
              </span>
            </button>

            {/* Dark mode toggle */}
            <button
              onClick={toggleDarkMode}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
            >
              {isDarkMode ? (
                <Sun className="w-5 h-5 text-gray-600 dark:text-gray-300 group-hover:text-yellow-500 dark:group-hover:text-yellow-400 transition-colors" />
              ) : (
                <Moon className="w-5 h-5 text-gray-600 group-hover:text-blue-600 transition-colors" />
              )}
            </button>

            {/* User Menu */}
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-3 px-3 py-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors group"
              >
                <div className="w-8 h-8 bg-gradient-to-tr from-gray-900 to-gray-600 dark:from-white dark:to-gray-300 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-semibold text-white dark:text-gray-900">
                    {currentUser?.name?.charAt(0) || currentUser?.email?.charAt(0) || 'U'}
                  </span>
                </div>
                <div className="hidden sm:block text-left">
                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                    {currentUser?.name || 'User'}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                    {currentUser?.role?.replace('_', ' ') || 'Member'}
                  </div>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-500 dark:text-gray-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`} />
              </button>

              {/* Dropdown Menu */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-200 dark:border-gray-700 py-2 z-50">
                  {/* User Info */}
                  <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
                    <div className="font-medium text-gray-900 dark:text-white">
                      {currentUser?.name || 'User'}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {currentUser?.email}
                    </div>
                  </div>

                  {/* Menu Items */}
                  <div className="py-2">
                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        // Navigate to settings
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                    >
                      <SettingsIcon className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200">Settings</span>
                    </button>

                    {hasPermission('invite_users') && (
                      <button
                        onClick={() => {
                          setIsUserMenuOpen(false);
                          setShowInviteModal(true);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                      >
                        <UserPlus className="w-4 h-4 text-gray-500 dark:text-gray-400" />
                        <span className="text-sm text-gray-700 dark:text-gray-200">Invite Team Member</span>
                      </button>
                    )}

                    <hr className="my-2 border-gray-100 dark:border-gray-700" />

                    <button
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        handleLogout();
                      }}
                      className="w-full flex items-center space-x-3 px-4 py-2 text-left hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors group"
                    >
                      <LogOut className="w-4 h-4 text-gray-500 dark:text-gray-400 group-hover:text-red-600 dark:group-hover:text-red-400" />
                      <span className="text-sm text-gray-700 dark:text-gray-200 group-hover:text-red-600 dark:group-hover:text-red-400">
                        Sign Out
                      </span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Click away listener for dropdown */}
      {isUserMenuOpen && (
        <div
          className="fixed inset-0 z-20"
          onClick={() => setIsUserMenuOpen(false)}
        />
      )}

      {/* Modals */}
      {showInviteModal && (
        <InviteTeamMember
          onClose={() => setShowInviteModal(false)}
        />
      )}

      {showCreateStoreModal && (
        <CreateStoreModal
          onClose={() => setShowCreateStoreModal(false)}
          onCreate={handleCreateStore}
        />
      )}

      {/* Toast */}
      {toast.isVisible && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(prev => ({ ...prev, isVisible: false }))}
        />
      )}
    </>
  );
};

export default Header;
