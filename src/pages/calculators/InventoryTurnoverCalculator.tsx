import React, { useState, useCallback, useMemo } from 'react';
import CalculatorLayout from '@/components/calculators/CalculatorLayout';
import { Package, RotateCw, DollarSign, Clock, TrendingUp, AlertTriangle } from 'lucide-react';

interface InventoryInputs {
  costOfGoodsSold: number;
  averageInventory: number;
  beginningInventory?: number;
  endingInventory?: number;
  calculationMethod: 'average' | 'manual';
}

const InventoryTurnoverCalculator: React.FC = () => {
  const [inputs, setInputs] = useState<InventoryInputs>({
    costOfGoodsSold: 120000,
    averageInventory: 20000,
    beginningInventory: 18000,
    endingInventory: 22000,
    calculationMethod: 'manual'
  });

  const updateInput = useCallback((field: keyof InventoryInputs, value: number | string) => {
    setInputs(prev => ({
      ...prev,
      [field]: field === 'calculationMethod' ? value : Number(value)
    }));
  }, []);

  const calculations = useMemo(() => {
    const { costOfGoodsSold, averageInventory, beginningInventory, endingInventory, calculationMethod } = inputs;

    if (costOfGoodsSold <= 0) {
      return null;
    }

    let finalAverageInventory = averageInventory;

    // Calculate average inventory from beginning and ending if method is manual
    if (calculationMethod === 'manual' && beginningInventory !== undefined && endingInventory !== undefined) {
      finalAverageInventory = (beginningInventory + endingInventory) / 2;
    }

    if (finalAverageInventory <= 0) {
      return null;
    }

    // Core calculations
    const inventoryTurnover = costOfGoodsSold / finalAverageInventory;
    const daysInInventory = 365 / inventoryTurnover;

    // Additional metrics
    const monthsInInventory = daysInInventory / 30;
    const weeksInInventory = daysInInventory / 7;

    // Cost analysis
    const dailyCarryingCost = finalAverageInventory * 0.0003; // Assuming 11% annual carrying cost (0.03% daily)
    const annualCarryingCost = finalAverageInventory * 0.11;
    const potentialSavings = (daysInInventory - (365 / (inventoryTurnover * 1.2))) * dailyCarryingCost;

    return {
      inventoryTurnover,
      daysInInventory,
      monthsInInventory,
      weeksInInventory,
      averageInventoryUsed: finalAverageInventory,
      dailyCarryingCost,
      annualCarryingCost,
      potentialSavings: Math.max(0, potentialSavings)
    };
  }, [inputs]);

  const getInsights = useCallback(() => {
    if (!calculations) return [];

    const insights = [];

    // Turnover rate insights
    if (calculations.inventoryTurnover > 12) {
      insights.push('Excellent inventory turnover - very efficient inventory management');
    } else if (calculations.inventoryTurnover > 8) {
      insights.push('Good inventory turnover - healthy inventory management');
    } else if (calculations.inventoryTurnover > 4) {
      insights.push('Moderate inventory turnover - room for improvement');
    } else if (calculations.inventoryTurnover > 2) {
      insights.push('Low inventory turnover - consider reducing inventory levels');
    } else {
      insights.push('Very low inventory turnover - significant improvement needed');
    }

    // Days in inventory insights
    if (calculations.daysInInventory < 30) {
      insights.push('Fast-moving inventory - less than 1 month on hand');
    } else if (calculations.daysInInventory < 60) {
      insights.push('Moderate inventory holding period - about 2 months on hand');
    } else if (calculations.daysInInventory < 90) {
      insights.push('Slow-moving inventory - 3+ months on hand, consider reducing');
    } else {
      insights.push('Very slow inventory turnover - high carrying costs and obsolescence risk');
    }

    // Cost insights
    if (calculations.potentialSavings > 1000) {
      insights.push(`Potential annual savings of $${calculations.potentialSavings.toLocaleString()} by improving turnover by 20%`);
    }

    // Cash flow insights
    const cashTiedUp = calculations.averageInventoryUsed;
    if (cashTiedUp > 50000) {
      insights.push(`$${cashTiedUp.toLocaleString()} in cash tied up in inventory - optimize to free up working capital`);
    }

    return insights;
  }, [calculations]);

  const getTurnoverHealthColor = (turnover: number) => {
    if (turnover > 8) return 'text-green-600 dark:text-green-400';
    if (turnover > 4) return 'text-yellow-600 dark:text-yellow-400';
    if (turnover > 2) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const exportToPDF = () => {
    console.log('Exporting inventory turnover analysis to PDF');
  };

  const exportToExcel = () => {
    console.log('Exporting inventory turnover analysis to Excel');
  };

  return (
    <CalculatorLayout
      title="Inventory Turnover Calculator"
      description="Calculate inventory turnover ratio and days in inventory to optimize stock levels, reduce carrying costs, and improve cash flow management."
      keywords="inventory turnover calculator, inventory turnover ratio, days in inventory, stock turnover, inventory management, carrying costs"
      canonical="/calculators/inventory-turnover"
      results={calculations ? {
        title: 'Inventory Turnover Analysis',
        value: `${calculations.inventoryTurnover.toFixed(1)}x`,
        subtitle: `Annual turnover | ${calculations.daysInInventory.toFixed(0)} days in inventory`,
        insights: getInsights()
      } : undefined}
      onExportPDF={exportToPDF}
      onExportExcel={exportToExcel}
    >
      <div className="space-y-8">
        {/* Calculation Method Selection */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <RotateCw className="w-5 h-5 mr-2 text-blue-600" />
            Calculation Method
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <button
              onClick={() => updateInput('calculationMethod', 'manual')}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                inputs.calculationMethod === 'manual'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-white">Beginning & Ending Inventory</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Calculate average from beginning and ending inventory values
              </div>
            </button>

            <button
              onClick={() => updateInput('calculationMethod', 'average')}
              className={`p-4 rounded-lg border-2 transition-colors text-left ${
                inputs.calculationMethod === 'average'
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
              }`}
            >
              <div className="font-medium text-gray-900 dark:text-white">Direct Average Inventory</div>
              <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                Enter the average inventory value directly
              </div>
            </button>
          </div>
        </div>

        {/* Cost of Goods Sold */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <DollarSign className="w-5 h-5 mr-2 text-blue-600" />
            Sales Data
          </h3>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Cost of Goods Sold (Annual) ($)
            </label>
            <input
              type="number"
              value={inputs.costOfGoodsSold}
              onChange={(e) => updateInput('costOfGoodsSold', e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              placeholder="120000"
              min="0"
              step="1000"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Total cost of inventory sold during the year
            </p>
          </div>
        </div>

        {/* Inventory Values */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
            <Package className="w-5 h-5 mr-2 text-blue-600" />
            Inventory Values
          </h3>

          {inputs.calculationMethod === 'manual' ? (
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Beginning Inventory ($)
                </label>
                <input
                  type="number"
                  value={inputs.beginningInventory || ''}
                  onChange={(e) => updateInput('beginningInventory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="18000"
                  min="0"
                  step="1000"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Inventory value at start of period
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Ending Inventory ($)
                </label>
                <input
                  type="number"
                  value={inputs.endingInventory || ''}
                  onChange={(e) => updateInput('endingInventory', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="22000"
                  min="0"
                  step="1000"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  Inventory value at end of period
                </p>
              </div>

              {inputs.beginningInventory !== undefined && inputs.endingInventory !== undefined && (
                <div className="md:col-span-2 bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
                  <div className="text-sm text-blue-800 dark:text-blue-200">
                    Calculated Average Inventory: ${((inputs.beginningInventory + inputs.endingInventory) / 2).toLocaleString()}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Average Inventory ($)
              </label>
              <input
                type="number"
                value={inputs.averageInventory}
                onChange={(e) => updateInput('averageInventory', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="20000"
                min="0"
                step="1000"
              />
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                Average inventory value held during the period
              </p>
            </div>
          )}
        </div>

        {/* Results */}
        {calculations && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
              <TrendingUp className="w-5 h-5 mr-2 text-blue-600" />
              Turnover Analysis
            </h3>

            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-blue-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Inventory Turnover</div>
                <div className={`text-3xl font-bold mb-2 ${getTurnoverHealthColor(calculations.inventoryTurnover)}`}>
                  {calculations.inventoryTurnover.toFixed(1)}x
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Times per year
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-green-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Days in Inventory</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {calculations.daysInInventory.toFixed(0)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Days to sell inventory
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-purple-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Months in Inventory</div>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  {calculations.monthsInInventory.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  Months of supply
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-700 p-6 rounded-lg border-l-4 border-orange-500">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Annual Carrying Cost</div>
                <div className="text-3xl font-bold text-red-600 dark:text-red-400 mb-2">
                  ${calculations.annualCarryingCost.toLocaleString()}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  11% of avg inventory
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Optimization Opportunities */}
        {calculations && calculations.potentialSavings > 0 && (
          <div className="bg-green-50 dark:bg-green-900/20 p-6 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center mb-4">
              <TrendingUp className="w-5 h-5 text-green-600 mr-2" />
              <h4 className="font-semibold text-green-800 dark:text-green-200">Optimization Opportunity</h4>
            </div>
            <div className="grid md:grid-cols-2 gap-6">
              <div>
                <div className="text-sm text-green-700 dark:text-green-300">Potential Annual Savings</div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                  ${calculations.potentialSavings.toLocaleString()}
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  By improving turnover by 20%
                </div>
              </div>
              <div>
                <div className="text-sm text-green-700 dark:text-green-300">Target Turnover Rate</div>
                <div className="text-2xl font-bold text-green-800 dark:text-green-200">
                  {(calculations.inventoryTurnover * 1.2).toFixed(1)}x
                </div>
                <div className="text-xs text-green-600 dark:text-green-400 mt-1">
                  Target for optimization
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Industry Benchmarks */}
        <div className="bg-gray-50 dark:bg-gray-800 p-6 rounded-lg">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Industry Benchmark Ranges</h4>
          <div className="grid md:grid-cols-3 gap-4 text-sm">
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Grocery/Food</div>
              <div className="text-gray-600 dark:text-gray-300">12-24x turnover | 15-30 days</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Fashion/Apparel</div>
              <div className="text-gray-600 dark:text-gray-300">4-8x turnover | 45-90 days</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Electronics</div>
              <div className="text-gray-600 dark:text-gray-300">6-12x turnover | 30-60 days</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Automotive</div>
              <div className="text-gray-600 dark:text-gray-300">8-15x turnover | 25-45 days</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Furniture</div>
              <div className="text-gray-600 dark:text-gray-300">3-6x turnover | 60-120 days</div>
            </div>
            <div>
              <div className="font-medium text-gray-900 dark:text-white">Pharmaceuticals</div>
              <div className="text-gray-600 dark:text-gray-300">10-20x turnover | 18-35 days</div>
            </div>
          </div>
        </div>

        {/* Improvement Strategies */}
        <div className="bg-blue-50 dark:bg-blue-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
          <h4 className="font-semibold text-gray-900 dark:text-white mb-4">Ways to Improve Inventory Turnover</h4>
          <div className="grid md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="font-medium text-gray-900 dark:text-white">Demand-Side Strategies:</div>
              <ul className="text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                <li>• Improve demand forecasting</li>
                <li>• Implement just-in-time ordering</li>
                <li>• Use ABC analysis for inventory prioritization</li>
                <li>• Reduce slow-moving stock</li>
              </ul>
            </div>
            <div className="space-y-2">
              <div className="font-medium text-gray-900 dark:text-white">Supply-Side Strategies:</div>
              <ul className="text-gray-700 dark:text-gray-300 space-y-1 ml-4">
                <li>• Negotiate better supplier terms</li>
                <li>• Implement vendor-managed inventory</li>
                <li>• Use drop-shipping when possible</li>
                <li>• Optimize reorder points and quantities</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Warning for very low turnover */}
        {calculations && calculations.inventoryTurnover < 2 && (
          <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex items-center mb-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
              <h4 className="font-semibold text-red-800 dark:text-red-200">Low Turnover Warning</h4>
            </div>
            <p className="text-red-700 dark:text-red-300 text-sm mb-3">
              Your inventory turnover is below 2x annually, which may indicate:
            </p>
            <ul className="text-red-700 dark:text-red-300 text-sm ml-4 list-disc space-y-1">
              <li>Excess inventory tying up working capital</li>
              <li>High risk of obsolescence and markdowns</li>
              <li>Increased storage and carrying costs</li>
              <li>Poor demand forecasting or buying decisions</li>
            </ul>
          </div>
        )}
      </div>
    </CalculatorLayout>
  );
};

export default InventoryTurnoverCalculator;