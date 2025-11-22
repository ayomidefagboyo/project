import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import OutletSelector from '@/components/layout/OutletSelector';
import { 
  LayoutDashboard, 
  FileText, 
  CreditCard, 
  BarChart3, 
  Settings, 
  Bot, 
  History,
  X,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  Plus,
  ChevronDown,
  Receipt,
  DollarSign,
  Users,
  Shield,
  Menu,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import CreateStoreModal, { StoreFormData } from '@/components/modals/CreateStoreModal';
import Toast from '@/components/ui/Toast';
import { useOutlet } from '@/contexts/OutletContext';
import { dataService } from '@/lib/services';
import { subscriptionService } from '@/lib/subscriptionService';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, isDarkMode, className = '' }) => {
  const location = useLocation();
  const { currentUser, setUserOutlets } = useOutlet();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
  const [isCreateReportOpen, setIsCreateReportOpen] = useState(true);
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsCreateDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info') => {
    setToast({ message, type, isVisible: true });
  };

  const handleCreateStore = async (storeData: StoreFormData) => {
    if (!currentUser) return;

    try {
      // Check outlet limit before creating
      try {
        const currentCount = await subscriptionService.getUserOutletCount(currentUser.id);
        const canAdd = await subscriptionService.canAddOutlet(currentUser.id, currentCount);

        if (!canAdd) {
          showToast('You have reached your outlet limit. Please upgrade your plan to add more outlets.', 'warning');
          return;
        }
      } catch (subscriptionError) {
        console.warn('Subscription check failed, allowing outlet creation:', subscriptionError);
      }

      const newOutlet = await dataService.createOutlet(storeData, currentUser.id);
      setUserOutlets(prev => [...prev, newOutlet]);
      setShowCreateStoreModal(false);
      showToast('New store created successfully!', 'success');
    } catch (error) {
      console.error('Error creating store:', error);
      showToast('Failed to create store. Please try again.', 'error');
    }
  };

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'Compazz Insights', href: '/dashboard/ai-assistant', icon: Bot },
    { name: 'Daily Reports', href: '/dashboard/daily-reports', icon: BarChart3 },
    { name: 'Invoices', href: '/dashboard/invoices', icon: FileText },
    { name: 'Expenses', href: '/dashboard/expenses', icon: CreditCard },
    { name: 'Vendors', href: '/dashboard/vendors', icon: Users },
    { name: 'Audit Trail', href: '/dashboard/audit-trail', icon: Shield },
  ];

  const createReportItems = [
    { name: 'End of Day', href: '/dashboard/eod', icon: Clock, color: 'text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20' },
    { name: 'Create Invoice', href: '/dashboard/invoices/create', icon: Receipt, color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20' },
    { name: 'Add Expense', href: '/dashboard/expenses/create', icon: DollarSign, color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-900/20' },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  const NavItem = ({ item, isCollapsed = false }: { item: any; isCollapsed?: boolean }) => {
    const active = isActive(item.href);
    
    return (
      <Link
        to={item.href}
        className={`
          group relative flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 ease-in-out
          ${active 
            ? 'bg-gray-900 text-white shadow-sm dark:bg-white dark:text-gray-900' 
            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50 dark:text-gray-300 dark:hover:text-white dark:hover:bg-gray-800/50'
          }
          ${isCollapsed ? 'justify-center px-3' : ''}
        `}
      >
        <item.icon className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'} transition-colors`} />
        {!isCollapsed && (
          <span className="font-medium text-sm truncate">{item.name}</span>
        )}
        
        {/* Active indicator */}
        {active && !isCollapsed && (
          <div className="absolute right-3 w-2 h-2 bg-current rounded-full opacity-60" />
        )}
        
        {/* Tooltip for collapsed state */}
        {isCollapsed && (
          <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
            {item.name}
            <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
          </div>
        )}
      </Link>
    );
  };

  const QuickActionItem = ({ item, isCollapsed = false }: { item: any; isCollapsed?: boolean }) => (
    <Link
      to={item.href}
      className={`
        group flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50
        ${isCollapsed ? 'justify-center px-3' : ''}
      `}
    >
      <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${item.color}`}>
        <item.icon className="w-4 h-4" />
      </div>
      {!isCollapsed && (
        <span className="font-medium text-sm text-gray-700 dark:text-gray-200 truncate">{item.name}</span>
      )}
      
      {/* Tooltip for collapsed state */}
      {isCollapsed && (
        <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
          {item.name}
          <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
        </div>
      )}
    </Link>
  );

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black/20 backdrop-blur-sm z-40 lg:hidden" 
          onClick={onToggle}
        />
      )}

      {/* Sidebar */}
      <div
        className={`
          ${className}
          ${isOpen ? 'translate-x-0' : '-translate-x-full'}
          ${isCollapsed ? 'w-16' : 'w-64'}
          fixed inset-y-0 left-0 z-50 flex flex-col bg-white/95 backdrop-blur-xl border-r border-gray-100
          dark:bg-gray-900/95 dark:border-gray-800
          lg:relative lg:translate-x-0 lg:transition-all lg:duration-300 lg:ease-in-out
          transition-transform duration-300 ease-in-out
        `}
      >
        {/* Header */}
        <div className={`flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-800 ${isCollapsed ? 'px-4' : ''}`}>
          {!isCollapsed && (
            <OutletSelector onCreateStore={() => {
              console.log('Create store clicked from sidebar - opening modal');
              console.log('showCreateStoreModal before:', showCreateStoreModal);
              setShowCreateStoreModal(true);
              console.log('setShowCreateStoreModal(true) called');
            }} />
          )}

          <div className="flex items-center space-x-2">
            {/* Collapse button for desktop */}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="hidden lg:flex items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              {isCollapsed ? (
                <ChevronRight className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              ) : (
                <ChevronLeft className="w-4 h-4 text-gray-500 dark:text-gray-400" />
              )}
            </button>

            {/* Close button for mobile */}
            <button
              onClick={onToggle}
              className="flex lg:hidden items-center justify-center w-8 h-8 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            >
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto scrollbar-hide">
          <div className={`p-6 ${isCollapsed ? 'px-4' : ''}`}>
            {/* Create Report Dropdown */}
            {!isCollapsed && (
              <div className="mb-4">
                <div className="relative">
                  <button
                    onClick={() => setIsCreateReportOpen(!isCreateReportOpen)}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-xl text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <Plus className="w-5 h-5" />
                      <span className="font-medium text-sm">Create Report</span>
                    </div>
                    <ChevronDown className={`w-4 h-4 transition-transform ${isCreateReportOpen ? 'rotate-180' : ''}`} />
                  </button>
                  
                  {isCreateReportOpen && (
                    <div className="mt-2 space-y-1">
                      {createReportItems.map((item) => (
                        <Link
                          key={item.name}
                          to={item.href}
                          className="flex items-center gap-3 px-4 py-2 ml-4 rounded-lg transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          <div className={`flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center ${item.color}`}>
                            <item.icon className="w-3 h-3" />
                          </div>
                          <span className="font-medium text-sm text-gray-700 dark:text-gray-200">{item.name}</span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Main Navigation */}
            <div className="space-y-2">
              {navItems.map((item) => (
                <NavItem key={item.name} item={item} isCollapsed={isCollapsed} />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className={`p-6 border-t border-gray-100 dark:border-gray-800 ${isCollapsed ? 'px-4' : ''}`}>
          <Link
            to="/dashboard/settings"
            className={`
              group flex items-center gap-4 px-4 py-3 rounded-xl transition-all duration-200 hover:bg-gray-50 dark:hover:bg-gray-800/50
              ${isActive('/dashboard/settings') 
                ? 'bg-gray-900 text-white dark:bg-white dark:text-gray-900' 
                : 'text-gray-600 dark:text-gray-300'
              }
              ${isCollapsed ? 'justify-center px-3' : ''}
            `}
          >
            <Settings className={`flex-shrink-0 ${isCollapsed ? 'w-6 h-6' : 'w-5 h-5'}`} />
            {!isCollapsed && (
              <span className="font-medium text-sm">Settings</span>
            )}
            
            {/* Tooltip for collapsed state */}
            {isCollapsed && (
              <div className="absolute left-full ml-3 px-3 py-2 bg-gray-900 text-white text-sm font-medium rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50">
                Settings
                <div className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 bg-gray-900 rotate-45" />
              </div>
            )}
          </Link>
        </div>
      </div>

      {/* Create Store Modal */}
      {console.log('Sidebar render - showCreateStoreModal:', showCreateStoreModal)}
      {showCreateStoreModal && (
        <CreateStoreModal
          isOpen={showCreateStoreModal}
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

export default Sidebar;