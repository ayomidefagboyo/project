/**
 * Settings Page - Terminal & POS Configuration
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  Receipt,
  Printer,
  Palette,
  Monitor,
  Users,
  Shield,
  Store,
  Settings as SettingsIcon,
  Moon,
  Sun,
  Laptop,
  CheckCircle,
  AlertCircle,
  Wifi
} from 'lucide-react';
import ReceiptEditor from '../components/settings/ReceiptEditor';

interface SettingsTab {
  id: string;
  label: string;
  icon: React.ElementType;
  description: string;
  color: string;
}

const settingsTabs: SettingsTab[] = [
  {
    id: 'receipts',
    label: 'Receipt Customization',
    icon: Receipt,
    description: 'Customize receipt layout and branding',
    color: 'blue'
  },
  {
    id: 'appearance',
    label: 'Appearance',
    icon: Palette,
    description: 'Dark mode and interface preferences',
    color: 'purple'
  },
  {
    id: 'hardware',
    label: 'Hardware Setup',
    icon: Printer,
    description: 'Printers, scanners, and peripherals',
    color: 'green'
  },
  {
    id: 'terminal',
    label: 'Terminal Settings',
    icon: Monitor,
    description: 'POS terminal configuration',
    color: 'orange'
  },
  {
    id: 'staff',
    label: 'Staff & Security',
    icon: Users,
    description: 'Staff permissions and access control',
    color: 'red'
  },
  {
    id: 'outlet',
    label: 'Outlet Settings',
    icon: Store,
    description: 'Business info and preferences',
    color: 'teal'
  }
];

const colorMap: Record<string, { bg: string; text: string; icon: string; border: string; hover: string }> = {
  blue: { bg: 'bg-blue-50', text: 'text-blue-900', icon: 'bg-blue-600', border: 'border-blue-200', hover: 'hover:bg-blue-100' },
  purple: { bg: 'bg-purple-50', text: 'text-purple-900', icon: 'bg-purple-600', border: 'border-purple-200', hover: 'hover:bg-purple-100' },
  green: { bg: 'bg-green-50', text: 'text-green-900', icon: 'bg-green-600', border: 'border-green-200', hover: 'hover:bg-green-100' },
  orange: { bg: 'bg-orange-50', text: 'text-orange-900', icon: 'bg-orange-600', border: 'border-orange-200', hover: 'hover:bg-orange-100' },
  red: { bg: 'bg-red-50', text: 'text-red-900', icon: 'bg-red-600', border: 'border-red-200', hover: 'hover:bg-red-100' },
  teal: { bg: 'bg-teal-50', text: 'text-teal-900', icon: 'bg-teal-600', border: 'border-teal-200', hover: 'hover:bg-teal-100' }
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('receipts');
  const [darkMode, setDarkMode] = useState(false);
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark' | 'system'>('system');

  // Initialize theme on component mount
  useEffect(() => {
    const saved = localStorage.getItem('pos-theme-preference');
    if (saved) {
      setSystemPreference(saved as 'light' | 'dark' | 'system');
    }

    // Check if dark mode is currently active
    const isDark = document.documentElement.classList.contains('dark');
    setDarkMode(isDark);
  }, []);

  // Apply theme changes
  const applyTheme = (preference: 'light' | 'dark' | 'system') => {
    setSystemPreference(preference);
    localStorage.setItem('pos-theme-preference', preference);

    if (preference === 'system') {
      const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      setDarkMode(systemDark);
      if (systemDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    } else if (preference === 'dark') {
      setDarkMode(true);
      document.documentElement.classList.add('dark');
    } else {
      setDarkMode(false);
      document.documentElement.classList.remove('dark');
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'receipts':
        return <ReceiptCustomizationTab />;
      case 'appearance':
        return (
          <AppearanceTab
            darkMode={darkMode}
            systemPreference={systemPreference}
            onThemeChange={applyTheme}
          />
        );
      case 'hardware':
        return <HardwareSetupTab />;
      case 'terminal':
        return <TerminalSettingsTab />;
      case 'staff':
        return <StaffSecurityTab />;
      case 'outlet':
        return <OutletSettingsTab />;
      default:
        return <ReceiptCustomizationTab />;
    }
  };

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 p-4 overflow-y-auto">
          <div className="space-y-2">
            {settingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const colors = colorMap[tab.color];
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    isActive
                      ? `${colors.bg} ${colors.border} ${colors.text} dark:bg-gray-700 dark:border-gray-600`
                      : `border-transparent hover:bg-gray-50 dark:hover:bg-gray-700 ${colors.hover}`
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`w-10 h-10 ${colors.icon} rounded-lg flex items-center justify-center flex-shrink-0`}>
                      <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className={`font-semibold ${isActive ? colors.text : 'text-gray-900 dark:text-white'}`}>
                        {tab.label}
                      </h3>
                      <p className={`text-sm mt-1 ${isActive ? 'text-gray-600 dark:text-gray-300' : 'text-gray-500 dark:text-gray-400'}`}>
                        {tab.description}
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

// Placeholder components for each settings section
const ReceiptCustomizationTab = () => (
  <div className="p-6 h-full">
    <div className="max-w-7xl h-full flex flex-col">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Receipt Customization</h2>
      <div className="flex-1 overflow-hidden">
        <ReceiptEditor />
      </div>
    </div>
  </div>
);

interface AppearanceTabProps {
  darkMode: boolean;
  systemPreference: 'light' | 'dark' | 'system';
  onThemeChange: (preference: 'light' | 'dark' | 'system') => void;
}

const AppearanceTab: React.FC<AppearanceTabProps> = ({ darkMode, systemPreference, onThemeChange }) => (
  <div className="p-6">
    <div className="max-w-4xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Appearance</h2>

      {/* Theme Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Color Theme</h3>
        <div className="grid grid-cols-3 gap-4">
          {/* Light Mode */}
          <button
            onClick={() => onThemeChange('light')}
            className={`p-4 rounded-xl border-2 transition-all ${
              systemPreference === 'light'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Sun className="w-8 h-8 text-yellow-500" />
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-gray-900 dark:text-white">Light</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Bright interface</p>
            </div>
          </button>

          {/* Dark Mode */}
          <button
            onClick={() => onThemeChange('dark')}
            className={`p-4 rounded-xl border-2 transition-all ${
              systemPreference === 'dark'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Moon className="w-8 h-8 text-blue-500" />
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-gray-900 dark:text-white">Dark</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Easy on the eyes</p>
            </div>
          </button>

          {/* System */}
          <button
            onClick={() => onThemeChange('system')}
            className={`p-4 rounded-xl border-2 transition-all ${
              systemPreference === 'system'
                ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
            }`}
          >
            <div className="flex items-center justify-center mb-3">
              <Laptop className="w-8 h-8 text-gray-500" />
            </div>
            <div className="text-center">
              <h4 className="font-semibold text-gray-900 dark:text-white">System</h4>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Follow device settings</p>
            </div>
          </button>
        </div>

        {/* Current Status */}
        <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-500" />
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Currently using <strong>{darkMode ? 'dark' : 'light'}</strong> mode
            </span>
          </div>
        </div>
      </div>
    </div>
  </div>
);

const HardwareSetupTab = () => {
  const [printers, setPrinters] = useState([
    { id: 'thermal-1', name: 'Receipt Printer', type: 'thermal', status: 'connected', defaultPrint: 'receipts' },
    { id: 'label-1', name: 'Label Printer', type: 'label', status: 'disconnected', defaultPrint: 'labels' }
  ]);
  const [scanners, setScanners] = useState([
    { id: 'scanner-1', name: 'Barcode Scanner', type: 'usb', status: 'connected' }
  ]);
  const [cashDrawers, setCashDrawers] = useState([
    { id: 'drawer-1', name: 'Cash Drawer', type: 'rj11', status: 'connected' }
  ]);

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Hardware Setup</h2>

        {/* Printers Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Printer className="w-5 h-5" />
              Printers
            </h3>
            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
              Add Printer
            </button>
          </div>

          <div className="space-y-3">
            {printers.map((printer) => (
              <div key={printer.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${printer.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{printer.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {printer.type} printer • Default for {printer.defaultPrint}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                    Test Print
                  </button>
                  <button className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Scanners Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Wifi className="w-5 h-5" />
              Barcode Scanners
            </h3>
            <button className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm">
              Add Scanner
            </button>
          </div>

          <div className="space-y-3">
            {scanners.map((scanner) => (
              <div key={scanner.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${scanner.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{scanner.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {scanner.type.toUpperCase()} connection
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                    Test Scan
                  </button>
                  <button className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Drawer Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
              <Monitor className="w-5 h-5" />
              Cash Drawer
            </h3>
          </div>

          <div className="space-y-3">
            {cashDrawers.map((drawer) => (
              <div key={drawer.id} className="flex items-center justify-between p-4 border border-gray-200 dark:border-gray-600 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${drawer.status === 'connected' ? 'bg-green-500' : 'bg-red-500'}`}></div>
                  <div>
                    <div className="font-medium text-gray-900 dark:text-white">{drawer.name}</div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {drawer.type.toUpperCase()} connection
                    </div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-sm">
                    Open Drawer
                  </button>
                  <button className="px-3 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-sm">
                    Configure
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hardware Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Hardware Preferences</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Auto-open cash drawer
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="on-sale">On every sale</option>
                  <option value="cash-only">Cash payments only</option>
                  <option value="manual">Manual only</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Receipt auto-print
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="always">Always print</option>
                  <option value="ask">Ask customer</option>
                  <option value="never">Manual only</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable barcode scanner beep</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Cut receipt paper after printing</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Print duplicate receipts</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const TerminalSettingsTab = () => {
  const [terminalName, setTerminalName] = useState('Register 1');
  const [autoLogout, setAutoLogout] = useState('30');
  const [soundsEnabled, setSoundsEnabled] = useState(true);
  const [keypadLayout, setKeypadLayout] = useState('standard');

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Terminal Settings</h2>

        {/* Terminal Identity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Terminal Identity</h3>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Terminal Name
              </label>
              <input
                type="text"
                value={terminalName}
                onChange={(e) => setTerminalName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Terminal ID
              </label>
              <input
                type="text"
                value="TRM-001"
                disabled
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
              />
            </div>
          </div>
        </div>

        {/* Session & Security */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Session & Security</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Auto logout after (minutes)
              </label>
              <select
                value={autoLogout}
                onChange={(e) => setAutoLogout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="15">15 minutes</option>
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="120">2 hours</option>
                <option value="never">Never</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require PIN for transaction voids</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require PIN for discounts</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Lock terminal on idle</span>
              </label>
            </div>
          </div>
        </div>

        {/* Interface Preferences */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Interface Preferences</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Keypad Layout
              </label>
              <select
                value={keypadLayout}
                onChange={(e) => setKeypadLayout(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="standard">Standard (123...)</option>
                <option value="phone">Phone style (789...)</option>
                <option value="calculator">Calculator style</option>
              </select>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={soundsEnabled}
                  onChange={(e) => setSoundsEnabled(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Enable sounds</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show product images</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Show running total</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const StaffSecurityTab = () => {
  const [requirePinForVoids, setRequirePinForVoids] = useState(true);
  const [maxDiscountPercent, setMaxDiscountPercent] = useState('10');

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Staff & Security</h2>

        {/* Staff Permissions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Default Staff Permissions</h3>

          <div className="grid grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Cashier Permissions</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Process sales</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Issue refunds (same day)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Apply discounts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Void transactions</span>
                </label>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Manager Permissions</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">All cashier permissions</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">View reports</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Manage staff</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                  <span className="text-sm text-gray-700 dark:text-gray-300">End of day operations</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Security Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Security Settings</h3>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum discount % (without approval)
                </label>
                <select
                  value={maxDiscountPercent}
                  onChange={(e) => setMaxDiscountPercent(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="5">5%</option>
                  <option value="10">10%</option>
                  <option value="15">15%</option>
                  <option value="20">20%</option>
                  <option value="0">No limit</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  PIN Requirements
                </label>
                <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                  <option value="4">4 digits minimum</option>
                  <option value="6">6 digits minimum</option>
                  <option value="8">8 digits minimum</option>
                </select>
              </div>
            </div>

            <div className="space-y-3">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={requirePinForVoids}
                  onChange={(e) => setRequirePinForVoids(e.target.checked)}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require manager PIN for voids</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" defaultChecked />
                <span className="text-sm text-gray-700 dark:text-gray-300">Log all transaction modifications</span>
              </label>
              <label className="flex items-center gap-2">
                <input type="checkbox" className="rounded border-gray-300" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require two-person approval for large refunds</span>
              </label>
            </div>
          </div>
        </div>

        {/* Quick Staff Actions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Quick Actions</h3>

          <div className="flex gap-3">
            <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
              Manage Staff
            </button>
            <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors">
              Add New Cashier
            </button>
            <button className="px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors">
              Reset All PINs
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

const OutletSettingsTab = () => {
  const [businessName, setBusinessName] = useState('Sample Supermarket');
  const [taxRate, setTaxRate] = useState('7.5');
  const [currency, setCurrency] = useState('NGN');

  return (
    <div className="p-6">
      <div className="max-w-4xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Outlet Settings</h2>

        {/* Business Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Business Information</h3>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Name
              </label>
              <input
                type="text"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Phone Number
                </label>
                <input
                  type="tel"
                  defaultValue="+234 800 123 4567"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  defaultValue="info@samplemart.ng"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Address
              </label>
              <textarea
                defaultValue="Plot 123, Main Street&#10;Ikeja, Lagos State"
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>
        </div>

        {/* Financial Settings */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Financial Settings</h3>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(e.target.value)}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="NGN">Nigerian Naira (₦)</option>
                <option value="USD">US Dollar ($)</option>
                <option value="EUR">Euro (€)</option>
                <option value="GBP">British Pound (£)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Rounding
              </label>
              <select className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white">
                <option value="0.01">To nearest kobo</option>
                <option value="0.05">To nearest 5 kobo</option>
                <option value="1">To nearest naira</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300" defaultChecked />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include tax in product prices (tax-inclusive)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="rounded border-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable multi-currency support</span>
            </label>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operating Hours</h3>

          <div className="space-y-3">
            {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map((day) => (
              <div key={day} className="flex items-center gap-4">
                <div className="w-24">
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{day}</span>
                </div>
                <input
                  type="time"
                  defaultValue="08:00"
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <span className="text-gray-500">to</span>
                <input
                  type="time"
                  defaultValue={day === 'Sunday' ? '18:00' : '20:00'}
                  className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" defaultChecked={day !== 'Sunday'} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                </label>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;