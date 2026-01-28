import React, { useState, useEffect } from 'react';
import { AlertTriangle, DollarSign, TrendingUp, TrendingDown, Shield, Clock, Users, Package } from 'lucide-react';

interface Alert {
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  timestamp: string;
  amount?: number;
  action_required?: boolean;
}

interface DashboardData {
  daily_metrics: {
    total_revenue: number;
    total_transactions: number;
    average_transaction: number;
    cash_percentage: number;
    risk_score: number;
  };
  today_alerts: {
    critical: Alert[];
    high: Alert[];
    medium: Alert[];
    total: number;
  };
  weekly_summary: {
    total_anomalies: number;
    risk_trend: number;
    recommendations: string[];
  };
  recommendations: string[];
}

interface SupermarketDashboardProps {
  locationId: string;
}

const SupermarketDashboard: React.FC<SupermarketDashboardProps> = ({ locationId }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchDashboardData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchDashboardData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [locationId]);

  const fetchDashboardData = async () => {
    try {
      const response = await fetch(`/api/v1/supermarket/dashboard/${locationId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data');
      }

      const data = await response.json();
      setDashboardData(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-50 border-red-200';
      case 'HIGH': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-blue-600 bg-blue-50 border-blue-200';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 80) return 'text-red-600';
    if (score >= 60) return 'text-orange-600';
    if (score >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <div className="flex items-center">
          <AlertTriangle className="h-5 w-5 text-red-600 mr-2" />
          <span className="text-red-800">Error: {error}</span>
        </div>
      </div>
    );
  }

  if (!dashboardData) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500">No dashboard data available</p>
      </div>
    );
  }

  const { daily_metrics, today_alerts, weekly_summary, recommendations } = dashboardData;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900">Supermarket Intelligence Dashboard</h1>
          <div className="flex items-center space-x-2">
            <Shield className="h-5 w-5 text-blue-600" />
            <span className="text-sm text-gray-500">Location: {locationId}</span>
          </div>
        </div>

        {/* Risk Score */}
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-600">Overall Risk Score</span>
            <span className={`text-2xl font-bold ${getRiskScoreColor(daily_metrics.risk_score)}`}>
              {daily_metrics.risk_score}/100
            </span>
          </div>
          <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                daily_metrics.risk_score >= 80 ? 'bg-red-600' :
                daily_metrics.risk_score >= 60 ? 'bg-orange-500' :
                daily_metrics.risk_score >= 40 ? 'bg-yellow-500' : 'bg-green-500'
              }`}
              style={{ width: `${daily_metrics.risk_score}%` }}
            ></div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Revenue</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${daily_metrics.total_revenue.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Transactions</p>
              <p className="text-2xl font-semibold text-gray-900">
                {daily_metrics.total_transactions}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-indigo-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
              <p className="text-2xl font-semibold text-gray-900">
                ${daily_metrics.average_transaction.toFixed(2)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center">
            <Package className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Cash %</p>
              <p className="text-2xl font-semibold text-gray-900">
                {daily_metrics.cash_percentage.toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Alerts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's Alerts */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-medium text-gray-900">Today's Alerts</h2>
              <span className="text-sm text-gray-500">{today_alerts.total} total</span>
            </div>
          </div>
          <div className="p-6">
            {today_alerts.total === 0 ? (
              <p className="text-gray-500 text-center py-4">No alerts today</p>
            ) : (
              <div className="space-y-3">
                {[...today_alerts.critical, ...today_alerts.high, ...today_alerts.medium]
                  .slice(0, 5)
                  .map((alert, index) => (
                  <div
                    key={index}
                    className={`p-3 rounded-lg border ${getSeverityColor(alert.severity)}`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center">
                          <AlertTriangle className="h-4 w-4 mr-2" />
                          <span className="font-medium text-sm">{alert.severity}</span>
                        </div>
                        <p className="text-sm mt-1">{alert.description}</p>
                        {alert.amount && (
                          <p className="text-sm font-medium mt-1">
                            Amount: ${alert.amount.toFixed(2)}
                          </p>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 ml-4">
                        <Clock className="h-3 w-3 inline mr-1" />
                        {new Date(alert.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Recommendations */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">Recommended Actions</h2>
          </div>
          <div className="p-6">
            {recommendations.length === 0 ? (
              <p className="text-gray-500 text-center py-4">No recommendations</p>
            ) : (
              <ul className="space-y-3">
                {recommendations.map((recommendation, index) => (
                  <li key={index} className="flex items-start">
                    <div className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full mt-2 mr-3"></div>
                    <span className="text-sm text-gray-700">{recommendation}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>

      {/* Weekly Summary */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Weekly Summary</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {weekly_summary.total_anomalies}
              </p>
              <p className="text-sm text-gray-600">Total Anomalies</p>
            </div>
            <div className="text-center">
              <p className={`text-2xl font-semibold ${getRiskScoreColor(weekly_summary.risk_trend)}`}>
                {weekly_summary.risk_trend}/100
              </p>
              <p className="text-sm text-gray-600">Risk Trend</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-semibold text-gray-900">
                {weekly_summary.recommendations.length}
              </p>
              <p className="text-sm text-gray-600">Active Recommendations</p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => window.location.href = `/supermarket/scan/${locationId}`}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
          >
            Run Theft Scan
          </button>
          <button
            onClick={() => window.location.href = `/supermarket/analytics/${locationId}`}
            className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors"
          >
            View Analytics
          </button>
          <button
            onClick={() => window.location.href = `/supermarket/alerts/${locationId}`}
            className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Real-time Alerts
          </button>
          <button
            onClick={() => window.location.href = `/supermarket/settings/${locationId}`}
            className="bg-gray-600 text-white px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            Settings
          </button>
        </div>
      </div>
    </div>
  );
};

export default SupermarketDashboard;