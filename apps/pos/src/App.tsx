import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect, useCallback } from 'react';
import POSDashboard, { type POSDashboardHandle } from './components/pos/POSDashboard';
import ProductManagement, { type ProductManagementHandle } from './components/pos/ProductManagement';
import POSEODDashboard from './pages/EODDashboard';
import TransactionsPage from './pages/TransactionsPage';
import ReceiveItemsPage from './pages/ReceiveItemsPage';
import SettingsPage from './pages/SettingsPage';
import StocktakingPage from './pages/StocktakingPage';
import TransferToOutletPage from './pages/TransferToOutletPage';
import PharmacyPatientsPage from './pages/PharmacyPatientsPage';
import AppLayout from './components/layout/AppLayout';
import { OutletProvider, useOutlet } from './contexts/OutletContext';
import { Upload, Download, Plus, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import ImportProductsModal from './components/pos/ImportProductsModal';
import { exportProducts } from './lib/inventoryImportExport';
import { posService, type POSProduct } from './lib/posService';
import { setMissingProductIntent } from './lib/missingProductIntent';
import { useToast } from './components/ui/Toast';
import TerminalSetup from './components/setup/TerminalSetup';
import StaffAuthentication from './components/auth/StaffAuthentication';
import AuthWrapper from './components/auth/AuthWrapper';

interface TerminalConfig {
  outlet_id: string;
  outlet_name: string;
  initialized_by: string;
  initialized_at: string;
}

interface TerminalSetupProgress {
  stage: 'saving' | 'syncing' | 'verifying' | 'complete';
  message: string;
}

interface StaffProfile {
  id: string;
  staff_code: string;
  display_name: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
}

function AppContent() {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentOutlet, currentUser, isLoading, reInitAuth } = useOutlet();
  const productManagementRef = useRef<ProductManagementHandle>(null);
  const posDashboardRef = useRef<POSDashboardHandle>(null);
  const { error } = useToast();

  // Terminal State
  const [terminalConfig, setTerminalConfig] = useState<TerminalConfig | null>(null);
  const [currentStaff, setCurrentStaff] = useState<StaffProfile | null>(null);
  const [terminalPhase, setTerminalPhase] = useState<'setup' | 'staff_auth' | 'operational'>('setup');

  // POS Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<POSProduct[]>([]);
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const scannerBufferRef = useRef('');
  const scannerLastKeyAtRef = useRef(0);
  const searchRequestRef = useRef(0);
  const onlineSyncInFlightRef = useRef(false);
  const lastCatalogSyncAtRef = useRef(0);

  // Import/Export State
  const [showImportModal, setShowImportModal] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Check terminal configuration on mount
  useEffect(() => {
    const storedConfig = localStorage.getItem('pos_terminal_config');
    const storedStaffSession = localStorage.getItem('pos_staff_session');

    if (storedConfig) {
      try {
        const config = JSON.parse(storedConfig);
        setTerminalConfig(config);

        // Check if staff is already authenticated
        if (storedStaffSession) {
          try {
            const staffSession = JSON.parse(storedStaffSession);
            // Check if session is still valid (24 hours)
            if (new Date(staffSession.expires_at) > new Date()) {
              setCurrentStaff(staffSession.staff_profile);
              setTerminalPhase('operational');
            } else {
              // Session expired, clear it
              localStorage.removeItem('pos_staff_session');
              setTerminalPhase('staff_auth');
            }
          } catch (err) {
            console.error('Invalid staff session:', err);
            localStorage.removeItem('pos_staff_session');
            setTerminalPhase('staff_auth');
          }
        } else {
          setTerminalPhase('staff_auth');
        }
      } catch (err) {
        console.error('Invalid terminal config:', err);
        localStorage.removeItem('pos_terminal_config');
        setTerminalPhase('setup');
      }
    } else {
      setTerminalPhase('setup');
    }
  }, []);

  // Monitor online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Keep Register product search ephemeral.
  // Leaving the register route should fully clear the search state.
  useEffect(() => {
    if (location.pathname === '/') return;
    searchRequestRef.current += 1;
    setSearchQuery('');
    setSearchResults([]);
    setShowSearchDropdown(false);
  }, [location.pathname]);

  // Keep local outlet cache warm and sync queued offline sales while online.
  useEffect(() => {
    if (terminalPhase !== 'operational' || !terminalConfig?.outlet_id || !isOnline) return;

    let disposed = false;
    const outletId = terminalConfig.outlet_id;

    const runOnlineSync = async (forceCatalog = false) => {
      if (onlineSyncInFlightRef.current) return;
      onlineSyncInFlightRef.current = true;

      try {
        const now = Date.now();
        const shouldSyncCatalog = forceCatalog || now - lastCatalogSyncAtRef.current >= 30_000;
        if (shouldSyncCatalog) {
          try {
            await posService.syncProductCatalog(outletId, { forceFull: false, maxPages: 300 });
            lastCatalogSyncAtRef.current = now;
            if (!disposed) {
              window.dispatchEvent(new CustomEvent('pos-products-synced'));
            }
          } catch (catalogSyncError) {
            console.warn('Background product catalog sync failed:', catalogSyncError);
          }
        }

        const pendingCount = await posService.getOfflineTransactionCount();
        if (pendingCount > 0 && !disposed) {
          const synced = await posService.syncOfflineTransactions();
          if (synced > 0 && !disposed) {
            window.dispatchEvent(new CustomEvent('pos-transactions-synced', { detail: { synced } }));
          }
        }
      } catch (syncError) {
        console.warn('Background online sync failed:', syncError);
      } finally {
        onlineSyncInFlightRef.current = false;
      }
    };

    void runOnlineSync(true);
    const intervalId = window.setInterval(() => {
      void runOnlineSync(false);
    }, 10_000);

    return () => {
      disposed = true;
      window.clearInterval(intervalId);
    };
  }, [terminalPhase, terminalConfig?.outlet_id, isOnline]);

  // Listen for staff logout events (from sidebar Clock Out button)
  useEffect(() => {
    const handleStaffLogoutEvent = () => {
      localStorage.removeItem('pos_staff_session');
      setCurrentStaff(null);
      setTerminalPhase('staff_auth');
    };

    window.addEventListener('pos-staff-logout', handleStaffLogoutEvent);
    window.addEventListener('pos-staff-session-expired', handleStaffLogoutEvent);

    return () => {
      window.removeEventListener('pos-staff-logout', handleStaffLogoutEvent);
      window.removeEventListener('pos-staff-session-expired', handleStaffLogoutEvent);
    };
  }, []);

  // Helper functions
  const handleTerminalSetup = async (
    config: TerminalConfig,
    onProgress?: (progress: TerminalSetupProgress) => void
  ) => {
    onProgress?.({ stage: 'saving', message: 'Saving terminal configuration...' });
    setTerminalConfig(config);
    localStorage.setItem('pos_terminal_config', JSON.stringify(config));

    onProgress?.({ stage: 'syncing', message: 'Syncing outlet catalog...' });
    await posService.syncProductCatalog(config.outlet_id, {
      forceFull: true,
      maxPages: 1200,
      onProgress: (progress) => {
        if (progress.stage !== 'syncing') return;
        onProgress?.({
          stage: 'syncing',
          message: `Syncing catalog: page ${progress.page} (${progress.updated} items cached)`,
        });
      },
    });

    onProgress?.({ stage: 'verifying', message: 'Verifying local catalog...' });
    await posService.getCachedProducts(config.outlet_id, {
      activeOnly: false,
      page: 1,
      size: 100,
    });

    setTerminalPhase('staff_auth');
    onProgress?.({ stage: 'complete', message: 'Initialization complete.' });
  };

  const handleStaffAuthenticated = (staff: StaffProfile) => {
    setCurrentStaff(staff);
    setTerminalPhase('operational');
  };

  const handleReconfigureTerminal = () => {
    localStorage.removeItem('pos_terminal_config');
    localStorage.removeItem('pos_staff_session');
    setTerminalConfig(null);
    setCurrentStaff(null);
    setTerminalPhase('setup');
  };

  const handleStaffLogout = () => {
    localStorage.removeItem('pos_staff_session');
    setCurrentStaff(null);
    setTerminalPhase('staff_auth');
  };

  // Handle authentication routing
  if (location.pathname === '/auth') {
    return <AuthWrapper onAuthSuccess={() => { reInitAuth(); navigate('/', { replace: true }); }} />;
  }

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to auth if not authenticated (except for auth page)
  if (!currentUser) {
    return <Navigate to="/auth" replace />;
  }

  // Format currency helper
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Search function - use local Dexie + in-memory for instant results
  const handleSearchChange = async (query: string) => {
    const requestId = ++searchRequestRef.current;
    setSearchQuery(query);

    // Minimum characters before searching (start after 1 character)
    if (!currentOutlet?.id || query.trim().length < 1) {
      setSearchResults([]);
      setShowSearchDropdown(false);
      return;
    }

    try {
      // Use optimized local search (IndexedDB via Dexie)
      const localResults = await posService.searchLocalProducts(currentOutlet.id, query.trim());
      if (requestId !== searchRequestRef.current) return;

      // Limit dropdown size for UX
      let topResults = localResults.slice(0, 25);

      // New terminals may have empty local cache while bootstrap sync is still running.
      if (topResults.length === 0 && navigator.onLine) {
        try {
          const onlineResult = await posService.getProducts(currentOutlet.id, {
            search: query.trim(),
            activeOnly: true,
            page: 1,
            size: 25,
          });
          if (requestId !== searchRequestRef.current) return;
          topResults = (onlineResult.items || []).slice(0, 25);
        } catch (onlineErr) {
          console.warn('Online search fallback failed:', onlineErr);
        }
      }

      if (requestId !== searchRequestRef.current) return;
      setSearchResults(topResults);
      setShowSearchDropdown(topResults.length > 0);
    } catch (error) {
      if (requestId !== searchRequestRef.current) return;
      console.error('Local search error:', error);
      setSearchResults([]);
      setShowSearchDropdown(false);
    }
  };

  // Add product from search dropdown
  const addProductFromSearch = (product: POSProduct) => {
    if (posDashboardRef.current) {
      posDashboardRef.current.addToCart(product);
    }
    searchRequestRef.current += 1;
    setSearchQuery('');
    setShowSearchDropdown(false);
    setSearchResults([]);
  };

  // Handle barcode scan
  const handleBarcodeScan = useCallback(async (barcode: string): Promise<boolean> => {
    if (!currentOutlet?.id) return false;
    const normalizedBarcode = barcode.trim();
    if (!normalizedBarcode) return false;

    try {
      const product = await posService.getProductByBarcode(normalizedBarcode, currentOutlet.id);
      if (posDashboardRef.current) {
        posDashboardRef.current.addToCart(product);
      }
      searchRequestRef.current += 1;
      setSearchQuery('');
      setShowSearchDropdown(false);
      setSearchResults([]);
      return true;
    } catch (err) {
      console.error('Barcode scan error:', err);
      const message = err instanceof Error ? err.message.toLowerCase() : '';
      const notFound = message.includes('not found') || message.includes('404');
      if (!notFound) {
        error('Could not verify barcode now. Check connection and try again.');
        return false;
      }

      setMissingProductIntent({
        barcode: normalizedBarcode,
        created_at: new Date().toISOString(),
        source: 'register_scan',
      });
      navigate(`/products?auto_create=1&barcode=${encodeURIComponent(normalizedBarcode)}`);
      error('Item not found. Opening product creation.');
      return false;
    }
  }, [currentOutlet?.id, navigate, error]);

  // Global barcode scanner capture for Register:
  // scanners often type quickly and submit with Enter, even when search input isn't focused.
  useEffect(() => {
    if (terminalPhase !== 'operational') return;
    if (location.pathname !== '/') return;

    const handleGlobalScannerInput = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      const isInputTarget =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        !!target?.isContentEditable;

      // Allow scanner capture while search input is focused, but avoid hijacking other form fields.
      if (isInputTarget) {
        const inputId = target instanceof HTMLInputElement ? target.id : '';
        if (inputId !== 'pos-product-search-input') {
          return;
        }
      }

      const now = Date.now();
      const interKeyMs = now - scannerLastKeyAtRef.current;

      if (event.key === 'Enter') {
        const scanned = scannerBufferRef.current.trim();
        scannerBufferRef.current = '';
        scannerLastKeyAtRef.current = 0;

        const looksLikeBarcode =
          scanned.length >= 4 &&
          !/\s/.test(scanned) &&
          /\d/.test(scanned);

        if (!looksLikeBarcode) return;

        event.preventDefault();
        void handleBarcodeScan(scanned);
        return;
      }

      if (event.key.length === 1 && !event.repeat) {
        // Scanner keystrokes are rapid; if paused too long, start a fresh buffer.
        if (interKeyMs > 120) {
          scannerBufferRef.current = '';
        }
        scannerBufferRef.current += event.key;
        scannerLastKeyAtRef.current = now;
        return;
      }

      if (event.key !== 'Shift') {
        scannerBufferRef.current = '';
        scannerLastKeyAtRef.current = 0;
      }
    };

    window.addEventListener('keydown', handleGlobalScannerInput);
    return () => window.removeEventListener('keydown', handleGlobalScannerInput);
  }, [terminalPhase, location.pathname, handleBarcodeScan]);

  // Header content for POS terminal page
  const posTerminalHeader = (
    <div className="flex flex-col xl:flex-row xl:items-center xl:justify-end w-full gap-3 xl:gap-3">
      {/* Search Bar with Dropdown */}
      <div className="relative w-full xl:w-[520px] 2xl:w-[640px] xl:flex-none">
        <input
          type="text"
          id="pos-product-search-input"
          name="pos-search-ignore"
          placeholder="Scan barcode or search product name/SKU..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={async (e) => {
            if (e.key === 'Enter') {
              const query = searchQuery.trim();
              // Try barcode lookup first for scanner-like strings.
              const scannerLikeQuery =
                query.length >= 4 &&
                !/\s/.test(query) &&
                /^[A-Z0-9._/-]+$/i.test(query) &&
                /\d/.test(query);
              if (scannerLikeQuery) {
                const foundByScan = await handleBarcodeScan(query);
                if (foundByScan) {
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                  setSearchResults([]);
                  return;
                }
              }
              // If Enter pressed and there are search results, add first result
              if (searchResults.length > 0) {
                addProductFromSearch(searchResults[0]);
              }
            }
          }}
          onFocus={() => {
            if (searchResults.length > 0) setShowSearchDropdown(true);
          }}
          className="w-full h-12 px-4 text-[16px] border border-stone-300 rounded-xl bg-white focus:ring-2 focus:ring-slate-400 focus:border-transparent"
          autoComplete="off"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck="false"
          data-form-type="other"
          data-lpignore="true"
          role="combobox"
          aria-autocomplete="list"
          autoFocus
        />

        {/* Search Dropdown */}
        {showSearchDropdown && searchResults.length > 0 && (
          <>
            {/* Overlay to close dropdown */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setShowSearchDropdown(false)}
            />

            {/* Dropdown Results */}
            <div className="absolute top-full left-0 right-0 bg-white border border-stone-200 rounded-xl shadow-lg z-20 mt-1 max-h-80 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProductFromSearch(product)}
                  className="w-full flex items-center px-3 py-2.5 hover:bg-stone-50 transition-colors text-left border-b border-stone-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between w-full space-x-3">
                    {/* Left: name + identifiers, single line with ellipsis */}
                    <div className="flex-1 min-w-0 text-sm text-stone-600">
                      <span className="font-semibold text-slate-900 truncate inline-block max-w-[52%] align-middle">
                        {product.name}
                      </span>
                      <span className="mx-1 text-stone-400">·</span>
                      <span className="truncate inline-block max-w-[20%] align-middle">
                        {product.sku}
                      </span>
                      {product.barcode && (
                        <>
                          <span className="mx-1 text-stone-400">·</span>
                          <span className="truncate inline-block max-w-[20%] align-middle text-stone-500">
                            {product.barcode}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Right: price */}
                    <div className="flex-shrink-0 text-base font-bold text-slate-900">
                      {formatCurrency(product.unit_price)}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Status Indicators - single row: + Add Customer | Cashier | Online icon (at far edge) */}
      <div className="flex items-center gap-2 flex-shrink-0 flex-wrap justify-start xl:justify-end">
        {/* Add Customer */}
        <button
          type="button"
          onClick={() => posDashboardRef.current?.openCustomerSearch()}
          className="h-12 px-5 rounded-xl border border-brand-soft bg-brand-soft text-brand text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-transform"
        >
          + Add Customer
        </button>

        {/* Staff Member - show current staff if authenticated */}
        {currentStaff && (
          <button
            type="button"
            className="h-12 px-5 rounded-xl border border-stone-300 bg-stone-100 text-slate-700 text-[15px] font-semibold whitespace-nowrap active:scale-95 transition-transform"
            onClick={handleStaffLogout}
          >
            {currentStaff.role}:{' '}
            <span className="font-semibold">
              {currentStaff.display_name.split(' ')[0] || currentStaff.display_name}
            </span>
          </button>
        )}

        {/* Online/Offline icon only - last at the edge */}
        <button
          type="button"
          className={`flex items-center justify-center w-12 h-12 rounded-xl border ${isOnline
            ? 'border-emerald-300 text-emerald-700 bg-emerald-50'
            : 'border-red-300 text-red-700 bg-red-50'
            }`}
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline ? <Wifi className="h-5 w-5" /> : <WifiOff className="h-5 w-5" />}
        </button>
      </div>
    </div>
  );

  // Header content for Product Management page
  const productManagementHeader = (
    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between w-full gap-4">
      {/* Left spacer to keep layout aligned without title/description */}
      <div className="flex-1" />

      {/* Action Buttons */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
        <button
          onClick={() => setShowImportModal(true)}
          className="btn-action text-sm px-3 py-2 sm:px-4 sm:py-2.5"
        >
          <Upload className="w-4 h-4 sm:w-5 sm:h-5" />
          <span className="hidden sm:inline">Import</span>
        </button>
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            className="btn-action text-sm px-3 py-2 sm:px-4 sm:py-2.5"
          >
            <Download className="w-4 h-4 sm:w-5 sm:h-5" />
            <span className="hidden sm:inline">Export</span>
            <ChevronDown className="w-3 h-3 hidden sm:block" />
          </button>
          {showExportMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)} />
              <div className="absolute right-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-20 py-1">
                <button
                  onClick={() => {
                    if (productManagementRef.current && currentOutlet) {
                      posService.getAllProducts(currentOutlet.id, { activeOnly: false }).then(items => {
                        exportProducts(items || [], { format: 'xlsx', outletName: currentOutlet.name });
                      });
                    }
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  Export as Excel (.xlsx)
                </button>
                <button
                  onClick={() => {
                    if (productManagementRef.current && currentOutlet) {
                      posService.getAllProducts(currentOutlet.id, { activeOnly: false }).then(items => {
                        exportProducts(items || [], { format: 'csv', outletName: currentOutlet.name });
                      });
                    }
                    setShowExportMenu(false);
                  }}
                  className="w-full text-left px-4 py-2.5 text-sm hover:bg-gray-50 transition-colors"
                >
                  Export as CSV
                </button>
              </div>
            </>
          )}
        </div>
        <button
          onClick={() => {
            if (productManagementRef.current) {
              productManagementRef.current.handleShowNewRow();
            }
          }}
          className="btn-brand text-white px-3 py-2 sm:px-6 sm:py-2.5 rounded-lg font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors text-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Add Product</span>
        </button>
      </div>
    </div>
  );

  const stocktakingHeader = (
    <div className="flex items-center justify-end w-full">
      <div className="text-right">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Reconciliation &amp; Stocktaking</h2>
        <p className="text-sm text-stone-500">Count physical stock and post variances in one action.</p>
      </div>
    </div>
  );

  const transferOutletHeader = (
    <div className="flex items-center justify-end w-full">
      <div className="text-right">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Transfer to Outlet</h2>
        <p className="text-sm text-stone-500">Move stock between outlets with real-time quantity updates.</p>
      </div>
    </div>
  );

  const pharmacyPatientsHeader = (
    <div className="flex items-center justify-end w-full">
      <div className="text-right">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900">Pharmacy Patients</h2>
        <p className="text-sm text-stone-500">Capture patient profiles and vitals from the POS terminal.</p>
      </div>
    </div>
  );

  // Handle different terminal phases
  if (terminalPhase === 'setup') {
    return <TerminalSetup onSetupComplete={handleTerminalSetup} />;
  }

  if (terminalPhase === 'staff_auth') {
    return (
      <StaffAuthentication
        terminalConfig={terminalConfig!}
        onStaffAuthenticated={handleStaffAuthenticated}
        onReconfigure={handleReconfigureTerminal}
      />
    );
  }

  // Operational phase - normal POS functionality
  const normalizedStaffRole = (currentStaff?.role || '').toLowerCase();
  const isManager = normalizedStaffRole === 'manager';
  const isPharmacist = normalizedStaffRole === 'pharmacist' || normalizedStaffRole === 'accountant';
  const isInventoryStaff = normalizedStaffRole === 'inventory_staff';
  const canAccessSettings = isManager;
  const canAccessReceive = isManager || isPharmacist || isInventoryStaff;
  const canAccessEod = normalizedStaffRole !== 'cashier';

  const headerContent =
    location.pathname === '/products'
      ? productManagementHeader
      : location.pathname === '/stocktaking'
        ? stocktakingHeader
        : location.pathname === '/transfer-outlet'
          ? transferOutletHeader
          : location.pathname === '/patients'
            ? pharmacyPatientsHeader
      : location.pathname === '/'
        ? posTerminalHeader
        : null; // EOD and other pages handle their own headers

  return (
    <AppLayout headerContent={headerContent} staffRole={currentStaff?.role}>
      <Routes>
        <Route path="/" element={<POSDashboard ref={posDashboardRef} />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/products" element={<ProductManagement ref={productManagementRef} />} />
        <Route path="/receive" element={canAccessReceive ? <ReceiveItemsPage /> : <Navigate to="/" replace />} />
        <Route path="/stocktaking" element={isManager ? <StocktakingPage /> : <Navigate to="/" replace />} />
        <Route path="/transfer-outlet" element={isManager ? <TransferToOutletPage /> : <Navigate to="/" replace />} />
        <Route path="/patients" element={isPharmacist ? <PharmacyPatientsPage /> : <Navigate to="/" replace />} />
        <Route path="/eod" element={canAccessEod ? <POSEODDashboard /> : <Navigate to="/" replace />} />
        <Route path="/settings" element={canAccessSettings ? <SettingsPage /> : <Navigate to="/" replace />} />
        <Route path="/auth" element={<AuthWrapper onAuthSuccess={() => window.location.href = '/'} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Import Products Modal */}
      <ImportProductsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          // Reload products in ProductManagement if it's mounted.
          if (productManagementRef.current) {
            productManagementRef.current.refresh();
          }
          // Route without hard reload so outlet/session context remains stable.
          navigate('/products');
        }}
      />
    </AppLayout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <OutletProvider>
        <AppContent />
      </OutletProvider>
    </BrowserRouter>
  );
}

export default App;
