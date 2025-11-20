/**
 * Anomaly detection service using FastAPI backend
 */

import { apiClient } from './apiClient';

export interface AnomalyCreateData {
  entity_type: 'invoice' | 'payment' | 'expense' | 'eod_report' | 'vendor' | 'customer';
  entity_id: string;
  anomaly_type: 'unusual_amount' | 'missing_data' | 'duplicate_entry' | 'timing_anomaly' | 'pattern_deviation';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detected_value?: number;
  expected_value?: number;
  confidence_score?: number;
  metadata?: Record<string, any>;
}

export interface AnomalyUpdateData {
  status?: 'open' | 'investigating' | 'resolved' | 'false_positive';
  resolution_notes?: string;
  resolved_by?: string;
  severity?: 'low' | 'medium' | 'high' | 'critical';
}

export interface AnomalyResponse {
  data: any | null;
  error: string | null;
}

export interface AnomalyListResponse {
  data: any[] | null;
  error: string | null;
  total: number;
  page: number;
  size: number;
}

export interface AnomalyStatsResponse {
  data: {
    total_anomalies: number;
    open_anomalies: number;
    resolved_anomalies: number;
    false_positives: number;
    severity_distribution: Record<string, number>;
    type_distribution: Record<string, number>;
    resolution_rate: number;
    average_resolution_time: number;
  } | null;
  error: string | null;
}

export interface AnomalyTrendResponse {
  data: {
    daily_anomalies: Array<{ date: string; count: number; severity: string }>;
    weekly_trends: Array<{ week: string; count: number; resolved: number }>;
    monthly_summary: Array<{ month: string; total: number; resolved: number; false_positives: number }>;
  } | null;
  error: string | null;
}

export interface AnomalyAlert {
  id: string;
  type: 'new_anomaly' | 'escalated_anomaly' | 'critical_anomaly';
  title: string;
  message: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  entity_type: string;
  entity_id: string;
  created_at: string;
  is_read: boolean;
}

export interface AnomalyDashboardSummary {
  data: {
    critical_alerts: number;
    high_priority_anomalies: number;
    recent_anomalies: any[];
    top_anomaly_types: Array<{ type: string; count: number }>;
    resolution_trends: Array<{ date: string; resolved: number; new: number }>;
    alerts: AnomalyAlert[];
  } | null;
  error: string | null;
}

export interface AnomalySearchRequest {
  query?: string;
  entity_type?: string;
  anomaly_type?: string;
  severity?: string;
  status?: string;
  date_from?: string;
  date_to?: string;
  limit?: number;
}

class AnomalyService {
  // Get all anomalies
  async getAnomalies(
    page: number = 1,
    size: number = 20,
    entityType?: string,
    severity?: string,
    status?: string
  ): Promise<AnomalyListResponse> {
    try {
      const params: any = { page, size };
      if (entityType) params.entity_type = entityType;
      if (severity) params.severity = severity;
      if (status) params.status = status;

      const response = await apiClient.get('/anomalies/', params);
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, page, size };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        page: response.data?.page || page,
        size: response.data?.size || size
      };
    } catch (error) {
      console.error('Get anomalies error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch anomalies',
        total: 0,
        page,
        size
      };
    }
  }

  // Get single anomaly by ID
  async getAnomaly(id: string): Promise<AnomalyResponse> {
    try {
      const response = await apiClient.get(`/anomalies/${id}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get anomaly error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch anomaly' 
      };
    }
  }

  // Create anomaly
  async createAnomaly(anomalyData: AnomalyCreateData): Promise<AnomalyResponse> {
    try {
      const response = await apiClient.post('/anomalies/', anomalyData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Create anomaly error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create anomaly' 
      };
    }
  }

  // Update anomaly
  async updateAnomaly(id: string, anomalyData: AnomalyUpdateData): Promise<AnomalyResponse> {
    try {
      const response = await apiClient.put(`/anomalies/${id}`, anomalyData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Update anomaly error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update anomaly' 
      };
    }
  }

  // Delete anomaly
  async deleteAnomaly(id: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/anomalies/${id}`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete anomaly error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete anomaly' 
      };
    }
  }

  // Detect anomalies for entity
  async detectAnomalies(
    entityType: 'invoice' | 'payment' | 'expense' | 'eod_report' | 'vendor' | 'customer',
    entityId: string
  ): Promise<AnomalyListResponse> {
    try {
      const response = await apiClient.post('/anomalies/detect', {
        entity_type: entityType,
        entity_id: entityId
      });
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, page: 1, size: 20 };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        page: 1,
        size: 20
      };
    } catch (error) {
      console.error('Detect anomalies error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to detect anomalies',
        total: 0,
        page: 1,
        size: 20
      };
    }
  }

  // Resolve anomaly
  async resolveAnomaly(
    id: string, 
    resolutionNotes: string, 
    isFalsePositive: boolean = false
  ): Promise<AnomalyResponse> {
    try {
      const response = await apiClient.patch(`/anomalies/${id}/resolve`, {
        resolution_notes: resolutionNotes,
        is_false_positive: isFalsePositive
      });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Resolve anomaly error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to resolve anomaly' 
      };
    }
  }

  // Bulk resolve anomalies
  async bulkResolveAnomalies(
    anomalyIds: string[],
    resolutionNotes: string,
    isFalsePositive: boolean = false
  ): Promise<AnomalyListResponse> {
    try {
      const response = await apiClient.post('/anomalies/bulk-resolve', {
        anomaly_ids: anomalyIds,
        resolution_notes: resolutionNotes,
        is_false_positive: isFalsePositive
      });
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, page: 1, size: 20 };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        page: 1,
        size: 20
      };
    } catch (error) {
      console.error('Bulk resolve anomalies error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to bulk resolve anomalies',
        total: 0,
        page: 1,
        size: 20
      };
    }
  }

  // Get anomaly statistics
  async getAnomalyStats(): Promise<AnomalyStatsResponse> {
    try {
      const response = await apiClient.get('/anomalies/stats/overview');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get anomaly stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get anomaly statistics' 
      };
    }
  }

  // Get anomaly trends
  async getAnomalyTrends(
    period: 'daily' | 'weekly' | 'monthly' = 'daily',
    days: number = 30
  ): Promise<AnomalyTrendResponse> {
    try {
      const response = await apiClient.get('/anomalies/trends', { 
        period, 
        days 
      });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get anomaly trends error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get anomaly trends' 
      };
    }
  }

  // Get critical alerts
  async getCriticalAlerts(): Promise<{ data: AnomalyAlert[] | null; error: string | null }> {
    try {
      const response = await apiClient.get('/anomalies/alerts/critical');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.alerts || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get critical alerts error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get critical alerts' 
      };
    }
  }

  // Get dashboard summary
  async getDashboardSummary(): Promise<AnomalyDashboardSummary> {
    try {
      const response = await apiClient.get('/anomalies/dashboard/summary');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get dashboard summary error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get dashboard summary' 
      };
    }
  }

  // Search anomalies
  async searchAnomalies(searchRequest: AnomalySearchRequest): Promise<AnomalyListResponse> {
    try {
      const response = await apiClient.post('/anomalies/search', searchRequest);
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, page: 1, size: 20 };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        page: response.data?.page || 1,
        size: response.data?.size || 20
      };
    } catch (error) {
      console.error('Search anomalies error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search anomalies',
        total: 0,
        page: 1,
        size: 20
      };
    }
  }

  // Mark alert as read
  async markAlertAsRead(alertId: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.patch(`/anomalies/alerts/${alertId}/read`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Mark alert as read error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to mark alert as read' 
      };
    }
  }

  // Get anomaly recommendations
  async getAnomalyRecommendations(anomalyId: string): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const response = await apiClient.get(`/anomalies/${anomalyId}/recommendations`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.recommendations || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get anomaly recommendations error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get anomaly recommendations' 
      };
    }
  }
}

// Create singleton instance
export const anomalyService = new AnomalyService();

// Export types
export type { 
  AnomalyCreateData, 
  AnomalyUpdateData, 
  AnomalyResponse, 
  AnomalyListResponse, 
  AnomalyStatsResponse, 
  AnomalyTrendResponse, 
  AnomalyAlert, 
  AnomalyDashboardSummary, 
  AnomalySearchRequest 
};















