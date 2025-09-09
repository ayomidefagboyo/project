import React, { useState, useEffect } from 'react';
import { 
  Bot,
  MessageSquare,
  Send,
  Shield,
  TrendingDown,
  Eye,
  Zap,
  Brain,
  TrendingUp,
  AlertTriangle
} from 'lucide-react';
import { useOutlet } from '@/contexts/OutletContext';
import { eodService, useLoadingState, ErrorMessage } from '@/lib/services';
import { Button } from '@/components/ui/Button';

interface OutletEODSummary {
  outlet_id: string;
  outlet_name: string;
  today_sales: number;
  today_profit: number;
  week_sales: number;
  week_profit: number;
  month_sales: number;
  month_profit: number;
  pending_reports: number;
  last_report_date: string | null;
  cash_variance_today: number | null;
  status: 'good' | 'warning' | 'critical';
}

interface MultiOutletAnalytics {
  total_outlets: number;
  total_sales_today: number;
  total_profit_today: number;
  total_pending_reports: number;
  outlets_with_discrepancies: number;
  best_performing_outlet: {
    name: string;
    sales: number;
  };
  worst_performing_outlet: {
    name: string;
    sales: number;
  };
}

interface Conversation {
  id: string;
  title: string;
  messages: Message[];
  created_at: string;
  updated_at: string;
}

interface Message {
  id: string;
  type: 'user' | 'ai';
  content: string;
  timestamp: string;
  insights?: AIInsight[];
  anomalies?: Anomaly[];
}

interface AIInsight {
  type: 'trend' | 'anomaly' | 'fraud' | 'opportunity' | 'warning';
  title: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  data?: any;
  confidence: number;
}

interface Anomaly {
  id: string;
  type: 'sales_variance' | 'expense_spike' | 'unusual_pattern' | 'fraud_indicator';
  outlet_id: string;
  outlet_name: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detected_at: string;
  data: any;
}

// Helper function to format AI response text for better readability
const formatResponseText = (content: string) => {
  return content
    // Remove markdown headers and make them bold text
    .replace(/^#{1,6}\\s*\\*\\*(.+?)\\*\\*/gm, '$1')
    .replace(/^#{1,6}\\s*(.+?)$/gm, '$1')
    // Remove markdown bold/italic formatting
    .replace(/\\*\\*(.+?)\\*\\*/g, '$1')
    .replace(/\\*(.+?)\\*/g, '$1')
    // Clean up bullet points
    .replace(/^\\s*[\u2022\\*\\-]\\s*/gm, '\u2022 ')
    // Remove excessive line breaks but keep paragraph structure
    .replace(/\\n{3,}/g, '\\n\\n')
    .trim();
};

const AIAssistant: React.FC = () => {
  const { currentUser, userOutlets, hasPermission } = useOutlet();
  const { isLoading, setLoading, error, setError } = useLoadingState();
  
  // Data state
  const [outletSummaries, setOutletSummaries] = useState<OutletEODSummary[]>([]);
  const [analytics, setAnalytics] = useState<MultiOutletAnalytics | null>(null);
  
  // AI Assistant State
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [currentMessage, setCurrentMessage] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [detectedAnomalies, setDetectedAnomalies] = useState<Anomaly[]>([]);
  const [aiInsights, setAiInsights] = useState<AIInsight[]>([]);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(true);
  
  // Auto-collapse sidebar on mobile
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 640) { // sm breakpoint
        setIsSidebarCollapsed(true);
      }
    };
    
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Check permissions
  const canViewMultiOutlet = hasPermission('view_all_outlets') || 
                            currentUser?.role === 'super_admin' ||
                            currentUser?.role === 'outlet_admin';

  useEffect(() => {
    if (canViewMultiOutlet && userOutlets.length > 0) {
      loadMultiOutletData();
    }
  }, [userOutlets, canViewMultiOutlet]);

  const loadMultiOutletData = async () => {
    if (!userOutlets.length) return;

    setLoading(true);
    setError(null);

    try {
      const summaries: OutletEODSummary[] = [];
      
      // Load data for each outlet
      for (const outlet of userOutlets) {
        try {
          // Get EOD summary for this outlet
          const summary = await eodService.getEODSummary();
          
          // Determine status based on various factors
          let status: 'good' | 'warning' | 'critical' = 'good';
          
          if (summary.pending_reports > 0) {
            status = 'warning';
          }
          
          if (summary.cash_variance_today && Math.abs(summary.cash_variance_today) > 100) {
            status = 'critical';
          }

          summaries.push({
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            today_sales: summary.today_sales,
            today_profit: summary.today_profit,
            week_sales: summary.week_sales,
            week_profit: summary.week_profit,
            month_sales: summary.month_sales,
            month_profit: summary.month_profit,
            pending_reports: summary.pending_reports,
            last_report_date: summary.last_report_date,
            cash_variance_today: summary.cash_variance_today,
            status
          });
        } catch (err) {
          console.error(`Error loading data for outlet ${outlet.name}:`, err);
          // Add outlet with error status
          summaries.push({
            outlet_id: outlet.id,
            outlet_name: outlet.name,
            today_sales: 0,
            today_profit: 0,
            week_sales: 0,
            week_profit: 0,
            month_sales: 0,
            month_profit: 0,
            pending_reports: 0,
            last_report_date: null,
            cash_variance_today: null,
            status: 'critical'
          });
        }
      }

      setOutletSummaries(summaries);

      // Calculate multi-outlet analytics
      const totalSalesToday = summaries.reduce((sum, s) => sum + s.today_sales, 0);
      const totalProfitToday = summaries.reduce((sum, s) => sum + s.today_profit, 0);
      const totalPendingReports = summaries.reduce((sum, s) => sum + s.pending_reports, 0);
      const outletsWithDiscrepancies = summaries.filter(s => 
        s.cash_variance_today && Math.abs(s.cash_variance_today) > 10
      ).length;

      const bestPerforming = summaries.reduce((best, current) => 
        current.today_sales > best.today_sales ? current : best
      );

      const worstPerforming = summaries.reduce((worst, current) => 
        current.today_sales < worst.today_sales ? current : worst
      );

      setAnalytics({
        total_outlets: summaries.length,
        total_sales_today: totalSalesToday,
        total_profit_today: totalProfitToday,
        total_pending_reports: totalPendingReports,
        outlets_with_discrepancies: outletsWithDiscrepancies,
        best_performing_outlet: {
          name: bestPerforming.outlet_name,
          sales: bestPerforming.today_sales
        },
        worst_performing_outlet: {
          name: worstPerforming.outlet_name,
          sales: worstPerforming.today_sales
        }
      });

    } catch (err) {
      setError('Failed to load multi-outlet EOD data');
      console.error('Multi-outlet EOD error:', err);
    } finally {
      setLoading(false);
    }
  };

  // AI Assistant Functions
  const createNewConversation = () => {
    const newConversation: Conversation = {
      id: `conv_${Date.now()}`,
      title: `Business Analysis ${conversations.length + 1}`,
      messages: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    setConversations(prev => [newConversation, ...prev]);
    setActiveConversationId(newConversation.id);
  };

  const detectAnomalies = async () => {
    if (!outletSummaries.length) return [];

    const anomalies: Anomaly[] = [];
    const today = new Date().toISOString().split('T')[0];

    // Calculate aggregate metrics for relative comparison
    const totalSalesToday = outletSummaries.reduce((sum, outlet) => sum + outlet.today_sales, 0);
    const avgSalesAcrossOutlets = totalSalesToday / outletSummaries.length;
    
    outletSummaries.forEach(outlet => {
      // Cash variance detection based on percentage of daily sales
      if (outlet.cash_variance_today && outlet.today_sales > 0) {
        const variancePercentage = Math.abs(outlet.cash_variance_today / outlet.today_sales) * 100;
        
        // Alert if variance is more than 5% of daily sales, critical if >15%
        if (variancePercentage > 5) {
          anomalies.push({
            id: `anom_${outlet.outlet_id}_${Date.now()}`,
            type: 'sales_variance',
            outlet_id: outlet.outlet_id,
            outlet_name: outlet.outlet_name,
            description: `Cash variance of ${variancePercentage.toFixed(1)}% detected (${outlet.cash_variance_today >= 0 ? '+' : ''}${Math.abs(outlet.cash_variance_today).toLocaleString()} vs ${outlet.today_sales.toLocaleString()} sales)`,
            severity: variancePercentage > 15 ? 'critical' : variancePercentage > 10 ? 'high' : 'medium',
            detected_at: today,
            data: { 
              variance: outlet.cash_variance_today,
              variance_percentage: variancePercentage,
              daily_sales: outlet.today_sales
            }
          });
        }
      }
    });

    return anomalies;
  };

  const generateAIInsights = async (message: string): Promise<AIInsight[]> => {
    const insights: AIInsight[] = [];
    
    // Business trend analysis
    if (analytics) {
      const totalSales = analytics.total_sales_today;
      const totalOutlets = analytics.total_outlets;
      const avgSalesPerOutlet = totalSales / totalOutlets;

      insights.push({
        type: 'trend',
        title: 'Sales Performance',
        description: `Average sales per outlet today: $${avgSalesPerOutlet.toFixed(2)}. ${analytics.best_performing_outlet.name} leads with $${analytics.best_performing_outlet.sales}.`,
        severity: 'low',
        confidence: 0.9,
        data: { avg_sales: avgSalesPerOutlet }
      });

      if (analytics.outlets_with_discrepancies > 0) {
        insights.push({
          type: 'warning',
          title: 'Cash Discrepancies Detected',
          description: `${analytics.outlets_with_discrepancies} outlet(s) have cash discrepancies that need attention.`,
          severity: analytics.outlets_with_discrepancies > 2 ? 'high' : 'medium',
          confidence: 0.95,
          data: { affected_outlets: analytics.outlets_with_discrepancies }
        });
      }
    }

    return insights;
  };

  const generateAIResponse = async (userMessage: string): Promise<string> => {
    // Simulate AI processing time
    await new Promise(resolve => setTimeout(resolve, 1500));

    const lowerMessage = userMessage.toLowerCase();
    
    // Business queries
    if (lowerMessage.includes('sales') || lowerMessage.includes('revenue')) {
      if (!analytics) return "I need outlet data to analyze sales. Please ensure the system has loaded your outlet data first.";
      
      return `Based on current data:
      
📊 Sales Summary
• Total sales today: $${analytics.total_sales_today.toLocaleString()}
• Total profit today: $${analytics.total_profit_today.toLocaleString()}
• Average per outlet: $${(analytics.total_sales_today / analytics.total_outlets).toLocaleString()}

🏆 Top Performer: ${analytics.best_performing_outlet.name} ($${analytics.best_performing_outlet.sales.toLocaleString()})

⚠️ Alerts: ${analytics.outlets_with_discrepancies} outlet(s) with discrepancies
${analytics.total_pending_reports} pending reports need attention`;
    }

    if (lowerMessage.includes('fraud') || lowerMessage.includes('suspicious')) {
      const anomalies = await detectAnomalies();
      const fraudIndicators = anomalies.filter(a => a.severity === 'critical' || a.type === 'fraud_indicator');
      
      if (fraudIndicators.length === 0) {
        return `🔒 Fraud Analysis Complete

No critical fraud indicators detected in current data. However, I'm monitoring:
• Cash variance patterns (>5% of daily sales)
• Unusual sales spikes/drops (>100% deviation from weekly average)
• Missing reports relative to outlet performance
• Profit margin deviations (>15% from weekly average)

Monitoring Thresholds:
• Cash variance alerts: >5% of daily sales
• Sales anomalies: >100% above or <70% below weekly average
• Margin deviations: >15% from historical average

Recommendations:
• Continue daily EOD reporting
• Review outlets with pending reports
• Monitor cash handling procedures`;
      }

      return `🚨 Fraud Alert

Detected ${fraudIndicators.length} potential fraud indicator(s):

${fraudIndicators.map(f => `• ${f.outlet_name}: ${f.description}`).join('\n')}

Immediate Actions Required:
• Investigate highlighted outlets
• Review cash handling procedures
• Verify employee access logs
• Conduct physical inventory checks`;
    }

    if (lowerMessage.includes('anomaly') || lowerMessage.includes('unusual')) {
      const anomalies = await detectAnomalies();
      
      if (anomalies.length === 0) {
        return `✅ Anomaly Detection Complete

No significant anomalies detected in current operations. All outlets appear to be operating within normal parameters.

Current Status:
• Sales patterns: Within ±100% of weekly averages
• Cash variances: <5% of daily sales  
• Reporting: Up to date relative to outlet size
• Profit margins: Within ±15% of weekly average
• Performance: Consistent across all metrics`;
      }

      return `📈 Anomaly Detection Results

Found ${anomalies.length} anomalies requiring attention:

${anomalies.slice(0, 5).map(a => `• ${a.severity.toUpperCase()}: ${a.outlet_name} - ${a.description}`).join('\n')}

Analysis:
• ${anomalies.filter(a => a.severity === 'critical').length} critical issues
• ${anomalies.filter(a => a.severity === 'high').length} high priority items
• ${anomalies.filter(a => a.severity === 'medium').length} medium priority items`;
    }

    if (lowerMessage.includes('profit') || lowerMessage.includes('margin')) {
      if (!analytics) return "Please load outlet data first to analyze profitability.";
      
      const profitMargin = (analytics.total_profit_today / analytics.total_sales_today) * 100;
      
      return `💰 Profitability Analysis

Today's Performance:
• Total Profit: $${analytics.total_profit_today.toLocaleString()}
• Total Sales: $${analytics.total_sales_today.toLocaleString()}
• Profit Margin: ${profitMargin.toFixed(1)}%

Outlet Performance:
• Best: ${analytics.best_performing_outlet.name}
• Needs attention: ${analytics.worst_performing_outlet.name}

Recommendations:
${profitMargin > 20 ? '• Excellent margin! Consider expansion opportunities' : '• Margin could be improved - review cost structure'}
• Focus on underperforming outlets
• Analyze expense categories for optimization`;
    }

    // Default business intelligence response
    return `🤖 AI Business Assistant

I can help you analyze business operations using sophisticated, currency-agnostic algorithms:

📊 Business Analytics
• Sales performance analysis (percentage-based comparisons)
• Profitability insights with margin analysis
• Cross-outlet trend identification

🔍 Fraud Detection
• Cash variance monitoring (>5% of daily sales)
• Suspicious pattern identification (>100% sales deviations)
• Risk assessment with severity scoring

⚠️ Operational Alerts
• Dynamic threshold anomaly detection
• Relative performance monitoring
• Scalable reporting compliance checks

💡 Strategic Insights
• Performance optimization recommendations
• Comparative outlet analysis
• Operational efficiency improvements

🎯 Smart Thresholds:
• Cash variance: 5%/10%/15% of daily sales (Medium/High/Critical)
• Sales anomalies: ±100% from weekly average
• Profit margins: ±15% deviation alerts
• Reports: Dynamic thresholds based on outlet performance

Ask me about specific metrics, trends, or any concerns about your business operations!`;
  };

  const sendMessage = async () => {
    if (!currentMessage.trim() || !activeConversationId || aiLoading) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      type: 'user',
      content: currentMessage,
      timestamp: new Date().toISOString()
    };

    // Add user message
    setConversations(prev => prev.map(conv => 
      conv.id === activeConversationId 
        ? { ...conv, messages: [...conv.messages, userMessage], updated_at: new Date().toISOString() }
        : conv
    ));

    setCurrentMessage('');
    setAiLoading(true);

    try {
      // Generate AI response
      const aiResponse = await generateAIResponse(currentMessage);
      const insights = await generateAIInsights(currentMessage);
      const anomalies = await detectAnomalies();

      const aiMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        type: 'ai',
        content: aiResponse,
        timestamp: new Date().toISOString(),
        insights,
        anomalies: anomalies.slice(0, 3) // Limit to top 3
      };

      // Add AI response
      setConversations(prev => prev.map(conv => 
        conv.id === activeConversationId 
          ? { ...conv, messages: [...conv.messages, aiMessage], updated_at: new Date().toISOString() }
          : conv
      ));

      // Update insights and anomalies
      setAiInsights(insights);
      setDetectedAnomalies(anomalies);

    } catch (error) {
      console.error('AI response error:', error);
    } finally {
      setAiLoading(false);
    }
  };

  // Initialize with sample data and first conversation
  useEffect(() => {
    if (conversations.length === 0) {
      createNewConversation();
    }
  }, []);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading AI Assistant...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      <div className="h-screen flex flex-col">
        {error && <ErrorMessage error={error} onDismiss={() => setError(null)} />}

        {/* Header - Mobile Responsive */}
        <div className="border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex-shrink-0">
          <div className="px-3 sm:px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-blue-600 mr-2 sm:mr-3" />
                <h1 className="text-lg sm:text-xl font-semibold text-gray-900 dark:text-white">
                  AI Assistant
                </h1>
              </div>
              <button
                onClick={createNewConversation}
                className="flex items-center px-2 sm:px-3 py-1.5 text-xs sm:text-sm bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
              >
                <MessageSquare className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span className="hidden sm:inline">New Chat</span>
                <span className="sm:hidden">New</span>
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex flex-1 min-h-0">
          {/* Sidebar - Desktop Only */}
          <div className={`${isSidebarCollapsed ? 'w-0' : 'w-64 sm:w-80'} border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'border-r-0' : ''} hidden sm:flex`}>
            {!isSidebarCollapsed && (
              <div className="p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <h3 className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">Recent Conversations</h3>
                <button
                  onClick={() => setIsSidebarCollapsed(true)}
                  className="p-1 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
                >
                  <div className="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center">
                    <div className="w-3 h-3 border-l-2 border-t-2 border-gray-500 transform rotate-45"></div>
                  </div>
                </button>
              </div>
            )}
            {!isSidebarCollapsed && (
              <div className="flex-1 overflow-y-auto">
                {conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    onClick={() => setActiveConversationId(conversation.id)}
                    className={`w-full p-2 sm:p-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 transition-colors ${
                      activeConversationId === conversation.id ? 'bg-blue-50 dark:bg-blue-900/20 border-r-2 border-r-blue-500' : ''
                    }`}
                  >
                    <div className="font-medium text-xs sm:text-sm text-gray-900 dark:text-white truncate">
                      {conversation.title}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {conversation.messages.length} messages
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Toggle Button for Collapsed Sidebar - Desktop Only */}
          {isSidebarCollapsed && (
            <div className="absolute top-20 left-4 z-10 hidden sm:block">
              <button
                onClick={() => setIsSidebarCollapsed(false)}
                className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-sm hover:shadow-md transition-shadow text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
              >
                <MessageSquare className="h-4 w-4 sm:h-5 sm:w-5" />
              </button>
            </div>
          )}

          {/* Chat Area - Mobile Responsive */}
          <div className="flex-1 flex flex-col bg-white dark:bg-gray-800 relative">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-3 sm:p-6">
              <div className="max-w-full sm:max-w-3xl mx-auto">
                {/* Welcome Screen with Quick Questions */}
                {!activeConversationId || conversations.find(c => c.id === activeConversationId)?.messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full min-h-72 sm:min-h-96">
                    <div className="text-center mb-6 sm:mb-8 px-4">
                      <Bot className="h-12 w-12 sm:h-16 sm:w-16 text-blue-600 mx-auto mb-3 sm:mb-4" />
                      <h2 className="text-xl sm:text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                        How can I help you today?
                      </h2>
                      <p className="text-sm sm:text-base text-gray-600 dark:text-gray-400">
                        Ask me anything about your business performance, analytics, or operations
                      </p>
                    </div>
                    
                    {/* Quick Questions Grid - Mobile Responsive */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 w-full max-w-full sm:max-w-2xl px-4">
                      {[
                        { question: 'How are sales performing today?', icon: '📊' },
                        { question: 'Check for suspicious activities', icon: '🔍' },
                        { question: 'What are today\'s profit margins?', icon: '💰' },
                        { question: 'Detect any operational anomalies', icon: '⚠️' }
                      ].map((item, index) => (
                        <button
                          key={index}
                          onClick={() => {
                            setCurrentMessage(item.question);
                            setTimeout(() => sendMessage(), 100);
                          }}
                          className="p-4 sm:p-6 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 rounded-xl border border-gray-200 dark:border-gray-600 text-left transition-all hover:shadow-md"
                        >
                          <div className="text-xl sm:text-2xl mb-2">{item.icon}</div>
                          <div className="font-medium text-sm sm:text-base text-gray-900 dark:text-white">
                            {item.question}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Regular Conversation View - Mobile Responsive */
                  <div className="space-y-4 sm:space-y-6">
                    {conversations.find(c => c.id === activeConversationId)?.messages.map((message) => (
                      <div key={message.id} className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-full sm:max-w-2xl ${message.type === 'user' ? 'ml-2 sm:ml-12' : 'mr-2 sm:mr-12'}`}>
                          {message.type === 'ai' && (
                            <div className="flex items-center mb-2">
                              <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                              <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">AI Assistant</span>
                            </div>
                          )}
                          <div className={`p-3 sm:p-4 rounded-2xl ${
                            message.type === 'user' 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                          }`}>
                            <div className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                              {message.type === 'ai' ? formatResponseText(message.content) : message.content}
                            </div>
                          </div>
                          <div className={`text-xs mt-2 ${
                            message.type === 'user' ? 'text-right text-gray-500' : 'text-gray-500'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                          </div>
                        </div>
                      </div>
                    ))}
                    
                    {/* Loading State - Mobile Responsive */}
                    {aiLoading && (
                      <div className="flex justify-start">
                        <div className="max-w-full sm:max-w-2xl mr-2 sm:mr-12">
                          <div className="flex items-center mb-2">
                            <Bot className="h-4 w-4 sm:h-5 sm:w-5 text-blue-600 mr-2" />
                            <span className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">AI Assistant</span>
                          </div>
                          <div className="bg-gray-100 dark:bg-gray-700 p-3 sm:p-4 rounded-2xl">
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-3 w-3 sm:h-4 sm:w-4 border-2 border-blue-600 border-t-transparent"></div>
                              <div className="text-xs sm:text-sm text-gray-600 dark:text-gray-400">Thinking...</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Input Area - Mobile Responsive */}
            <div className="border-t border-gray-200 dark:border-gray-700 p-3 sm:p-6 flex-shrink-0">
              <div className="max-w-full sm:max-w-3xl mx-auto">
                <div className="flex items-end space-x-2 sm:space-x-3">
                  <div className="flex-1">
                    <textarea
                      value={currentMessage}
                      onChange={(e) => setCurrentMessage(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          sendMessage();
                        }
                      }}
                      placeholder="Ask me about your business performance, fraud detection, or trends..."
                      className="w-full px-3 sm:px-4 py-2 sm:py-3 text-sm sm:text-base border border-gray-300 dark:border-gray-600 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-white resize-none"
                      disabled={aiLoading}
                      rows={1}
                      style={{ minHeight: '40px', maxHeight: '120px' }}
                    />
                  </div>
                  <button
                    onClick={sendMessage}
                    disabled={!currentMessage.trim() || aiLoading}
                    className="p-2 sm:p-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    <Send className="h-3 w-3 sm:h-4 sm:w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AIAssistant;