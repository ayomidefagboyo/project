import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit, Trash2, Phone, Mail, MapPin, Building2, CreditCard, Globe, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorService, CreateVendorData } from '@/lib/vendorService';
import { Vendor, VendorType, VendorScope } from '@/types';
import CreateVendorModal from '@/components/vendors/CreateVendorModal';
import EditVendorModal from '@/components/vendors/EditVendorModal';
import { formatCurrency } from '@/lib/utils';

const Vendors: React.FC = () => {
  const { currentOutlet, canCreateGlobalVendors, getAccessibleOutlets, isBusinessOwner, currentUser } = useOutlet();
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedVendor, setSelectedVendor] = useState<Vendor | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [scopeFilter, setScopeFilter] = useState<VendorScope | 'all'>('all');

  // Load vendors (both global and outlet-specific)
  const loadVendors = async () => {
    if (!currentOutlet) return;
    
    setLoading(true);
    setError(null);
    
    // For business owners, load vendors for all their outlets
    // For outlet staff, load vendors available to their outlet
    const outletIds = isBusinessOwner ? getAccessibleOutlets() : [currentOutlet.id];
    const { data, error } = await vendorService.getVendorsForMultipleOutlets(outletIds);
    
    if (error) {
      setError(error);
    } else {
      setVendors(data || []);
    }
    
    setLoading(false);
  };

  // Filter vendors by search and scope
  const filteredVendors = vendors.filter(vendor => {
    // Filter by search query
    const searchMatches = !searchQuery.trim() || 
      vendor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      vendor.contactPerson?.toLowerCase().includes(searchQuery.toLowerCase());
    
    // Filter by scope
    const scopeMatches = scopeFilter === 'all' || vendor.scope === scopeFilter;
    
    return searchMatches && scopeMatches;
  });

  // Create vendor
  const handleCreateVendor = async (vendorData: CreateVendorData & { scope?: VendorScope }) => {
    if (!currentOutlet) return;
    
    // Determine scope based on user permissions
    const scope = canCreateGlobalVendors() && vendorData.scope === 'global' ? 'global' : 'outlet_specific';
    const createdBy = isBusinessOwner ? 'owner' : 'outlet_manager';
    
    const { data, error } = await vendorService.createVendor({
      ...vendorData,
      scope,
      createdBy,
      outlets: scope === 'global' ? getAccessibleOutlets() : [currentOutlet.id]
    }, currentOutlet.id);
    
    if (error) {
      setError(error);
    } else if (data) {
      setVendors(prev => [data, ...prev]);
      setShowCreateModal(false);
    }
  };

  // Update vendor
  const handleUpdateVendor = async (vendorData: CreateVendorData & { id: string }) => {
    const { data, error } = await vendorService.updateVendor(vendorData);
    
    if (error) {
      setError(error);
    } else if (data) {
      setVendors(prev => prev.map(v => v.id === data.id ? data : v));
      setShowEditModal(false);
      setSelectedVendor(null);
    }
  };

  // Delete vendor
  const handleDeleteVendor = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) return;
    
    const { error } = await vendorService.deleteVendor(id);
    
    if (error) {
      setError(error);
    } else {
      setVendors(prev => prev.filter(v => v.id !== id));
    }
  };

  // Edit vendor
  const handleEditVendor = (vendor: Vendor) => {
    setSelectedVendor(vendor);
    setShowEditModal(true);
  };

  // Get vendor type color
  const getVendorTypeColor = (type: VendorType) => {
    switch (type) {
      case 'supplier':
        return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200';
      case 'service_provider':
        return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200';
      case 'contractor':
        return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-200';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200';
    }
  };

  // Get vendor scope badge
  const getScopeBadge = (scope: VendorScope, createdBy: string) => {
    if (scope === 'global') {
      return (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
          <Globe size={12} className="mr-1" />
          Global
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200">
        <Store size={12} className="mr-1" />
        Outlet Only
      </span>
    );
  };

  useEffect(() => {
    loadVendors();
  }, [currentOutlet]);

  // Get vendor counts by scope for summary
  const vendorCounts = {
    global: vendors.filter(v => v.scope === 'global').length,
    outlet_specific: vendors.filter(v => v.scope === 'outlet_specific').length,
    total: vendors.length
  };

  if (loading && vendors.length === 0) {
    return (
      <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vendors...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-4 sm:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">
            Vendors
          </h1>
          <p className="text-sm sm:text-base text-gray-600 dark:text-gray-300">
            Manage your suppliers and service providers
            {isBusinessOwner && (
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                ({vendorCounts.global} global, {vendorCounts.outlet_specific} outlet-specific)
              </span>
            )}
          </p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white border-0"
        >
          <Plus size={16} className="mr-2" />
          Add Vendor
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-grow">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
          <input
            type="text"
            placeholder="Search vendors by name, email, or contact person..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-500 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
          />
        </div>
        
        {/* Scope Filter - Only show for business owners */}
        {isBusinessOwner && (
          <div className="relative w-full sm:w-auto">
            <select
              value={scopeFilter}
              onChange={(e) => setScopeFilter(e.target.value as VendorScope | 'all')}
              className="appearance-none w-full sm:w-auto pl-3 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-500 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Vendors ({vendorCounts.total})</option>
              <option value="global">Global ({vendorCounts.global})</option>
              <option value="outlet_specific">Outlet-Specific ({vendorCounts.outlet_specific})</option>
            </select>
          </div>
        )}
      </div>

      {/* Vendors Grid */}
      {filteredVendors.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-8 text-center">
          <Building2 size={48} className="mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No vendors found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {searchQuery ? 'Try adjusting your search terms.' : 'Get started by adding your first vendor.'}
          </p>
          {!searchQuery && (
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white border-0"
            >
              <Plus size={16} className="mr-2" />
              Add Your First Vendor
            </Button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {filteredVendors.map((vendor) => (
            <div
              key={vendor.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-6 hover:shadow-lg transition-shadow"
            >
              {/* Header */}
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                    {vendor.name}
                  </h3>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getVendorTypeColor(vendor.vendorType)}`}>
                      {vendor.vendorType.replace('_', ' ')}
                    </span>
                    {getScopeBadge(vendor.scope, vendor.createdBy)}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEditVendor(vendor)}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                  >
                    <Edit size={16} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteVendor(vendor.id)}
                    className="p-2 text-gray-600 dark:text-gray-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </div>

              {/* Contact Info */}
              <div className="space-y-2 mb-4">
                {vendor.email && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Mail size={14} />
                    <span>{vendor.email}</span>
                  </div>
                )}
                {vendor.phone && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Phone size={14} />
                    <span>{vendor.phone}</span>
                  </div>
                )}
                {vendor.contactPerson && (
                  <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <Building2 size={14} />
                    <span>{vendor.contactPerson}</span>
                  </div>
                )}
              </div>

              {/* Financial Info */}
              <div className="border-t border-gray-200 dark:border-gray-600 pt-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-300">Current Balance:</span>
                  <span className={`font-medium ${vendor.currentBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    {formatCurrency(vendor.currentBalance)}
                  </span>
                </div>
                {vendor.creditLimit && (
                  <div className="flex items-center justify-between text-sm mt-1">
                    <span className="text-gray-600 dark:text-gray-300">Credit Limit:</span>
                    <span className="font-medium text-gray-900 dark:text-white">
                      {formatCurrency(vendor.creditLimit)}
                    </span>
                  </div>
                )}
                {vendor.paymentTerms && (
                  <div className="flex items-center gap-2 text-sm mt-2 text-gray-600 dark:text-gray-300">
                    <CreditCard size={14} />
                    <span>{vendor.paymentTerms}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modals */}
      {showCreateModal && (
        <CreateVendorModal
          onClose={() => setShowCreateModal(false)}
          onSubmit={handleCreateVendor}
        />
      )}

      {showEditModal && selectedVendor && (
        <EditVendorModal
          vendor={selectedVendor}
          onClose={() => {
            setShowEditModal(false);
            setSelectedVendor(null);
          }}
          onSubmit={handleUpdateVendor}
        />
      )}
    </div>
  );
};

export default Vendors;


