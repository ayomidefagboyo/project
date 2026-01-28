import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Printer, Download, Edit, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import InvoiceStatusBadge from '@/components/invoice/InvoiceStatusBadge';
import { invoices } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';

const InvoiceDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const invoice = invoices.find(inv => inv.id === id);

  if (!invoice) {
    return (
      <div className="text-center py-16">
        <h2 className="text-2xl font-semibold text-gray-900 dark:text-white">Invoice not found</h2>
        <p className="text-gray-500 dark:text-gray-400 mt-2">The invoice you're looking for doesn't exist or has been removed.</p>
        <Button asChild className="mt-4">
          <Link to="/invoices">Back to Invoices</Link>
        </Button>
      </div>
    );
  }

  const calculateSubtotal = () => {
    return invoice.items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  };

  const calculateTaxAmount = () => {
    const subtotal = calculateSubtotal();
    return invoice.taxRate ? subtotal * (invoice.taxRate / 100) : 0;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTaxAmount();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild className="mr-4">
            <Link to="/invoices" aria-label="Back to invoices">
              <ArrowLeft size={18} />
            </Link>
          </Button>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Invoice {invoice.invoiceNumber}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="flex items-center">
            <Printer size={16} className="mr-1.5" />
            Print
          </Button>
          <Button variant="outline" size="sm" className="flex items-center">
            <Download size={16} className="mr-1.5" />
            Download
          </Button>
          <Button variant="outline" size="sm" className="flex items-center">
            <Edit size={16} className="mr-1.5" />
            Edit
          </Button>
          <Button variant="destructive" size="sm" className="flex items-center">
            <Trash2 size={16} className="mr-1.5" />
            Delete
          </Button>
        </div>
      </div>

      {/* Invoice Status */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Status</p>
            <div className="mt-1">
              <InvoiceStatusBadge status={invoice.status} />
            </div>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Issue Date</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {formatDate(invoice.issueDate)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Due Date</p>
            <p className="mt-1 font-medium text-gray-900 dark:text-white">
              {formatDate(invoice.dueDate)}
            </p>
          </div>
          <div>
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Amount</p>
            <p className="mt-1 font-semibold text-lg text-gray-900 dark:text-white">
              {formatCurrency(calculateTotal())}
            </p>
          </div>
        </div>
      </div>

      {/* Invoice Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Customer Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Customer</h2>
          <div className="space-y-3">
            <p className="font-medium text-gray-900 dark:text-white">{invoice.customer.name}</p>
            <p className="text-gray-600 dark:text-gray-400">{invoice.customer.email}</p>
            {invoice.customer.phone && (
              <p className="text-gray-600 dark:text-gray-400">{invoice.customer.phone}</p>
            )}
            {invoice.customer.address && (
              <address className="not-italic text-gray-600 dark:text-gray-400">
                {invoice.customer.address.street}<br />
                {invoice.customer.address.city}, {invoice.customer.address.state} {invoice.customer.address.zip}<br />
                {invoice.customer.address.country}
              </address>
            )}
          </div>
        </div>

        {/* Payment Information */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Payment Information</h2>
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Invoice Number</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{invoice.invoiceNumber}</dd>
            </div>
            <div>
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Tax Rate</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">{invoice.taxRate || 0}%</dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="text-sm font-medium text-gray-500 dark:text-gray-400">Payment Terms</dt>
              <dd className="mt-1 text-gray-900 dark:text-white">
                Net 30 - Due by {formatDate(invoice.dueDate)}
              </dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Invoice Items */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
        <h2 className="text-lg font-medium p-6 border-b border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white">
          Invoice Items
        </h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-800">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Description
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Quantity
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Unit Price
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Total
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-800">
              {invoice.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {item.description}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {item.quantity}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(item.unitPrice)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                    {formatCurrency(item.quantity * item.unitPrice)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <div className="sm:col-start-2 space-y-2">
              <div className="flex justify-between">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Subtotal</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{formatCurrency(calculateSubtotal())}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <dt className="text-sm text-gray-500 dark:text-gray-400">Tax ({invoice.taxRate || 0}%)</dt>
                <dd className="text-sm text-gray-900 dark:text-white">{formatCurrency(calculateTaxAmount())}</dd>
              </div>
              <div className="flex justify-between border-t border-gray-200 dark:border-gray-700 pt-2">
                <dt className="text-sm font-medium text-gray-900 dark:text-white">Total</dt>
                <dd className="text-sm font-medium text-gray-900 dark:text-white">{formatCurrency(calculateTotal())}</dd>
              </div>
            </div>
          </dl>
        </div>
      </div>

      {/* Notes */}
      {invoice.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
          <h2 className="text-lg font-medium mb-2 text-gray-900 dark:text-white">Notes</h2>
          <p className="text-gray-600 dark:text-gray-400">{invoice.notes}</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceDetail;