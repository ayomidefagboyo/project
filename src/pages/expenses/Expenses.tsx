import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { PlusCircle, Filter, Search, Download } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { expenses, vendors } from '@/lib/mockData';
import { formatCurrency, formatDate } from '@/lib/utils';

const Expenses: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  
  const uniqueCategories = Array.from(new Set(expenses.map(expense => expense.category)));
  
  const filteredExpenses = expenses.filter(expense => {
    // Filter by search term
    const searchMatches = 
      expense.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
      (expense.vendor && expense.vendor.name.toLowerCase().includes(searchTerm.toLowerCase()));
      
    // Filter by category
    const categoryMatches = categoryFilter === 'all' || expense.category === categoryFilter;
    
    return searchMatches && categoryMatches;
  });

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Expenses</h1>
          <p className="text-gray-500 dark:text-gray-400">Track and manage your business expenses</p>
        </div>
        <Button asChild>
          <Link to="/expenses/new" className="flex items-center">
            <PlusCircle size={16} className="mr-2" />
            Add Expense
          </Link>
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-grow">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={18} className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search expenses..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <select
              className="appearance-none pl-3 pr-8 py-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All Categories</option>
              {uniqueCategories.map(category => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-300">
              <Filter size={16} />
            </div>
          </div>
          <Button variant="outline" size="icon">
            <Download size={18} />
          </Button>
        </div>
      </div>

      {/* Expenses Table */}
      <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 rounded-lg">
        <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:pl-6">
                Description
              </th>
              <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:table-cell">
                Category
              </th>
              <th scope="col" className="hidden px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200 sm:table-cell">
                Vendor
              </th>
              <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 dark:text-gray-200">
                Date
              </th>
              <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900 dark:text-gray-200">
                Amount
              </th>
              <th scope="col" className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
            {filteredExpenses.map((expense) => (
              <tr key={expense.id}>
                <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 dark:text-white sm:pl-6">
                  {expense.description}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                  {expense.category}
                </td>
                <td className="hidden px-3 py-4 text-sm text-gray-500 dark:text-gray-400 sm:table-cell">
                  {expense.vendor ? expense.vendor.name : 'N/A'}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400">
                  {formatDate(expense.date)}
                </td>
                <td className="px-3 py-4 text-sm text-gray-500 dark:text-gray-400 text-right">
                  {formatCurrency(expense.amount)}
                </td>
                <td className="relative py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                    aria-label={`Edit expense ${expense.description}`}
                  >
                    Edit
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredExpenses.length === 0 && (
          <div className="text-center py-16 px-4">
            <p className="text-gray-500 dark:text-gray-400">No expenses found</p>
          </div>
        )}
      </div>

      {/* Summary */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm p-6">
        <h2 className="text-lg font-medium mb-4 text-gray-900 dark:text-white">Expense Summary</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Total Expenses</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0))}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Average Per Expense</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              {formatCurrency(filteredExpenses.length > 0 
                ? filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0) / filteredExpenses.length 
                : 0
              )}
            </p>
          </div>
          <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <p className="text-sm text-gray-500 dark:text-gray-400">Top Category</p>
            <p className="mt-1 text-xl font-semibold text-gray-900 dark:text-white">
              {uniqueCategories.length > 0 ? uniqueCategories[0] : 'None'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;