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
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalSales, setTotalSales] = useState(0);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [profit, setProfit] = useState(0);

  const demoSteps: DemoStep[] = [
    {
      id: 'eod',
      time: '📊',
      title: 'EOD Report',
      description: 'Cash: $540, Card: $890...',
      amount: '$1,430',
      type: 'income',
      icon: <Receipt className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'receipt',
      time: '📄',
      title: 'Scan Receipt',
      description: 'AI extracting data...',
      amount: '-$89',
      type: 'expense',
      icon: <Package className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ai_check',
      time: '🤖',
      title: 'AI Analysis',
      description: 'Expense looks normal',
      amount: '✓',
      type: 'balance',
      icon: <CheckCircle className="w-4 h-4" />,
      status: 'processing'
    },
    {
      id: 'ask_ai',
      time: '💬',
      title: 'Ask AI',
      description: '"How\'s my profit trend?"',
      amount: '+12%',
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

  useEffect(() => {
    if (isPlaying && currentStep < demoSteps.length - 1) {
      const timer = setTimeout(() => {
        setCurrentStep(prev => {
          const nextStep = prev + 1;
          updateTotals(nextStep);
          return nextStep;
        });
      }, 1200);

      return () => clearTimeout(timer);
    } else if (currentStep >= demoSteps.length - 1) {
      setIsPlaying(false);
    }
  }, [currentStep, isPlaying, demoSteps.length]);

  const startDemo = () => {
    setCurrentStep(0);
    setIsPlaying(true);
    updateTotals(0);
  };

  const resetDemo = () => {
    setCurrentStep(0);
    setIsPlaying(false);
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
    <div className="w-full max-w-sm mx-auto">
      {/* Demo Controls */}
      <div className="flex justify-center mb-4">
        <button
          onClick={startDemo}
          disabled={isPlaying}
          className="px-6 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {isPlaying ? '▶ Playing...' : '▶ Watch Sarah\'s Day'}
        </button>
      </div>

      {/* Compact Timeline */}
      <div className="space-y-2 mb-4">
        {demoSteps.map((step, index) => {
          const status = getStepStatus(index);
          const isActive = index === currentStep;

          return (
            <div
              key={step.id}
              className={`flex items-center justify-between p-2 rounded-lg transition-all duration-700 transform ${
                status === 'completed'
                  ? 'bg-emerald-50 dark:bg-emerald-900/20 opacity-70'
                  : status === 'processing'
                  ? 'bg-orange-50 dark:bg-orange-900/20 scale-105 shadow-md animate-pulse'
                  : 'bg-gray-50 dark:bg-gray-800 opacity-40'
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className="text-lg">{step.time}</span>
                <div>
                  <p className={`text-sm font-medium ${
                    status === 'pending' ? 'text-gray-400' : 'text-gray-900 dark:text-white'
                  }`}>
                    {step.title}
                  </p>
                  {status === 'processing' && (
                    <p className="text-xs text-orange-600 animate-pulse">{step.description}</p>
                  )}
                </div>
              </div>

              <div className="flex items-center space-x-1">
                <span className={`text-sm font-bold ${
                  status === 'pending' ? 'text-gray-300' : getAmountColor(step.type)
                }`}>
                  {step.amount}
                </span>
                {getStatusIcon(status)}
              </div>
            </div>
          );
        })}
      </div>

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
            <div className="flex items-center justify-between">
              <span className="text-xs text-gray-600">AI Insight:</span>
              <div className="flex items-center text-emerald-600 animate-pulse">
                <TrendingUp className="w-4 h-4 mr-1" />
                <span className="text-xs font-medium">+12% vs yesterday</span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-600 dark:text-gray-400">Net Profit</p>
              <p className="text-xl font-bold text-emerald-600 animate-bounce">
                ${profit.toFixed(0)}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default BusinessScenarioDemo;