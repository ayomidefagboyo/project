import { dataService } from './services';
import { Vendor, VendorType, VendorScope, Address } from '@/types';

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

class VendorService {
  // Get all vendors for current outlet
  async getVendors(outletId: string): Promise<VendorResponse> {
    try {
      return await dataService.getVendors(outletId);
    } catch (error) {
      console.error('Get vendors error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendors' 
      };
    }
  }

  // Get vendors for multiple outlets (global + outlet-specific)
  async getVendorsForMultipleOutlets(outletIds: string[]): Promise<VendorResponse> {
    try {
      return await dataService.getVendorsForMultipleOutlets(outletIds);
    } catch (error) {
      console.error('Get vendors for multiple outlets error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendors' 
      };
    }
  }

  // Get vendors available for a specific outlet (global + outlet-specific)
  async getVendorsForOutlet(outletId: string): Promise<VendorResponse> {
    try {
      return await dataService.getVendorsForOutlet(outletId);
    } catch (error) {
      console.error('Get vendors for outlet error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendors for outlet' 
      };
    }
  }

  // Get specific vendor for outlet validation
  async getVendorForOutlet(vendorId: string, outletId: string): Promise<SingleVendorResponse> {
    try {
      return await dataService.getVendorForOutlet(vendorId, outletId);
    } catch (error) {
      console.error('Get vendor for outlet error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendor' 
      };
    }
  }

  // Get single vendor by ID
  async getVendor(id: string): Promise<SingleVendorResponse> {
    try {
      return await dataService.getVendor(id);
    } catch (error) {
      console.error('Get vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to fetch vendor' 
      };
    }
  }

  // Create new vendor
  async createVendor(vendorData: CreateVendorData, outletId: string): Promise<SingleVendorResponse> {
    try {
      return await dataService.createVendor(vendorData, outletId);
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
      return await dataService.updateVendor(vendorData);
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
      return await dataService.deleteVendor(id);
    } catch (error) {
      console.error('Delete vendor error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Failed to delete vendor' 
      };
    }
  }

  // Search vendors
  async searchVendors(outletId: string, query: string): Promise<VendorResponse> {
    try {
      return await dataService.searchVendors(outletId, query);
    } catch (error) {
      console.error('Search vendors error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to search vendors' 
      };
    }
  }
}

export const vendorService = new VendorService();
