import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Filter, Search, CheckCircle, Clock, XCircle, DollarSign } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useOutlet } from '@/contexts/OutletContext';
import { vendorInvoiceService } from '@/lib/vendorInvoiceService';
import { VendorInvoice, InvoiceApprovalStatus } from '@/types';
import { formatCurrency } from '@/lib/utils';
import VendorInvoiceTable from '@/components/invoice/VendorInvoiceTable';

const Invoices: React.FC = () => {
  const { currentUser, getAccessibleOutlets, canApproveVendorInvoices } = useOutlet();
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<InvoiceApprovalStatus | 'all'>('all');
  const [vendorInvoices, setVendorInvoices] = useState<VendorInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-4 text-gray-600 dark:text-gray-400">Loading vendor invoices...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white">Vendor Invoices</h1>
          <p className="text-sm sm:text-base text-gray-500 dark:text-gray-400">
            Manage bills from suppliers and vendors
            {canApproveVendorInvoices() && totalPending > 0 && (
              <span className="ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200">
                {formatCurrency(totalPending)} pending approval
              </span>
            )}
          </p>
        </div>
        <Button asChild className="w-full sm:w-auto">
          <Link to="/invoices/create" className="flex items-center justify-center">
            <PlusCircle size={16} className="mr-2" />
            <span className="hidden sm:inline">Create Invoice</span>
            <span className="sm:hidden">Create</span>
          </Link>
        </Button>
      </div>

      {/* Status Summary Cards - Only show for approvers */}
      {canApproveVendorInvoices() && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-semibold text-orange-600 dark:text-orange-400">{statusCounts.pending_approval}</p>
              </div>
              <Clock className="h-8 w-8 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                <p className="text-2xl font-semibold text-blue-600 dark:text-blue-400">{statusCounts.approved}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-blue-600 dark:text-blue-400" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Paid</p>
                <p className="text-2xl font-semibold text-green-600 dark:text-green-400">{statusCounts.paid}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-600 dark:text-green-400" />
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</p>
                <p className="text-2xl font-semibold text-red-600 dark:text-red-400">{statusCounts.rejected}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
            </div>
          </div>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-200">{error}</p>
        </div>
      )}

      {/* Filters - Mobile Responsive */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={16} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search by invoice number, vendor name, or description..."
            className="w-full pl-9 sm:pl-10 pr-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative w-full sm:w-auto">
            <select
              className="appearance-none w-full sm:w-auto pl-3 pr-8 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as InvoiceApprovalStatus | 'all')}
            >
              <option value="all">All Statuses</option>
              <option value="pending_approval">Pending Approval</option>
              <option value="approved">Approved</option>
              <option value="paid">Paid</option>
              <option value="rejected">Rejected</option>
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <Filter size={14} />
            </div>
          </div>
        </div>
      </div>

      {/* Vendor Invoices Table */}
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
  );
};

export default Invoices;