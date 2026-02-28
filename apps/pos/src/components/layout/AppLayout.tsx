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
  ShoppingCart,
  ClipboardCheck,
  ArrowLeftRight,
  HeartPulse,
} from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useOutlet } from '../../contexts/OutletContext';
import { clearStaffSession } from '../../lib/staffSessionStorage';

interface AppLayoutProps {
  children: React.ReactNode;
  headerContent?: React.ReactNode;
  staffRole?: string | null;
}

// Sidebar navigation items
interface NavItem {
  path: string;
  label: string;
  sublabel: string;
  icon: React.ComponentType<{ className?: string }>;
  managerOnly?: boolean;
  pharmacistOnly?: boolean;
  managerOrPharmacist?: boolean;
}

const navItems: NavItem[] = [
  {
    path: '/',
    label: 'Register',
    sublabel: 'Ring Up Sales',
    icon: Monitor,
  },
  {
    path: '/transactions',
    label: 'Transactions',
    sublabel: 'Sales History',
    icon: Receipt,
  },
  {
    path: '/products',
    label: 'Items',
    sublabel: 'Products & Inventory',
    icon: Package,
  },
  {
    path: '/purchasing',
    label: 'Purchasing',
    sublabel: 'Replenish Stock',
    icon: ShoppingCart,
  },
  {
    path: '/receive',
    label: 'Receive Items',
    sublabel: 'Vendor Invoices',
    icon: Truck,
  },
  {
    path: '/stocktaking',
    label: 'Stocktaking',
    sublabel: 'Reconcile Inventory',
    icon: ClipboardCheck,
    managerOrPharmacist: true,
  },
  {
    path: '/transfer-outlet',
    label: 'Transfer Outlet',
    sublabel: 'Move Stock',
    icon: ArrowLeftRight,
    managerOrPharmacist: true,
  },
  {
    path: '/patients',
    label: 'Pharmacy Patients',
    sublabel: 'Vitals & Records',
    icon: HeartPulse,
    pharmacistOnly: true,
  },
  {
    path: '/eod',
    label: 'End of Day',
    sublabel: 'Close & Reconcile',
    icon: Calendar,
  },
];

const AppLayout: React.FC<AppLayoutProps> = ({ children, headerContent, staffRole }) => {
  const { currentUser, currentOutlet } = useOutlet();
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const normalizedStaffRole = (staffRole || '').toLowerCase();
  const isCashier = normalizedStaffRole === 'cashier';
  const isManager = normalizedStaffRole === 'manager';
  const isInventoryStaff = normalizedStaffRole === 'inventory_staff';
  const isPharmacist = normalizedStaffRole === 'pharmacist' || normalizedStaffRole === 'accountant';
  const canAccessSettings = normalizedStaffRole === 'manager';
  const canAccessReceive = isManager || isPharmacist || isInventoryStaff;

  // Clock out handler – returns to staff auth (PIN entry), NOT main sign-in
  const handleClockOut = () => {
    clearStaffSession();
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
  const visibleNavItems = navItems.filter((item) => {
    if (item.managerOrPharmacist && !(isManager || isPharmacist)) return false;
    if (item.managerOnly && !isManager) return false;
    if (item.pharmacistOnly && !isPharmacist) return false;
    if ((item.path === '/receive' || item.path === '/purchasing') && !canAccessReceive) return false;
    if (isCashier && (item.path === '/receive' || item.path === '/purchasing' || item.path === '/eod')) return false;
    return true;
  });

  return (
    <div className="w-full h-screen min-h-0 overflow-hidden bg-stone-50 flex">
      {/* ======== Sidebar ======== */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-slate-900/35 backdrop-blur-[1px] z-40 transition-opacity"
            onClick={() => setShowSidebar(false)}
          />

          {/* Panel */}
          <div className="fixed left-0 top-0 h-full w-[90vw] max-w-[24rem] bg-stone-50 shadow-2xl border-r border-stone-200 z-50 flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-6 border-b border-stone-200">
              <div>
                <p className="text-[11px] font-medium tracking-[0.14em] uppercase text-stone-500">POS Terminal</p>
                <h2 className="text-[20px] font-semibold text-slate-900 capitalize mt-1.5">
                  {currentOutlet?.name || 'Point of Sale'}
                </h2>
              </div>
              <button
                onClick={() => setShowSidebar(false)}
                className="p-2.5 rounded-xl text-stone-500 hover:text-slate-900 hover:bg-stone-200/70 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 px-4 py-5 overflow-y-auto">
              <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.14em] uppercase text-stone-500">
                Operations
              </p>
              <div className="space-y-2">
              {visibleNavItems.map((item) => {
                const active = isActive(item.path);
                const Icon = item.icon;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setShowSidebar(false)}
                    className={`group flex items-center gap-4 px-4 py-4 rounded-2xl border transition-all active:scale-[0.99] ${
                      active
                        ? 'bg-white border-stone-300 shadow-[0_1px_2px_rgba(0,0,0,0.05)]'
                        : 'border-transparent hover:bg-stone-100/80'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                      active
                        ? 'bg-slate-900 text-stone-100'
                        : 'bg-stone-200 text-slate-600 group-hover:bg-stone-300'
                    }`}>
                      <Icon className="w-6 h-6" />
                    </div>
                    <div>
                      <span className={`text-[18px] font-semibold block leading-tight ${
                        active ? 'text-slate-900' : 'text-slate-700'
                      }`}>
                        {item.label}
                      </span>
                      <span className="text-[14px] text-stone-500">{item.sublabel}</span>
                    </div>
                  </Link>
                );
              })}
              </div>
            </nav>

            {/* Bottom Section */}
            <div className="px-4 py-5 border-t border-stone-200">
              <p className="px-3 pb-2 text-[11px] font-medium tracking-[0.14em] uppercase text-stone-500">
                System
              </p>
              <div className="space-y-2">
              {/* Clock Out */}
              <button
                type="button"
                onClick={() => { setShowSidebar(false); handleClockOut(); }}
                className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-transparent hover:bg-white hover:border-stone-300 active:scale-[0.99] transition-all"
              >
                <div className="w-12 h-12 bg-stone-200 text-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                  <LogOut className="w-6 h-6" />
                </div>
                <div className="text-left">
                  <span className="text-[18px] font-semibold text-slate-900 block leading-tight">Clock Out</span>
                  <span className="text-[14px] text-stone-500">End Shift</span>
                </div>
              </button>

              {canAccessSettings && (
                <button
                  type="button"
                  onClick={() => {
                    setShowSidebar(false);
                    navigate('/settings');
                  }}
                  className="w-full flex items-center gap-4 px-4 py-4 rounded-2xl border border-transparent hover:bg-white hover:border-stone-300 active:scale-[0.99] transition-all"
                >
                  <div className="w-12 h-12 bg-stone-200 text-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Settings className="w-6 h-6" />
                  </div>
                  <div className="text-left">
                    <span className="text-[18px] font-semibold text-slate-900 block leading-tight">Settings</span>
                    <span className="text-[14px] text-stone-500">Preferences</span>
                  </div>
                </button>
              )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ======== Main Content ======== */}
      <div className="flex-1 min-w-0 min-h-0 flex flex-col h-full overflow-hidden">
        {/* Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            {/* Left: Menu + Outlet */}
            <div className="flex min-w-0 items-center space-x-3 flex-shrink-0">
              <button
                onClick={() => setShowSidebar(true)}
                className="p-3 hover:bg-gray-200 rounded-xl transition-colors"
              >
                <Menu className="w-7 h-7 text-gray-600" />
              </button>
              <div className="min-w-0">
                <h1 className="truncate text-lg sm:text-xl font-bold text-gray-900 leading-tight capitalize">
                  {currentOutlet?.name || 'Outlet'}
                </h1>
              </div>
            </div>

            {/* Right: Dynamic page header content */}
            <div className="w-full min-w-0 flex-1 xl:flex-initial">
              {headerContent}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;
