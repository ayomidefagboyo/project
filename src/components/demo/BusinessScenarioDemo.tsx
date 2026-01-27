import React, { useState, useEffect } from 'react';
import { Clock, DollarSign, Receipt, TrendingUp, Coffee, Package, CheckCircle, AlertCircle } from 'lucide-react';

interface DemoStep {
  id: string;
  time: string;
  title: string;
  description: string;
  amount: string;
  type: 'income' | 'expense' | 'balance';
  icon: React.ReactNode;
  status: 'completed' | 'processing' | 'pending';
}

const BusinessScenarioDemo: React.FC = () => {
  const [currentStep, setCurrentStep] = useState(-1);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);

  const demoSteps: DemoStep[] = [
    {
      id: 'eod',
      time: '8PM',
      title: 'EOD Report',
      description: 'Sarah enters her daily sales totals: Cash sales $540, Card/Transfer $890, POS system shows total daily revenue of $1,430. The system automatically validates totals and creates her end-of-day financial summary.',
      amount: '$1,430',
      type: 'income',
      icon: <Receipt className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'receipt',
      time: '9PM',
      title: 'Scan Receipt',
      description: 'Sarah takes a photo of her supply invoice using the mobile app. Within seconds, the AI recognizes "Metro Restaurant Supplies" as the merchant, extracts the $89.50 amount, automatically categorizes it under "Kitchen Supplies", and captures today\'s date. The expense is instantly added to her books without any manual data entry.',
      amount: '-$89',
      type: 'expense',
      icon: <Package className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ai_check',
      time: '9PM',
      title: 'AI Analysis',
      description: 'The AI automatically reviews the expense against Sarah\'s spending patterns, vendor history, and typical amounts. It checks for duplicates, unusual amounts, and suspicious patterns. This $89 supply expense appears normal and within expected ranges.',
      amount: 'No Issues',
      type: 'balance',
      icon: <CheckCircle className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ask_ai',
      time: '9PM',
      title: 'Ask AI Assistant',
      description: 'Sarah asks "How is my profit trending?" The AI analyzes her financial data and responds: "Your profit is up 12% compared to yesterday, driven by higher card transactions. Your expense ratio is healthy at 6.2%."',
      amount: '+12% vs yesterday',
      type: 'balance',
      icon: <TrendingUp className="w-4 h-4" />,
      status: 'processing'
    }
  ];

  const updateTotals = (stepIndex: number) => {
    if (stepIndex >= 0) {
      setTotalSales(1430); // From EOD
    }
    if (stepIndex >= 1) {
      setTotalExpenses(89); // From receipt
    }

    const finalProfit = 1430 - 89;
    setProfit(stepIndex >= 0 ? finalProfit : 0);
  };

  const nextStep = () => {
    if (currentStep < demoSteps.length - 1) {
      const next = currentStep + 1;
      setCurrentStep(next);
      updateTotals(next);
    }
  };

  const prevStep = () => {
    if (currentStep > -1) {
      const prev = currentStep - 1;
      setCurrentStep(prev);
      updateTotals(prev);
    }
  };

  const startDemo = () => {
    setCurrentStep(0);
    updateTotals(0);
  };

  const resetDemo = () => {
    setCurrentStep(-1);
    setTotalSales(0);
    setTotalExpenses(0);
    setProfit(0);
  };

  const getStepStatus = (index: number): 'completed' | 'processing' | 'pending' => {
    if (index < currentStep) return 'completed';
    if (index === currentStep) return 'processing';
    return 'pending';
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-emerald-500" />;
      case 'processing':
        return <AlertCircle className="w-4 h-4 text-orange-500 animate-pulse" />;
      default:
        return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getAmountColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'text-emerald-600 font-semibold';
      case 'expense':
        return 'text-red-600 font-semibold';
      default:
        return 'text-blue-600 font-semibold';
    }
  };

  return (
    <div className="w-full max-w-lg mx-auto">
      {/* Demo Controls */}
      <div className="flex justify-center mb-6">
        {currentStep === -1 ? (
          <button
            onClick={startDemo}
            className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 transition-colors"
          >
            Start Demo
          </button>
        ) : (
          <button
            onClick={nextStep}
            disabled={currentStep >= demoSteps.length - 1}
            className="px-8 py-3 bg-emerald-600 text-white rounded-lg font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {currentStep >= demoSteps.length - 1 ? 'Demo Complete' : 'Continue'}
          </button>
        )}
      </div>

      {/* Active Step - Fully Expanded */}
      {currentStep >= 0 && (
        <div className="mb-6">
          {(() => {
            const step = demoSteps[currentStep];
            return (
              <div className="bg-gradient-to-r from-orange-50 to-orange-100 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl p-6 shadow-lg ring-2 ring-orange-300">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-orange-500 rounded-full flex items-center justify-center text-white font-bold">
                      {currentStep + 1}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-600">{step.time}</p>
                      <h3 className="text-xl font-semibold text-gray-900 dark:text-white">{step.title}</h3>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${getAmountColor(step.type)}`}>
                      {step.amount}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="bg-white dark:bg-gray-800 rounded-lg p-4 mb-4">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed">
                    {step.description}
                  </p>
                </div>

                {/* Progress Indicator */}
                <div className="flex items-center justify-between">
                  <div className="flex space-x-2">
                    {demoSteps.map((_, index) => (
                      <div
                        key={index}
                        className={`w-3 h-3 rounded-full transition-colors ${
                          index < currentStep
                            ? 'bg-emerald-500'
                            : index === currentStep
                            ? 'bg-orange-500'
                            : 'bg-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-sm text-gray-600">
                    Step {currentStep + 1} of {demoSteps.length}
                  </span>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* Compact Summary */}
      <div className="bg-emerald-50 dark:bg-emerald-900/20 rounded-lg p-3">
        {currentStep < demoSteps.length - 1 ? (
          <div className="text-center">
            <p className="text-xs text-gray-600 dark:text-gray-400">Today's Sales</p>
            <p className={`text-xl font-bold transition-all duration-500 text-emerald-600 ${totalSales > 0 ? 'transform scale-110' : ''}`}>
              ${totalSales.toFixed(0)}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <div className="text-center">
              <span className="text-xs text-gray-600">AI Insights</span>
              <div className="flex items-center justify-center text-emerald-600 animate-pulse mt-1">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">+12% vs yesterday</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">Net Profit</p>
              <p className="text-xl font-bold text-emerald-600 animate-bounce">
                $1,341
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessScenarioDemo;