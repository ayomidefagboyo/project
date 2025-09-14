import React, { useState, useCallback, useMemo } from 'react';
import CalculatorLayout from '@/components/calculators/CalculatorLayout';
import { DollarSign, TrendingUp, TrendingDown, AlertTriangle, Plus, Trash2 } from 'lucide-react';

interface CashFlowItem {
  id: string;
  description: string;
  amount: number;
  timing: number; // months from now
}

interface CashFlowInputs {
  initialCash: number;
  inflows: CashFlowItem[];
  outflows: CashFlowItem[];
  projectionMonths: number;
}

const CashFlowCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<CashFlowInputs>({
    initialCash: 50000,
    inflows: [
      { id: '1', description: 'Sales Revenue', amount: 25000, timing: 1 },
      { id: '2', description: 'Investment', amount: 10000, timing: 3 }
    ],
    outflows: [
      { id: '3', description: 'Operating Expenses', amount: 15000, timing: 1 },
      { id: '4', description: 'Equipment Purchase', amount: 8000, timing: 2 }
    ],
    projectionMonths: 12
  });

  const updateInitialCash = useCallback((value: number) => {
    setInputs(prev => ({ ...prev, initialCash: value }));
  }, []);

  const updateProjectionMonths = useCallback((value: number) => {
    setInputs(prev => ({ ...prev, projectionMonths: value }));
  }, []);

  const addCashFlowItem = useCallback((type: 'inflows' | 'outflows') => {
    const newItem: CashFlowItem = {
      id: Date.now().toString(),
      description: type === 'inflows' ? 'New Income Source' : 'New Expense',
      amount: 1000,
      timing: 1
    };

    setInputs(prev => ({
      ...prev,
      [type]: [...prev[type], newItem]
    }));
  }, []);

  const updateCashFlowItem = useCallback((type: 'inflows' | 'outflows', id: string, field: keyof Omit<CashFlowItem, 'id'>, value: string | number) => {
    setInputs(prev => ({
      ...prev,
      [type]: prev[type].map(item =>
        item.id === id ? { ...item, [field]: field === 'description' ? value : Number(value) } : item
      )
    }));
  }, []);

  const removeCashFlowItem = useCallback((type: 'inflows' | 'outflows', id: string) => {
    setInputs(prev => ({
      ...prev,
      [type]: prev[type].filter(item => item.id !== id)
    }));
  }, []);

  const calculations = useMemo(() => {
    const { initialCash, inflows, outflows, projectionMonths } = inputs;

    // Create monthly cash flow projections
    const monthlyProjections = Array.from({ length: projectionMonths }, (_, month) => {
      const monthNumber = month + 1;

      // Calculate inflows for this month
      const monthlyInflows = inflows
        .filter(item => item.timing === monthNumber)
        .reduce((sum, item) => sum + item.amount, 0);

      // Calculate outflows for this month
      const monthlyOutflows = outflows
        .filter(item => item.timing === monthNumber)
        .reduce((sum, item) => sum + item.amount, 0);

      const netCashFlow = monthlyInflows - monthlyOutflows;

      return {
        month: monthNumber,
        inflows: monthlyInflows,
        outflows: monthlyOutflows,
        netCashFlow,
        cumulativeCash: 0 // Will be calculated below
      };
    });

    // Calculate cumulative cash balance
    let runningBalance = initialCash;
    monthlyProjections.forEach(projection => {
      runningBalance += projection.netCashFlow;
      projection.cumulativeCash = runningBalance;
    });

    // Find minimum cash balance
    const minCashBalance = Math.min(initialCash, ...monthlyProjections.map(p => p.cumulativeCash));
    const minCashMonth = monthlyProjections.findIndex(p => p.cumulativeCash === minCashBalance) + 1;

    // Calculate totals
    const totalInflows = inflows.reduce((sum, item) => sum + item.amount, 0);
    const totalOutflows = outflows.reduce((sum, item) => sum + item.amount, 0);
    const netCashFlow = totalInflows - totalOutflows;
    const finalCashBalance = initialCash + netCashFlow;

    // Cash flow health indicators
    const cashFlowPositiveMonths = monthlyProjections.filter(p => p.netCashFlow > 0).length;
    const cashFlowNegativeMonths = monthlyProjections.filter(p => p.netCashFlow < 0).length;
    const hasNegativeBalance = monthlyProjections.some(p => p.cumulativeCash < 0);

    return {
      monthlyProjections,
      minCashBalance,
      minCashMonth: minCashBalance === initialCash ? 0 : minCashMonth,
      totalInflows,
      totalOutflows,
      netCashFlow,
      finalCashBalance,
      cashFlowPositiveMonths,
      cashFlowNegativeMonths,
      hasNegativeBalance
    };
  }, [inputs]);

  const getInsights = useCallback(() => {
    if (!calculations) return [];

    const insights = [];

    if (calculations.netCashFlow > 0) {
      insights.push(`Positive net cash flow of $${calculations.netCashFlow.toLocaleString()} over ${inputs.projectionMonths} months`);
    } else {
      insights.push(`Negative net cash flow of $${Math.abs(calculations.netCashFlow).toLocaleString()} - consider cost reduction`);
    }

    if (calculations.hasNegativeBalance) {
      insights.push(`⚠️ Cash balance goes negative in month ${calculations.minCashMonth} - plan for additional funding`);
    } else {
      insights.push('Cash balance remains positive throughout the projection period');
    }

    if (calculations.minCashBalance < 10000 && calculations.minCashBalance > 0) {
      insights.push('Low cash reserves detected - consider maintaining higher cash cushion');
    }

    if (calculations.cashFlowPositiveMonths > calculations.cashFlowNegativeMonths) {
      insights.push(`Healthy cash flow pattern: ${calculations.cashFlowPositiveMonths} positive months vs ${calculations.cashFlowNegativeMonths} negative months`);
    }

    return insights;
  }, [calculations, inputs.projectionMonths]);

  const exportToPDF = () => {
    console.log('Exporting cash flow projection to PDF');
  };

  const exportToExcel = () => {
    console.log('Exporting cash flow projection to Excel');
  };

  return (
    <CalculatorLayout
      title="Cash Flow Calculator"
      description="Forecast your business cash flow to identify potential shortages and plan for growth. Track monthly inflows, outflows, and cash balance projections."
      results={calculations ? {
        title: 'Cash Flow Projection',
        value: `$${calculations.finalCashBalance.toLocaleString()}`,
        subtitle: `Final cash balance after ${inputs.projectionMonths} months`,
        insights: getInsights()
      } : undefined}
      onExportPDF={exportToPDF}
      onExportExcel={exportToExcel}
    >
      <div className="space-y-8">
        {/* Initial Cash & Settings */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Starting Position
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Cash Balance ($)
              </label>
              <input
                type="number"
                value={inputs.initialCash}
                onChange={(e) => updateInitialCash(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="50000"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Current cash on hand
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Projection Period (Months)
              </label>
              <input
                type="number"
                value={inputs.projectionMonths}
                onChange={(e) => updateProjectionMonths(Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="12"
                min="1"
                max="36"
                step="1"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                How many months to project
              </p>
            </div>
          </div>
        </div>

        {/* Cash Inflows */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-green-600" />
              Cash Inflows
            </h3>
            <button
              onClick={() => addCashFlowItem('inflows')}
              className="flex items-center px-3 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Income
            </button>
          </div>

          <div className="space-y-4">
            {inputs.inflows.map((inflow) => (
              <div key={inflow.id} className="grid md:grid-cols-4 gap-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={inflow.description}
                    onChange={(e) => updateCashFlowItem('inflows', inflow.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    value={inflow.amount}
                    onChange={(e) => updateCashFlowItem('inflows', inflow.id, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Month</label>
                  <input
                    type="number"
                    value={inflow.timing}
                    onChange={(e) => updateCashFlowItem('inflows', inflow.id, 'timing', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                    max={inputs.projectionMonths}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => removeCashFlowItem('inflows', inflow.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Cash Outflows */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
              <TrendingDown className="w-5 h-5 mr-2 text-red-600" />
              Cash Outflows
            </h3>
            <button
              onClick={() => addCashFlowItem('outflows')}
              className="flex items-center px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add Expense
            </button>
          </div>

          <div className="space-y-4">
            {inputs.outflows.map((outflow) => (
              <div key={outflow.id} className="grid md:grid-cols-4 gap-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Description</label>
                  <input
                    type="text"
                    value={outflow.description}
                    onChange={(e) => updateCashFlowItem('outflows', outflow.id, 'description', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Amount ($)</label>
                  <input
                    type="number"
                    value={outflow.amount}
                    onChange={(e) => updateCashFlowItem('outflows', outflow.id, 'amount', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-600 dark:text-gray-300 mb-1">Month</label>
                  <input
                    type="number"
                    value={outflow.timing}
                    onChange={(e) => updateCashFlowItem('outflows', outflow.id, 'timing', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    min="1"
                    max={inputs.projectionMonths}
                  />
                </div>
                <div className="flex items-end">
                  <button
                    onClick={() => removeCashFlowItem('outflows', outflow.id)}
                    className="p-2 text-red-600 hover:text-red-800 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Summary Metrics */}
        {calculations && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <AlertTriangle className="w-5 h-5 mr-2 text-blue-600" />
              Cash Flow Summary
            </h3>

            <div className="grid md:grid-cols-4 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Inflows</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  +${calculations.totalInflows.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Outflows</div>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                  -${calculations.totalOutflows.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Net Cash Flow</div>
                <div className={`text-2xl font-bold ${calculations.netCashFlow >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  {calculations.netCashFlow >= 0 ? '+' : ''}${calculations.netCashFlow.toLocaleString()}
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Min Cash Balance</div>
                <div className={`text-2xl font-bold ${calculations.minCashBalance >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${calculations.minCashBalance.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {calculations.minCashMonth > 0 ? `Month ${calculations.minCashMonth}` : 'Starting balance'}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Warning for negative cash flow */}
        {calculations && calculations.hasNegativeBalance && (
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <h4 className="font-semibold text-red-800 dark:text-red-200">Cash Flow Warning</h4>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm">
              Your cash balance goes negative in month {calculations.minCashMonth}. Consider:
            </p>
            <ul className="text-red-700 dark:text-red-300 text-sm mt-2 ml-4 list-disc">
              <li>Securing additional funding or a line of credit</li>
              <li>Accelerating receivables or delaying some expenses</li>
              <li>Reducing discretionary spending</li>
            </ul>
          </div>
        )}
      </div>
    </CalculatorLayout>
  );
};

export default CashFlowCalculator;