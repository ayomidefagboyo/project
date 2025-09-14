import React, { useState, useCallback, useMemo } from 'react';
import CalculatorLayout from '@/components/calculators/CalculatorLayout';
import { TrendingUp, DollarSign, Calendar, Percent } from 'lucide-react';

interface ROIInputs {
  initialInvestment: number;
  finalValue: number;
  timeframe: number;
  timeUnit: 'months' | 'years';
}

const ROICalculator: React.FC = () => {
  const [inputs, setInputs] = useState<ROIInputs>({
    initialInvestment: 10000,
    finalValue: 15000,
    timeframe: 12,
    timeUnit: 'months'
  });

  const updateInput = useCallback((field: keyof ROIInputs, value: number | string) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'timeUnit' ? value : Number(value)
    }));
  }, []);

  const calculations = useMemo(() => {
    const { initialInvestment, finalValue, timeframe, timeUnit } = inputs;

    if (initialInvestment <= 0 || finalValue <= 0 || timeframe <= 0) {
      return null;
    }

    // Basic ROI calculation
    const totalReturn = finalValue - initialInvestment;
    const roiPercentage = (totalReturn / initialInvestment) * 100;

    // Annualized ROI
    const timeInYears = timeUnit === 'years' ? timeframe : timeframe / 12;
    const annualizedROI = timeInYears > 0 ? (Math.pow(finalValue / initialInvestment, 1 / timeInYears) - 1) * 100 : 0;

    // Monthly ROI (for comparison)
    const monthlyROI = timeInYears > 0 ? Math.pow(1 + (roiPercentage / 100), 1 / (timeInYears * 12)) - 1 : 0;

    // Break-even analysis
    const breakEvenTime = roiPercentage > 0 ? timeframe : 0;

    return {
      totalReturn,
      roiPercentage,
      annualizedROI,
      monthlyROI: monthlyROI * 100,
      breakEvenTime,
      timeInYears
    };
  }, [inputs]);

  const getInsights = useCallback(() => {
    if (!calculations) return [];

    const insights = [];

    if (calculations.roiPercentage > 0) {
      insights.push(`Your investment generated a positive return of ${calculations.roiPercentage.toFixed(1)}%`);
    } else {
      insights.push(`Your investment had a negative return of ${Math.abs(calculations.roiPercentage).toFixed(1)}%`);
    }

    if (calculations.annualizedROI > 10) {
      insights.push('Excellent annual return - above average market performance');
    } else if (calculations.annualizedROI > 7) {
      insights.push('Good annual return - competitive with market averages');
    } else if (calculations.annualizedROI > 0) {
      insights.push('Moderate positive return - consider if this meets your goals');
    } else {
      insights.push('Negative annual return - review investment strategy');
    }

    if (calculations.timeInYears >= 1) {
      insights.push(`Over ${calculations.timeInYears.toFixed(1)} year(s), your money ${calculations.roiPercentage > 0 ? 'grew' : 'declined'} by $${Math.abs(calculations.totalReturn).toLocaleString()}`);
    }

    return insights;
  }, [calculations]);

  const exportToPDF = () => {
    // Here you would implement PDF export functionality
    console.log('Exporting ROI calculation to PDF');
  };

  const exportToExcel = () => {
    // Here you would implement Excel export functionality
    console.log('Exporting ROI calculation to Excel');
  };

  return (
    <CalculatorLayout
      title="ROI Calculator"
      description="Calculate return on investment for business decisions, equipment purchases, marketing campaigns, and more. Make data-driven financial decisions with instant ROI analysis."
      results={calculations ? {
        title: 'Your ROI Results',
        value: `${calculations.roiPercentage >= 0 ? '+' : ''}${calculations.roiPercentage.toFixed(1)}%`,
        subtitle: `Total Return: ${calculations.totalReturn >= 0 ? '+' : ''}$${calculations.totalReturn.toLocaleString()}`,
        insights: getInsights()
      } : undefined}
      onExportPDF={exportToPDF}
      onExportExcel={exportToExcel}
    >
      <div className="space-y-8">
        {/* Investment Details */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Investment Details
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Initial Investment ($)
              </label>
              <input
                type="number"
                value={inputs.initialInvestment}
                onChange={(e) => updateInput('initialInvestment', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="10000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Amount you invested initially
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Final Value ($)
              </label>
              <input
                type="number"
                value={inputs.finalValue}
                onChange={(e) => updateInput('finalValue', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="15000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Current or expected final value
              </p>
            </div>
          </div>
        </div>

        {/* Timeframe */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <Calendar className="w-5 h-5 mr-2 text-blue-600" />
            Investment Period
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Timeframe
              </label>
              <input
                type="number"
                value={inputs.timeframe}
                onChange={(e) => updateInput('timeframe', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="12"
                min="1"
                step="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Time Unit
              </label>
              <select
                value={inputs.timeUnit}
                onChange={(e) => updateInput('timeUnit', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="months">Months</option>
                <option value="years">Years</option>
              </select>
            </div>
          </div>
        </div>

        {/* Additional Metrics */}
        {calculations && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Percent className="w-5 h-5 mr-2 text-blue-600" />
              Detailed Analysis
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Annualized ROI</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calculations.annualizedROI.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Yearly average return
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Monthly ROI</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calculations.monthlyROI.toFixed(2)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Average monthly return
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Total Gain/Loss</div>
                <div className={`text-2xl font-bold ${calculations.totalReturn >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {calculations.totalReturn >= 0 ? '+' : ''}${calculations.totalReturn.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Absolute return amount
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Investment Period</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calculations.timeInYears.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Years invested
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Common ROI Benchmarks */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">ROI Benchmarks</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Stock Market</div>
              <div className="text-gray-600 dark:text-gray-300">~10% annually</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Real Estate</div>
              <div className="text-gray-600 dark:text-gray-300">~8-12% annually</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Business Equipment</div>
              <div className="text-gray-600 dark:text-gray-300">~15-25% annually</div>
            </div>
          </div>
        </div>
      </div>
    </CalculatorLayout>
  );
};

export default ROICalculator;