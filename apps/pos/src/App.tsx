import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useState, useRef, useEffect } from 'react';
import POSDashboard, { type POSDashboardHandle } from './components/pos/POSDashboard';
import ProductManagement, { type ProductManagementHandle } from './components/pos/ProductManagement';
import POSEODDashboard from './pages/EODDashboard';
import TransactionsPage from './pages/TransactionsPage';
import ReceiveItemsPage from './pages/ReceiveItemsPage';
import SettingsPage from './pages/SettingsPage';
import AppLayout from './components/layout/AppLayout';
import { OutletProvider, useOutlet } from './contexts/OutletContext';
import { Upload, Download, Plus, Wifi, WifiOff, ChevronDown } from 'lucide-react';
import ImportProductsModal from './components/pos/ImportProductsModal';
import { exportProducts } from './lib/inventoryImportExport';
import { posService, type POSProduct } from './lib/posService';
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

  // Listen for staff logout events (from sidebar Clock Out button)
  useEffect(() => {
    const handleStaffLogoutEvent = () => {
      localStorage.removeItem('pos_staff_session');
      setCurrentStaff(null);
      setTerminalPhase('staff_auth');
    };

    window.addEventListener('pos-staff-logout', handleStaffLogoutEvent);
    return () => window.removeEventListener('pos-staff-logout', handleStaffLogoutEvent);
  }, []);

  // Helper functions
  const handleTerminalSetup = (config: TerminalConfig) => {
    setTerminalConfig(config);
    localStorage.setItem('pos_terminal_config', JSON.stringify(config));
    setTerminalPhase('staff_auth');
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

      // Limit dropdown size for UX
      const topResults = localResults.slice(0, 25);

      setSearchResults(topResults);
      setShowSearchDropdown(topResults.length > 0);
    } catch (error) {
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
    setSearchQuery('');
    setShowSearchDropdown(false);
    setSearchResults([]);
  };

  // Handle barcode scan
  const handleBarcodeScan = async (barcode: string) => {
    if (!currentOutlet?.id) return;

    try {
      const product = await posService.getProductByBarcode(barcode, currentOutlet.id);
      if (posDashboardRef.current) {
        posDashboardRef.current.addToCart(product);
      }
    } catch (error) {
      console.error('Barcode scan error:', error);
      error('Product not found. Please try again.');
    }
  };

  // Header content for POS terminal page
  const posTerminalHeader = (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between w-full gap-4">
      {/* Search Bar with Dropdown */}
      <div className="relative flex-1 max-w-2xl">
        <input
          type="search"
          id="pos-product-search-input"
          name="product-search-query"
          placeholder="Find Products - Enter barcode or product name..."
          value={searchQuery}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyPress={async (e) => {
            if (e.key === 'Enter') {
              const query = searchQuery.trim();
              // If it looks like a barcode (long numeric/alphanumeric string), try barcode scan first
              if (query.length >= 8 && /^[A-Z0-9]+$/i.test(query)) {
                try {
                  await handleBarcodeScan(query);
                  setSearchQuery('');
                  setShowSearchDropdown(false);
                  return;
                } catch (error) {
                  // If barcode scan fails, fall through to normal search
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
          className="w-full px-4 py-2.5 text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent"
          autoComplete="chrome-off"
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
            <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-20 mt-1 max-h-80 overflow-y-auto">
              {searchResults.map((product) => (
                <button
                  key={product.id}
                  onClick={() => addProductFromSearch(product)}
                  className="w-full flex items-center px-3 py-2 hover:bg-gray-50 transition-colors text-left border-b border-gray-100 last:border-b-0"
                >
                  <div className="flex items-center justify-between w-full space-x-3">
                    {/* Left: name + identifiers, single line with ellipsis */}
                    <div className="flex-1 min-w-0 text-xs text-gray-700">
                      <span className="font-semibold text-gray-900 truncate inline-block max-w-[55%] align-middle">
                        {product.name}
                      </span>
                      <span className="mx-1 text-gray-400">·</span>
                      <span className="truncate inline-block max-w-[20%] align-middle">
                        {product.sku}
                      </span>
                      {product.barcode && (
                        <>
                          <span className="mx-1 text-gray-400">·</span>
                          <span className="truncate inline-block max-w-[20%] align-middle text-gray-500">
                            {product.barcode}
                          </span>
                        </>
                      )}
                    </div>

                    {/* Right: price */}
                    <div className="flex-shrink-0 text-sm font-bold text-orange-600">
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
      <div className="flex items-center gap-3 flex-shrink-0 flex-wrap justify-end">
        {/* Add Customer */}
        <button
          type="button"
          onClick={() => posDashboardRef.current?.openCustomerSearch()}
          className="px-4 py-2 rounded-full bg-blue-50 text-blue-700 text-sm font-semibold whitespace-nowrap active:scale-95 transition-transform"
        >
          + Add Customer
        </button>

        {/* Staff Member - show current staff if authenticated */}
        {currentStaff && (
          <button
            type="button"
            className="px-4 py-2 rounded-full bg-gray-100 text-gray-700 text-sm font-semibold whitespace-nowrap active:scale-95 transition-transform"
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
          className={`flex items-center justify-center w-8 h-8 rounded-full border ${isOnline
            ? 'border-green-500 text-green-600 bg-green-50'
            : 'border-red-500 text-red-600 bg-red-50'
            }`}
          title={isOnline ? 'Online' : 'Offline'}
        >
          {isOnline ? <Wifi className="h-4 w-4" /> : <WifiOff className="h-4 w-4" />}
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
                      posService.getProducts(currentOutlet.id, { size: 1000 }).then(res => {
                        exportProducts(res.items || [], { format: 'xlsx', outletName: currentOutlet.name });
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
                      posService.getProducts(currentOutlet.id, { size: 1000 }).then(res => {
                        exportProducts(res.items || [], { format: 'csv', outletName: currentOutlet.name });
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
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 sm:px-6 sm:py-2.5 rounded-lg font-semibold flex items-center gap-1.5 sm:gap-2 transition-colors text-sm whitespace-nowrap"
        >
          <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
          <span>Add Product</span>
        </button>
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
  const headerContent =
    location.pathname === '/products'
      ? productManagementHeader
      : location.pathname === '/'
        ? posTerminalHeader
        : null; // EOD and other pages handle their own headers

  return (
    <AppLayout headerContent={headerContent}>
      <Routes>
        <Route path="/" element={<POSDashboard ref={posDashboardRef} />} />
        <Route path="/transactions" element={<TransactionsPage />} />
        <Route path="/products" element={<ProductManagement ref={productManagementRef} />} />
        <Route path="/receive" element={<ReceiveItemsPage />} />
        <Route path="/eod" element={<POSEODDashboard />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/auth" element={<AuthWrapper onAuthSuccess={() => window.location.href = '/'} />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>

      {/* Import Products Modal */}
      <ImportProductsModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportComplete={() => {
          // Reload products in ProductManagement if it's mounted
          if (productManagementRef.current) {
            productManagementRef.current.handleShowNewRow(); // This triggers a refresh
          }
          // Navigate to products page to see results
          window.location.href = '/products';
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
