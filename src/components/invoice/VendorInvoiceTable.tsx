import React, { useState } from 'react';
import { Eye, Check, X, DollarSign, FileText, Calendar, Building2 } from 'lucide-react';
import { VendorInvoice, InvoiceApprovalStatus } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

interface VendorInvoiceTableProps {
  invoices: VendorInvoice[];
  onApprove?: (invoiceId: string) => Promise<void>;
  onReject?: (invoiceId: string, reason: string) => Promise<void>;
  onMarkPaid?: (invoiceId: string, paymentReference?: string) => Promise<void>;
}

const VendorInvoiceTable: React.FC<VendorInvoiceTableProps> = ({
  invoices,
  onApprove,
  onReject,
  onMarkPaid
}) => {
  const [selectedInvoice, setSelectedInvoice] = useState<VendorInvoice | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [paymentReference, setPaymentReference] = useState('');
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const getStatusBadge = (status: InvoiceApprovalStatus) => {
    const statusConfig = {
      pending_approval: {
        bg: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-200',
        label: 'Pending Approval'
      },
      approved: {
        bg: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
        label: 'Approved'
      },
      paid: {
        bg: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-200',
        label: 'Paid'
      },
      rejected: {
        bg: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
        label: 'Rejected'
      }
    };

    const config = statusConfig[status];
    return (
      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.bg}`}>
        {config.label}
      </span>
    );
  };

  const handleApprove = async (invoice: VendorInvoice) => {
    if (!onApprove) return;
    
    try {
      setProcessingId(invoice.id);
      await onApprove(invoice.id);
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!onReject || !selectedInvoice || !rejectReason.trim()) return;
    
    try {
      setProcessingId(selectedInvoice.id);
      await onReject(selectedInvoice.id, rejectReason);
      setShowRejectModal(false);
      setRejectReason('');
      setSelectedInvoice(null);
    } finally {
      setProcessingId(null);
    }
  };

  const handleMarkPaid = async () => {
    if (!onMarkPaid || !selectedInvoice) return;
    
    try {
      setProcessingId(selectedInvoice.id);
      await onMarkPaid(selectedInvoice.id, paymentReference);
      setShowPaymentModal(false);
      setPaymentReference('');
      setSelectedInvoice(null);
    } finally {
      setProcessingId(null);
    }
  };

  if (invoices.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 p-8 text-center">
        <FileText size={48} className="mx-auto text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
          No vendor invoices found
        </h3>
        <p className="text-gray-600 dark:text-gray-400">
          Vendor invoices will appear here once they are created.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-600">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Invoice Details
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Vendor
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
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-600">
              {invoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <FileText className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.invoiceNumber}
                        </div>
                        {invoice.description && (
                          <div className="text-sm text-gray-500 dark:text-gray-400 truncate max-w-xs">
                            {invoice.description}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <Building2 className="h-5 w-5 text-gray-400 mr-3" />
                      <div>
                        <div className="text-sm font-medium text-gray-900 dark:text-white">
                          {invoice.vendor.name}
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 capitalize">
                          {invoice.vendor.vendorType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-semibold text-gray-900 dark:text-white">
                      {formatCurrency(invoice.amount)}
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      {invoice.items.length} item{invoice.items.length !== 1 ? 's' : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    {getStatusBadge(invoice.status)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center text-sm text-gray-900 dark:text-white">
                      <Calendar className="h-4 w-4 text-gray-400 mr-2" />
                      {formatDate(invoice.dueDate)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex items-center justify-end space-x-2">
                      {/* View Details */}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        onClick={() => setSelectedInvoice(invoice)}
                      >
                        <Eye size={16} />
                      </Button>

                      {/* Approval Actions - Only show for pending invoices */}
                      {invoice.status === 'pending_approval' && onApprove && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => handleApprove(invoice)}
                          disabled={processingId === invoice.id}
                        >
                          <Check size={16} />
                        </Button>
                      )}

                      {invoice.status === 'pending_approval' && onReject && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowRejectModal(true);
                          }}
                          disabled={processingId === invoice.id}
                        >
                          <X size={16} />
                        </Button>
                      )}

                      {/* Mark as Paid - Only show for approved invoices */}
                      {invoice.status === 'approved' && onMarkPaid && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => {
                            setSelectedInvoice(invoice);
                            setShowPaymentModal(true);
                          }}
                          disabled={processingId === invoice.id}
                        >
                          <DollarSign size={16} />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reject Modal */}
      {showRejectModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Reject Invoice
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Please provide a reason for rejecting invoice {selectedInvoice.invoiceNumber}:
            </p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-red-500"
              rows={3}
              placeholder="Enter rejection reason..."
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowRejectModal(false);
                  setRejectReason('');
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleReject}
                disabled={!rejectReason.trim() || processingId === selectedInvoice.id}
                className="bg-red-600 hover:bg-red-700 text-white"
              >
                {processingId === selectedInvoice.id ? 'Rejecting...' : 'Reject Invoice'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Modal */}
      {showPaymentModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Mark as Paid
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
              Mark invoice {selectedInvoice.invoiceNumber} for {formatCurrency(selectedInvoice.amount)} as paid:
            </p>
            <input
              type="text"
              value={paymentReference}
              onChange={(e) => setPaymentReference(e.target.value)}
              className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Payment reference (optional)"
            />
            <div className="flex items-center justify-end gap-3 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  setShowPaymentModal(false);
                  setPaymentReference('');
                  setSelectedInvoice(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleMarkPaid}
                disabled={processingId === selectedInvoice.id}
                className="bg-green-600 hover:bg-green-700 text-white"
              >
                {processingId === selectedInvoice.id ? 'Processing...' : 'Mark as Paid'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default VendorInvoiceTable;