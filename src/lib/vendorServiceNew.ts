/**
 * Vendor service using FastAPI backend
 */

import { apiClient } from './apiClient';
import { Vendor, VendorType } from '@/types';

export interface CreateVendorData {
  name: string;
  email?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
  contactPerson?: string;
  vendorType?: VendorType;
  taxId?: string;
  paymentTerms?: string;
  creditLimit?: number;
  notes?: string;
  bankDetails?: {
    accountName?: string;
    accountNumber?: string;
    bankName?: string;
    routingNumber?: string;
  };
}

export interface UpdateVendorData extends Partial<CreateVendorData> {
  id: string;
}

export interface VendorResponse {
  data: Vendor[] | null;
  error: string | null;
}

export interface SingleVendorResponse {
  data: Vendor | null;
  error: string | null;
}

export interface VendorSearchResponse {
  data: Vendor[] | null;
  error: string | null;
  total: number;
  query: string;
}

class VendorService {
  // Get all vendors for current outlet
  async getVendors(outletId: string, page: number = 1, size: number = 20): Promise<VendorResponse> {
    try {
      const response = await apiClient.get('/vendors/', { 
        page, 
        size,
        outlet_id: outletId 
      });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get vendors error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendors' 
      };
    }
  }

  // Get single vendor by ID
  async getVendor(id: string): Promise<SingleVendorResponse> {
    try {
      const response = await apiClient.get(`/vendors/${id}`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendor' 
      };
    }
  }

  // Create new vendor
  async createVendor(vendorData: CreateVendorData): Promise<SingleVendorResponse> {
    try {
      const response = await apiClient.post('/vendors/', vendorData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Create vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create vendor' 
      };
    }
  }

  // Update vendor
  async updateVendor(vendorData: UpdateVendorData): Promise<SingleVendorResponse> {
    try {
      const { id, ...updateData } = vendorData;
      const response = await apiClient.put(`/vendors/${id}`, updateData);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Update vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update vendor' 
      };
    }
  }

  // Delete vendor
  async deleteVendor(id: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/vendors/${id}`);
      
      if (response.error) {
        return { error: response.error };
      }

      return { error: null };
    } catch (error) {
      console.error('Delete vendor error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete vendor' 
      };
    }
  }

  // Search vendors
  async searchVendors(query: string, outletId: string): Promise<VendorSearchResponse> {
    try {
      const response = await apiClient.post('/vendors/search', {
        query,
        outlet_id: outletId
      });
      
      if (response.error) {
        return { data: null, error: response.error, total: 0, query };
      }

      return { 
        data: response.data?.items || [], 
        error: null,
        total: response.data?.total || 0,
        query
      };
    } catch (error) {
      console.error('Search vendors error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search vendors',
        total: 0,
        query
      };
    }
  }

  // Get vendor statistics
  async getVendorStats(outletId: string): Promise<{ data: any | null; error: string | null }> {
    try {
      const response = await apiClient.get('/vendors/stats/overview', { outlet_id: outletId });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Get vendor stats error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get vendor statistics' 
      };
    }
  }

  // Update vendor balance
  async updateVendorBalance(vendorId: string, amount: number, type: 'add' | 'subtract'): Promise<SingleVendorResponse> {
    try {
      const response = await apiClient.patch(`/vendors/${vendorId}/balance`, {
        amount,
        type
      });
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data, 
        error: null 
      };
    } catch (error) {
      console.error('Update vendor balance error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update vendor balance' 
      };
    }
  }

  // Get vendor payment history
  async getVendorPaymentHistory(vendorId: string): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const response = await apiClient.get(`/vendors/${vendorId}/payments`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get vendor payment history error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get vendor payment history' 
      };
    }
  }

  // Get vendor invoices
  async getVendorInvoices(vendorId: string): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const response = await apiClient.get(`/vendors/${vendorId}/invoices`);
      
      if (response.error) {
        return { data: null, error: response.error };
      }

      return { 
        data: response.data?.items || [], 
        error: null 
      };
    } catch (error) {
      console.error('Get vendor invoices error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get vendor invoices' 
      };
    }
  }
}

// Create singleton instance
export const vendorService = new VendorService();

// Export types
export type { CreateVendorData, UpdateVendorData, VendorResponse, SingleVendorResponse, VendorSearchResponse };















