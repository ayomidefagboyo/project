import React, { useState, useEffect } from 'react';
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  FileText, 
  DollarSign, 
  Calendar, 
  User, 
  MessageSquare,
  AlertTriangle,
  TrendingUp,
  Filter,
  Eye
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { approvalService } from '@/lib/approvalService';
import { ApprovalWorkflow } from '@/types';
import Button from '@/components/ui/Button';

interface PendingApproval extends ApprovalWorkflow {
  entityData: any;
}

interface ApprovalStats {
  totalApprovals: number;
  pendingApprovals: number;
  approvedCount: number;
  rejectedCount: number;
  averageApprovalTime: number;
  approvalsByType: Record<string, number>;
  approverPerformance: Array<{
    approverName: string;
    approverId: string;
    totalApprovals: number;
    averageTime: number;
  }>;
}

const ApprovalDashboard: React.FC = () => {
  const { currentOutlet, currentUser, hasPermission } = useOutlet();
  const [activeTab, setActiveTab] = useState<'pending' | 'history' | 'analytics'>('pending');
  const [pendingApprovals, setPendingApprovals] = useState<PendingApproval[]>([]);
  const [approvalHistory, setApprovalHistory] = useState<any[]>([]);
  const [stats, setStats] = useState<ApprovalStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [selectedApproval, setSelectedApproval] = useState<PendingApproval | null>(null);
  const [decision, setDecision] = useState<'approved' | 'rejected' | ''>('');
  const [comments, setComments] = useState('');
  const [processing, setProcessing] = useState(false);

  const [filters, setFilters] = useState({
    entityType: 'all',
    status: 'all'
  });

  useEffect(() => {
    if (currentOutlet && currentUser) {
      loadPendingApprovals();
      loadApprovalHistory();
      loadStats();
    }
  }, [currentOutlet, currentUser]);

  const loadPendingApprovals = async () => {
    if (!currentOutlet || !currentUser) return;

    try {
      setError(null);
      const { data, error } = await approvalService.getPendingApprovals(currentOutlet.id, currentUser.id);
      
      if (error) throw new Error(error);
      setPendingApprovals(data || []);
    } catch (err) {
      console.error('Error loading pending approvals:', err);
      setError(err instanceof Error ? err.message : 'Failed to load pending approvals');
    }
  };

  const loadApprovalHistory = async () => {
    if (!currentOutlet) return;

    try {
      const { data, error } = await approvalService.getApprovalHistory(currentOutlet.id);
      
      if (error) throw new Error(error);
      setApprovalHistory(data || []);
    } catch (err) {
      console.error('Error loading approval history:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    if (!currentOutlet) return;

    try {
      const { data, error } = await approvalService.getApprovalStats(currentOutlet.id);
      
      if (error) throw new Error(error);
      setStats(data);
    } catch (err) {
      console.error('Error loading approval stats:', err);
    }
  };

  const handleApprovalDecision = async (approval: PendingApproval, approvalDecision: 'approved' | 'rejected') => {
    if (!currentUser) return;

    try {
      setProcessing(true);
      
      const { error } = await approvalService.processApproval(
        approval.id,
        approvalDecision,
        currentUser.id,
        comments
      );
      
      if (error) throw new Error(error);
      
      setSelectedApproval(null);
      setDecision('');
      setComments('');
      
      // Reload data
      await loadPendingApprovals();
      await loadApprovalHistory();
      await loadStats();
      
    } catch (err) {
      console.error('Error processing approval:', err);
      setError(err instanceof Error ? err.message : 'Failed to process approval');
    } finally {
      setProcessing(false);
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case 'invoice': return FileText;
      case 'expense': return DollarSign;
      case 'payment': return DollarSign;
      default: return FileText;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return 'text-green-600 bg-green-50 border-green-200';
      case 'rejected': return 'text-red-600 bg-red-50 border-red-200';
      case 'pending': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getPriorityColor = (amount: number) => {
    if (amount > 10000) return 'text-red-600';
    if (amount > 5000) return 'text-orange-600';
    if (amount > 1000) return 'text-yellow-600';
    return 'text-green-600';
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { 
      style: 'currency', 
      currency: 'USD' 
    }).format(amount);
  };

  const formatTimeAgo = (date: string) => {
    const now = new Date().getTime();
    const past = new Date(date).getTime();
    const diffHours = Math.floor((now - past) / (1000 * 60 * 60));
    
    if (diffHours < 1) return 'Less than 1 hour ago';
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  };

  if (!hasPermission('view_reports')) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <AlertTriangle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
            Access Denied
          </h3>
          <p className="text-gray-600 dark:text-gray-400">
            You don't have permission to view approvals.
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
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Approval Management</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">
            Review and approve invoices, expenses, and payments
          </p>
        </div>

        {/* Stats Cards */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <Clock className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {stats.pendingApprovals}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <CheckCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Approved</p>
                  <p className="text-2xl font-bold text-green-600">
                    {stats.approvedCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <XCircle className="h-8 w-8 text-red-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Rejected</p>
                  <p className="text-2xl font-bold text-red-600">
                    {stats.rejectedCount}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center">
                <TrendingUp className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Avg Time</p>
                  <p className="text-2xl font-bold text-blue-600">
                    {stats.averageApprovalTime.toFixed(1)}h
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tabs */}
        <div className="mb-8">
          <div className="border-b border-gray-200 dark:border-gray-700">
            <nav className="-mb-px flex space-x-8">
              {[
                { id: 'pending', label: 'Pending Approvals', icon: Clock, count: pendingApprovals.length },
                { id: 'history', label: 'Approval History', icon: Calendar, count: approvalHistory.length },
                { id: 'analytics', label: 'Analytics', icon: TrendingUp }
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                    activeTab === tab.id
                      ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
                  }`}
                >
                  <tab.icon className="h-4 w-4 mr-2" />
                  {tab.label}
                  {tab.count !== undefined && (
                    <span className={`ml-2 px-2 py-1 text-xs rounded-full ${
                      activeTab === tab.id ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                    }`}>
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-600 dark:text-red-400">{error}</p>
          </div>
        )}

        {/* Pending Approvals Tab */}
        {activeTab === 'pending' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Loading approvals...</p>
              </div>
            ) : pendingApprovals.length === 0 ? (
              <div className="bg-white dark:bg-gray-800 p-12 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 text-center">
                <CheckCircle className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  All Caught Up!
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  No pending approvals at this time.
                </p>
              </div>
            ) : (
              pendingApprovals.map((approval) => {
                const EntityIcon = getEntityIcon(approval.entityType);
                const amount = approval.entityData?.total || approval.entityData?.amount || 0;
                
                return (
                  <div
                    key={approval.id}
                    className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4">
                        <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
                          <EntityIcon className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              {approval.entityType.charAt(0).toUpperCase() + approval.entityType.slice(1)} Approval
                            </h3>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Step {approval.workflowStep}
                            </span>
                          </div>
                          
                          <div className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center space-x-4">
                              <span className={`font-semibold ${getPriorityColor(amount)}`}>
                                {formatCurrency(amount)}
                              </span>
                              {approval.entityData?.invoice_number && (
                                <span>#{approval.entityData.invoice_number}</span>
                              )}
                              {approval.entityData?.description && (
                                <span className="truncate max-w-xs">
                                  {approval.entityData.description}
                                </span>
                              )}
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <span>
                                <Calendar className="h-4 w-4 inline mr-1" />
                                Requested: {formatTimeAgo(approval.createdAt)}
                              </span>
                              {approval.comments && (
                                <span className="text-blue-600 dark:text-blue-400">
                                  <MessageSquare className="h-4 w-4 inline mr-1" />
                                  Has notes
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="flex space-x-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setSelectedApproval(approval)}
                        >
                          <Eye className="h-4 w-4 mr-1" />
                          Review
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(approval);
                            setDecision('approved');
                          }}
                          className="bg-green-600 hover:bg-green-700 text-white"
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedApproval(approval);
                            setDecision('rejected');
                          }}
                          className="bg-red-600 hover:bg-red-700 text-white"
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Approval History Tab */}
        {activeTab === 'history' && (
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Approval History
                </h3>
                
                <div className="flex space-x-4">
                  <select
                    value={filters.entityType}
                    onChange={(e) => setFilters(prev => ({ ...prev, entityType: e.target.value }))}
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All Types</option>
                    <option value="invoice">Invoices</option>
                    <option value="expense">Expenses</option>
                    <option value="payment">Payments</option>
                  </select>
                  
                  <select
                    value={filters.status}
                    onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    <option value="all">All Status</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="pending">Pending</option>
                  </select>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Entity
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Approver
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Comments
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {approvalHistory
                    .filter(approval => 
                      (filters.entityType === 'all' || approval.entity_type === filters.entityType) &&
                      (filters.status === 'all' || approval.status === filters.status)
                    )
                    .map((approval) => {
                      const amount = approval.entityData?.total || approval.entityData?.amount || 0;
                      return (
                        <tr key={approval.id} className="hover:bg-gray-50 dark:hover:bg-gray-750">
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900 dark:text-white capitalize">
                                {approval.entity_type}
                              </span>
                              {approval.entityData?.invoice_number && (
                                <span className="ml-2 text-sm text-gray-500">
                                  #{approval.entityData.invoice_number}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {formatCurrency(amount)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(approval.status)}`}>
                              {approval.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {approval.approverName}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                            {approval.approved_at ? 
                              new Date(approval.approved_at).toLocaleDateString() : 
                              'Pending'
                            }
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                            {approval.comments || '-'}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Analytics Tab */}
        {activeTab === 'analytics' && stats && (
          <div className="space-y-6">
            {/* Approvals by Type */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Approvals by Type (30 days)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {Object.entries(stats.approvalsByType).map(([type, count]) => (
                  <div key={type} className="text-center">
                    <p className="text-3xl font-bold text-gray-900 dark:text-white">{count}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">
                      {type.replace('_', ' ')}s
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Approver Performance */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-6">
                Approver Performance
              </h3>
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="border-b border-gray-200 dark:border-gray-700">
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                        Approver
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                        Total Approvals
                      </th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 dark:text-gray-300">
                        Avg Response Time
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {stats.approverPerformance.map((approver) => (
                      <tr key={approver.approverId}>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {approver.approverName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {approver.totalApprovals}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {approver.averageTime.toFixed(1)} hours
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Approval Decision Modal */}
        {selectedApproval && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {decision === 'approved' ? 'Approve' : decision === 'rejected' ? 'Reject' : 'Review'} {selectedApproval.entityType}
                  </h3>
                  <button
                    onClick={() => {
                      setSelectedApproval(null);
                      setDecision('');
                      setComments('');
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    ×
                  </button>
                </div>

                {/* Approval Details */}
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Type
                      </label>
                      <p className="text-gray-900 dark:text-white capitalize">
                        {selectedApproval.entityType}
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Amount
                      </label>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {formatCurrency(selectedApproval.entityData?.total || selectedApproval.entityData?.amount || 0)}
                      </p>
                    </div>
                  </div>

                  {selectedApproval.entityData?.description && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Description
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedApproval.entityData.description}
                      </p>
                    </div>
                  )}

                  {selectedApproval.comments && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Approval Notes
                      </label>
                      <p className="text-gray-900 dark:text-white">
                        {selectedApproval.comments}
                      </p>
                    </div>
                  )}
                </div>

                {decision && (
                  <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {decision === 'approved' ? 'Approval' : 'Rejection'} Comments
                        </label>
                        <textarea
                          value={comments}
                          onChange={(e) => setComments(e.target.value)}
                          rows={4}
                          className="w-full border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                          placeholder={`Optional comments for this ${decision}...`}
                        />
                      </div>

                      <div className="flex space-x-3">
                        <Button
                          onClick={() => handleApprovalDecision(selectedApproval, decision)}
                          disabled={processing}
                          className={decision === 'approved' ? 
                            'bg-green-600 hover:bg-green-700 text-white' : 
                            'bg-red-600 hover:bg-red-700 text-white'
                          }
                        >
                          {processing ? (
                            <>
                              <div className="animate-spin rounded-full h-4 w-4 border border-white border-t-transparent mr-2"></div>
                              Processing...
                            </>
                          ) : (
                            <>
                              {decision === 'approved' ? <CheckCircle className="h-4 w-4 mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                              Confirm {decision === 'approved' ? 'Approval' : 'Rejection'}
                            </>
                          )}
                        </Button>
                        
                        <Button
                          variant="outline"
                          onClick={() => {
                            setSelectedApproval(null);
                            setDecision('');
                            setComments('');
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                )}

                {!decision && (
                  <div className="flex space-x-3">
                    <Button
                      onClick={() => setDecision('approved')}
                      className="bg-green-600 hover:bg-green-700 text-white"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    
                    <Button
                      onClick={() => setDecision('rejected')}
                      className="bg-red-600 hover:bg-red-700 text-white"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => setSelectedApproval(null)}
                    >
                      Close
                    </Button>
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

export default ApprovalDashboard;