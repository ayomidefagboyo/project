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
      description: 'Input cash register totals: Cash $540, Card/Transfer $890, POS transactions...',
      amount: '$1,430',
      type: 'income',
      icon: <Receipt className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'receipt',
      time: '9PM',
      title: 'Scan Receipt',
      description: 'Take photo of supply invoice. AI extracts: Merchant, amount, category, date...',
      amount: '-$89',
      type: 'expense',
      icon: <Package className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ai_check',
      time: '9PM',
      title: 'AI Analysis',
      description: 'AI reviews expense patterns and flags any anomalies. This expense looks normal.',
      amount: 'No Issues',
      type: 'balance',
      icon: <CheckCircle className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ask_ai',
      time: '9PM',
      title: 'Ask AI Assistant',
      description: 'Chat with AI: "How is my profit trending?" AI responds with insights and comparisons.',
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
    <div className="w-full max-w-md mx-auto">
      {/* Demo Controls */}
      <div className="flex justify-center space-x-2 mb-4">
        {currentStep === -1 ? (
          <button
            onClick={startDemo}
            className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            Start Demo
          </button>
        ) : (
          <>
            <button
              onClick={prevStep}
              disabled={currentStep === -1}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            <button
              onClick={nextStep}
              disabled={currentStep >= demoSteps.length - 1}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
            <button
              onClick={resetDemo}
              className="px-4 py-2 bg-gray-600 text-white rounded-lg text-sm font-medium hover:bg-gray-700 transition-colors"
            >
              Reset
            </button>
          </>
        )}
      </div>

      {/* Timeline */}
      {currentStep >= 0 && (
        <div className="space-y-2 mb-4">
          {demoSteps.map((step, index) => {
            const status = getStepStatus(index);
            const isActive = index === currentStep;

            return (
              <div
                key={step.id}
                className={`rounded-lg transition-all duration-500 transform ${
                  status === 'completed'
                    ? 'bg-emerald-50 dark:bg-emerald-900/20 opacity-70'
                    : status === 'processing'
                    ? 'bg-orange-50 dark:bg-orange-900/20 scale-105 shadow-lg ring-2 ring-orange-300'
                    : 'bg-gray-50 dark:bg-gray-800 opacity-60'
                }`}
              >
                {/* Collapsed View */}
                <div className="flex items-center justify-between p-3">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium text-gray-600">{step.time}</span>
                    <p className={`text-sm font-medium ${
                      status === 'pending' ? 'text-gray-400' : 'text-gray-900 dark:text-white'
                    }`}>
                      {step.title}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <span className={`text-sm font-bold ${
                      status === 'pending' ? 'text-gray-300' : getAmountColor(step.type)
                    }`}>
                      {step.amount}
                    </span>
                    {getStatusIcon(status)}
                  </div>
                </div>

                {/* Expanded View - Only for Active Step */}
                {status === 'processing' && (
                  <div className="px-3 pb-3 border-t border-orange-200 dark:border-orange-800 mt-2 pt-2">
                    <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">
                      {step.description}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
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