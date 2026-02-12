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
      bgColor: 'bg-orange-600',
      hoverColor: 'hover:bg-orange-700'
    },
    {
      id: PaymentMethod.TRANSFER,
      label: 'Bank Transfer',
      icon: Building2,
      description: 'Bank transfer / Mobile banking',
      requiresAmount: false,
      bgColor: 'bg-orange-600',
      hoverColor: 'hover:bg-orange-700'
    },
    {
      id: PaymentMethod.POS,
      label: 'POS Card',
      icon: CreditCard,
      description: 'Debit/Credit card via POS terminal',
      requiresAmount: false,
      bgColor: 'bg-orange-600',
      hoverColor: 'hover:bg-orange-700'
    },
    {
      id: PaymentMethod.MOBILE,
      label: 'Mobile Money',
      icon: Smartphone,
      description: 'Mobile wallet payment',
      requiresAmount: false,
      bgColor: 'bg-orange-600',
      hoverColor: 'hover:bg-orange-700'
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
      <div className="bg-white rounded-xl shadow-xl max-w-5xl w-full max-h-[95vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-slate-200 bg-slate-50 rounded-t-xl">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-slate-900">Sales Receipt</h2>
              <div className="flex items-center space-x-2 mt-1">
                {isOnline ? (
                  <div className="flex items-center text-emerald-600 text-sm font-medium">
                    <Wifi className="h-4 w-4 mr-1" />
                    <span>Online</span>
                  </div>
                ) : (
                  <div className="flex items-center text-red-600 text-sm font-medium">
                    <WifiOff className="h-4 w-4 mr-1" />
                    <span>Offline Mode</span>
                  </div>
                )}
              </div>
            </div>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600 transition-colors touch-target-sm rounded-lg"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Receipt Layout - Similar to Reference */}
          <div className="grid grid-cols-12 gap-8">
            {/* Left Side - Receipt Details */}
            <div className="col-span-8 space-y-6">
              {/* Customer Name */}
              <div className="flex items-center space-x-4">
                <div className="flex-1">
                  <input
                    id="customer-name"
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Enter customer name or phone"
                    className="w-full px-4 py-3 text-lg border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Cash Payment Details - Only show if Cash is selected */}
              {selectedPaymentMethod === PaymentMethod.CASH && (
                <div className="bg-slate-50 rounded-lg p-6">
                  <h3 className="font-bold text-xl text-slate-900 mb-4 flex items-center">
                    <Calculator className="h-6 w-6 mr-2" />
                    Cash Payment
                  </h3>

                  <div className="space-y-4">
                    <div>
                      <label htmlFor="tendered-amount" className="block text-lg font-semibold text-slate-700 mb-2">
                        Amount Tendered
                      </label>
                      <input
                        id="tendered-amount"
                        type="number"
                        value={tenderedAmount}
                        onChange={(e) => setTenderedAmount(e.target.value)}
                        placeholder="0.00"
                        min={totals.total}
                        step="0.01"
                        className="w-full px-4 py-4 text-2xl font-bold border-2 border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      />
                    </div>

                    {/* Quick Amount Buttons */}
                    <div className="grid grid-cols-4 gap-3">
                      {quickAmounts.map((amount) => (
                        <button
                          key={amount}
                          onClick={() => handleQuickAmount(amount)}
                          className="px-4 py-3 text-lg font-semibold bg-white border-2 border-slate-200 hover:border-indigo-300 rounded-lg transition-colors"
                        >
                          {formatCurrency(amount)}
                        </button>
                      ))}
                    </div>

                    {/* Change Calculation */}
                    {changeAmount > 0 && (
                      <div className="bg-emerald-50 border-2 border-emerald-200 rounded-lg p-4">
                        <div className="flex justify-between items-center">
                          <span className="text-emerald-800 font-semibold text-lg">Change Due:</span>
                          <span className="text-3xl font-bold text-emerald-600">
                            {formatCurrency(changeAmount)}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Right Side - Order Summary */}
            <div className="col-span-4">
              <div className="bg-slate-50 rounded-lg p-6 sticky top-6">
                <h3 className="font-bold text-xl text-slate-900 mb-4">Order Summary</h3>
                <div className="space-y-3 text-lg">
                  <div className="flex justify-between">
                    <span className="text-slate-600">SubTotal:</span>
                    <span className="font-semibold">{formatCurrency(totals.subtotal)}</span>
                  </div>
                  {totals.totalDiscount > 0 && (
                    <div className="flex justify-between text-red-600">
                      <span>Discount:</span>
                      <span className="font-semibold">-{formatCurrency(totals.totalDiscount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-600">Tax:</span>
                    <span className="font-semibold">{formatCurrency(totals.totalTax)}</span>
                  </div>
                  <div className="border-t-2 border-slate-300 pt-3 flex justify-between text-2xl font-bold">
                    <span>Total:</span>
                    <span className="text-brand">{formatCurrency(totals.total)}</span>
                  </div>
                </div>

                {/* Amount Due Display */}
                <div className="mt-6 text-center">
                  <div className="text-lg text-slate-600">Amount Due</div>
                  <div className="text-4xl font-bold text-slate-900">
                    {selectedPaymentMethod === PaymentMethod.CASH && tenderedAmountValue >= totals.total
                      ? formatCurrency(0)
                      : formatCurrency(totals.total)
                    }
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Large Payment Method Buttons - Similar to Reference */}
          <div className="border-t-2 border-slate-200 pt-6">
            <div className="grid grid-cols-6 gap-4 mb-6">
              {[
                { method: PaymentMethod.CASH, label: 'Cash', active: selectedPaymentMethod === PaymentMethod.CASH },
                { method: PaymentMethod.POS, label: 'Credit', active: selectedPaymentMethod === PaymentMethod.POS },
                { method: PaymentMethod.POS, label: 'Debit', active: selectedPaymentMethod === PaymentMethod.POS },
                { method: PaymentMethod.TRANSFER, label: 'Check', active: selectedPaymentMethod === PaymentMethod.TRANSFER },
                { method: PaymentMethod.MOBILE, label: 'Gift', active: selectedPaymentMethod === PaymentMethod.MOBILE },
                { method: PaymentMethod.TRANSFER, label: 'Account', active: selectedPaymentMethod === PaymentMethod.TRANSFER }
              ].map((payment, index) => (
                <button
                  key={index}
                  onClick={() => handlePaymentMethodSelect(payment.method)}
                  className={`
                    h-16 font-bold text-lg rounded-lg transition-all touch-action-manipulation
                    ${payment.active
                      ? 'btn-brand border-2 border-transparent shadow-lg text-white'
                      : 'bg-brand-soft border-2 border-brand-soft text-brand hover:opacity-90'
                    }
                  `}
                >
                  {payment.label}
                </button>
              ))}
            </div>
          </div>

          {/* Large Action Buttons - bottom-right group for Hold / Save actions */}
          <div className="mt-4 flex items-center justify-between gap-4">
            {/* Left side: secondary actions */}
            <div className="flex gap-3">
              <button
                onClick={onCancel}
                className="h-16 px-6 btn-brand text-white font-bold text-lg rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {/* Email functionality */}}
                className="h-16 px-6 btn-brand text-white font-bold text-lg rounded-lg transition-colors"
              >
                Save &amp; Email
              </button>
            </div>

            {/* Right side: primary sales terminal actions (bottom-right) */}
            <div className="flex gap-3">
              <button
                onClick={() => {/* Hold functionality */}}
                className="h-16 px-6 btn-brand text-white font-bold text-lg rounded-lg transition-colors"
              >
                Put on Hold
              </button>
              <button
                onClick={() => {/* Save functionality */}}
                className="h-16 px-6 btn-brand text-white font-bold text-lg rounded-lg transition-colors"
              >
                Save Only
              </button>
              <button
                onClick={handleProcessPayment}
                disabled={!isValidCashPayment || isProcessing}
                className="h-16 px-6 btn-brand disabled:bg-slate-400 disabled:cursor-not-allowed text-white font-bold text-lg rounded-lg transition-colors flex items-center justify-center space-x-2"
              >
                {isProcessing ? (
                  <>
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
                    <span>Processing...</span>
                  </>
                ) : (
                  <span>Save &amp; Print</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default POSPaymentModal;
