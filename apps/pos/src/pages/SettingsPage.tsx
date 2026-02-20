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
  Store,
  Tag,
  Moon,
  Sun,
  Laptop,
  CheckCircle
} from 'lucide-react';
import ReceiptEditor from '../components/settings/ReceiptEditor';
import LabelDesigner from '../components/settings/LabelDesigner';
import HardwareSetupTab from '../components/settings/HardwareSetupTab';
import { useOutlet } from '../contexts/OutletContext';
import { useTerminalId } from '../hooks/useTerminalId';
import { dataService } from '../lib/dataService';
import type { BusinessSettings } from '@/types';
import {
  DEFAULT_BRAND_COLOR,
  applyBrandColorToDocument,
  mergeBrandColorIntoTerminalSettings,
  normalizeBrandColor,
  resolveBrandColorFromSettings,
} from '../lib/brandTheme';

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
    id: 'labels',
    label: 'Label Designer',
    icon: Tag,
    description: 'Customize product label layout and defaults',
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

const brandColorPresets = ['#0f172a', '#1d4ed8', '#15803d', '#b45309', '#be123c', '#0f766e'];

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('receipts');
  const [darkMode, setDarkMode] = useState(false);
  const [systemPreference, setSystemPreference] = useState<'light' | 'dark' | 'system'>('system');
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [brandColorStatus, setBrandColorStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { currentOutlet, currentUser, businessSettings, setBusinessSettings } = useOutlet();
  const { terminalId } = useTerminalId();

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

  useEffect(() => {
    const resolved = resolveBrandColorFromSettings(businessSettings);
    setBrandColor(resolved);
    applyBrandColorToDocument(resolved);
  }, [businessSettings]);

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

  const handleBrandColorChange = (color: string) => {
    const normalized = normalizeBrandColor(color);
    setBrandColor(normalized);
    setBrandColorStatus('idle');
    applyBrandColorToDocument(normalized);
  };

  const saveBrandColor = async () => {
    if (!currentOutlet?.id) return;

    setBrandColorStatus('saving');

    const mergedTerminalSettings = mergeBrandColorIntoTerminalSettings(
      businessSettings?.pos_terminal_settings,
      brandColor
    );

    const withDefaults = (payload: Record<string, unknown>): Record<string, unknown> => {
      if (businessSettings) return payload;

      return {
        ...payload,
        business_name: currentOutlet.name,
        business_type: currentOutlet.businessType || 'retail',
        theme: 'auto',
        language: 'en',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        currency: currentOutlet.currency || 'NGN',
        timezone: currentOutlet.timezone || 'Africa/Lagos',
      };
    };

    let response = await dataService.updateBusinessSettings(
      currentOutlet.id,
      withDefaults({ brand_color: brandColor }) as any
    );

    // Backward-compatible fallback for databases using JSON settings only.
    if (response.error && response.error.toLowerCase().includes('brand_color')) {
      response = await dataService.updateBusinessSettings(
        currentOutlet.id,
        withDefaults({ pos_terminal_settings: mergedTerminalSettings }) as any
      );
    }

    if (response.error || !response.data) {
      setBrandColorStatus('error');
      return;
    }

    setBusinessSettings(response.data);
    setBrandColorStatus('saved');
    setTimeout(() => setBrandColorStatus('idle'), 1500);
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case 'receipts':
        return <ReceiptCustomizationTab />;
      case 'labels':
        return <LabelDesignerTab />;
      case 'appearance':
        return (
          <AppearanceTab
            darkMode={darkMode}
            systemPreference={systemPreference}
            onThemeChange={applyTheme}
            brandColor={brandColor}
            onBrandColorChange={handleBrandColorChange}
            onSaveBrandColor={saveBrandColor}
            brandColorStatus={brandColorStatus}
            canEditBrandColor={!!currentOutlet?.id}
          />
        );
      case 'hardware':
        return (
          <HardwareSetupTab
            outletId={currentOutlet?.id}
            terminalId={terminalId || undefined}
            currentUserId={currentUser?.id}
            terminalSettings={businessSettings?.pos_terminal_settings}
          />
        );
      case 'terminal':
        return (
          <TerminalSettingsTab
            outletId={currentOutlet?.id}
            terminalId={terminalId || undefined}
          />
        );
      case 'staff':
        return <StaffSecurityTab />;
      case 'outlet':
        return <OutletSettingsTab outletId={currentOutlet?.id} />;
      default:
        return <ReceiptCustomizationTab />;
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col xl:flex-row bg-gray-50 dark:bg-gray-900 overflow-hidden">
        {/* Sidebar Navigation */}
        <div className="shrink-0 xl:w-80 bg-white dark:bg-gray-800 border-b xl:border-b-0 xl:border-r border-gray-200 dark:border-gray-700 p-3 sm:p-4 overflow-x-auto xl:overflow-y-auto">
          <div className="flex xl:flex-col gap-2 min-w-max xl:min-w-0">
            {settingsTabs.map((tab) => {
              const isActive = activeTab === tab.id;
              const colors = colorMap[tab.color];
              const Icon = tab.icon;

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`min-w-[250px] xl:min-w-0 w-full text-left p-4 rounded-xl border-2 transition-all ${
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
      <div className="flex-1 min-h-0 overflow-y-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

// Placeholder components for each settings section
const ReceiptCustomizationTab = () => (
  <div className="p-4 sm:p-6 h-full">
    <div className="max-w-7xl h-full flex flex-col">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Receipt Customization</h2>
      <div className="flex-1 overflow-hidden">
        <ReceiptEditor />
      </div>
    </div>
  </div>
);

const LabelDesignerTab = () => (
  <div className="h-full">
    <LabelDesigner />
  </div>
);

interface AppearanceTabProps {
  darkMode: boolean;
  systemPreference: 'light' | 'dark' | 'system';
  onThemeChange: (preference: 'light' | 'dark' | 'system') => void;
  brandColor: string;
  onBrandColorChange: (color: string) => void;
  onSaveBrandColor: () => void;
  brandColorStatus: 'idle' | 'saving' | 'saved' | 'error';
  canEditBrandColor: boolean;
}

const AppearanceTab: React.FC<AppearanceTabProps> = ({
  darkMode,
  systemPreference,
  onThemeChange,
  brandColor,
  onBrandColorChange,
  onSaveBrandColor,
  brandColorStatus,
  canEditBrandColor,
}) => (
  <div className="p-4 sm:p-6">
    <div className="max-w-5xl">
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Appearance</h2>

      {/* Theme Selection */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Color Theme</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
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

      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Outlet Brand Color</h3>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
          Sets the primary action color for this outlet across all POS terminals.
        </p>

        <div className="flex flex-wrap items-center gap-3 mb-4">
          <input
            type="color"
            value={brandColor}
            onChange={(e) => onBrandColorChange(e.target.value)}
            disabled={!canEditBrandColor || brandColorStatus === 'saving'}
            className="h-11 w-16 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 p-1 cursor-pointer disabled:cursor-not-allowed"
          />

          <div className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-sm font-mono text-gray-700 dark:text-gray-200 min-w-[110px]">
            {brandColor}
          </div>

          <button
            onClick={onSaveBrandColor}
            disabled={!canEditBrandColor || brandColorStatus === 'saving'}
            className="px-4 py-2.5 rounded-lg text-sm font-semibold btn-brand disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {brandColorStatus === 'saving' ? 'Saving...' : 'Save Color'}
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-3">
          {brandColorPresets.map((preset) => (
            <button
              key={preset}
              onClick={() => onBrandColorChange(preset)}
              className={`h-8 w-8 rounded-full border-2 transition-all ${
                brandColor === preset ? 'border-gray-900 dark:border-white scale-105' : 'border-gray-300 dark:border-gray-600'
              }`}
              style={{ backgroundColor: preset }}
              title={`Use ${preset}`}
            />
          ))}
        </div>

        {brandColorStatus === 'saved' && (
          <p className="text-sm text-green-600 dark:text-green-400">Brand color saved for this outlet.</p>
        )}
        {brandColorStatus === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400">Could not save brand color. Please retry.</p>
        )}
      </div>
    </div>
  </div>
);

interface TerminalSettingsTabProps {
  outletId?: string;
  terminalId?: string;
}

interface TerminalSettingsState {
  terminalName: string;
  autoLogout: string;
  soundsEnabled: boolean;
  keypadLayout: 'standard' | 'phone' | 'calculator';
}

const defaultTerminalSettings: TerminalSettingsState = {
  terminalName: 'Register 1',
  autoLogout: '30',
  soundsEnabled: true,
  keypadLayout: 'standard'
};

const TerminalSettingsTab: React.FC<TerminalSettingsTabProps> = ({ outletId, terminalId }) => {
  const [settings, setSettings] = useState<TerminalSettingsState>(defaultTerminalSettings);

  const storageKey = outletId && terminalId ? `pos_terminal_settings_${outletId}_${terminalId}` : null;

  // Load persisted terminal settings
  useEffect(() => {
    if (!storageKey) return;

    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<TerminalSettingsState>;
      setSettings(prev => ({
        terminalName: parsed.terminalName ?? prev.terminalName,
        autoLogout: parsed.autoLogout ?? prev.autoLogout,
        soundsEnabled: parsed.soundsEnabled ?? prev.soundsEnabled,
        keypadLayout: (parsed.keypadLayout as TerminalSettingsState['keypadLayout']) ?? prev.keypadLayout
      }));
    } catch {
      // Ignore malformed data
    }
  }, [storageKey]);

  // Persist on change
  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // Ignore storage errors
    }
  }, [settings, storageKey]);

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Terminal Settings</h2>

        {/* Terminal Identity */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Terminal Identity</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Terminal Name
              </label>
              <input
                type="text"
                value={settings.terminalName}
                onChange={(e) => setSettings(prev => ({ ...prev, terminalName: e.target.value }))}
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
                value={settings.autoLogout}
                onChange={(e) => setSettings(prev => ({ ...prev, autoLogout: e.target.value }))}
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
                  value={settings.keypadLayout}
                  onChange={(e) =>
                    setSettings(prev => ({
                      ...prev,
                      keypadLayout: e.target.value as TerminalSettingsState['keypadLayout']
                    }))
                  }
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
                  checked={settings.soundsEnabled}
                  onChange={(e) => setSettings(prev => ({ ...prev, soundsEnabled: e.target.checked }))}
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

interface StaffSecurityState {
  requireManagerPinForVoids: boolean;
  maxDiscountPercent: string;
  pinMinDigits: '4' | '6' | '8';
  logTransactionModifications: boolean;
  requireTwoPersonApprovalForLargeRefunds: boolean;
  cashierCanIssueRefunds: boolean;
  cashierCanApplyDiscounts: boolean;
  cashierCanVoidTransactions: boolean;
}

const defaultStaffSecurity: StaffSecurityState = {
  requireManagerPinForVoids: true,
  maxDiscountPercent: '10',
  pinMinDigits: '4',
  logTransactionModifications: true,
  requireTwoPersonApprovalForLargeRefunds: false,
  cashierCanIssueRefunds: true,
  cashierCanApplyDiscounts: false,
  cashierCanVoidTransactions: false
};

const toRecord = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
};

const toBoolean = (value: unknown, fallback: boolean): boolean =>
  typeof value === 'boolean' ? value : fallback;

const toPinMinDigits = (value: unknown, fallback: StaffSecurityState['pinMinDigits']): StaffSecurityState['pinMinDigits'] => {
  const normalized = String(value ?? fallback);
  if (normalized === '6' || normalized === '8') return normalized;
  return '4';
};

const toMaxDiscountPercent = (value: unknown, fallback: string): string => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.max(0, value));
  }
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) {
    return String(Math.max(0, Number(value)));
  }
  return fallback;
};

const parseSecurityPrefs = (settings: BusinessSettings | null): StaffSecurityState => {
  const root = toRecord(settings?.pos_security_prefs);
  const cashierPermissions = toRecord(root.cashier_permissions);

  return {
    requireManagerPinForVoids: toBoolean(root.require_manager_pin_for_voids, defaultStaffSecurity.requireManagerPinForVoids),
    maxDiscountPercent: toMaxDiscountPercent(root.max_discount_percent, defaultStaffSecurity.maxDiscountPercent),
    pinMinDigits: toPinMinDigits(root.pin_min_digits, defaultStaffSecurity.pinMinDigits),
    logTransactionModifications: toBoolean(root.log_transaction_modifications, defaultStaffSecurity.logTransactionModifications),
    requireTwoPersonApprovalForLargeRefunds: toBoolean(
      root.require_two_person_approval_for_large_refunds,
      defaultStaffSecurity.requireTwoPersonApprovalForLargeRefunds
    ),
    cashierCanIssueRefunds: toBoolean(cashierPermissions.issue_refunds_same_day, defaultStaffSecurity.cashierCanIssueRefunds),
    cashierCanApplyDiscounts: toBoolean(cashierPermissions.apply_discounts, defaultStaffSecurity.cashierCanApplyDiscounts),
    cashierCanVoidTransactions: toBoolean(cashierPermissions.void_transactions, defaultStaffSecurity.cashierCanVoidTransactions)
  };
};

const StaffSecurityTab: React.FC = () => {
  const { currentOutlet, businessSettings, setBusinessSettings } = useOutlet();
  const [state, setState] = useState<StaffSecurityState>(defaultStaffSecurity);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setState(parseSecurityPrefs(businessSettings));
  }, [businessSettings]);

  const savePolicies = async () => {
    if (!currentOutlet?.id) return;

    setSaveStatus('saving');
    setSaveError(null);

    const policyPayload = {
      max_discount_percent: Number(state.maxDiscountPercent),
      pin_min_digits: Number(state.pinMinDigits),
      require_manager_pin_for_voids: state.requireManagerPinForVoids,
      log_transaction_modifications: state.logTransactionModifications,
      require_two_person_approval_for_large_refunds: state.requireTwoPersonApprovalForLargeRefunds,
      cashier_permissions: {
        process_sales: true,
        issue_refunds_same_day: state.cashierCanIssueRefunds,
        apply_discounts: state.cashierCanApplyDiscounts,
        void_transactions: state.cashierCanVoidTransactions,
        access_receive_items: false,
        access_end_of_day: false,
        access_settings: false
      }
    };

    const withDefaults = (payload: Record<string, unknown>): Record<string, unknown> => {
      if (businessSettings) return payload;

      return {
        ...payload,
        business_name: currentOutlet.name,
        business_type: currentOutlet.businessType || 'retail',
        theme: 'auto',
        language: 'en',
        date_format: 'MM/DD/YYYY',
        time_format: '12h',
        currency: currentOutlet.currency || 'NGN',
        timezone: currentOutlet.timezone || 'Africa/Lagos',
      };
    };

    const response = await dataService.updateBusinessSettings(
      currentOutlet.id,
      withDefaults({ pos_security_prefs: policyPayload }) as any
    );

    if (response.error || !response.data) {
      setSaveStatus('error');
      setSaveError(response.error || 'Unable to save policy settings.');
      return;
    }

    setBusinessSettings(response.data);
    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Staff & Security</h2>
          <button
            onClick={savePolicies}
            disabled={!currentOutlet?.id || saveStatus === 'saving'}
            className="btn-brand text-white px-4 py-2.5 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Policy'}
          </button>
        </div>
        {saveStatus === 'saved' && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-6">
            Policies saved. Changes apply outlet-wide across all terminals.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-6">
            {saveError || 'Could not save policies. Please retry.'}
          </p>
        )}

        {/* Staff Permissions */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Default Staff Permissions</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
            Staff profiles are synced from the admin dashboard. This tab controls outlet-wide POS policy only.
          </p>

          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Cashier Permissions</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" checked readOnly />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Process sales</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={state.cashierCanIssueRefunds}
                    onChange={e => setState(prev => ({ ...prev, cashierCanIssueRefunds: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Issue refunds (same day)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={state.cashierCanApplyDiscounts}
                    onChange={e => setState(prev => ({ ...prev, cashierCanApplyDiscounts: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Apply discounts</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded border-gray-300"
                    checked={state.cashierCanVoidTransactions}
                    onChange={e => setState(prev => ({ ...prev, cashierCanVoidTransactions: e.target.checked }))}
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Void transactions</span>
                </label>
                <p className="text-xs text-gray-500 dark:text-gray-400 pt-1">
                  Receive Items is available to managers, pharmacists, and inventory staff. End of Day and Settings stay manager-only.
                </p>
              </div>
            </div>

            <div>
              <h4 className="font-medium text-gray-900 dark:text-white mb-3">Manager Permissions</h4>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" checked readOnly />
                  <span className="text-sm text-gray-700 dark:text-gray-300">All cashier permissions</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" checked readOnly />
                  <span className="text-sm text-gray-700 dark:text-gray-300">View reports</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" checked readOnly />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Manage staff</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" className="rounded border-gray-300" checked readOnly />
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum discount % (without approval)
                </label>
                <select
                  value={state.maxDiscountPercent}
                  onChange={e => setState(prev => ({ ...prev, maxDiscountPercent: e.target.value }))}
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
                <select
                  value={state.pinMinDigits}
                  onChange={e => setState(prev => ({ ...prev, pinMinDigits: e.target.value as StaffSecurityState['pinMinDigits'] }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
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
                  checked={state.requireManagerPinForVoids}
                  onChange={e => setState(prev => ({ ...prev, requireManagerPinForVoids: e.target.checked }))}
                  className="rounded border-gray-300"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require manager PIN for voids</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={state.logTransactionModifications}
                  onChange={e => setState(prev => ({ ...prev, logTransactionModifications: e.target.checked }))}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Log all transaction modifications</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={state.requireTwoPersonApprovalForLargeRefunds}
                  onChange={e => setState(prev => ({ ...prev, requireTwoPersonApprovalForLargeRefunds: e.target.checked }))}
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">Require two-person approval for large refunds</span>
              </label>
            </div>
          </div>
        </div>

        {/* Dashboard sync notice */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Staff Directory Sync</h3>
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
            Create, edit, and deactivate staff in the admin dashboard. POS pulls those profiles automatically.
          </p>
          <a
            href="https://compazz.app"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-semibold text-gray-800 dark:text-gray-100 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Open Admin Dashboard
          </a>
        </div>
      </div>
    </div>
  );
};

interface OutletSettingsTabProps {
  outletId?: string;
}

interface OutletSettingsState {
  businessName: string;
  taxRate: string;
  currency: string;
}

const defaultOutletSettings: OutletSettingsState = {
  businessName: 'Sample Supermarket',
  taxRate: '7.5',
  currency: 'NGN'
};

const OutletSettingsTab: React.FC<OutletSettingsTabProps> = ({ outletId }) => {
  const [state, setState] = useState<OutletSettingsState>(defaultOutletSettings);

  const storageKey = outletId ? `pos_outlet_settings_${outletId}` : null;

  useEffect(() => {
    if (!storageKey) return;
    try {
      const raw = localStorage.getItem(storageKey);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Partial<OutletSettingsState>;
      setState(prev => ({
        businessName: parsed.businessName ?? prev.businessName,
        taxRate: parsed.taxRate ?? prev.taxRate,
        currency: parsed.currency ?? prev.currency
      }));
    } catch {
      // ignore
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      // ignore
    }
  }, [state, storageKey]);

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl">
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
                value={state.businessName}
                onChange={e => setState(prev => ({ ...prev, businessName: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                  value={state.taxRate}
                  onChange={e => setState(prev => ({ ...prev, taxRate: e.target.value }))}
                step="0.1"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Currency
              </label>
              <select
                  value={state.currency}
                  onChange={e => setState(prev => ({ ...prev, currency: e.target.value }))}
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
              <div key={day} className="flex flex-wrap items-center gap-3">
                <div className="w-full sm:w-24">
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
                <label className="flex items-center gap-2 sm:ml-auto">
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
