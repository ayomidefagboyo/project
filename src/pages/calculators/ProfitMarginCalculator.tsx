import React, { useState, useCallback, useMemo } from 'react';
import CalculatorLayout from '@/components/calculators/CalculatorLayout';
import { BarChart3, DollarSign, Percent, TrendingUp } from 'lucide-react';

interface ProfitMarginInputs {
  revenue: number;
  costOfGoodsSold: number;
  operatingExpenses: number;
  taxes: number;
  interest: number;
}

const ProfitMarginCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<ProfitMarginInputs>({
    revenue: 100000,
    costOfGoodsSold: 60000,
    operatingExpenses: 25000,
    taxes: 3000,
    interest: 2000
  });

  const updateInput = useCallback((field: keyof ProfitMarginInputs, value: number) => {
    setInputs(prev => ({
      ...prev,
      [field]: value
    }));
  }, []);

  const calculations = useMemo(() => {
    const { revenue, costOfGoodsSold, operatingExpenses, taxes, interest } = inputs;

    if (revenue <= 0) {
      return null;
    }

    // Gross Profit calculations
    const grossProfit = revenue - costOfGoodsSold;
    const grossMargin = (grossProfit / revenue) * 100;

    // Operating Profit calculations
    const operatingProfit = grossProfit - operatingExpenses;
    const operatingMargin = (operatingProfit / revenue) * 100;

    // Net Profit calculations
    const netProfit = operatingProfit - taxes - interest;
    const netMargin = (netProfit / revenue) * 100;

    // EBITDA approximation (without depreciation/amortization data)
    const ebitda = operatingProfit + interest;
    const ebitdaMargin = (ebitda / revenue) * 100;

    // Additional metrics
    const totalCosts = costOfGoodsSold + operatingExpenses + taxes + interest;
    const costRatio = (totalCosts / revenue) * 100;

    return {
      grossProfit,
      grossMargin,
      operatingProfit,
      operatingMargin,
      netProfit,
      netMargin,
      ebitda,
      ebitdaMargin,
      totalCosts,
      costRatio
    };
  }, [inputs]);

  const getInsights = useCallback(() => {
    if (!calculations) return [];

    const insights = [];

    // Gross margin insights
    if (calculations.grossMargin > 50) {
      insights.push('Excellent gross margin - strong pricing power and efficient production');
    } else if (calculations.grossMargin > 30) {
      insights.push('Good gross margin - healthy unit economics');
    } else if (calculations.grossMargin > 15) {
      insights.push('Moderate gross margin - consider cost optimization or pricing adjustments');
    } else if (calculations.grossMargin > 0) {
      insights.push('Low gross margin - review cost structure and pricing urgently');
    } else {
      insights.push('Negative gross margin - costs exceed revenue, immediate action required');
    }

    // Operating margin insights
    if (calculations.operatingMargin > 15) {
      insights.push('Strong operational efficiency with healthy operating margins');
    } else if (calculations.operatingMargin > 5) {
      insights.push('Decent operational performance - room for expense optimization');
    } else if (calculations.operatingMargin > 0) {
      insights.push('Tight operating margins - focus on reducing operational expenses');
    } else {
      insights.push('Negative operating margin - operational expenses exceed gross profit');
    }

    // Net margin insights
    if (calculations.netMargin > 10) {
      insights.push('Excellent bottom-line profitability');
    } else if (calculations.netMargin > 5) {
      insights.push('Good net profitability - sustainable business model');
    } else if (calculations.netMargin > 0) {
      insights.push('Positive but slim net margins - monitor cash flow closely');
    } else {
      insights.push('Negative net margin - business is losing money overall');
    }

    return insights;
  }, [calculations]);

  const getMarginHealthColor = (margin: number) => {
    if (margin > 15) return 'text-green-600 dark:text-green-400';
    if (margin > 5) return 'text-yellow-600 dark:text-yellow-400';
    if (margin > 0) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const exportToPDF = () => {
    console.log('Exporting profit margin analysis to PDF');
  };

  const exportToExcel = () => {
    console.log('Exporting profit margin analysis to Excel');
  };

  return (
    <CalculatorLayout
      title="Profit Margin Calculator"
      description="Calculate gross, operating, and net profit margins to understand your business profitability. Optimize pricing strategies and identify cost-cutting opportunities."
      results={calculations ? {
        title: 'Profit Margin Analysis',
        value: `${calculations.netMargin.toFixed(1)}%`,
        subtitle: `Net Profit Margin | $${calculations.netProfit.toLocaleString()} net profit`,
        insights: getInsights()
      } : undefined}
      onExportPDF={exportToPDF}
      onExportExcel={exportToExcel}
    >
      <div className="space-y-8">
        {/* Revenue */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Revenue & Sales
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Total Revenue ($)
            </label>
            <input
              type="number"
              value={inputs.revenue}
              onChange={(e) => updateInput('revenue', Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="100000"
              min="0"
              step="1000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total sales revenue for the period
            </p>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <TrendingUp className="w-5 h-5 mr-2 text-red-600" />
            Direct Costs
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cost of Goods Sold (COGS) ($)
            </label>
            <input
              type="number"
              value={inputs.costOfGoodsSold}
              onChange={(e) => updateInput('costOfGoodsSold', Number(e.target.value))}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="60000"
              min="0"
              step="1000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Direct costs: materials, labor, manufacturing, shipping
            </p>
          </div>
        </div>

        {/* Operating Expenses */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <BarChart3 className="w-5 h-5 mr-2 text-purple-600" />
            Operating Expenses
          </h3>

          <div className="grid md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Operating Expenses ($)
              </label>
              <input
                type="number"
                value={inputs.operatingExpenses}
                onChange={(e) => updateInput('operatingExpenses', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="25000"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Rent, salaries, marketing, utilities
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Taxes ($)
              </label>
              <input
                type="number"
                value={inputs.taxes}
                onChange={(e) => updateInput('taxes', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="3000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Income taxes and other taxes
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Interest Expenses ($)
              </label>
              <input
                type="number"
                value={inputs.interest}
                onChange={(e) => updateInput('interest', Number(e.target.value))}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="2000"
                min="0"
                step="100"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Loan interest and financing costs
              </p>
            </div>
          </div>
        </div>

        {/* Margin Calculations */}
        {calculations && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <Percent className="w-5 h-5 mr-2 text-blue-600" />
              Profitability Analysis
            </h3>

            <div className="grid md:grid-cols-2 gap-6">
              {/* Gross Margin */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-blue-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Gross Profit Margin</div>
                <div className={`text-3xl font-bold mb-2 ${getMarginHealthColor(calculations.grossMargin)}`}>
                  {calculations.grossMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Gross Profit: ${calculations.grossProfit.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Revenue minus direct costs
                </div>
              </div>

              {/* Operating Margin */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-purple-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Operating Profit Margin</div>
                <div className={`text-3xl font-bold mb-2 ${getMarginHealthColor(calculations.operatingMargin)}`}>
                  {calculations.operatingMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Operating Profit: ${calculations.operatingProfit.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Gross profit minus operating expenses
                </div>
              </div>

              {/* Net Margin */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-green-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Net Profit Margin</div>
                <div className={`text-3xl font-bold mb-2 ${getMarginHealthColor(calculations.netMargin)}`}>
                  {calculations.netMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  Net Profit: ${calculations.netProfit.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Final profit after all expenses
                </div>
              </div>

              {/* EBITDA Margin */}
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-orange-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">EBITDA Margin</div>
                <div className={`text-3xl font-bold mb-2 ${getMarginHealthColor(calculations.ebitdaMargin)}`}>
                  {calculations.ebitdaMargin.toFixed(1)}%
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-300">
                  EBITDA: ${calculations.ebitda.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Operating profit plus interest (approx.)
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Profit Waterfall Breakdown */}
        {calculations && (
          <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Profit Waterfall</h4>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">Revenue</span>
                <span className="font-medium text-green-600 dark:text-green-400">+${inputs.revenue.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">- Cost of Goods Sold</span>
                <span className="font-medium text-red-600 dark:text-red-400">-${inputs.costOfGoodsSold.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-300 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white font-medium">= Gross Profit</span>
                <span className="font-bold text-gray-900 dark:text-white">${calculations.grossProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">- Operating Expenses</span>
                <span className="font-medium text-red-600 dark:text-red-400">-${inputs.operatingExpenses.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t border-gray-300 dark:border-gray-600">
                <span className="text-gray-900 dark:text-white font-medium">= Operating Profit</span>
                <span className="font-bold text-gray-900 dark:text-white">${calculations.operatingProfit.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-700 dark:text-gray-300">- Taxes & Interest</span>
                <span className="font-medium text-red-600 dark:text-red-400">-${(inputs.taxes + inputs.interest).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center py-2 border-t-2 border-gray-900 dark:border-white">
                <span className="text-gray-900 dark:text-white font-bold">= Net Profit</span>
                <span className={`font-bold text-xl ${calculations.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                  ${calculations.netProfit.toLocaleString()}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Industry Benchmarks */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Industry Benchmark Ranges</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Retail</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 20-50% | Net: 2-5%</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Software/SaaS</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 70-90% | Net: 15-25%</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Restaurants</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 60-70% | Net: 3-8%</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Manufacturing</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 25-35% | Net: 5-10%</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Services</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 50-80% | Net: 10-20%</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Healthcare</div>
              <div className="text-gray-600 dark:text-gray-300">Gross: 40-60% | Net: 8-15%</div>
            </div>
          </div>
        </div>
      </div>
    </CalculatorLayout>
  );
};

export default ProfitMarginCalculator;