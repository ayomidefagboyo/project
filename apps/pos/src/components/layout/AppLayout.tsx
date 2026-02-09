/**
 * Global App Layout with Sidebar
 * Modeled after Square POS / QuickBooks POS navigation
 */

import React, { useEffect, useState } from 'react';
import {
  Menu,
  X,
  Monitor,
  Settings,
  Clock,
  Package,
  Receipt,
  Calendar,
  LogOut,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useOutlet } from '../../contexts/OutletContext';
import { authService } from '@/lib/auth';

interface AppLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
}

// Sidebar navigation items
const navItems = [
  {
    path: '/',
    label: 'Register',
    sublabel: 'Ring Up Sales',
    icon: Monitor,
    color: 'green',
  },
  {
    path: '/transactions',
    label: 'Transactions',
    sublabel: 'Sales History',
    icon: Receipt,
    color: 'blue',
  },
  {
    path: '/products',
    label: 'Items',
    sublabel: 'Products & Inventory',
    icon: Package,
    color: 'purple',
  },
  {
    path: '/eod',
    label: 'End of Day',
    sublabel: 'Close & Reconcile',
    icon: Calendar,
    color: 'amber',
  },
];

const colorMap: Record<string, { active: string; idle: string; icon: string; text: string; sub: string }> = {
  green:  { active: 'bg-green-100  border-green-300', idle: 'hover:bg-green-50',  icon: 'bg-green-600',  text: 'text-green-900',  sub: 'text-green-600' },
  blue:   { active: 'bg-blue-100   border-blue-300',  idle: 'hover:bg-blue-50',   icon: 'bg-blue-600',   text: 'text-blue-900',   sub: 'text-blue-600' },
  purple: { active: 'bg-purple-100 border-purple-300', idle: 'hover:bg-purple-50', icon: 'bg-purple-600', text: 'text-purple-900', sub: 'text-purple-600' },
  amber:  { active: 'bg-amber-100  border-amber-300', idle: 'hover:bg-amber-50',  icon: 'bg-amber-600',  text: 'text-amber-900',  sub: 'text-amber-600' },
};

const AppLayout: React.FC<AppLayoutProps> = ({ children, headerContent }) => {
  const { currentUser, currentOutlet } = useOutlet();
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  // Clock out handler
  const handleClockOut = async () => {
    try {
      const { error } = await authService.signOut();
      if (!error) {
        navigate('/auth', { replace: true });
      } else {
        console.error('Clock out error:', error);
      }
    } catch (err) {
      console.error('Clock out error:', err);
    }
  };

  // Allow header cashier button to trigger clock-out via custom event
  useEffect(() => {
    const listener = () => { handleClockOut(); };
    window.addEventListener('pos-clock-out', listener);
    return () => window.removeEventListener('pos-clock-out', listener);
  }, []);

  const isActive = (path: string) => location.pathname === path;

  return (
    <div className="w-screen h-screen overflow-hidden bg-gray-50 flex">
      {/* ======== Sidebar ======== */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black/40 z-40 transition-opacity"
            onClick={() => setShowSidebar(false)}
          />

          {/* Panel */}
          <div className="fixed left-0 top-0 h-full w-72 bg-white shadow-2xl z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
              <div>
                <h2 className="text-base font-bold text-gray-900 capitalize">
                  {currentOutlet?.name || 'Point of Sale'}
                </h2>
                <p className="text-xs text-gray-500 mt-0.5">POS Terminal</p>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.path);
                const c = colorMap[item.color];
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowSidebar(false)}
                    className={`flex items-center gap-3 px-3 py-3 rounded-xl border transition-all ${
                      active
                        ? `${c.active} border-opacity-100`
                        : `border-transparent ${c.idle}`
                    }`}
                  >
                    <div className={`w-10 h-10 ${c.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <span className={`text-sm font-semibold ${c.text} block leading-tight`}>
                        {item.label}
                      </span>
                      <span className={`text-xs ${c.sub}`}>{item.sublabel}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom Section */}
            <div className="px-3 py-4 border-t border-gray-100 space-y-1">
              {/* Clock Out */}
              <button
                type="button"
                onClick={() => { setShowSidebar(false); handleClockOut(); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-red-50 transition-colors"
              >
                <div className="w-10 h-10 bg-red-500 rounded-lg flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-red-800 block leading-tight">Clock Out</span>
                  <span className="text-xs text-red-600">End Shift</span>
                </div>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-gray-100 transition-colors"
              >
                <div className="w-10 h-10 bg-gray-400 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Settings className="w-5 h-5 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-sm font-semibold text-gray-800 block leading-tight">Settings</span>
                  <span className="text-xs text-gray-500">Preferences</span>
                </div>
              </button>

              {/* Signed-in user */}
              <div className="flex items-center gap-3 px-3 pt-3 mt-2 border-t border-gray-100">
                <div className="w-8 h-8 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">
                    {currentUser?.name?.charAt(0)?.toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-900 truncate">{currentUser?.name || 'User'}</div>
                  <div className="text-xs text-gray-500 truncate">{currentUser?.role || 'Cashier'}</div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======== Main Content ======== */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            {/* Left: Menu + Outlet */}
            <div className="flex items-center space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 leading-tight capitalize">
                  {currentOutlet?.name || 'Outlet'}
                </h1>
              </div>
            </div>

            {/* Right: Dynamic page header content */}
            <div className="flex-1 lg:flex-initial lg:max-w-4xl w-full">
              {headerContent}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;