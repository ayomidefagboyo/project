import React, { useState, useEffect } from 'react';
import { 
  AlertTriangle, 
  Shield, 
  TrendingUp, 
  CheckCircle, 
  Clock, 
  Filter,
  Eye,
  MessageSquare,
  BarChart3,
  AlertCircle,
  DollarSign,
  FileText,
  Calendar
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { anomalyService } from '@/lib/anomalyService';
import { Anomaly, AnomalyType } from '@/types';
import Button from '@/components/ui/Button';

interface AnomalyStats {
  totalAnomalies: number;
  unresolvedAnomalies: number;
  riskScore: number;
  anomaliesByType: Record<AnomalyType, number>;
  anomaliesBySeverity: Record<string, number>;
  resolutionRate: number;
}

const AnomalyDashboard: React.FC = () => {
  const { currentOutlet, currentUser, hasPermission } = useOutlet();
  const [anomalies, setAnomalies] = useState<Anomaly[]>([]);
  const [stats, setStats] = useState<AnomalyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [filters, setFilters] = useState({
    type: 'all' as AnomalyType | 'all',
    severity: 'all',
    resolved: 'unresolved'
  });
  
  const [selectedAnomaly, setSelectedAnomaly] = useState<Anomaly | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (currentOutlet) {
      loadAnomalies();
      loadStats();
    }
  }, [currentOutlet, filters]);

  const loadAnomalies = async () => {
    if (!currentOutlet) return;

    try {
      setLoading(true);
      setError(null);

      const filterParams = {
        ...(filters.type !== 'all' && { type: filters.type }),
        ...(filters.severity !== 'all' && { severity: filters.severity }),
        ...(filters.resolved !== 'all' && { resolved: filters.resolved === 'resolved' })
      };

      const { data, error } = await anomalyService.getAnomalies(currentOutlet.id, filterParams);
      
      if (error) throw new Error(error);
      setAnomalies(data || []);
    } catch (err) {
      console.error('Error loading anomalies:', err);
      setError(err instanceof Error ? err.message : 'Failed to load anomalies');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!currentOutlet) return;

    try {
      const { data, error } = await anomalyService.getAnomalyStats(currentOutlet.id);
      if (error) throw new Error(error);
      setStats(data);
    } catch (err) {
      console.error('Error loading anomaly stats:', err);
    }
  };

  const handleResolveAnomaly = async (anomaly: Anomaly) => {
    if (!currentUser || !hasPermission('manage_outlets')) return;

    try {
      setResolving(true);
      
      const { error } = await anomalyService.resolveAnomaly(
        anomaly.id, 
        currentUser.id, 
        resolutionNotes
      );
      
      if (error) throw new Error(error);
      
      setSelectedAnomaly(null);
      setResolutionNotes('');
      await loadAnomalies();
      await loadStats();
    } catch (err) {
      console.error('Error resolving anomaly:', err);
      setError(err instanceof Error ? err.message : 'Failed to resolve anomaly');
    } finally {
      setResolving(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'text-red-700 bg-red-100 border-red-300';
      case 'high': return 'text-red-600 bg-red-50 border-red-200';
      case 'medium': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'low': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getTypeIcon = (type: AnomalyType) => {
    switch (type) {
      case 'duplicate_payment': return DollarSign;
      case 'price_spike': return TrendingUp;
      case 'missing_info': return FileText;
      case 'unauthorized_account': return Shield;
      case 'supply_gap': return AlertTriangle;
      case 'eod_mismatch': return Calendar;
      default: return AlertCircle;
    }
  };

  const getTypeColor = (type: AnomalyType) => {
    switch (type) {
      case 'duplicate_payment': return 'text-purple-600';
      case 'price_spike': return 'text-red-600';
      case 'missing_info': return 'text-yellow-600';
      case 'unauthorized_account': return 'text-red-700';
      case 'supply_gap': return 'text-orange-600';
      case 'eod_mismatch': return 'text-blue-600';
      default: return 'text-gray-600';
    }
  };

  const getRiskScoreColor = (score: number) => {
    if (score >= 70) return 'text-red-600 bg-red-100';
    if (score >= 40) return 'text-orange-600 bg-orange-100';
    if (score >= 20) return 'text-yellow-600 bg-yellow-100';
    return 'text-green-600 bg-green-100';
  };

  if (!hasPermission('view_analytics')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view anomaly detection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Anomaly Detection</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            AI-powered detection and analysis of unusual business activities
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <AlertTriangle className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Anomalies</p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalAnomalies}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Unresolved</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.unresolvedAnomalies}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Shield className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Risk Score</p>
                  <div className="flex items-center">
                    <p className={`text-2xl font-bold px-2 py-1 rounded ${getRiskScoreColor(stats.riskScore)}`}>
                      {stats.riskScore}
                    </p>
                    <span className="text-sm text-gray-500 ml-2">/100</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Resolution Rate</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.resolutionRate.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Type
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value as any }))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="duplicate_payment">Duplicate Payments</option>
                  <option value="price_spike">Price Spikes</option>
                  <option value="missing_info">Missing Information</option>
                  <option value="unauthorized_account">Unauthorized Accounts</option>
                  <option value="supply_gap">Supply Gaps</option>
                  <option value="eod_mismatch">EOD Mismatches</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Severity
                </label>
                <select
                  value={filters.severity}
                  onChange={(e) => setFilters(prev => ({ ...prev, severity: e.target.value }))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="all">All Severities</option>
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Status
                </label>
                <select
                  value={filters.resolved}
                  onChange={(e) => setFilters(prev => ({ ...prev, resolved: e.target.value }))}
                  className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="unresolved">Unresolved</option>
                  <option value="resolved">Resolved</option>
                  <option value="all">All Status</option>
                </select>
              </div>
            </div>

            <Button
              onClick={loadAnomalies}
              variant="outline"
            >
              <Filter className="h-4 w-4 mr-2" />
              Apply Filters
            </Button>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Anomalies List */}
        <div className="space-y-4">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-gray-600 dark:text-gray-400">Loading anomalies...</p>
            </div>
          ) : anomalies.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
              <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                All Clear!
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                No anomalies match your current filters.
              </p>
            </div>
          ) : (
            anomalies.map((anomaly) => {
              const TypeIcon = getTypeIcon(anomaly.type);
              return (
                <div
                  key={anomaly.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start space-x-4">
                      <div className={`p-2 rounded-lg bg-gray-100 dark:bg-gray-700`}>
                        <TypeIcon className={`h-6 w-6 ${getTypeColor(anomaly.type)}`} />
                      </div>
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(anomaly.severity)}`}>
                            {anomaly.severity.toUpperCase()}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {anomaly.type.replace('_', ' ').toUpperCase()}
                          </span>
                          {anomaly.aiConfidence && (
                            <span className="text-sm text-blue-600 dark:text-blue-400">
                              {anomaly.aiConfidence}% confidence
                            </span>
                          )}
                        </div>
                        
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {anomaly.description}
                        </h3>
                        
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p>
                            <strong>Entity:</strong> {anomaly.relatedEntity} (ID: {anomaly.relatedId})
                          </p>
                          <p>
                            <strong>Detected:</strong> {new Date(anomaly.detectedAt).toLocaleString()}
                          </p>
                          {anomaly.resolved && anomaly.resolvedAt && (
                            <p className="text-green-600 dark:text-green-400">
                              <strong>Resolved:</strong> {new Date(anomaly.resolvedAt).toLocaleString()}
                              {anomaly.resolutionNotes && (
                                <span className="block mt-1 italic">"{anomaly.resolutionNotes}"</span>
                              )}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setSelectedAnomaly(anomaly)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                      
                      {!anomaly.resolved && hasPermission('manage_outlets') && (
                        <Button
                          size="sm"
                          onClick={() => setSelectedAnomaly(anomaly)}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Resolve
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Anomaly Detail/Resolution Modal */}
        {selectedAnomaly && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Anomaly Details
                  </h3>
                  <button
                    onClick={() => setSelectedAnomaly(null)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Type
                    </label>
                    <p className="text-gray-900 dark:text-white capitalize">
                      {selectedAnomaly.type.replace('_', ' ')}
                    </p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Description
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedAnomaly.description}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Severity
                      </label>
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getSeverityColor(selectedAnomaly.severity)}`}>
                        {selectedAnomaly.severity.toUpperCase()}
                      </span>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        AI Confidence
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedAnomaly.aiConfidence}%
                      </p>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Related Entity
                    </label>
                    <p className="text-gray-900 dark:text-white">
                      {selectedAnomaly.relatedEntity} (ID: {selectedAnomaly.relatedId})
                    </p>
                  </div>
                </div>

                {!selectedAnomaly.resolved && hasPermission('manage_outlets') && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      Resolve Anomaly
                    </h4>
                    
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Resolution Notes
                        </label>
                        <textarea
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                          rows={4}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder="Explain how this anomaly was investigated and resolved..."
                        />
                      </div>

                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleResolveAnomaly(selectedAnomaly)}
                          disabled={resolving || !resolutionNotes.trim()}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          {resolving ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent mr-2"></div>
                              Resolving...
                            </>
                          ) : (
                            <>
                              <CheckCircle className="h-4 w-4 mr-2" />
                              Mark as Resolved
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => setSelectedAnomaly(null)}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AnomalyDashboard;