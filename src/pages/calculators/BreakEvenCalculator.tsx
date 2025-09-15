import React, { useState, useCallback, useMemo } from 'react';
import CalculatorLayout from '@/components/calculators/CalculatorLayout';
import { Target, DollarSign, TrendingDown, Package } from 'lucide-react';

interface BreakEvenInputs {
  fixedCosts: number;
  variableCostPerUnit: number;
  pricePerUnit: number;
  targetProfit?: number;
}

const BreakEvenCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<BreakEvenInputs>({
    fixedCosts: 10000,
    variableCostPerUnit: 5,
    pricePerUnit: 15,
    targetProfit: 5000
  });

  const updateInput = useCallback((field: keyof BreakEvenInputs, value: number) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const calculations = useMemo(() => {
    const { fixedCosts, variableCostPerUnit, pricePerUnit, targetProfit } = inputs;

    if (pricePerUnit <= variableCostPerUnit || pricePerUnit <= 0 || fixedCosts < 0) {
      return null;
    }

    // Contribution margin per unit
    const contributionMargin = pricePerUnit - variableCostPerUnit;
    const contributionMarginRatio = (contributionMargin / pricePerUnit) * 100;

    // Break-even point in units
    const breakEvenUnits = Math.ceil(fixedCosts / contributionMargin);

    // Break-even point in revenue
    const breakEvenRevenue = breakEvenUnits * pricePerUnit;

    // Units needed for target profit
    const unitsForTargetProfit = targetProfit ? Math.ceil((fixedCosts + targetProfit) / contributionMargin) : 0;
    const revenueForTargetProfit = unitsForTargetProfit * pricePerUnit;

    // Margin of safety (if target profit is set)
    const marginOfSafety = targetProfit ? ((unitsForTargetProfit - breakEvenUnits) / unitsForTargetProfit) * 100 : 0;

    return {
      contributionMargin,
      contributionMarginRatio,
      breakEvenUnits,
      breakEvenRevenue,
      unitsForTargetProfit,
      revenueForTargetProfit,
      marginOfSafety
    };
  }, [inputs]);

  const getInsights = useCallback(() => {
    if (!calculations) return [];

    const insights = [];

    insights.push(`You need to sell ${calculations.breakEvenUnits.toLocaleString()} units to break even`);
    insights.push(`Each unit contributes $${calculations.contributionMargin.toFixed(2)} toward covering fixed costs`);

    if (calculations.contributionMarginRatio > 50) {
      insights.push('Excellent contribution margin - strong pricing power');
    } else if (calculations.contributionMarginRatio > 30) {
      insights.push('Good contribution margin - healthy unit economics');
    } else if (calculations.contributionMarginRatio > 15) {
      insights.push('Moderate contribution margin - consider cost optimization');
    } else {
      insights.push('Low contribution margin - review pricing and costs urgently');
    }

    if (inputs.targetProfit && calculations.unitsForTargetProfit > 0) {
      const additionalUnits = calculations.unitsForTargetProfit - calculations.breakEvenUnits;
      insights.push(`Sell ${additionalUnits.toLocaleString()} more units beyond break-even to reach your profit target`);
    }

    return insights;
  }, [calculations, inputs.targetProfit]);

  const exportToPDF = () => {
    console.log('Exporting break-even analysis to PDF');
  };

  const exportToExcel = () => {
    console.log('Exporting break-even analysis to Excel');
  };

  return (
    <CalculatorLayout
      title="Break-Even Calculator"
      description="Calculate when your business will break even and start generating profit. Analyze unit economics, contribution margins, and plan for profitability."
      keywords="break-even calculator, break even analysis, contribution margin calculator, unit economics, profitability calculator, business break even"
      canonical="/calculators/break-even"
      results={calculations ? {
        title: 'Break-Even Analysis',
        value: calculations.breakEvenUnits.toLocaleString(),
        subtitle: `Units to break even | $${calculations.breakEvenRevenue.toLocaleString()} revenue`,
        insights: getInsights()
      } : undefined}
      onExportPDF={exportToPDF}
      onExportExcel={exportToExcel}
    >
      <div className="space-y-8">
        {/* Cost Structure */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Cost Structure
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Fixed Costs ($)
              </label>
              <input
                type="number"
                value={inputs.fixedCosts}
                onChange={(e) => updateInput('fixedCosts', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="10000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Rent, salaries, insurance, etc. (monthly/yearly)
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Variable Cost per Unit ($)
              </label>
              <input
                type="number"
                value={inputs.variableCostPerUnit}
                onChange={(e) => updateInput('variableCostPerUnit', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="5"
                min="0"
                step="0.01"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Materials, labor, shipping per unit
              </p>
            </div>
          </div>
        </div>

        {/* Pricing */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Product Pricing
          </h3>

          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Price per Unit ($)
              </label>
              <input
                type="number"
                value={inputs.pricePerUnit}
                onChange={(e) => updateInput('pricePerUnit', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="15"
                min="0.01"
                step="0.01"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Selling price per unit
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Target Profit ($) <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="number"
                value={inputs.targetProfit || ''}
                onChange={(e) => updateInput('targetProfit', Number(e.target.value) || 0)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="5000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Desired profit amount
              </p>
            </div>
          </div>
        </div>

        {/* Unit Economics */}
        {calculations && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <TrendingDown className="w-5 h-5 mr-2 text-blue-600" />
              Unit Economics
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Contribution Margin</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  ${calculations.contributionMargin.toFixed(2)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Per unit contribution
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Contribution Margin %</div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {calculations.contributionMarginRatio.toFixed(1)}%
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Of selling price
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                <div className="text-sm text-gray-600 dark:text-gray-400">Break-Even Revenue</div>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                  ${calculations.breakEvenRevenue.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Revenue to break even
                </div>
              </div>

              {inputs.targetProfit && inputs.targetProfit > 0 && (
                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                  <div className="text-sm text-gray-600 dark:text-gray-400">Target Profit Revenue</div>
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    ${calculations.revenueForTargetProfit.toLocaleString()}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Revenue for target profit
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Scenario Analysis */}
        {calculations && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Quick Scenarios</h4>
            <div className="grid md:grid-cols-3 gap-4 text-sm">
              <div>
                <div className="font-medium text-gray-900 dark:text-white">10% Price Increase</div>
                <div className="text-gray-600 dark:text-gray-300">
                  Break-even: {Math.ceil(inputs.fixedCosts / ((inputs.pricePerUnit * 1.1) - inputs.variableCostPerUnit)).toLocaleString()} units
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">10% Cost Reduction</div>
                <div className="text-gray-600 dark:text-gray-300">
                  Break-even: {Math.ceil(inputs.fixedCosts / (inputs.pricePerUnit - (inputs.variableCostPerUnit * 0.9))).toLocaleString()} units
                </div>
              </div>
              <div>
                <div className="font-medium text-gray-900 dark:text-white">20% More Fixed Costs</div>
                <div className="text-gray-600 dark:text-gray-300">
                  Break-even: {Math.ceil((inputs.fixedCosts * 1.2) / calculations.contributionMargin).toLocaleString()} units
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Input Validation */}
        {calculations === null && inputs.pricePerUnit <= inputs.variableCostPerUnit && (
          <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-red-800 dark:text-red-200 text-sm">
              ⚠️ Price per unit must be higher than variable cost per unit to generate profit.
            </p>
          </div>
        )}
      </div>
    </CalculatorLayout>
  );
};

export default BreakEvenCalculator;