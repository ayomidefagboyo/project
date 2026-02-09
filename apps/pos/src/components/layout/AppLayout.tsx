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
  Truck,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useOutlet } from '../../contexts/OutletContext';

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
    path: '/receive',
    label: 'Receive Items',
    sublabel: 'Vendor Invoices',
    icon: Truck,
    color: 'teal',
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
  teal:   { active: 'bg-teal-100   border-teal-300',  idle: 'hover:bg-teal-50',   icon: 'bg-teal-600',   text: 'text-teal-900',   sub: 'text-teal-600' },
  amber:  { active: 'bg-amber-100  border-amber-300', idle: 'hover:bg-amber-50',  icon: 'bg-amber-600',  text: 'text-amber-900',  sub: 'text-amber-600' },
};

const AppLayout: React.FC<AppLayoutProps> = ({ children, headerContent }) => {
  const { currentUser, currentOutlet } = useOutlet();
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();

  // Clock out handler – returns to staff auth (PIN entry), NOT main sign-in
  const handleClockOut = () => {
    localStorage.removeItem('pos_staff_session');
    // Dispatch event so App.tsx can reset terminal phase to staff_auth
    window.dispatchEvent(new CustomEvent('pos-staff-logout'));
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

            {/* Navigation – large touch targets */}
            <nav className="flex-1 px-3 py-4 space-y-2 overflow-y-auto">
              {navItems.map((item) => {
                const active = isActive(item.path);
                const c = colorMap[item.color];
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowSidebar(false)}
                    className={`flex items-center gap-4 px-4 py-4 rounded-2xl border-2 transition-all active:scale-[0.97] ${
                      active
                        ? `${c.active}`
                        : `border-transparent ${c.idle}`
                    }`}
                  >
                    <div className={`w-12 h-12 ${c.icon} rounded-xl flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <span className={`text-base font-bold ${c.text} block leading-tight`}>
                        {item.label}
                      </span>
                      <span className={`text-sm ${c.sub}`}>{item.sublabel}</span>
                    </div>
                  </Link>
                );
              })}
            </nav>

            {/* Bottom Section – touch-friendly */}
            <div className="px-3 py-4 border-t border-gray-100 space-y-2">
              {/* Clock Out */}
              <button
                type="button"
                onClick={() => { setShowSidebar(false); handleClockOut(); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-red-50 active:scale-[0.97] transition-all"
              >
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-base font-bold text-red-800 block leading-tight">Clock Out</span>
                  <span className="text-sm text-red-600">End Shift</span>
                </div>
              </button>

              {/* Settings */}
              <button
                type="button"
                onClick={() => setShowSidebar(false)}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl hover:bg-gray-100 active:scale-[0.97] transition-all"
              >
                <div className="w-12 h-12 bg-gray-400 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Settings className="w-6 h-6 text-white" />
                </div>
                <div className="text-left">
                  <span className="text-base font-bold text-gray-800 block leading-tight">Settings</span>
                  <span className="text-sm text-gray-500">Preferences</span>
                </div>
              </button>
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