/**
 * Payment service using FastAPI backend
 */

import { apiClient } from './apiClient';
import { Payment, PaymentStatus, EnhancedInvoice, EnhancedVendor } from '@/types';

export interface CreatePaymentData {
  invoice_id: string;
  vendor_id: string;
  amount: number;
  status?: PaymentStatus;
  payment_method?: string;
  bank_reference?: string;
  payment_receipt_url?: string;
  notes?: string;
}

export interface UpdatePaymentData {
  status?: PaymentStatus;
  payment_method?: string;
  bank_reference?: string;
  payment_receipt_url?: string;
  notes?: string;
  paid_by?: string;
  confirmed_by?: string;
}

export interface PaymentResponse {
  data: Payment[] | null;
  error: string | null;
}

export interface SinglePaymentResponse {
  data: Payment | null;
  error: string | null;
}

export interface PaymentQueueResponse {
  data: {
    grouped_payments: Record<string, any>;
    total_pending: number;
    total_overdue: number;
    total_due_soon: number;
  } | null;
  error: string | null;
}

export interface PaymentStatsResponse {
  data: {
    total_payments: number;
    total_amount: number;
    pending_amount: number;
    overdue_amount: number;
    paid_amount: number;
    status_distribution: Record<string, number>;
    method_distribution: Record<string, number>;
  } | null;
  error: string | null;
}

export interface BulkPaymentUpdate {
  payment_ids: string[];
  status: PaymentStatus;
  payment_method?: string;
  bank_reference?: string;
  notes?: string;
}

class PaymentService {
  // Get all payments for current outlet
  async getPayments(
    outletId: string, 
    page: number = 1, 
    size: number = 20,
    search?: string,
    status?: PaymentStatus,
    vendor_id?: string
  ): Promise<PaymentResponse> {
    try {
      const params: any = { page, size };
      if (search) params.search = search;
      if (status) params.status = status;
      if (vendor_id) params.vendor_id = vendor_id;

      const response = await apiClient.get('/payments/', params);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get payments error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch payments' 
      };
    }
  }

  // Get single payment by ID
  async getPayment(id: string): Promise<SinglePaymentResponse> {
    try {
      const response = await apiClient.get(`/payments/${id}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get payment error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch payment' 
      };
    }
  }

  // Create new payment
  async createPayment(paymentData: CreatePaymentData): Promise<SinglePaymentResponse> {
    try {
      const response = await apiClient.post('/payments/', paymentData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Create payment error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create payment' 
      };
    }
  }

  // Update payment
  async updatePayment(id: string, paymentData: UpdatePaymentData): Promise<SinglePaymentResponse> {
    try {
      const response = await apiClient.put(`/payments/${id}`, paymentData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Update payment error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update payment' 
      };
    }
  }

  // Delete payment
  async deletePayment(id: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/payments/${id}`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete payment error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete payment' 
      };
    }
  }

  // Get payment queue with vendor grouping
  async getPaymentQueue(): Promise<PaymentQueueResponse> {
    try {
      const response = await apiClient.get('/payments/queue');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get payment queue error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch payment queue' 
      };
    }
  }

  // Mark payment as paid
  async markPaymentAsPaid(
    id: string, 
    paymentMethod?: string, 
    bankReference?: string, 
    notes?: string
  ): Promise<SinglePaymentResponse> {
    try {
      const response = await apiClient.patch(`/payments/${id}/mark-paid`, {
        payment_method: paymentMethod,
        bank_reference: bankReference,
        notes
      });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Mark payment as paid error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to mark payment as paid' 
      };
    }
  }

  // Confirm payment
  async confirmPayment(id: string, notes?: string): Promise<SinglePaymentResponse> {
    try {
      const response = await apiClient.patch(`/payments/${id}/confirm`, { notes });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Confirm payment error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to confirm payment' 
      };
    }
  }

  // Bulk update payments
  async bulkUpdatePayments(bulkData: BulkPaymentUpdate): Promise<PaymentResponse> {
    try {
      const response = await apiClient.post('/payments/bulk-update', bulkData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data || [], 
        error: null 
      };
    } catch (error) {
      console.error('Bulk update payments error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to bulk update payments' 
      };
    }
  }

  // Mark multiple payments as paid
  async markMultiplePaymentsAsPaid(
    paymentIds: string[], 
    paymentDetails: {
      paidBy: string;
      paymentMethod: string;
      notes?: string;
    }
  ): Promise<PaymentResponse> {
    try {
      const bulkData: BulkPaymentUpdate = {
        payment_ids: paymentIds,
        status: 'paid',
        payment_method: paymentDetails.paymentMethod,
        notes: paymentDetails.notes
      };

      return await this.bulkUpdatePayments(bulkData);
    } catch (error) {
      console.error('Mark multiple payments as paid error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to mark payments as paid' 
      };
    }
  }

  // Update payment status
  async updatePaymentStatus(
    id: string, 
    status: PaymentStatus, 
    updates: Partial<UpdatePaymentData> = {}
  ): Promise<SinglePaymentResponse> {
    try {
      const updateData: UpdatePaymentData = {
        status,
        ...updates
      };

      return await this.updatePayment(id, updateData);
    } catch (error) {
      console.error('Update payment status error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update payment status' 
      };
    }
  }

  // Search payments
  async searchPayments(
    query: string,
    status?: PaymentStatus,
    vendor_id?: string,
    date_from?: string,
    date_to?: string,
    limit: number = 10
  ): Promise<PaymentResponse> {
    try {
      const searchData = {
        query,
        status,
        vendor_id,
        date_from,
        date_to,
        limit
      };

      const response = await apiClient.post('/payments/search', searchData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('Search payments error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search payments' 
      };
    }
  }

  // Get payment statistics
  async getPaymentStats(): Promise<PaymentStatsResponse> {
    try {
      const response = await apiClient.get('/payments/stats/overview');
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get payment stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get payment statistics' 
      };
    }
  }
}

// Create singleton instance
export const paymentService = new PaymentService();

// Export types
export type { 
  CreatePaymentData, 
  UpdatePaymentData, 
  PaymentResponse, 
  SinglePaymentResponse, 
  PaymentQueueResponse, 
  PaymentStatsResponse, 
  BulkPaymentUpdate 
};



