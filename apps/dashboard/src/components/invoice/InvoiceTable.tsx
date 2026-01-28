import React from 'react';
import { Link } from 'react-router-dom';
import { Invoice } from '@/types';
import { formatCurrency, formatDate } from '@/lib/utils';
import InvoiceStatusBadge from './InvoiceStatusBadge';
import { ChevronRight, MoreHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/Button';

interface InvoiceTableProps {
  invoices: Invoice[];
}

const InvoiceTable: React.FC<InvoiceTableProps> = ({ invoices }) => {
  const calculateTotal = (invoice: Invoice) => {
    const subtotal = invoice.items.reduce(
      (sum, item) => sum + item.quantity * item.unitPrice,
      0
    );
    
    const taxAmount = invoice.taxRate 
      ? subtotal * (invoice.taxRate / 100) 
      : 0;
      
    return subtotal + taxAmount;
  };

  return (
    <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>
            <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:pl-6">
              Invoice
            </th>
            <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:table-cell">
              Customer
            </th>
            <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:table-cell">
              Date
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
              Amount
            </th>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
              Status
            </th>
            <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
              <span className="sr-only">Actions</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
          {invoices.map((invoice) => (
            <tr key={invoice.id}>
              <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                {invoice.invoiceNumber}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                {invoice.customer.name}
              </td>
              <td className="hidden whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                {formatDate(invoice.issueDate)}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                {formatCurrency(calculateTotal(invoice))}
              </td>
              <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                <InvoiceStatusBadge status={invoice.status} />
              </td>
              <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                <div className="flex items-center justify-end space-x-2">
                  <Button variant="ghost" size="icon" aria-label="More options">
                    <MoreHorizontal size={18} />
                  </Button>
                  <Link 
                    to={`/invoices/${invoice.id}`}
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 flex items-center"
                  >
                    View
                    <ChevronRight size={16} />
                  </Link>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {invoices.length === 0 && (
        <div className="text-center py-16 px-4">
          <p className="text-gray-500 dark:text-gray-400">No invoices found</p>
        </div>
      )}
    </div>
  );
};

export default InvoiceTable;