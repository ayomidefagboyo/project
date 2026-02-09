import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Search, CheckCircle, Clock, XCircle, DollarSign, Receipt, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { VendorInvoice, InvoiceApprovalStatus } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VendorInvoiceTable from '@/components/invoice/VendorInvoiceTable';
import { useRealtimeSync } from '@/hooks/useRealtimeSync';

const Invoices: React.FC = () => {
  const { currentUser, getAccessibleOutlets, canApproveVendorInvoices } = useOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceApprovalStatus | 'all'>('all');
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Real-time sync for invoices
  const accessibleOutlets = getAccessibleOutlets();
  const { isConnected: isRealtimeConnected } = useRealtimeSync({
    outletId: accessibleOutlets[0] || '', // Use first accessible outlet for channel
    enabled: !!currentUser && accessibleOutlets.length > 0,
    onInvoiceChange: (action, data) => {
      console.log(`🧾 Real-time: Invoice ${action}`, data);
      if (action === 'INSERT') {
        // Reload all invoices to ensure proper data structure
        loadVendorInvoices();
      } else if (action === 'UPDATE') {
        setVendorInvoices(prev =>
          prev.map(inv => inv.id === data.id ? { ...inv, ...data } : inv)
        );
      } else if (action === 'DELETE') {
        setVendorInvoices(prev => prev.filter(inv => inv.id !== data.id));
      }
    }
  });

  // Load vendor invoices
  const loadVendorInvoices = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const accessibleOutlets = getAccessibleOutlets();
      const { data, error: invoiceError } = await vendorInvoiceService.getVendorInvoices(accessibleOutlets);
      
      if (invoiceError) {
        setError(invoiceError);
      } else if (data) {
        setVendorInvoices(data);
      }
    } catch (err) {
      console.error('Error loading vendor invoices:', err);
      setError('Failed to load vendor invoices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (currentUser) {
      loadVendorInvoices();
    }
  }, [currentUser]);

  const filteredInvoices = vendorInvoices.filter(invoice => {
    // Filter by search term
    const searchMatches = 
      invoice.invoiceNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      invoice.vendor.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (invoice.description && invoice.description.toLowerCase().includes(searchTerm.toLowerCase()));
      
    // Filter by status
    const statusMatches = statusFilter === 'all' || invoice.status === statusFilter;
    
    return searchMatches && statusMatches;
  });

  // Get status counts for summary
  const statusCounts = {
    pending_approval: vendorInvoices.filter(inv => inv.status === 'pending_approval').length,
    approved: vendorInvoices.filter(inv => inv.status === 'approved').length,
    paid: vendorInvoices.filter(inv => inv.status === 'paid').length,
    rejected: vendorInvoices.filter(inv => inv.status === 'rejected').length,
  };

  const totalPending = vendorInvoices
    .filter(inv => inv.status === 'pending_approval')
    .reduce((sum, inv) => sum + inv.amount, 0);

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-6 py-12">
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-gray-200 dark:border-gray-700 rounded-full animate-spin border-t-gray-900 dark:border-t-white mx-auto"></div>
                <Receipt className="w-6 h-6 text-gray-400 absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2" />
              </div>
              <p className="mt-6 text-gray-600 dark:text-gray-400 font-light">Loading vendor invoices...</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">Vendor Invoices</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              Manage bills from suppliers and vendors with precision
              {canApproveVendorInvoices() && totalPending > 0 && (
                <span className="ml-3 inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-200 dark:border-amber-800">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  {formatCurrency(totalPending)} pending approval
                </span>
              )}
            </p>
          </div>
          <Button 
            asChild 
            className="bg-gray-900 hover:bg-gray-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Link to="/dashboard/invoices/create" className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Create Invoice</span>
            </Link>
          </Button>
        </div>

        {/* Status Summary Cards - Only show for approvers */}
        {canApproveVendorInvoices() && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="card p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Pending Approval</p>
                  <p className="text-3xl font-light text-amber-600 dark:text-amber-400 tracking-tight">{statusCounts.pending_approval}</p>
                </div>
                <div className="w-12 h-12 bg-amber-50 dark:bg-amber-900/20 rounded-xl flex items-center justify-center">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </div>
            <div className="card p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Approved</p>
                  <p className="text-3xl font-light text-blue-600 dark:text-blue-400 tracking-tight">{statusCounts.approved}</p>
                </div>
                <div className="w-12 h-12 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </div>
            <div className="card p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Paid</p>
                  <p className="text-3xl font-light text-emerald-600 dark:text-emerald-400 tracking-tight">{statusCounts.paid}</p>
                </div>
                <div className="w-12 h-12 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl flex items-center justify-center">
                  <DollarSign className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </div>
            <div className="card p-6 hover:shadow-lg transition-all duration-200">
              <div className="flex items-center justify-between">
                <div className="space-y-3">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Rejected</p>
                  <p className="text-3xl font-light text-red-500 dark:text-red-400 tracking-tight">{statusCounts.rejected}</p>
                </div>
                <div className="w-12 h-12 bg-red-50 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                  <XCircle className="w-6 h-6 text-red-500 dark:text-red-400" />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="card border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 p-4">
            <div className="flex items-center space-x-2">
              <XCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              <p className="text-red-800 dark:text-red-200 font-light">{error}</p>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search invoices, vendors, or descriptions..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="relative lg:w-48">
              <select
                className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as InvoiceApprovalStatus | 'all')}
              >
                <option value="all">All Statuses</option>
                <option value="pending_approval">Pending Approval</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
                <option value="rejected">Rejected</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                <Filter className="w-4 h-4" />
              </div>
            </div>
          </div>
        </div>

        {/* Vendor Invoices Table */}
        <div className="card p-0 overflow-hidden">
          <VendorInvoiceTable 
            invoices={filteredInvoices} 
            onApprove={canApproveVendorInvoices() ? async (invoiceId) => {
              try {
                const { error } = await vendorInvoiceService.approveVendorInvoice(invoiceId, currentUser?.id || '');
                if (!error) {
                  loadVendorInvoices(); // Refresh list
                }
              } catch (err) {
                console.error('Error approving invoice:', err);
              }
            } : undefined}
            onReject={canApproveVendorInvoices() ? async (invoiceId, reason) => {
              try {
                const { error } = await vendorInvoiceService.rejectVendorInvoice(invoiceId, currentUser?.id || '', reason);
                if (!error) {
                  loadVendorInvoices(); // Refresh list
                }
              } catch (err) {
                console.error('Error rejecting invoice:', err);
              }
            } : undefined}
            onMarkPaid={canApproveVendorInvoices() ? async (invoiceId, paymentReference) => {
              try {
                const { error } = await vendorInvoiceService.markInvoiceAsPaid(invoiceId, currentUser?.id || '', paymentReference);
                if (!error) {
                  loadVendorInvoices(); // Refresh list
                }
              } catch (err) {
                console.error('Error marking invoice as paid:', err);
              }
            } : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default Invoices;