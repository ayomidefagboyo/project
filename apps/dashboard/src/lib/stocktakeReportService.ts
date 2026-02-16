import { apiClient } from '@/lib/apiClient';

export interface StocktakeSessionSummary {
  id: string;
  outlet_id: string;
  terminal_id?: string | null;
  performed_by?: string | null;
  performed_by_name?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  status: string;
  total_items: number;
  adjusted_items: number;
  unchanged_items: number;
  positive_variance_items: number;
  negative_variance_items: number;
  net_quantity_variance: number;
  total_variance_value: number;
  source?: 'session_table' | 'movement_fallback';
}

export interface StocktakeSessionItem {
  movement_id: string;
  product_id: string;
  product_name: string;
  sku?: string | null;
  barcode?: string | null;
  system_quantity: number;
  counted_quantity: number;
  quantity_change: number;
  reason?: string | null;
  notes?: string | null;
  unit_cost?: number | null;
  variance_value?: number | null;
  movement_date?: string | null;
}

export interface StocktakeSessionDetail {
  session: StocktakeSessionSummary & { notes?: string | null };
  items: StocktakeSessionItem[];
}

interface StocktakeListResponse {
  items: StocktakeSessionSummary[];
  total: number;
  page: number;
  size: number;
}

class StocktakeReportService {
  async listStocktakeSessions(
    outletId: string,
    options: {
      page?: number;
      size?: number;
      dateFrom?: string;
      dateTo?: string;
    } = {}
  ): Promise<StocktakeListResponse> {
    const params = {
      outlet_id: outletId,
      page: options.page ?? 1,
      size: options.size ?? 25,
      ...(options.dateFrom ? { date_from: options.dateFrom } : {}),
      ...(options.dateTo ? { date_to: options.dateTo } : {})
    };

    const response = await apiClient.get<StocktakeListResponse>('/reports/stocktakes', params);
    if (!response.data) {
      throw new Error(response.error || 'Failed to load stocktake reports');
    }
    return response.data;
  }

  async getStocktakeSessionDetail(sessionId: string, outletId: string): Promise<StocktakeSessionDetail> {
    const response = await apiClient.get<StocktakeSessionDetail>(`/reports/stocktakes/${encodeURIComponent(sessionId)}`, {
      outlet_id: outletId
    });
    if (!response.data) {
      throw new Error(response.error || 'Failed to load stocktake details');
    }
    return response.data;
  }
}

export const stocktakeReportService = new StocktakeReportService();
