import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Filter, Search, Download, Receipt, CreditCard, Edit3 } from 'lucide-react';
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
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
      <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-tr from-gray-900 to-gray-700 dark:from-white dark:to-gray-200 rounded-xl flex items-center justify-center shadow-sm">
                <Receipt className="w-5 h-5 text-white dark:text-gray-900" />
              </div>
              <h1 className="text-3xl font-light text-gray-900 dark:text-white tracking-tight">Expenses</h1>
            </div>
            <p className="text-gray-600 dark:text-gray-400 font-light">
              Track and manage your business expenses with precision
            </p>
          </div>
          <Button 
            asChild 
            className="bg-gray-900 hover:bg-gray-800 text-white border-0 px-6 py-3 rounded-xl font-medium transition-all duration-200 shadow-sm hover:shadow-md dark:bg-white dark:text-gray-900 dark:hover:bg-gray-100"
          >
            <Link to="/dashboard/expenses/create" className="flex items-center space-x-2">
              <Plus className="w-4 h-4" />
              <span>Add Expense</span>
            </Link>
          </Button>
        </div>

        {/* Filters */}
        <div className="card p-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Search className="w-4 h-4 text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search expenses, descriptions, or vendors..."
                className="w-full pl-11 pr-4 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <div className="relative lg:w-48">
                <select
                  className="appearance-none w-full pl-4 pr-10 py-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all duration-200"
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                >
                  <option value="all">All Categories</option>
                  {uniqueCategories.map(category => (
                    <option key={category} value={category}>{category}</option>
                  ))}
                </select>
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400">
                  <Filter className="w-4 h-4" />
                </div>
              </div>
              <Button 
                variant="outline" 
                className="border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 px-4 py-3 rounded-xl"
              >
                <Download className="w-4 h-4 mr-2" />
                Export
              </Button>
            </div>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="card p-0 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th scope="col" className="py-4 pl-6 pr-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Description
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:table-cell">
                    Category
                  </th>
                  <th scope="col" className="hidden px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider sm:table-cell">
                    Vendor
                  </th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-4 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">
                    Amount
                  </th>
                  <th scope="col" className="relative py-4 pl-3 pr-6">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-900">
                {filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="py-4 pl-6 pr-3 text-sm font-medium text-gray-900 dark:text-white">
                      {expense.description}
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-600 dark:text-gray-400 sm:table-cell">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200">
                        {expense.category}
                      </span>
                    </td>
                    <td className="hidden px-6 py-4 text-sm text-gray-600 dark:text-gray-400 sm:table-cell">
                      {expense.vendor ? expense.vendor.name : 'N/A'}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
                      {formatDate(expense.date)}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-right text-gray-900 dark:text-white">
                      {formatCurrency(expense.amount)}
                    </td>
                    <td className="relative py-4 pl-3 pr-6 text-right text-sm font-medium">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
                        aria-label={`Edit expense ${expense.description}`}
                      >
                        <Edit3 className="w-4 h-4 mr-2" />
                        Edit
                      </Button>
                    </td>
                  </tr>
                ))}
                {filteredExpenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-16 px-4">
                      <div className="flex flex-col items-center space-y-3">
                        <Receipt className="w-12 h-12 text-gray-400" />
                        <p className="text-gray-500 dark:text-gray-400 font-light">No expenses found</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Summary */}
        <div className="card p-6">
          <h2 className="text-lg font-medium mb-6 text-foreground tracking-tight">Expense Summary</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Total Expenses</p>
                <p className="text-2xl font-light text-foreground tracking-tight">
                  {formatCurrency(filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0))}
                </p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Average Per Expense</p>
                <p className="text-2xl font-light text-foreground tracking-tight">
                  {formatCurrency(filteredExpenses.length > 0 
                    ? filteredExpenses.reduce((sum, expense) => sum + expense.amount, 0) / filteredExpenses.length 
                    : 0
                  )}
                </p>
              </div>
            </div>
            <div className="p-6 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Top Category</p>
                <p className="text-2xl font-light text-foreground tracking-tight">
                  {uniqueCategories.length > 0 ? uniqueCategories[0] : 'None'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Expenses;