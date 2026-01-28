import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { Mail, Sync, Check, X, Eye, Trash2, Settings, AlertCircle } from 'lucide-react';

interface EmailAccount {
  id: string;
  email_address: string;
  provider: string;
  last_sync: string | null;
  is_active: boolean;
  expenses_count: number;
}

interface ParsedExpense {
  id: string;
  amount: number;
  merchant: string;
  transaction_date: string;
  account_number: string;
  transaction_type: string;
  category: string;
  confidence_score: number;
  bank_name: string | null;
  is_approved: boolean;
}

const EmailExpenseSync: React.FC = () => {
  const [emailAccounts, setEmailAccounts] = useState<EmailAccount[]>([]);
  const [parsedExpenses, setParsedExpenses] = useState<ParsedExpense[]>([]);
  const [selectedAccount, setSelectedAccount] = useState<string | null>(null);
  const [showSetupModal, setShowSetupModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadEmailAccounts();
  }, []);

  const loadEmailAccounts = async () => {
    try {
      const response = await fetch('/api/v1/email-expenses/accounts', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const accounts = await response.json();
        setEmailAccounts(accounts);
      }
    } catch (err) {
      console.error('Error loading email accounts:', err);
    }
  };

  const loadParsedExpenses = async (accountId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/email-expenses/expenses/${accountId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        const expenses = await response.json();
        setParsedExpenses(expenses);
      }
    } catch (err) {
      console.error('Error loading parsed expenses:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const syncAccount = async (accountId: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/v1/email-expenses/sync/${accountId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({ days_back: 7 })
      });

      if (response.ok) {
        // Refresh accounts and expenses after sync
        await loadEmailAccounts();
        if (selectedAccount) {
          await loadParsedExpenses(selectedAccount);
        }
      }
    } catch (err) {
      console.error('Error syncing account:', err);
      setError('Failed to sync email account');
    } finally {
      setIsLoading(false);
    }
  };

  const approveExpense = async (expenseId: string) => {
    try {
      const response = await fetch(`/api/v1/email-expenses/expenses/${expenseId}/approve`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (response.ok) {
        // Refresh expenses list
        if (selectedAccount) {
          await loadParsedExpenses(selectedAccount);
        }
      }
    } catch (err) {
      console.error('Error approving expense:', err);
      setError('Failed to approve expense');
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600';
    if (score >= 0.6) return 'text-yellow-600';
    return 'text-red-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Email Expense Sync
          </h2>
          <p className="text-gray-500 dark:text-gray-400">
            Automatically import expenses from your email debit alerts
          </p>
        </div>
        <Button
          onClick={() => setShowSetupModal(true)}
          className="flex items-center space-x-2"
        >
          <Mail size={20} />
          <span>Connect Email</span>
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <AlertCircle size={20} className="text-red-500 mr-2" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Email Accounts */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold mb-4">Connected Accounts</h3>

            {emailAccounts.length === 0 ? (
              <div className="text-center py-8">
                <Mail size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500">No email accounts connected</p>
                <Button
                  onClick={() => setShowSetupModal(true)}
                  variant="outline"
                  className="mt-4"
                >
                  Connect First Account
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                {emailAccounts.map((account) => (
                  <div
                    key={account.id}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedAccount === account.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                    onClick={() => {
                      setSelectedAccount(account.id);
                      loadParsedExpenses(account.id);
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{account.email_address}</p>
                        <p className="text-xs text-gray-500 capitalize">{account.provider}</p>
                        {account.last_sync && (
                          <p className="text-xs text-gray-400">
                            Last sync: {new Date(account.last_sync).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center space-x-1">
                        <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                          {account.expenses_count}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={(e) => {
                            e.stopPropagation();
                            syncAccount(account.id);
                          }}
                          disabled={isLoading}
                        >
                          <Sync size={14} />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Parsed Expenses */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow">
            <div className="p-6 border-b">
              <h3 className="text-lg font-semibold">
                {selectedAccount ? 'Parsed Expenses' : 'Select an account to view expenses'}
              </h3>
            </div>

            {selectedAccount ? (
              <div className="p-6">
                {isLoading ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                    <p className="mt-2 text-gray-500">Loading expenses...</p>
                  </div>
                ) : parsedExpenses.length === 0 ? (
                  <div className="text-center py-8">
                    <Eye size={48} className="mx-auto text-gray-400 mb-4" />
                    <p className="text-gray-500">No expenses found</p>
                    <Button
                      onClick={() => selectedAccount && syncAccount(selectedAccount)}
                      variant="outline"
                      className="mt-4"
                    >
                      <Sync size={16} className="mr-2" />
                      Sync Now
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {parsedExpenses.map((expense) => (
                      <div
                        key={expense.id}
                        className={`border rounded-lg p-4 ${
                          expense.is_approved ? 'bg-green-50 border-green-200' : 'border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex-1">
                            <div className="flex items-center space-x-3">
                              <h4 className="font-medium text-lg">{expense.merchant}</h4>
                              <span className={`text-sm font-medium ${getConfidenceColor(expense.confidence_score)}`}>
                                {Math.round(expense.confidence_score * 100)}% confidence
                              </span>
                            </div>

                            <div className="mt-2 grid grid-cols-2 gap-4 text-sm text-gray-600">
                              <div>
                                <span className="font-medium">Amount:</span> {formatCurrency(expense.amount)}
                              </div>
                              <div>
                                <span className="font-medium">Date:</span> {new Date(expense.transaction_date).toLocaleDateString()}
                              </div>
                              <div>
                                <span className="font-medium">Category:</span> {expense.category}
                              </div>
                              <div>
                                <span className="font-medium">Account:</span> {expense.account_number}
                              </div>
                            </div>

                            {expense.bank_name && (
                              <div className="mt-2 text-sm text-gray-600">
                                <span className="font-medium">Bank:</span> {expense.bank_name}
                              </div>
                            )}
                          </div>

                          <div className="flex items-center space-x-2">
                            {expense.is_approved ? (
                              <div className="flex items-center text-green-600">
                                <Check size={20} className="mr-1" />
                                <span className="text-sm">Approved</span>
                              </div>
                            ) : (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => approveExpense(expense.id)}
                                  className="bg-green-600 hover:bg-green-700"
                                >
                                  <Check size={16} className="mr-1" />
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-red-600 border-red-600 hover:bg-red-50"
                                >
                                  <X size={16} />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                <Settings size={48} className="mx-auto mb-4 text-gray-400" />
                <p>Select an email account to view and manage expenses</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Email Setup Modal */}
      {showSetupModal && (
        <EmailSetupModal
          onClose={() => setShowSetupModal(false)}
          onSuccess={() => {
            setShowSetupModal(false);
            loadEmailAccounts();
          }}
        />
      )}
    </div>
  );
};

// Email Setup Modal Component
const EmailSetupModal: React.FC<{
  onClose: () => void;
  onSuccess: () => void;
}> = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    email_address: '',
    provider: 'gmail',
    app_password: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch('/api/v1/email-expenses/setup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        },
        body: JSON.stringify({
          ...formData,
          imap_server: '' // Will be auto-detected by provider
        })
      });

      if (response.ok) {
        onSuccess();
      } else {
        const errorData = await response.json();
        setError(errorData.detail || 'Failed to connect email account');
      }
    } catch (err) {
      setError('Network error. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-medium">Connect Email Account</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-700 text-sm">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Email Address</label>
            <input
              type="email"
              value={formData.email_address}
              onChange={(e) => setFormData({ ...formData, email_address: e.target.value })}
              className="w-full p-2 border rounded-md"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">Email Provider</label>
            <select
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              className="w-full p-2 border rounded-md"
            >
              <option value="gmail">Gmail</option>
              <option value="outlook">Outlook/Hotmail</option>
              <option value="yahoo">Yahoo Mail</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">App Password</label>
            <input
              type="password"
              value={formData.app_password}
              onChange={(e) => setFormData({ ...formData, app_password: e.target.value })}
              className="w-full p-2 border rounded-md"
              placeholder="Generate from your email security settings"
              required
            />
            <p className="text-xs text-gray-500 mt-1">
              Create an app-specific password from your email security settings
            </p>
          </div>

          <div className="flex space-x-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting ? 'Connecting...' : 'Connect'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default EmailExpenseSync;