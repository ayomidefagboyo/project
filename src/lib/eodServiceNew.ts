/**
 * EOD (End of Day) service using FastAPI backend
 */

import { apiClient } from './apiClient';
import { EnhancedDailyReport } from '@/types';

export interface EODCreateData {
  date: string;
  sales_cash: number;
  sales_transfer: number;
  sales_pos: number;
  sales_credit: number;
  opening_balance: number;
  closing_balance: number;
  bank_deposit: number;
  inventory_cost: number;
  notes?: string;
  discrepancies?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
}

export interface EODUpdateData {
  sales_cash?: number;
  sales_transfer?: number;
  sales_pos?: number;
  sales_credit?: number;
  opening_balance?: number;
  closing_balance?: number;
  bank_deposit?: number;
  inventory_cost?: number;
  notes?: string;
  discrepancies?: Array<{
    type: string;
    amount: number;
    description: string;
  }>;
}

export interface EODResponse {
  data: EnhancedDailyReport | null;
  error: string | null;
}

export interface EODListResponse {
  data: EnhancedDailyReport[] | null;
  error: string | null;
  total: number;
  page: number;
  size: number;
}

export interface EODAnalyticsResponse {
  data: {
    average_daily_sales: number;
    total_sales: number;
    total_expenses: number;
    net_profit: number;
    cash_variance: number;
    sales_trend: Array<{ date: string; sales: number; expenses: number; profit: number }>;
    top_selling_days: Array<{ date: string; sales: number }>;
    expense_breakdown: Record<string, number>;
    cash_flow_analysis: {
      average_cash_flow: number;
      cash_flow_trend: 'increasing' | 'decreasing' | 'stable';
      variance_analysis: {
        high_variance_days: number;
        low_variance_days: number;
        average_variance: number;
      };
    };
  } | null;
  error: string | null;
}

export interface EODStatsResponse {
  data: {
    total_reports: number;
    total_sales: number;
    total_expenses: number;
    net_profit: number;
    average_daily_sales: number;
    cash_variance: number;
    reports_by_status: Record<string, number>;
    sales_by_payment_method: Record<string, number>;
    monthly_trends: Array<{
      month: string;
      sales: number;
      expenses: number;
      profit: number;
    }>;
  } | null;
  error: string | null;
}

export interface EODSearchRequest {
  query?: string;
  date_from?: string;
  date_to?: string;
  status?: string;
  outlet_id?: string;
  limit?: number;
}

class EODService {
  // Create EOD report
  async createEODReport(eodData: EODCreateData): Promise<EODResponse> {
    try {
      const response = await apiClient.post('/eod/reports', eodData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Create EOD report error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create EOD report' 
      };
    }
  }

  // Update EOD report
  async updateEODReport(id: string, eodData: EODUpdateData): Promise<EODResponse> {
    try {
      const response = await apiClient.put(`/eod/reports/${id}`, eodData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Update EOD report error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update EOD report' 
      };
    }
  }

  // Get EOD report by ID
  async getEODReport(id: string): Promise<EODResponse> {
    try {
      const response = await apiClient.get(`/eod/reports/${id}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get EOD report error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get EOD report' 
      };
    }
  }

  // List EOD reports
  async listEODReports(
    page: number = 1,
    size: number = 20,
    dateFrom?: string,
    dateTo?: string,
    status?: string
  ): Promise<EODListResponse> {
    try {
      const params: any = { page, size };
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (status) params.status = status;

      const response = await apiClient.get('/eod/reports', params);
      
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
      console.error('List EOD reports error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to list EOD reports',
        total: 0,
        page,
        size
      };
    }
  }

  // Delete EOD report
  async deleteEODReport(id: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/eod/reports/${id}`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete EOD report error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete EOD report' 
      };
    }
  }

  // Check if EOD report exists for date
  async checkEODExists(outletId: string, date: string): Promise<{ exists: boolean; report: EnhancedDailyReport | null; error: string | null }> {
    try {
      const response = await apiClient.get('/eod/check-exists', { 
        outlet_id: outletId, 
        date 
      });
      
      if (response.error) {
        return { exists: false, report: null, error: response.error };
      }

      return { 
        exists: response.data?.exists || false,
        report: response.data?.report || null,
        error: null
      };
    } catch (error) {
      console.error('Check EOD exists error:', error);
      return { 
        exists: false, 
        report: null, 
        error: error instanceof Error ? error.message : 'Failed to check EOD existence' 
      };
    }
  }

  // Get EOD analytics
  async getEODAnalytics(
    dateFrom?: string,
    dateTo?: string,
    outletId?: string
  ): Promise<EODAnalyticsResponse> {
    try {
      const params: any = {};
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (outletId) params.outlet_id = outletId;

      const response = await apiClient.get('/eod/analytics', params);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get EOD analytics error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get EOD analytics' 
      };
    }
  }

  // Get EOD statistics
  async getEODStats(): Promise<EODStatsResponse> {
    try {
      const response = await apiClient.get('/eod/stats/overview');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get EOD stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get EOD statistics' 
      };
    }
  }

  // Search EOD reports
  async searchEODReports(searchRequest: EODSearchRequest): Promise<EODListResponse> {
    try {
      const response = await apiClient.post('/eod/search', searchRequest);
      
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
      console.error('Search EOD reports error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search EOD reports',
        total: 0,
        page: 1,
        size: 20
      };
    }
  }

  // Approve EOD report
  async approveEODReport(id: string, notes?: string): Promise<EODResponse> {
    try {
      const response = await apiClient.patch(`/eod/reports/${id}/approve`, { notes });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Approve EOD report error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to approve EOD report' 
      };
    }
  }

  // Reject EOD report
  async rejectEODReport(id: string, reason: string): Promise<EODResponse> {
    try {
      const response = await apiClient.patch(`/eod/reports/${id}/reject`, { reason });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Reject EOD report error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to reject EOD report' 
      };
    }
  }

  // Get recent EOD reports
  async getRecentEODReports(limit: number = 5): Promise<EODListResponse> {
    try {
      const response = await apiClient.get('/eod/recent', { limit });
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, page: 1, size: limit };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        page: 1,
        size: limit
      };
    } catch (error) {
      console.error('Get recent EOD reports error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get recent EOD reports',
        total: 0,
        page: 1,
        size: limit
      };
    }
  }

  // Get EOD report by date
  async getEODReportByDate(date: string, outletId?: string): Promise<EODResponse> {
    try {
      const params: any = { date };
      if (outletId) params.outlet_id = outletId;

      const response = await apiClient.get('/eod/reports/by-date', params);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get EOD report by date error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get EOD report by date' 
      };
    }
  }
}

// Create singleton instance
export const eodService = new EODService();

// Export types
export type { 
  EODCreateData, 
  EODUpdateData, 
  EODResponse, 
  EODListResponse, 
  EODAnalyticsResponse, 
  EODStatsResponse, 
  EODSearchRequest 
};




