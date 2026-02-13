import { apiClient } from './apiClient';
import type { Vendor, VendorType, VendorScope, Address } from '@/types';

interface BackendVendor {
  id: string;
  outlet_id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: Address | null;
  payment_terms?: string | null;
  contact_person?: string | null;
  vendor_type?: VendorType | null;
  credit_limit?: number | null;
  current_balance?: number | null;
  created_at: string;
  updated_at: string;
  scope?: VendorScope | null;
  outlets?: string[] | null;
  created_by?: string | null;
}

export interface CreateVendorData {
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  paymentTerms?: string;
  contactPerson?: string;
  vendorType: VendorType;
  scope?: VendorScope;
  outlets?: string[];
  createdBy?: 'owner' | 'outlet_manager';
  creditLimit?: number;
  defaultPaymentTerms?: number;
  taxId?: string;
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

const normalizeVendor = (vendor: BackendVendor): Vendor => {
  return {
    id: vendor.id,
    outletId: vendor.outlet_id,
    name: vendor.name,
    email: vendor.email || undefined,
    phone: vendor.phone || undefined,
    address: vendor.address || undefined,
    paymentTerms: vendor.payment_terms || undefined,
    contactPerson: vendor.contact_person || undefined,
    vendorType: vendor.vendor_type || 'supplier',
    scope: vendor.scope || 'outlet_specific',
    outlets: vendor.outlets && vendor.outlets.length > 0 ? vendor.outlets : [vendor.outlet_id],
    creditLimit: vendor.credit_limit || undefined,
    currentBalance: vendor.current_balance || 0,
    defaultPaymentTerms: undefined,
    taxId: undefined,
    preferredCategories: undefined,
    createdBy: vendor.created_by ? 'owner' : 'outlet_manager',
    createdAt: vendor.created_at,
    updatedAt: vendor.updated_at
  };
};

const toBackendPayload = (data: Partial<CreateVendorData>) => {
  return {
    name: data.name,
    email: data.email,
    phone: data.phone,
    address: data.address,
    payment_terms: data.paymentTerms,
    contact_person: data.contactPerson,
    vendor_type: data.vendorType,
    credit_limit: data.creditLimit
  };
};

class VendorService {
  async getVendors(_outletId: string): Promise<VendorResponse> {
    try {
      const response = await apiClient.get<{ items: BackendVendor[] }>('/vendors/', { page: 1, size: 100 });
      if (response.error || !response.data) {
        return { data: null, error: response.error || 'Failed to fetch vendors' };
      }

      return { data: (response.data.items || []).map(normalizeVendor), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch vendors'
      };
    }
  }

  async getVendorsForMultipleOutlets(outletIds: string[]): Promise<VendorResponse> {
    const result = await this.getVendors(outletIds[0] || '');
    if (!result.data) return result;
    const filtered = outletIds.length > 0
      ? result.data.filter((vendor) => outletIds.includes(vendor.outletId))
      : result.data;
    return { data: filtered, error: null };
  }

  async getVendorsForOutlet(outletId: string): Promise<VendorResponse> {
    const result = await this.getVendors(outletId);
    if (!result.data) return result;
    return { data: result.data.filter((vendor) => vendor.outletId === outletId), error: null };
  }

  async getVendorForOutlet(vendorId: string, outletId: string): Promise<SingleVendorResponse> {
    const result = await this.getVendor(vendorId);
    if (!result.data) return result;
    if (result.data.outletId !== outletId) {
      return { data: null, error: 'Vendor not found for this outlet' };
    }
    return result;
  }

  async getVendor(id: string): Promise<SingleVendorResponse> {
    try {
      const response = await apiClient.get<BackendVendor>(`/vendors/${id}`);
      if (response.error || !response.data) {
        return { data: null, error: response.error || 'Failed to fetch vendor' };
      }

      return { data: normalizeVendor(response.data), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to fetch vendor'
      };
    }
  }

  async createVendor(vendorData: CreateVendorData, _outletId?: string): Promise<SingleVendorResponse> {
    try {
      const response = await apiClient.post<BackendVendor>('/vendors/', toBackendPayload(vendorData));
      if (response.error || !response.data) {
        return { data: null, error: response.error || 'Failed to create vendor' };
      }

      return { data: normalizeVendor(response.data), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create vendor'
      };
    }
  }

  async updateVendor(vendorData: UpdateVendorData): Promise<SingleVendorResponse> {
    try {
      const { id, ...payload } = vendorData;
      const response = await apiClient.put<BackendVendor>(`/vendors/${id}`, toBackendPayload(payload));
      if (response.error || !response.data) {
        return { data: null, error: response.error || 'Failed to update vendor' };
      }

      return { data: normalizeVendor(response.data), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update vendor'
      };
    }
  }

  async deleteVendor(id: string): Promise<{ error: string | null }> {
    try {
      const response = await apiClient.delete(`/vendors/${id}`);
      if (response.status === 204) {
        return { error: null };
      }
      if (response.error) {
        return { error: response.error };
      }
      return { error: null };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : 'Failed to delete vendor'
      };
    }
  }

  async searchVendors(outletId: string, query: string): Promise<VendorResponse> {
    try {
      const response = await apiClient.post<{ items: BackendVendor[] }>('/vendors/search', { query, limit: 50 });
      if (response.error || !response.data) {
        return { data: null, error: response.error || 'Failed to search vendors' };
      }
      const normalized = (response.data.items || []).map(normalizeVendor);
      return { data: normalized.filter((vendor) => vendor.outletId === outletId), error: null };
    } catch (error) {
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search vendors'
      };
    }
  }
}

export const vendorService = new VendorService();
