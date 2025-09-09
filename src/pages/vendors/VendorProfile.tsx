import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  Edit, 
  Phone, 
  Mail, 
  MapPin, 
  CreditCard, 
  Building, 
  DollarSign, 
  Clock, 
  FileText, 
  AlertTriangle,
  TrendingUp,
  Calendar,
  Star
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { dataService } from '@/lib/dataService';
import { paymentService } from '@/lib/paymentService';
import { EnhancedVendor, Payment, EnhancedInvoice, PriceBenchmark } from '@/types';
import Button from '@/components/ui/Button';

interface VendorStats {
  totalInvoices: number;
  totalPaid: number;
  totalOutstanding: number;
  averagePaymentTime: number;
  lastPaymentDate: string | null;
  paymentHistory: Payment[];
  recentInvoices: EnhancedInvoice[];
  priceTrends: PriceBenchmark[];
}

const VendorProfile: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentOutlet, hasPermission } = useOutlet();
  
  const [vendor, setVendor] = useState<EnhancedVendor | null>(null);
  const [vendorStats, setVendorStats] = useState<VendorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'payments' | 'invoices' | 'pricing'>('overview');

  useEffect(() => {
    if (id && currentOutlet) {
      loadVendorData();
    }
  }, [id, currentOutlet]);

  const loadVendorData = async () => {
    if (!id || !currentOutlet) return;

    try {
      setLoading(true);
      setError(null);

      // Load vendor details
      const { data: vendorData, error: vendorError } = await dataService.getVendor(id);
      if (vendorError) throw new Error(vendorError);
      setVendor(vendorData);

      if (vendorData) {
        // Load vendor statistics
        await loadVendorStats(vendorData.id);
      }
    } catch (err) {
      console.error('Error loading vendor data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load vendor data');
    } finally {
      setLoading(false);
    }
  };

  const loadVendorStats = async (vendorId: string) => {
    try {
      // Get payment history
      const { data: paymentHistory, error: paymentError } = await paymentService.getPaymentsByVendor(vendorId);
      if (paymentError) throw new Error(paymentError);

      // Get invoices for this vendor
      const { data: invoices, error: invoiceError } = await dataService.listInvoices(currentOutlet!.id);
      if (invoiceError) throw new Error(invoiceError);

      const vendorInvoices = invoices?.filter(inv => inv.vendorId === vendorId) || [];

      // Calculate statistics
      const paidPayments = paymentHistory?.filter(p => p.status === 'paid') || [];
      const totalPaid = paidPayments.reduce((sum, p) => sum + p.amount, 0);
      const totalOutstanding = paymentHistory?.filter(p => p.status !== 'paid').reduce((sum, p) => sum + p.amount, 0) || 0;

      // Calculate average payment time
      let totalPaymentTime = 0;
      let paymentCount = 0;
      paidPayments.forEach(payment => {
        if (payment.paidAt) {
          const paymentDate = new Date(payment.paidAt);
          const createdDate = new Date(payment.createdAt);
          const daysDiff = (paymentDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          totalPaymentTime += daysDiff;
          paymentCount++;
        }
      });

      const averagePaymentTime = paymentCount > 0 ? totalPaymentTime / paymentCount : 0;
      const lastPaymentDate = paidPayments.length > 0 ? paidPayments[0].paidAt : null;

      setVendorStats({
        totalInvoices: vendorInvoices.length,
        totalPaid,
        totalOutstanding,
        averagePaymentTime,
        lastPaymentDate,
        paymentHistory: paymentHistory || [],
        recentInvoices: vendorInvoices.slice(0, 10),
        priceTrends: [] // Will be implemented with price benchmarking
      });
    } catch (err) {
      console.error('Error loading vendor stats:', err);
    }
  };

  const getRatingColor = (rating: number) => {
    if (rating >= 4.5) return 'text-green-600';
    if (rating >= 3.5) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
      case 'paid': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'overdue': return 'bg-red-100 text-red-800';
      case 'needs_clarification': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Vendor
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            {error || 'Vendor not found'}
          </p>
          <Button onClick={() => navigate('/vendors')} variant="outline">
            Back to Vendors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-4">
            <Button
              onClick={() => navigate('/vendors')}
              variant="outline"
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Vendors
            </Button>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-start space-x-4">
                <div className="bg-blue-100 dark:bg-blue-900 p-3 rounded-lg">
                  <Building className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {vendor.name}
                  </h1>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span className="flex items-center">
                      <Mail className="h-4 w-4 mr-1" />
                      {vendor.email}
                    </span>
                    <span className="flex items-center">
                      <Phone className="h-4 w-4 mr-1" />
                      {vendor.phone}
                    </span>
                    <span className="capitalize">
                      {vendor.vendorType.replace('_', ' ')}
                    </span>
                  </div>
                  {vendor.rating && (
                    <div className="flex items-center mt-2">
                      <Star className={`h-4 w-4 mr-1 ${getRatingColor(vendor.rating)}`} />
                      <span className={`text-sm font-medium ${getRatingColor(vendor.rating)}`}>
                        {vendor.rating.toFixed(1)} Rating
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex space-x-2">
                {hasPermission('manage_outlets') && (
                  <Button variant="outline">
                    <Edit className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Stats */}
            {vendorStats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    ${vendorStats.totalPaid.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Paid</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    ${vendorStats.totalOutstanding.toLocaleString()}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Outstanding</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {vendorStats.totalInvoices}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Invoices</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-blue-600">
                    {vendorStats.averagePaymentTime.toFixed(0)} days
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Payment Time</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'overview', label: 'Overview', icon: Building },
                { id: 'payments', label: 'Payment History', icon: DollarSign },
                { id: 'invoices', label: 'Invoices', icon: FileText },
                { id: 'pricing', label: 'Pricing Trends', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Contact Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Contact Information
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Mail className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-gray-900 dark:text-white">{vendor.email}</span>
                  </div>
                  <div className="flex items-center">
                    <Phone className="h-5 w-5 text-gray-400 mr-3" />
                    <span className="text-gray-900 dark:text-white">{vendor.phone}</span>
                  </div>
                  {vendor.contactPerson && (
                    <div className="flex items-start">
                      <span className="text-sm text-gray-600 dark:text-gray-400 mr-3 mt-1">Contact:</span>
                      <span className="text-gray-900 dark:text-white">{vendor.contactPerson}</span>
                    </div>
                  )}
                  {vendor.address && (
                    <div className="flex items-start">
                      <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-1" />
                      <div className="text-gray-900 dark:text-white">
                        {vendor.address.street && <div>{vendor.address.street}</div>}
                        <div>
                          {vendor.address.city && vendor.address.city}
                          {vendor.address.state && `, ${vendor.address.state}`}
                          {vendor.address.zip && ` ${vendor.address.zip}`}
                        </div>
                        {vendor.address.country && <div>{vendor.address.country}</div>}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Banking Information */}
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Banking Information
                </h3>
                <div className="space-y-3">
                  {vendor.accountName && (
                    <div className="flex items-center">
                      <CreditCard className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-gray-900 dark:text-white font-medium">
                          {vendor.accountName}
                        </div>
                        {vendor.accountNumber && (
                          <div className="text-sm text-gray-600 dark:text-gray-400">
                            {vendor.accountNumber}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  {vendor.bankName && (
                    <div className="flex items-center">
                      <Building className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-gray-900 dark:text-white">{vendor.bankName}</span>
                    </div>
                  )}
                  {vendor.paymentTerms && (
                    <div className="flex items-center">
                      <Clock className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-gray-900 dark:text-white">{vendor.paymentTerms}</span>
                    </div>
                  )}
                  {vendor.creditLimit && (
                    <div className="flex items-center">
                      <DollarSign className="h-5 w-5 text-gray-400 mr-3" />
                      <span className="text-gray-900 dark:text-white">
                        Credit Limit: ${vendor.creditLimit.toLocaleString()}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'payments' && vendorStats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Payment History
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Method
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Reference
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {vendorStats.paymentHistory.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No payment history available
                        </td>
                      </tr>
                    ) : (
                      vendorStats.paymentHistory.map((payment) => (
                        <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {new Date(payment.paidAt || payment.createdAt).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${payment.amount.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(payment.status)}`}>
                              {payment.status.replace('_', ' ')}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {payment.paymentMethod || 'N/A'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {payment.bankReference || 'N/A'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'invoices' && vendorStats && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="p-6 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recent Invoices
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Invoice #
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Date
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                        Due Date
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                    {vendorStats.recentInvoices.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                          No invoices available
                        </td>
                      </tr>
                    ) : (
                      vendorStats.recentInvoices.map((invoice) => (
                        <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 dark:text-blue-400">
                            #{invoice.invoiceNumber}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {new Date(invoice.issueDate).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            ${invoice.total.toLocaleString()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getPaymentStatusColor(invoice.status)}`}>
                              {invoice.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {new Date(invoice.dueDate).toLocaleDateString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'pricing' && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Pricing Trends
              </h3>
              <div className="text-center py-12">
                <TrendingUp className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 dark:text-gray-400">
                  Pricing trend analysis will be available once AI price benchmarking is implemented.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VendorProfile;