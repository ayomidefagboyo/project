/**
 * Global App Layout with Sidebar
 * Available throughout the entire application
 */

import React, { useState } from 'react';
import {
  Menu,
  X,
  Monitor,
  Settings,
  Clock,
  Package,
  Plus,
  RotateCcw,
} from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';
import { useOutlet } from '../../contexts/OutletContext';

interface AppLayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<AppLayoutProps> = ({ children }) => {
  const { currentUser, currentOutlet } = useOutlet();
  const [showSidebar, setShowSidebar] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Global Sidebar */}
      {showSidebar && (
        <>
          {/* Overlay */}
          <div
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setShowSidebar(false)}
          />

          {/* Sidebar */}
          <div className="fixed left-0 top-0 h-full w-80 bg-white shadow-lg z-50 transform transition-transform flex flex-col">
            <div className="flex-1 p-6">
              <div className="flex items-center justify-end mb-8">
                <button
                  onClick={() => setShowSidebar(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Main Navigation */}
              <div className="space-y-4">
                {/* Register - Navigate to Sales Terminal */}
                <Link
                  to="/"
                  onClick={() => setShowSidebar(false)}
                  className={`w-full flex items-center p-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-sm ${
                    location.pathname === '/'
                      ? 'bg-gradient-to-r from-green-100 to-green-200'
                      : 'bg-gradient-to-r from-green-50 to-green-100 hover:from-green-100 hover:to-green-200'
                  }`}
                >
                  <div className="w-12 h-12 bg-green-500 rounded-lg flex items-center justify-center mr-4">
                    <Monitor className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold text-green-900 block">Register</span>
                    <span className="text-sm text-green-700">Sales Terminal</span>
                  </div>
                </Link>

                <Link
                  to="/products"
                  onClick={() => setShowSidebar(false)}
                  className={`w-full flex items-center p-4 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-sm ${
                    location.pathname === '/products'
                      ? 'bg-gradient-to-r from-blue-100 to-blue-200'
                      : 'bg-gradient-to-r from-blue-50 to-blue-100 hover:from-blue-100 hover:to-blue-200'
                  }`}
                >
                  <div className="w-12 h-12 bg-blue-500 rounded-lg flex items-center justify-center mr-4">
                    <Package className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold text-blue-900 block">Products</span>
                    <span className="text-sm text-blue-700">Manage Inventory</span>
                  </div>
                </Link>

                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-full flex items-center p-4 bg-gradient-to-r from-purple-50 to-purple-100 hover:from-purple-100 hover:to-purple-200 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-sm"
                >
                  <div className="w-12 h-12 bg-purple-500 rounded-lg flex items-center justify-center mr-4">
                    <RotateCcw className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold text-purple-900 block">Transfers</span>
                    <span className="text-sm text-purple-700">Between Outlets</span>
                  </div>
                </button>

                <button
                  onClick={() => setShowSidebar(false)}
                  className="w-full flex items-center p-4 bg-gradient-to-r from-orange-50 to-orange-100 hover:from-orange-100 hover:to-orange-200 rounded-xl transition-all duration-200 transform hover:scale-105 shadow-sm"
                >
                  <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mr-4">
                    <Plus className="w-6 h-6 text-white" />
                  </div>
                  <div className="text-left">
                    <span className="text-lg font-semibold text-orange-900 block">Add Product</span>
                    <span className="text-sm text-orange-700">Quick Add</span>
                  </div>
                </button>
              </div>
            </div>

            {/* Bottom Section - Settings and Clock In/Out */}
            <div className="p-6 border-t border-gray-200">
              <div className="space-y-3">
                {/* Clock In/Out */}
                <button className="w-full flex items-center p-3 bg-gradient-to-r from-indigo-50 to-indigo-100 hover:from-indigo-100 hover:to-indigo-200 rounded-lg transition-all duration-200">
                  <div className="w-10 h-10 bg-indigo-500 rounded-lg flex items-center justify-center mr-3">
                    <Clock className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-sm font-semibold text-indigo-900 block">Clock In</span>
                    <span className="text-xs text-indigo-700">Start Shift</span>
                  </div>
                </button>

                {/* Settings */}
                <button className="w-full flex items-center p-3 bg-gradient-to-r from-gray-50 to-gray-100 hover:from-gray-100 hover:to-gray-200 rounded-lg transition-all duration-200">
                  <div className="w-10 h-10 bg-gray-500 rounded-lg flex items-center justify-center mr-3">
                    <Settings className="w-5 h-5 text-white" />
                  </div>
                  <div className="text-left flex-1">
                    <span className="text-sm font-semibold text-gray-900 block">Settings</span>
                    <span className="text-xs text-gray-700">Preferences</span>
                  </div>
                </button>
              </div>

              {/* User Info */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-semibold">
                      {currentUser?.name?.charAt(0) || 'U'}
                    </span>
                  </div>
                  <div className="text-left">
                    <div className="text-sm font-medium text-gray-900">{currentUser?.name || 'User'}</div>
                    <div className="text-xs text-gray-600">{currentUser?.role || 'Cashier'}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Global Header */}
        <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: Menu + Title */}
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowSidebar(true)}
                className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Menu className="w-6 h-6 text-gray-600" />
              </button>

              <div>
                <h1 className="text-xl font-bold text-gray-900 leading-tight capitalize">
                  {currentOutlet?.name || 'Outlet'}
                </h1>
              </div>
            </div>

            {/* Right: Could add global status indicators here */}
            <div className="flex items-center space-x-3">
              {/* Add global status indicators if needed */}
            </div>
          </div>
        </div>

        {/* Page Content */}
        <div className="flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AppLayout;