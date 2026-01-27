/**
 * POS Payment Modal - Payment processing interface
 * Nigerian Supermarket Focus
 */

import React, { useState, useEffect } from 'react';
import {
  CreditCard,
  DollarSign,
  Smartphone,
  Building2,
  X,
  Calculator,
  Receipt,
  Wifi,
  WifiOff,
  User
} from 'lucide-react';
import { PaymentMethod } from '@/lib/posService';

interface CartTotals {
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
}

interface POSPaymentModalProps {
  totals: CartTotals;
  isOnline: boolean;
  onPayment: (
    paymentMethod: PaymentMethod,
    tenderedAmount?: number,
    customerName?: string
  ) => void;
  onCancel: () => void;
}

const POSPaymentModal: React.FC<POSPaymentModalProps> = ({
  totals,
  isOnline,
  onPayment,
  onCancel
}) => {
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [tenderedAmount, setTenderedAmount] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const parseAmount = (value: string): number => {
    return parseFloat(value.replace(/[^\d.]/g, '')) || 0;
  };

  const tenderedAmountValue = parseAmount(tenderedAmount);
  const changeAmount = tenderedAmountValue > totals.total ? tenderedAmountValue - totals.total : 0;
  const isValidCashPayment = selectedPaymentMethod !== PaymentMethod.CASH || tenderedAmountValue >= totals.total;

  // Payment method options
  const paymentMethods = [
    {
      id: PaymentMethod.CASH,
      label: 'Cash',
      icon: DollarSign,
      description: 'Physical cash payment',
      requiresAmount: true,
      bgColor: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    },
    {
      id: PaymentMethod.TRANSFER,
      label: 'Bank Transfer',
      icon: Building2,
      description: 'Bank transfer / Mobile banking',
      requiresAmount: false,
      bgColor: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      id: PaymentMethod.POS,
      label: 'POS Card',
      icon: CreditCard,
      description: 'Debit/Credit card via POS terminal',
      requiresAmount: false,
      bgColor: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    },
    {
      id: PaymentMethod.MOBILE,
      label: 'Mobile Money',
      icon: Smartphone,
      description: 'Mobile wallet payment',
      requiresAmount: false,
      bgColor: 'bg-orange-500',
      hoverColor: 'hover:bg-orange-600'
    }
  ];

  // Quick amount buttons for cash payments
  const quickAmounts = [
    totals.total,
    Math.ceil(totals.total / 1000) * 1000,
    Math.ceil(totals.total / 5000) * 5000,
    Math.ceil(totals.total / 10000) * 10000
  ].filter((amount, index, arr) => arr.indexOf(amount) === index && amount >= totals.total);

  const handleQuickAmount = (amount: number) => {
    setTenderedAmount(amount.toString());
  };

  const handlePaymentMethodSelect = (method: PaymentMethod) => {
    setSelectedPaymentMethod(method);
    if (method !== PaymentMethod.CASH) {
      setTenderedAmount('');
    }
  };

  const handleProcessPayment = async () => {
    if (!isValidCashPayment) return;

    setIsProcessing(true);
    try {
      await onPayment(
        selectedPaymentMethod,
        selectedPaymentMethod === PaymentMethod.CASH ? tenderedAmountValue : undefined,
        customerName || undefined
      );
    } finally {
      setIsProcessing(false);
    }
  };

  // Auto-focus tendered amount for cash payments
  useEffect(() => {
    if (selectedPaymentMethod === PaymentMethod.CASH) {
      const input = document.getElementById('tendered-amount') as HTMLInputElement;
      if (input) {
        input.focus();
        input.select();
      }
    }
  }, [selectedPaymentMethod]);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 bg-gray-50 rounded-t-lg">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Process Payment</h2>
              <div className="flex items-center space-x-2 mt-1">
                {isOnline ? (
                  <div className="flex items-center text-green-600 text-sm">
                    <Wifi className="h-4 w-4 mr-1" />
                    <span>Online</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 text-sm">
                    <WifiOff className="h-4 w-4 mr-1" />
                    <span>Offline Mode</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Order Summary */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Order Summary</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Subtotal:</span>
                <span>{formatCurrency(totals.subtotal)}</span>
              </div>
              {totals.totalDiscount > 0 && (
                <div className="flex justify-between text-red-600">
                  <span>Discount:</span>
                  <span>-{formatCurrency(totals.totalDiscount)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-600">Tax (7.5%):</span>
                <span>{formatCurrency(totals.totalTax)}</span>
              </div>
              <div className="border-t border-gray-300 pt-2 flex justify-between text-lg font-bold">
                <span>Total:</span>
                <span className="text-blue-600">{formatCurrency(totals.total)}</span>
              </div>
            </div>
          </div>

          {/* Customer Name (Optional) */}
          <div className="mb-6">
            <label htmlFor="customer-name" className="flex items-center text-sm font-medium text-gray-700 mb-2">
              <User className="h-4 w-4 mr-1" />
              Customer Name (Optional)
            </label>
            <input
              id="customer-name"
              type="text"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              placeholder="Enter customer name for receipt"
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Payment Methods */}
          <div className="mb-6">
            <h3 className="font-semibold text-gray-900 mb-3">Payment Method</h3>
            <div className="grid grid-cols-2 gap-3">
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                const isSelected = selectedPaymentMethod === method.id;

                return (
                  <button
                    key={method.id}
                    onClick={() => handlePaymentMethodSelect(method.id)}
                    className={`
                      p-4 rounded-lg border-2 transition-all text-left
                      ${isSelected
                        ? 'border-blue-500 bg-blue-50 shadow-md'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                      }
                    `}
                  >
                    <div className="flex items-start space-x-3">
                      <div className={`p-2 rounded-lg ${method.bgColor} text-white`}>
                        <Icon className="h-5 w-5" />
                      </div>
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900">{method.label}</h4>
                        <p className="text-sm text-gray-500 mt-1">{method.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Cash Payment Details */}
          {selectedPaymentMethod === PaymentMethod.CASH && (
            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center">
                <Calculator className="h-5 w-5 mr-2" />
                Cash Payment
              </h3>

              <div className="space-y-4">
                {/* Amount Tendered */}
                <div>
                  <label htmlFor="tendered-amount" className="block text-sm font-medium text-gray-700 mb-2">
                    Amount Tendered *
                  </label>
                  <input
                    id="tendered-amount"
                    type="number"
                    value={tenderedAmount}
                    onChange={(e) => setTenderedAmount(e.target.value)}
                    placeholder="0.00"
                    min={totals.total}
                    step="0.01"
                    className="w-full px-4 py-3 text-lg border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  {tenderedAmountValue < totals.total && tenderedAmount && (
                    <p className="text-red-600 text-sm mt-1">
                      Amount must be at least {formatCurrency(totals.total)}
                    </p>
                  )}
                </div>

                {/* Quick Amount Buttons */}
                <div>
                  <p className="text-sm font-medium text-gray-700 mb-2">Quick amounts:</p>
                  <div className="flex flex-wrap gap-2">
                    {quickAmounts.map((amount) => (
                      <button
                        key={amount}
                        onClick={() => handleQuickAmount(amount)}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-md transition-colors"
                      >
                        {formatCurrency(amount)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Change Calculation */}
                {changeAmount > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <div className="flex justify-between items-center">
                      <span className="text-green-800 font-medium">Change Due:</span>
                      <span className="text-xl font-bold text-green-600">
                        {formatCurrency(changeAmount)}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex space-x-4">
            <button
              onClick={onCancel}
              className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors font-medium"
            >
              Cancel
            </button>
            <button
              onClick={handleProcessPayment}
              disabled={!isValidCashPayment || isProcessing}
              className="flex-1 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium flex items-center justify-center space-x-2"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <Receipt className="h-5 w-5" />
                  <span>Complete Payment</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPaymentModal;