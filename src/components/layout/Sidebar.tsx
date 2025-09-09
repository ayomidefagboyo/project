import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
  Shield
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface SidebarProps {
  isOpen: boolean;
  onToggle: () => void;
  isDarkMode: boolean;
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ isOpen, onToggle, isDarkMode, className = '' }) => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCreateDropdownOpen, setIsCreateDropdownOpen] = useState(false);
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

  const navItems = [
    { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { name: 'AI Assistant', href: '/ai-assistant', icon: Bot },
    { name: 'Daily Reports', href: '/daily-reports', icon: BarChart3 },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Expenses', href: '/expenses', icon: CreditCard },
    { name: 'Vendors', href: '/vendors', icon: Users },
    { name: 'Audit Trail', href: '/audit-trail', icon: Shield },
  ];

  const createReportItems = [
    { name: 'End of Day', href: '/eod', icon: Clock },
    { name: 'Create Invoice', href: '/invoices/create', icon: Receipt },
    { name: 'Add Expense', href: '/expenses/create', icon: DollarSign },
  ];

  const isActive = (href: string) => {
    if (href === '/dashboard') {
      return location.pathname === '/dashboard';
    }
    return location.pathname.startsWith(href);
  };

  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  return (
    <>
      {/* Mobile sidebar */}
      <div className={`lg:hidden fixed inset-0 z-50 ${isOpen ? 'block' : 'hidden'}`}>
        {/* Backdrop */}
        <div className="fixed inset-0 bg-black bg-opacity-50" onClick={onToggle}></div>
        <div className="fixed inset-y-0 left-0 w-64 bg-white dark:bg-gray-800 shadow-xl transform transition-transform duration-300 ease-in-out z-60">
          {/* Mobile header */}
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-600">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Compass</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onToggle}
              className="p-2 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700"
            >
              <X size={20} />
            </Button>
          </div>
          
          {/* Mobile Create Report Dropdown */}
          <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-600">
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
                className="w-full justify-between text-sm font-medium"
              >
                <div className="flex items-center gap-2">
                  <Plus size={16} />
                  Create Report
                </div>
                <ChevronDown size={14} className={`transition-transform ${isCreateDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              {isCreateDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-[70] pointer-events-auto">
                  {createReportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => {
                          setIsCreateDropdownOpen(false);
                          onToggle(); // Close sidebar on mobile when clicking a link
                        }}
                        className="block w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors first:rounded-t-lg last:rounded-b-lg"
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={16} />
                          {item.name}
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Mobile navigation */}
          <nav className="mt-4 px-4 pb-4">
            <ul className="space-y-2">
              {navItems.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.name}>
                    <Link
                      to={item.href}
                      onClick={onToggle} // Close sidebar on mobile when clicking a link
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                          : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                      }`}
                    >
                      <Icon size={20} />
                      {item.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          {/* Mobile Settings */}
          <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-600">
            <Link
              to="/settings"
              onClick={onToggle}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive('/settings')
                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                  : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <Settings size={20} />
              Settings
            </Link>
          </div>
        </div>
      </div>

      {/* Desktop sidebar */}
      <div className={`hidden lg:block bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-600 transition-all duration-300 ease-in-out relative ${className} ${isCollapsed ? 'w-14' : 'w-56'} flex-shrink-0`}>
        {/* Desktop header */}
        <div className={`p-4 border-b border-gray-200 dark:border-gray-600 ${isCollapsed ? 'p-3' : ''}`}>
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'}`}>
            {!isCollapsed && (
              <>
                <h1 className="text-lg font-bold text-gray-900 dark:text-white">Compass</h1>
              </>
            )}
            {isCollapsed && (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg ring-2 ring-blue-200 dark:ring-blue-800">
                <span className="text-white font-bold text-sm">C</span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleCollapse}
              className={`p-1.5 text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 ${isCollapsed ? 'absolute -right-2 top-4 z-10' : ''}`}
            >
              {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
            </Button>
          </div>
        </div>
        
        {/* Create Report Dropdown */}
        {!isCollapsed && (
          <div className="p-3 border-b border-gray-200 dark:border-gray-600">
            <div className="relative" ref={dropdownRef}>
              <Button
                variant="outline"
                onClick={() => setIsCreateDropdownOpen(!isCreateDropdownOpen)}
                className="w-full justify-between text-sm font-medium"
              >
                <div className="flex items-center gap-2">
                  <Plus size={16} />
                  Create Report
                </div>
                <ChevronDown size={14} className={`transition-transform ${isCreateDropdownOpen ? 'rotate-180' : ''}`} />
              </Button>
              
              {isCreateDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg shadow-lg z-50">
                  {createReportItems.map((item) => {
                    const Icon = item.icon;
                    return (
                      <Link
                        key={item.name}
                        to={item.href}
                        onClick={() => setIsCreateDropdownOpen(false)}
                        className="flex items-center gap-3 px-3 py-2 text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white transition-colors"
                      >
                        <Icon size={16} />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Desktop navigation */}
        <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'}`}>
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <li key={item.name}>
                  <Link
                    to={item.href}
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                      isActive(item.href)
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                        : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <Icon size={18} />
                    {!isCollapsed && <span className="truncate">{item.name}</span>}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* Settings at bottom */}
        <div className={`p-3 border-t border-gray-200 dark:border-gray-600 ${isCollapsed ? 'px-2' : ''}`}>
          <Link
            to="/settings"
            className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              isActive('/settings')
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200 border border-blue-200 dark:border-blue-700'
                : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white'
            } ${isCollapsed ? 'justify-center px-2' : ''}`}
            title={isCollapsed ? 'Settings' : undefined}
          >
            <Settings size={18} />
            {!isCollapsed && <span className="truncate">Settings</span>}
          </Link>
        </div>
      </div>
    </>
  );
};

export default Sidebar;