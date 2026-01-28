import { apiClient } from './apiClient';
import type { ApiResponse } from './apiClient';
import type { Vendor, VendorType } from '@/types';

export interface CreateVendorData {
    business_name: string;
    contact_person: string;
    email: string;
    phone: string;
    address?: any;
    vendor_type: VendorType;
    tax_id?: string;
    payment_terms?: string;
    credit_limit?: number;
    website?: string;
    notes?: string;
    outlet_id: string; // Ensure vendors are linked to outlets
    is_active: boolean; // Add is_active property
}

export const vendorService = {
    async getVendors(outletId: string): Promise<ApiResponse<Vendor[]>> {
        const response = await apiClient.get<Vendor[]>(`/vendors?outlet_id=${outletId}`);
        return response;
    },

    async getVendor(id: string): Promise<ApiResponse<Vendor>> {
        return apiClient.get<Vendor>(`/vendors/${id}`);
    },

    async createVendor(data: CreateVendorData): Promise<ApiResponse<Vendor>> {
        return apiClient.post<Vendor>('/vendors', data);
    },

    async updateVendor(id: string, data: Partial<CreateVendorData>): Promise<ApiResponse<Vendor>> {
        return apiClient.put<Vendor>(`/vendors/${id}`, data);
    },

    async deleteVendor(id: string): Promise<ApiResponse<void>> {
        return apiClient.delete(`/vendors/${id}`);
    }
};
