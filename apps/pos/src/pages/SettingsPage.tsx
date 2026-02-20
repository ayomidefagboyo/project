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
import { posService } from '../lib/posService';
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

type ThemePreference = 'light' | 'dark' | 'system';

const THEME_PREFERENCE_STORAGE_KEY = 'pos-theme-preference';

const normalizeThemePreference = (value: unknown): ThemePreference => {
  if (value === 'light' || value === 'dark') return value;
  return 'system';
};

const mapBusinessThemeToPreference = (value: unknown): ThemePreference => {
  if (value === 'light' || value === 'dark') return value;
  return 'system';
};

const mapPreferenceToBusinessTheme = (preference: ThemePreference): 'light' | 'dark' | 'auto' => (
  preference === 'system' ? 'auto' : preference
);

const applyThemePreferenceToDocument = (preference: ThemePreference): boolean => {
  if (typeof document === 'undefined') return false;

  const shouldUseDark =
    preference === 'dark' ||
    (
      preference === 'system' &&
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches
    );

  if (shouldUseDark) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }

  return shouldUseDark;
};

const SettingsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('receipts');
  const [darkMode, setDarkMode] = useState(false);
  const [systemPreference, setSystemPreference] = useState<ThemePreference>('system');
  const [brandColor, setBrandColor] = useState(DEFAULT_BRAND_COLOR);
  const [brandColorStatus, setBrandColorStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const { currentOutlet, currentUser, businessSettings, setBusinessSettings } = useOutlet();
  const { terminalId } = useTerminalId();

  // Use local cache only as boot fallback until outlet settings hydrate.
  useEffect(() => {
    try {
      const saved = normalizeThemePreference(localStorage.getItem(THEME_PREFERENCE_STORAGE_KEY));
      setSystemPreference(saved);
      setDarkMode(applyThemePreferenceToDocument(saved));
    } catch {
      setSystemPreference('system');
      setDarkMode(applyThemePreferenceToDocument('system'));
    }
  }, []);

  useEffect(() => {
    const resolved = resolveBrandColorFromSettings(businessSettings);
    setBrandColor(resolved);
    applyBrandColorToDocument(resolved);
  }, [businessSettings]);

  // Outlet-wide source of truth.
  useEffect(() => {
    if (!businessSettings) return;
    const preference = mapBusinessThemeToPreference(businessSettings.theme);
    setSystemPreference(preference);
    setDarkMode(applyThemePreferenceToDocument(preference));
    try {
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    } catch {
      // Ignore storage errors
    }
  }, [businessSettings]);

  const withBusinessSettingDefaults = (payload: Record<string, unknown>): Record<string, unknown> => {
    if (businessSettings || !currentOutlet) return payload;

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

  const handleThemeChange = async (preference: ThemePreference) => {
    setSystemPreference(preference);
    setDarkMode(applyThemePreferenceToDocument(preference));

    try {
      localStorage.setItem(THEME_PREFERENCE_STORAGE_KEY, preference);
    } catch {
      // Ignore storage errors
    }

    if (!currentOutlet?.id) {
      return;
    }

    const response = await dataService.updateBusinessSettings(
      currentOutlet.id,
      withBusinessSettingDefaults({ theme: mapPreferenceToBusinessTheme(preference) }) as any
    );

    if (response.error || !response.data) {
      console.error('Could not sync outlet theme:', response.error || 'Unknown error');
      return;
    }

    setBusinessSettings(response.data);
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

    let response = await dataService.updateBusinessSettings(
      currentOutlet.id,
      withBusinessSettingDefaults({ brand_color: brandColor }) as any
    );

    // Backward-compatible fallback for databases using JSON settings only.
    if (response.error && response.error.toLowerCase().includes('brand_color')) {
      response = await dataService.updateBusinessSettings(
        currentOutlet.id,
        withBusinessSettingDefaults({ pos_terminal_settings: mergedTerminalSettings }) as any
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
            onThemeChange={handleThemeChange}
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
        return <OutletSettingsTab />;
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
  systemPreference: ThemePreference;
  onThemeChange: (preference: ThemePreference) => Promise<void>;
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
            onClick={() => void onThemeChange('light')}
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
            onClick={() => void onThemeChange('dark')}
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
            onClick={() => void onThemeChange('system')}
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
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
            Theme preference is shared outlet-wide across all terminals.
          </p>
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

type OutletDayKey = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

type OutletOperatingDay = {
  open: string;
  close: string;
  isOpen: boolean;
};

type OutletOperatingHoursState = Record<OutletDayKey, OutletOperatingDay>;

interface OutletSharedPreferences {
  rounding: '0.01' | '0.05' | '1';
  includeTaxInPrices: boolean;
  multiCurrencySupport: boolean;
}

interface OutletSettingsState {
  businessName: string;
  phoneNumber: string;
  emailAddress: string;
  website: string;
  businessAddress: string;
  taxRate: string;
  currency: string;
  openingHours: OutletOperatingHoursState;
  rounding: OutletSharedPreferences['rounding'];
  includeTaxInPrices: boolean;
  multiCurrencySupport: boolean;
}

const outletDayOrder: Array<{ key: OutletDayKey; label: string }> = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' },
];

const defaultOutletOpeningHours: OutletOperatingHoursState = {
  monday: { open: '08:00', close: '20:00', isOpen: true },
  tuesday: { open: '08:00', close: '20:00', isOpen: true },
  wednesday: { open: '08:00', close: '20:00', isOpen: true },
  thursday: { open: '08:00', close: '20:00', isOpen: true },
  friday: { open: '08:00', close: '20:00', isOpen: true },
  saturday: { open: '08:00', close: '20:00', isOpen: true },
  sunday: { open: '10:00', close: '18:00', isOpen: false },
};

const defaultOutletSharedPreferences: OutletSharedPreferences = {
  rounding: '0.01',
  includeTaxInPrices: true,
  multiCurrencySupport: false,
};

const normalizeCurrencyCode = (value: unknown): string => {
  const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
  return normalized.length > 0 ? normalized : 'NGN';
};

const normalizeTaxRatePercent = (value: unknown): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(numeric)) return '0';
  const normalized = Math.max(0, numeric);
  return Number.isInteger(normalized) ? String(normalized) : normalized.toFixed(2).replace(/\.?0+$/, '');
};

const normalizeAddressText = (value: unknown): string => {
  if (typeof value === 'string') return value;
  const record = toRecord(value);
  const lines = [
    record.street,
    record.city,
    record.state,
    record.zip,
    record.country,
  ]
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .filter((entry) => entry.length > 0);
  return lines.join(', ');
};

const normalizeOpeningHours = (value: unknown): OutletOperatingHoursState => {
  const source = toRecord(value);
  const buildDay = (key: OutletDayKey): OutletOperatingDay => {
    const raw = toRecord(source[key]);
    return {
      open: typeof raw.open === 'string' && raw.open.trim().length > 0
        ? raw.open
        : defaultOutletOpeningHours[key].open,
      close: typeof raw.close === 'string' && raw.close.trim().length > 0
        ? raw.close
        : defaultOutletOpeningHours[key].close,
      isOpen: toBoolean(raw.isOpen, defaultOutletOpeningHours[key].isOpen),
    };
  };

  return {
    monday: buildDay('monday'),
    tuesday: buildDay('tuesday'),
    wednesday: buildDay('wednesday'),
    thursday: buildDay('thursday'),
    friday: buildDay('friday'),
    saturday: buildDay('saturday'),
    sunday: buildDay('sunday'),
  };
};

const readOutletSharedPreferences = (terminalSettings: unknown): OutletSharedPreferences => {
  const terminalSettingsRecord = toRecord(terminalSettings);
  const preferences = toRecord(terminalSettingsRecord.outlet_preferences);
  const roundingRaw = typeof preferences.rounding === 'string' ? preferences.rounding : '';
  const rounding = roundingRaw === '0.05' || roundingRaw === '1' ? roundingRaw : '0.01';

  return {
    rounding,
    includeTaxInPrices: toBoolean(
      preferences.includeTaxInPrices,
      defaultOutletSharedPreferences.includeTaxInPrices
    ),
    multiCurrencySupport: toBoolean(
      preferences.multiCurrencySupport,
      defaultOutletSharedPreferences.multiCurrencySupport
    ),
  };
};

const mergeOutletSharedPreferencesIntoTerminalSettings = (
  terminalSettings: unknown,
  preferences: OutletSharedPreferences
): Record<string, unknown> => {
  const base = toRecord(terminalSettings);
  const existingPreferences = toRecord(base.outlet_preferences);

  return {
    ...base,
    outlet_preferences: {
      ...existingPreferences,
      rounding: preferences.rounding,
      includeTaxInPrices: preferences.includeTaxInPrices,
      multiCurrencySupport: preferences.multiCurrencySupport,
    },
  };
};

const createDefaultOutletSettings = (businessName = ''): OutletSettingsState => ({
  businessName,
  phoneNumber: '',
  emailAddress: '',
  website: '',
  businessAddress: '',
  taxRate: '0',
  currency: 'NGN',
  openingHours: defaultOutletOpeningHours,
  rounding: defaultOutletSharedPreferences.rounding,
  includeTaxInPrices: defaultOutletSharedPreferences.includeTaxInPrices,
  multiCurrencySupport: defaultOutletSharedPreferences.multiCurrencySupport,
});

const OutletSettingsTab: React.FC = () => {
  const {
    currentOutlet,
    userOutlets,
    setCurrentOutlet,
    setUserOutlets,
    businessSettings,
    setBusinessSettings,
  } = useOutlet();
  const outletId = currentOutlet?.id;

  const [state, setState] = useState<OutletSettingsState>(() => createDefaultOutletSettings(currentOutlet?.name || ''));
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    if (!outletId) {
      setState(createDefaultOutletSettings(''));
      return;
    }

    let cancelled = false;

    const loadOutletSettings = async () => {
      setIsLoading(true);
      setLoadError(null);

      try {
        const outletInfo = await posService.getOutletInfo(outletId);
        if (cancelled) return;

        const sharedPreferences = readOutletSharedPreferences(businessSettings?.pos_terminal_settings);
        const openingHoursSource =
          outletInfo.opening_hours ??
          (outletInfo as Record<string, unknown>).openingHours ??
          (currentOutlet as unknown as Record<string, unknown> | null)?.opening_hours ??
          currentOutlet?.openingHours;
        const taxRateSource =
          outletInfo.tax_rate ??
          (outletInfo as Record<string, unknown>).taxRate ??
          (currentOutlet as unknown as Record<string, unknown> | null)?.tax_rate ??
          currentOutlet?.taxRate;

        setState({
          businessName:
            (typeof outletInfo.name === 'string' && outletInfo.name.trim().length > 0)
              ? outletInfo.name
              : currentOutlet?.name || '',
          phoneNumber:
            (typeof outletInfo.phone === 'string' && outletInfo.phone.trim().length > 0)
              ? outletInfo.phone
              : currentOutlet?.phone || '',
          emailAddress:
            (typeof outletInfo.email === 'string' && outletInfo.email.trim().length > 0)
              ? outletInfo.email
              : currentOutlet?.email || '',
          website: typeof outletInfo.website === 'string' ? outletInfo.website : '',
          businessAddress: normalizeAddressText(outletInfo.address ?? currentOutlet?.address),
          taxRate: normalizeTaxRatePercent(taxRateSource),
          currency: normalizeCurrencyCode(outletInfo.currency ?? currentOutlet?.currency),
          openingHours: normalizeOpeningHours(openingHoursSource),
          rounding: sharedPreferences.rounding,
          includeTaxInPrices: sharedPreferences.includeTaxInPrices,
          multiCurrencySupport: sharedPreferences.multiCurrencySupport,
        });
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Could not load latest outlet settings.');
        const sharedPreferences = readOutletSharedPreferences(businessSettings?.pos_terminal_settings);
        setState({
          ...createDefaultOutletSettings(currentOutlet?.name || ''),
          phoneNumber: currentOutlet?.phone || '',
          emailAddress: currentOutlet?.email || '',
          businessAddress: normalizeAddressText(currentOutlet?.address),
          taxRate: normalizeTaxRatePercent(
            (currentOutlet as unknown as Record<string, unknown> | null)?.tax_rate ?? currentOutlet?.taxRate
          ),
          currency: normalizeCurrencyCode(currentOutlet?.currency),
          openingHours: normalizeOpeningHours(
            (currentOutlet as unknown as Record<string, unknown> | null)?.opening_hours ??
            currentOutlet?.openingHours
          ),
          rounding: sharedPreferences.rounding,
          includeTaxInPrices: sharedPreferences.includeTaxInPrices,
          multiCurrencySupport: sharedPreferences.multiCurrencySupport,
        });
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadOutletSettings();

    return () => {
      cancelled = true;
    };
  }, [outletId, businessSettings?.pos_terminal_settings, currentOutlet]);

  const withBusinessSettingDefaults = (payload: Record<string, unknown>): Record<string, unknown> => {
    if (businessSettings || !currentOutlet) return payload;

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

  const updateOpeningHours = (day: OutletDayKey, updates: Partial<OutletOperatingDay>) => {
    setState((prev) => ({
      ...prev,
      openingHours: {
        ...prev.openingHours,
        [day]: {
          ...prev.openingHours[day],
          ...updates,
        },
      },
    }));
  };

  const saveOutletSettings = async () => {
    if (!outletId || !currentOutlet) return;

    setSaveStatus('saving');
    setSaveError(null);

    const taxRateNumeric = Number(state.taxRate);
    const normalizedTaxRate = Number.isFinite(taxRateNumeric) ? Math.max(0, taxRateNumeric) : 0;
    const normalizedCurrency = normalizeCurrencyCode(state.currency);
    const normalizedBusinessName = state.businessName.trim().length > 0 ? state.businessName.trim() : currentOutlet.name;

    const outletPayload = {
      name: normalizedBusinessName,
      phone: state.phoneNumber.trim(),
      email: state.emailAddress.trim(),
      website: state.website.trim(),
      address: state.businessAddress.trim(),
      tax_rate: normalizedTaxRate,
      currency: normalizedCurrency,
      opening_hours: state.openingHours,
    };

    let outletUpdateError: string | null = null;
    try {
      await posService.updateOutletInfo(outletId, outletPayload as any);
    } catch (error) {
      outletUpdateError = error instanceof Error ? error.message : 'Could not update outlet record.';
    }

    const mergedTerminalSettings = mergeOutletSharedPreferencesIntoTerminalSettings(
      businessSettings?.pos_terminal_settings,
      {
        rounding: state.rounding,
        includeTaxInPrices: state.includeTaxInPrices,
        multiCurrencySupport: state.multiCurrencySupport,
      }
    );

    const businessSettingsResponse = await dataService.updateBusinessSettings(
      outletId,
      withBusinessSettingDefaults({
        currency: normalizedCurrency,
        pos_terminal_settings: mergedTerminalSettings,
      }) as any
    );

    if (outletUpdateError || businessSettingsResponse.error || !businessSettingsResponse.data) {
      setSaveStatus('error');
      setSaveError(
        outletUpdateError ||
        businessSettingsResponse.error ||
        'Could not save outlet settings.'
      );
      return;
    }

    setBusinessSettings(businessSettingsResponse.data);

    const nextOutlet = {
      ...currentOutlet,
      name: normalizedBusinessName,
      phone: outletPayload.phone,
      email: outletPayload.email,
      address: outletPayload.address,
      currency: normalizedCurrency,
      taxRate: normalizedTaxRate,
      openingHours: state.openingHours,
    } as any;
    setCurrentOutlet(nextOutlet);
    setUserOutlets(userOutlets.map((outlet) => (outlet.id === outletId ? nextOutlet : outlet)));

    setSaveStatus('saved');
    setTimeout(() => setSaveStatus('idle'), 1500);
  };

  return (
    <div className="p-4 sm:p-6">
      <div className="max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Outlet Settings</h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              These settings sync outlet-wide across all terminals. Only the Terminal Settings tab is device-specific.
            </p>
          </div>
          <button
            onClick={saveOutletSettings}
            disabled={!outletId || saveStatus === 'saving'}
            className="btn-brand text-white px-4 py-2.5 rounded-lg font-semibold disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {saveStatus === 'saving' ? 'Saving...' : 'Save Outlet Settings'}
          </button>
        </div>

        {loadError && (
          <p className="text-sm text-amber-600 dark:text-amber-400 mb-4">
            Could not refresh from server. Showing current terminal snapshot. {loadError}
          </p>
        )}
        {saveStatus === 'saved' && (
          <p className="text-sm text-green-600 dark:text-green-400 mb-4">
            Outlet settings synced to all terminals.
          </p>
        )}
        {saveStatus === 'error' && (
          <p className="text-sm text-red-600 dark:text-red-400 mb-4">
            {saveError || 'Could not save outlet settings. Please retry.'}
          </p>
        )}
        {isLoading && (
          <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">Loading latest outlet settings...</p>
        )}

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
                  value={state.phoneNumber}
                  onChange={e => setState(prev => ({ ...prev, phoneNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Email Address
                </label>
                <input
                  type="email"
                  value={state.emailAddress}
                  onChange={e => setState(prev => ({ ...prev, emailAddress: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Website
              </label>
              <input
                type="url"
                value={state.website}
                onChange={e => setState(prev => ({ ...prev, website: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="https://example.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Business Address
              </label>
              <textarea
                value={state.businessAddress}
                onChange={e => setState(prev => ({ ...prev, businessAddress: e.target.value }))}
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
                min="0"
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
              <select
                value={state.rounding}
                onChange={e => setState(prev => ({ ...prev, rounding: e.target.value as OutletSharedPreferences['rounding'] }))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="0.01">To nearest kobo</option>
                <option value="0.05">To nearest 5 kobo</option>
                <option value="1">To nearest naira</option>
              </select>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={state.includeTaxInPrices}
                onChange={e => setState(prev => ({ ...prev, includeTaxInPrices: e.target.checked }))}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Include tax in product prices (tax-inclusive)</span>
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={state.multiCurrencySupport}
                onChange={e => setState(prev => ({ ...prev, multiCurrencySupport: e.target.checked }))}
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">Enable multi-currency support</span>
            </label>
          </div>
        </div>

        {/* Operating Hours */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Operating Hours</h3>

          <div className="space-y-3">
            {outletDayOrder.map((day) => {
              const dayState = state.openingHours[day.key];
              return (
                <div key={day.key} className="flex flex-wrap items-center gap-3">
                  <div className="w-full sm:w-24">
                    <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{day.label}</span>
                  </div>
                  <input
                    type="time"
                    value={dayState.open}
                    onChange={e => updateOpeningHours(day.key, { open: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!dayState.isOpen}
                  />
                  <span className="text-gray-500">to</span>
                  <input
                    type="time"
                    value={dayState.close}
                    onChange={e => updateOpeningHours(day.key, { close: e.target.value })}
                    className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    disabled={!dayState.isOpen}
                  />
                  <label className="flex items-center gap-2 sm:ml-auto">
                    <input
                      type="checkbox"
                      className="rounded border-gray-300"
                      checked={dayState.isOpen}
                      onChange={e => updateOpeningHours(day.key, { isOpen: e.target.checked })}
                    />
                    <span className="text-sm text-gray-600 dark:text-gray-400">Open</span>
                  </label>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsPage;
