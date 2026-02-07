/**
 * POS EOD (End of Day) service using FastAPI backend
 * Thin wrapper around /eod/reports endpoints for the POS app.
 */

import { apiClient } from './apiClient';

export interface POSEODCreateData {
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
  images?: File[]; // Support for multiple image uploads
}

export interface POSEODResponse {
  data: any | null;
  error: string | null;
}

export class POSEODService {
  async createEODReport(eodData: POSEODCreateData, outletId?: string): Promise<POSEODResponse> {
    try {
      const url = outletId ? `/eod/reports?outlet_id=${outletId}` : '/eod/reports';
      const response = await apiClient.post(url, eodData);

      if (response.error) {
        return { data: null, error: response.error };
      }

      return {
        data: response.data,
        error: null
      };
    } catch (error) {
      console.error('Create EOD report error (POS):', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create EOD report'
      };
    }
  }
}

export const posEodService = new POSEODService();

