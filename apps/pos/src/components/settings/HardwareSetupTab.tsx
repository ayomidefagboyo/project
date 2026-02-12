import React, { useEffect, useState } from 'react';
import { Monitor, Plus, Printer, Trash2, Wifi } from 'lucide-react';
import { posService } from '../../lib/posService';
import { ToastContainer, useToast } from '../ui/Toast';
import {
  type AutoOpenDrawerMode,
  type AutoPrintMode,
  type CashDrawerConfig,
  createDefaultHardwareState,
  createHardwareProfile,
  getHardwareStorageKey,
  type HardwarePolicyProfile,
  type HardwareState,
  loadHardwareState,
  type PrinterConfig,
  resolveHardwarePolicy,
  saveHardwareState,
  type ScannerConfig,
} from '../../lib/hardwareProfiles';

interface HardwareSetupTabProps {
  outletId?: string;
  terminalId?: string;
  currentUserId?: string;
}

interface ScanTestResult {
  value: string;
  at: string;
}

type HardwareDeviceKind = 'printer' | 'scanner' | 'drawer';
type HardwareModalKind = HardwareDeviceKind | 'profile';
type HardwareModalMode = 'add' | 'edit';

interface HardwareEditModalState {
  kind: HardwareDeviceKind;
  mode: HardwareModalMode;
  id?: string;
  title: string;
  submitLabel: string;
  data: {
    name: string;
    type: string;
    status: 'connected' | 'disconnected';
    profileId: string;
    defaultPrint?: string;
  };
}

interface HardwareRemoveModalState {
  kind: HardwareModalKind;
  id: string;
  name: string;
}

interface HardwareScanModalState {
  scannerId: string;
  scannerName: string;
  scannerProfileId: string;
  value: string;
}

interface HardwareProfileModalState {
  mode: 'add' | 'edit';
  profileId?: string;
  name: string;
}

const createHardwareId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const formatHardwareTime = (isoTime?: string): string => {
  if (!isoTime) return 'N/A';
  const parsed = new Date(isoTime);
  if (Number.isNaN(parsed.getTime())) return 'N/A';
  return parsed.toLocaleString();
};

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const HardwareSetupTab: React.FC<HardwareSetupTabProps> = ({ outletId, terminalId, currentUserId }) => {
  const [state, setState] = useState<HardwareState>(() => createDefaultHardwareState());
  const { printers, scanners, cashDrawers, profiles } = state;
  const [lastPrintTestAt, setLastPrintTestAt] = useState<Record<string, string>>({});
  const [lastScanTest, setLastScanTest] = useState<Record<string, ScanTestResult>>({});
  const [lastDrawerOpenAt, setLastDrawerOpenAt] = useState<Record<string, string>>({});
  const [drawerActionId, setDrawerActionId] = useState<string | null>(null);
  const [editModal, setEditModal] = useState<HardwareEditModalState | null>(null);
  const [profileModal, setProfileModal] = useState<HardwareProfileModalState | null>(null);
  const [removeModal, setRemoveModal] = useState<HardwareRemoveModalState | null>(null);
  const [scanModal, setScanModal] = useState<HardwareScanModalState | null>(null);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>('');
  const [hydratedStorageKey, setHydratedStorageKey] = useState<string | null>(null);
  const { toasts, success, error, warning, info, removeToast } = useToast();

  const storageKey = getHardwareStorageKey(outletId, terminalId);
  const selectedPolicy = resolveHardwarePolicy(state, selectedPolicyId || state.terminalDefaultProfileId);

  useEffect(() => {
    if (!storageKey) {
      setState(createDefaultHardwareState());
      setHydratedStorageKey(null);
      return;
    }

    setState(loadHardwareState(outletId, terminalId));
    setHydratedStorageKey(storageKey);
  }, [outletId, terminalId, storageKey]);

  useEffect(() => {
    if (!storageKey || hydratedStorageKey !== storageKey) return;
    saveHardwareState(outletId, terminalId, state);
  }, [outletId, terminalId, state, storageKey, hydratedStorageKey]);

  useEffect(() => {
    if (profiles.some((profile) => profile.id === selectedPolicyId)) return;

    const fallbackProfile =
      profiles.find((profile) => profile.id === state.terminalDefaultProfileId) || profiles[0];
    if (fallbackProfile) {
      setSelectedPolicyId(fallbackProfile.id);
    }
  }, [profiles, selectedPolicyId, state.terminalDefaultProfileId]);

  const getProfileName = (profileId: string): string =>
    profiles.find((profile) => profile.id === profileId)?.name || 'Unknown Policy';

  const getDeviceCountForProfile = (profileId: string): number =>
    printers.filter((printer) => printer.profileId === profileId).length +
    scanners.filter((scanner) => scanner.profileId === profileId).length +
    cashDrawers.filter((drawer) => drawer.profileId === profileId).length;

  const updateSelectedPolicy = (
    updates: Partial<
      Pick<
        HardwarePolicyProfile,
        | 'autoOpenDrawerMode'
        | 'autoPrintMode'
        | 'scannerBeepEnabled'
        | 'cutPaperEnabled'
        | 'duplicateReceiptsEnabled'
      >
    >
  ) => {
    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === selectedPolicy.id ? { ...profile, ...updates } : profile
      ),
    }));
  };

  const openProfileModal = (mode: 'add' | 'edit', profile?: HardwarePolicyProfile) => {
    setProfileModal({
      mode,
      profileId: profile?.id,
      name: profile?.name ?? `Policy ${profiles.length + 1}`,
    });
  };

  const openPrinterModal = (mode: HardwareModalMode, printer?: PrinterConfig) => {
    const fallbackProfileId = selectedPolicy.id || state.terminalDefaultProfileId;

    setEditModal({
      kind: 'printer',
      mode,
      id: printer?.id,
      title: mode === 'add' ? 'Add Printer' : 'Configure Printer',
      submitLabel: mode === 'add' ? 'Add Printer' : 'Save Changes',
      data: {
        name: printer?.name ?? `Printer ${printers.length + 1}`,
        type: String(printer?.type ?? 'thermal'),
        status: printer?.status ?? 'connected',
        profileId: printer?.profileId ?? fallbackProfileId,
        defaultPrint: String(printer?.defaultPrint ?? 'receipts'),
      },
    });
  };

  const openScannerModal = (mode: HardwareModalMode, scanner?: ScannerConfig) => {
    const fallbackProfileId = selectedPolicy.id || state.terminalDefaultProfileId;

    setEditModal({
      kind: 'scanner',
      mode,
      id: scanner?.id,
      title: mode === 'add' ? 'Add Scanner' : 'Configure Scanner',
      submitLabel: mode === 'add' ? 'Add Scanner' : 'Save Changes',
      data: {
        name: scanner?.name ?? `Scanner ${scanners.length + 1}`,
        type: String(scanner?.type ?? 'usb'),
        status: scanner?.status ?? 'connected',
        profileId: scanner?.profileId ?? fallbackProfileId,
      },
    });
  };

  const openDrawerModal = (mode: HardwareModalMode, drawer?: CashDrawerConfig) => {
    const fallbackProfileId = selectedPolicy.id || state.terminalDefaultProfileId;

    setEditModal({
      kind: 'drawer',
      mode,
      id: drawer?.id,
      title: mode === 'add' ? 'Add Cash Drawer' : 'Configure Cash Drawer',
      submitLabel: mode === 'add' ? 'Add Drawer' : 'Save Changes',
      data: {
        name: drawer?.name ?? `Drawer ${cashDrawers.length + 1}`,
        type: String(drawer?.type ?? 'rj11'),
        status: drawer?.status ?? 'connected',
        profileId: drawer?.profileId ?? fallbackProfileId,
      },
    });
  };

  const getTypeOptions = (kind: HardwareDeviceKind): string[] => {
    if (kind === 'printer') return ['thermal', 'label'];
    if (kind === 'scanner') return ['usb', 'bluetooth'];
    return ['rj11', 'usb'];
  };

  const openRemoveModal = (kind: HardwareModalKind, id: string, name: string) => {
    setRemoveModal({ kind, id, name });
  };

  const handleRemoveConfirmed = () => {
    if (!removeModal) return;

    if (removeModal.kind === 'profile') {
      if (profiles.length <= 1) {
        warning('At least one policy profile is required.');
        setRemoveModal(null);
        return;
      }

      const remainingProfiles = profiles.filter((profile) => profile.id !== removeModal.id);
      const fallbackProfileId =
        state.terminalDefaultProfileId !== removeModal.id &&
        remainingProfiles.some((profile) => profile.id === state.terminalDefaultProfileId)
          ? state.terminalDefaultProfileId
          : remainingProfiles[0].id;

      setState((prev) => ({
        ...prev,
        profiles: remainingProfiles,
        terminalDefaultProfileId: fallbackProfileId,
        printers: prev.printers.map((printer) =>
          printer.profileId === removeModal.id ? { ...printer, profileId: fallbackProfileId } : printer
        ),
        scanners: prev.scanners.map((scanner) =>
          scanner.profileId === removeModal.id ? { ...scanner, profileId: fallbackProfileId } : scanner
        ),
        cashDrawers: prev.cashDrawers.map((drawer) =>
          drawer.profileId === removeModal.id ? { ...drawer, profileId: fallbackProfileId } : drawer
        ),
      }));

      if (selectedPolicyId === removeModal.id) {
        setSelectedPolicyId(fallbackProfileId);
      }

      success(`Removed profile "${removeModal.name}".`);
      setRemoveModal(null);
      return;
    }

    if (removeModal.kind === 'printer') {
      setState((prev) => ({
        ...prev,
        printers: prev.printers.filter((item) => item.id !== removeModal.id),
      }));
      success(`Removed printer "${removeModal.name}".`);
    } else if (removeModal.kind === 'scanner') {
      setState((prev) => ({
        ...prev,
        scanners: prev.scanners.filter((item) => item.id !== removeModal.id),
      }));
      success(`Removed scanner "${removeModal.name}".`);
    } else {
      setState((prev) => ({
        ...prev,
        cashDrawers: prev.cashDrawers.filter((item) => item.id !== removeModal.id),
      }));
      success(`Removed drawer "${removeModal.name}".`);
    }

    setRemoveModal(null);
  };

  const handleSaveEditModal = () => {
    if (!editModal) return;

    const name = editModal.data.name.trim();
    const type = editModal.data.type.trim();
    const profileId = editModal.data.profileId.trim();

    if (!name) {
      error('Name is required.');
      return;
    }
    if (!type) {
      error('Type is required.');
      return;
    }
    if (!profiles.some((profile) => profile.id === profileId)) {
      error('Select a valid policy profile.');
      return;
    }

    if (editModal.kind === 'printer') {
      const defaultPrint = (editModal.data.defaultPrint || '').trim();
      if (!defaultPrint) {
        error('Default print role is required.');
        return;
      }

      const nextPrinter: PrinterConfig = {
        id: editModal.id || createHardwareId('printer'),
        name,
        type,
        status: editModal.data.status,
        profileId,
        defaultPrint,
      };

      setState((prev) => ({
        ...prev,
        printers:
          editModal.mode === 'add'
            ? [...prev.printers, nextPrinter]
            : prev.printers.map((item) => (item.id === editModal.id ? nextPrinter : item)),
      }));
      success(editModal.mode === 'add' ? `Added printer "${name}".` : `Updated printer "${name}".`);
      setEditModal(null);
      return;
    }

    if (editModal.kind === 'scanner') {
      const nextScanner: ScannerConfig = {
        id: editModal.id || createHardwareId('scanner'),
        name,
        type,
        status: editModal.data.status,
        profileId,
      };

      setState((prev) => ({
        ...prev,
        scanners:
          editModal.mode === 'add'
            ? [...prev.scanners, nextScanner]
            : prev.scanners.map((item) => (item.id === editModal.id ? nextScanner : item)),
      }));
      success(editModal.mode === 'add' ? `Added scanner "${name}".` : `Updated scanner "${name}".`);
      setEditModal(null);
      return;
    }

    const nextDrawer: CashDrawerConfig = {
      id: editModal.id || createHardwareId('drawer'),
      name,
      type,
      status: editModal.data.status,
      profileId,
    };

    setState((prev) => ({
      ...prev,
      cashDrawers:
        editModal.mode === 'add'
          ? [...prev.cashDrawers, nextDrawer]
          : prev.cashDrawers.map((item) => (item.id === editModal.id ? nextDrawer : item)),
    }));
    success(editModal.mode === 'add' ? `Added drawer "${name}".` : `Updated drawer "${name}".`);
    setEditModal(null);
  };

  const handleSaveProfileModal = () => {
    if (!profileModal) return;

    const name = profileModal.name.trim();
    if (!name) {
      error('Profile name is required.');
      return;
    }

    if (profileModal.mode === 'add') {
      const seedPolicy = resolveHardwarePolicy(state, selectedPolicy.id || state.terminalDefaultProfileId);
      const nextProfile = createHardwareProfile(name, seedPolicy);
      setState((prev) => ({
        ...prev,
        profiles: [...prev.profiles, nextProfile],
      }));
      setSelectedPolicyId(nextProfile.id);
      setProfileModal(null);
      success(`Created policy "${name}".`);
      return;
    }

    if (!profileModal.profileId) {
      error('Invalid profile selection.');
      return;
    }

    setState((prev) => ({
      ...prev,
      profiles: prev.profiles.map((profile) =>
        profile.id === profileModal.profileId ? { ...profile, name } : profile
      ),
    }));
    setProfileModal(null);
    success(`Updated profile "${name}".`);
  };

  const playScannerBeep = (profileId?: string) => {
    const policy = resolveHardwarePolicy(state, profileId || selectedPolicy.id);
    if (!policy.scannerBeepEnabled) return;

    try {
      const windowWithWebkitAudio = window as Window & { webkitAudioContext?: typeof AudioContext };
      const AudioContextConstructor = window.AudioContext || windowWithWebkitAudio.webkitAudioContext;
      if (!AudioContextConstructor) return;

      const context = new AudioContextConstructor();
      const oscillator = context.createOscillator();
      const gainNode = context.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.value = 880;
      gainNode.gain.value = 0.08;

      oscillator.connect(gainNode);
      gainNode.connect(context.destination);
      oscillator.start();
      oscillator.stop(context.currentTime + 0.08);
      setTimeout(() => {
        void context.close();
      }, 120);
    } catch {
      // Ignore audio initialization failures.
    }
  };

  const handleTestPrint = (printer: PrinterConfig) => {
    if (printer.status !== 'connected') {
      warning(`"${printer.name}" is disconnected.`);
      return;
    }

    const printWindow = window.open('', '_blank', 'width=420,height=700');
    if (!printWindow) {
      error('Allow pop-ups to run test print.');
      return;
    }

    const now = new Date();
    const nowIso = now.toISOString();
    const receiptLines = [
      'COMPAZZ POS HARDWARE TEST',
      '------------------------------------------',
      `Printer: ${printer.name}`,
      `Type: ${printer.type}`,
      `Default Role: ${printer.defaultPrint}`,
      `Policy: ${getProfileName(printer.profileId)}`,
      `Outlet: ${outletId || 'N/A'}`,
      `Terminal: ${terminalId || 'N/A'}`,
      `Date: ${now.toLocaleDateString()}`,
      `Time: ${now.toLocaleTimeString()}`,
      '------------------------------------------',
      'If this prints clearly, printer setup is OK.',
      '------------------------------------------',
    ].join('\n');

    printWindow.document.write(`
      <!doctype html>
      <html>
        <head>
          <title>Printer Test</title>
          <style>
            body { font-family: monospace; padding: 16px; }
            pre { white-space: pre-wrap; font-size: 13px; line-height: 1.5; }
          </style>
        </head>
        <body>
          <pre>${escapeHtml(receiptLines)}</pre>
          <script>
            window.onload = () => {
              window.print();
            };
            window.onafterprint = () => {
              window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();

    setLastPrintTestAt((prev) => ({ ...prev, [printer.id]: nowIso }));
    success(`Test print opened for "${printer.name}".`);
  };

  const openScanModal = (scanner: ScannerConfig) => {
    if (scanner.status !== 'connected') {
      warning(`"${scanner.name}" is disconnected.`);
      return;
    }

    setScanModal({
      scannerId: scanner.id,
      scannerName: scanner.name,
      scannerProfileId: scanner.profileId,
      value: '',
    });
  };

  const handleSubmitScanModal = () => {
    if (!scanModal) return;

    const scanned = scanModal.value.trim();
    if (!scanned) {
      error('Enter or scan a barcode value.');
      return;
    }

    const scannedAt = new Date().toISOString();
    setLastScanTest((prev) => ({
      ...prev,
      [scanModal.scannerId]: { value: scanned, at: scannedAt },
    }));
    playScannerBeep(scanModal.scannerProfileId);
    success(`Captured barcode: ${scanned}`);
    setScanModal(null);
  };

  const handleOpenDrawer = async (drawer: CashDrawerConfig) => {
    if (drawer.status !== 'connected') {
      warning(`"${drawer.name}" is disconnected.`);
      return;
    }

    setDrawerActionId(drawer.id);
    try {
      if (!outletId || !terminalId || !currentUserId) {
        const actionTime = new Date().toISOString();
        setLastDrawerOpenAt((prev) => ({ ...prev, [drawer.id]: actionTime }));
        info('Drawer action recorded locally. Missing outlet/terminal/user context for API action.');
        return;
      }

      const activeSession = await posService.getActiveCashDrawerSession(outletId, terminalId);
      if (!activeSession) {
        await posService.openCashDrawerSession({
          outlet_id: outletId,
          terminal_id: terminalId,
          cashier_id: currentUserId,
          opening_balance: 0,
          opening_notes: 'Auto-opened from Hardware Setup',
        });
        info('No active cash drawer session found. Opened a new session.');
      }

      const actionTime = new Date().toISOString();
      setLastDrawerOpenAt((prev) => ({ ...prev, [drawer.id]: actionTime }));
      success(`Drawer action sent for "${drawer.name}".`);
    } catch (drawerError) {
      const message = drawerError instanceof Error ? drawerError.message : 'Failed to run cash drawer action.';
      error(message, 5000);
    } finally {
      setDrawerActionId(null);
    }
  };

  return (
    <>
      <div className="p-4 xl:p-5">
        <div className="max-w-[1440px] mx-auto">
          <div className="mb-3">
            <h2 className="text-xl xl:text-2xl font-bold text-gray-900 dark:text-white">Hardware Setup</h2>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Compact terminal view for touch-screen desktop.
            </p>
          </div>

          <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
            Profiles and hardware behavior are shared across devices to prevent per-button drift.
          </div>

          <div className="mb-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Policy Profiles</h3>
              <button
                onClick={() => openProfileModal('add')}
                className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Policy
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5 mb-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Policy to edit
                </label>
                <select
                  className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  value={selectedPolicy.id}
                  onChange={(e) => setSelectedPolicyId(e.target.value)}
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Terminal default policy
                </label>
                <select
                  className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  value={state.terminalDefaultProfileId}
                  onChange={(e) =>
                    setState((prev) => ({
                      ...prev,
                      terminalDefaultProfileId: e.target.value,
                    }))
                  }
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {profiles.map((profile) => {
                const isDefault = profile.id === state.terminalDefaultProfileId;
                const isSelected = profile.id === selectedPolicy.id;
                const totalAssigned = getDeviceCountForProfile(profile.id);

                return (
                  <div
                    key={profile.id}
                    className={`rounded-lg border px-2.5 py-2 ${
                      isSelected
                        ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30'
                        : 'border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {profile.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                          {totalAssigned} device{totalAssigned === 1 ? '' : 's'}
                          {isDefault ? ' • default' : ''}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button
                          onClick={() => setSelectedPolicyId(profile.id)}
                          className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                        >
                          Use
                        </button>
                        <button
                          onClick={() => openProfileModal('edit', profile)}
                          className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                        >
                          Edit
                        </button>
                        {!isDefault && (
                          <button
                            onClick={() => openRemoveModal('profile', profile.id, profile.name)}
                            className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 xl:grid-cols-3 gap-3">
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Printer className="w-4 h-4" />
                  Printers
                </h3>
                <button
                  onClick={() => openPrinterModal('add')}
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {printers.length === 0 && (
                  <div className="p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                    No printers configured.
                  </div>
                )}
                {printers.map((printer) => (
                  <div
                    key={printer.id}
                    className="flex items-start justify-between gap-2 px-2.5 py-2 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            printer.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        ></div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {printer.name}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {printer.type} • {printer.defaultPrint} • {getProfileName(printer.profileId)}
                      </div>
                      {lastPrintTestAt[printer.id] && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Test: {formatHardwareTime(lastPrintTestAt[printer.id])}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleTestPrint(printer)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => openPrinterModal('edit', printer)}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openRemoveModal('printer', printer.id, printer.name)}
                        className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs"
                        title="Remove printer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Wifi className="w-4 h-4" />
                  Scanners
                </h3>
                <button
                  onClick={() => openScannerModal('add')}
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {scanners.length === 0 && (
                  <div className="p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                    No scanners configured.
                  </div>
                )}
                {scanners.map((scanner) => (
                  <div
                    key={scanner.id}
                    className="flex items-start justify-between gap-2 px-2.5 py-2 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            scanner.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        ></div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {scanner.name}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {scanner.type.toUpperCase()} • {getProfileName(scanner.profileId)}
                      </div>
                      {lastScanTest[scanner.id] && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5 break-all">
                          {lastScanTest[scanner.id].value}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => openScanModal(scanner)}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs"
                      >
                        Test
                      </button>
                      <button
                        onClick={() => openScannerModal('edit', scanner)}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openRemoveModal('scanner', scanner.id, scanner.name)}
                        className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs"
                        title="Remove scanner"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
              <div className="flex items-center justify-between mb-2.5">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white flex items-center gap-1.5">
                  <Monitor className="w-4 h-4" />
                  Cash Drawers
                </h3>
                <button
                  onClick={() => openDrawerModal('add')}
                  className="px-2.5 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-xs flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>

              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {cashDrawers.length === 0 && (
                  <div className="p-3 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-xs text-gray-500 dark:text-gray-400">
                    No cash drawers configured.
                  </div>
                )}
                {cashDrawers.map((drawer) => (
                  <div
                    key={drawer.id}
                    className="flex items-start justify-between gap-2 px-2.5 py-2 border border-gray-200 dark:border-gray-600 rounded-lg"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            drawer.status === 'connected' ? 'bg-green-500' : 'bg-red-500'
                          }`}
                        ></div>
                        <div className="font-medium text-sm text-gray-900 dark:text-white truncate">
                          {drawer.name}
                        </div>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                        {drawer.type.toUpperCase()} • {getProfileName(drawer.profileId)}
                      </div>
                      {lastDrawerOpenAt[drawer.id] && (
                        <div className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-0.5">
                          Open: {formatHardwareTime(lastDrawerOpenAt[drawer.id])}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        onClick={() => handleOpenDrawer(drawer)}
                        disabled={drawerActionId === drawer.id}
                        className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded text-xs disabled:opacity-60"
                      >
                        {drawerActionId === drawer.id ? '...' : 'Open'}
                      </button>
                      <button
                        onClick={() => openDrawerModal('edit', drawer)}
                        className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded text-xs"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => openRemoveModal('drawer', drawer.id, drawer.name)}
                        className="px-2 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded text-xs"
                        title="Remove drawer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-3 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-3">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-2.5">Policy Preferences</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Editing policy: <strong>{selectedPolicy.name}</strong>
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Auto-open cash drawer
                </label>
                <select
                  className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  value={selectedPolicy.autoOpenDrawerMode}
                  onChange={(e) =>
                    updateSelectedPolicy({
                      autoOpenDrawerMode: e.target.value as AutoOpenDrawerMode,
                    })
                  }
                >
                  <option value="on-sale">On every sale</option>
                  <option value="cash-only">Cash only</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Receipt auto-print
                </label>
                <select
                  className="w-full px-2.5 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white"
                  value={selectedPolicy.autoPrintMode}
                  onChange={(e) =>
                    updateSelectedPolicy({
                      autoPrintMode: e.target.value as AutoPrintMode,
                    })
                  }
                >
                  <option value="always">Always</option>
                  <option value="ask">Ask customer</option>
                  <option value="never">Manual</option>
                </select>
              </div>
            </div>

            <div className="mt-2.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2">
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedPolicy.scannerBeepEnabled}
                  onChange={(e) =>
                    updateSelectedPolicy({
                      scannerBeepEnabled: e.target.checked,
                    })
                  }
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Scanner beep</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedPolicy.cutPaperEnabled}
                  onChange={(e) =>
                    updateSelectedPolicy({
                      cutPaperEnabled: e.target.checked,
                    })
                  }
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Cut paper after print</span>
              </label>
              <label className="flex items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 px-2.5 py-2">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={selectedPolicy.duplicateReceiptsEnabled}
                  onChange={(e) =>
                    updateSelectedPolicy({
                      duplicateReceiptsEnabled: e.target.checked,
                    })
                  }
                />
                <span className="text-xs text-gray-700 dark:text-gray-300">Duplicate receipts</span>
              </label>
            </div>
          </div>
        </div>
      </div>

      {editModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">{editModal.title}</h4>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Name</label>
                <input
                  value={editModal.data.name}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            data: { ...prev.data, name: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  autoFocus
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Type</label>
                <select
                  value={editModal.data.type}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            data: { ...prev.data, type: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {getTypeOptions(editModal.kind).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {!getTypeOptions(editModal.kind).includes(editModal.data.type) && (
                    <option value={editModal.data.type}>{editModal.data.type}</option>
                  )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                <select
                  value={editModal.data.status}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            data: { ...prev.data, status: e.target.value as 'connected' | 'disconnected' },
                          }
                        : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="connected">connected</option>
                  <option value="disconnected">disconnected</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Policy</label>
                <select
                  value={editModal.data.profileId}
                  onChange={(e) =>
                    setEditModal((prev) =>
                      prev
                        ? {
                            ...prev,
                            data: { ...prev.data, profileId: e.target.value },
                          }
                        : prev
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
              </div>

              {editModal.kind === 'printer' && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Default Role</label>
                  <select
                    value={editModal.data.defaultPrint || 'receipts'}
                    onChange={(e) =>
                      setEditModal((prev) =>
                        prev
                          ? {
                              ...prev,
                              data: { ...prev.data, defaultPrint: e.target.value },
                            }
                          : prev
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="receipts">receipts</option>
                    <option value="labels">labels</option>
                    {editModal.data.defaultPrint &&
                      !['receipts', 'labels'].includes(editModal.data.defaultPrint) && (
                        <option value={editModal.data.defaultPrint}>{editModal.data.defaultPrint}</option>
                      )}
                  </select>
                </div>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setEditModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEditModal}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                {editModal.submitLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {profileModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {profileModal.mode === 'add' ? 'Add Policy' : 'Edit Policy'}
              </h4>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Policy Name</label>
              <input
                value={profileModal.name}
                onChange={(e) =>
                  setProfileModal((prev) =>
                    prev
                      ? {
                          ...prev,
                          name: e.target.value,
                        }
                      : prev
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                autoFocus
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setProfileModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveProfileModal}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Save Policy
              </button>
            </div>
          </div>
        </div>
      )}

      {removeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                {removeModal.kind === 'profile' ? 'Remove Policy' : 'Remove Hardware'}
              </h4>
            </div>
            <div className="p-5">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Remove <strong>{removeModal.name}</strong>? This action cannot be undone.
              </p>
              {removeModal.kind === 'profile' && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Devices using this policy will be reassigned to the terminal default policy.
                </p>
              )}
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setRemoveModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleRemoveConfirmed}
                className="px-4 py-2 rounded-lg bg-red-600 text-white hover:bg-red-700"
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      {scanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-gray-800 shadow-xl border border-gray-200 dark:border-gray-700">
            <div className="px-5 py-4 border-b border-gray-200 dark:border-gray-700">
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white">Test Scanner</h4>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Scanner: {scanModal.scannerName}</p>
            </div>
            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Scan Result</label>
              <input
                value={scanModal.value}
                onChange={(e) => setScanModal((prev) => (prev ? { ...prev, value: e.target.value } : prev))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Scan barcode here and press Save"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleSubmitScanModal();
                  }
                }}
              />
            </div>
            <div className="px-5 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-2">
              <button
                onClick={() => setScanModal(null)}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitScanModal}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700"
              >
                Save Scan
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={removeToast} />
    </>
  );
};

export default HardwareSetupTab;
