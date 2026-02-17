/**
 * Staff management service for dashboard
 */

import { apiClient, ApiResponse } from './apiClient';

export interface StaffProfile {
  id: string;
  staff_code: string;
  display_name: string;
  role: string;
  permissions: string[];
  is_active: boolean;
  created_at: string;
  outlet_id: string;
  parent_account_id: string;
  last_login?: string;
  failed_login_attempts?: number;
}

export interface CreateStaffData {
  display_name: string;
  pin: string;
  role: string;
  permissions: string[];
  outlet_id: string;
}

export interface UpdateStaffData {
  display_name?: string;
  pin?: string;
  role?: string;
  permissions?: string[];
  is_active?: boolean;
}

export interface StaffListResponse {
  profiles: StaffProfile[];
  total: number;
}

class StaffService {
  /**
   * Create a new staff profile
   */
  async createStaffProfile(staffData: CreateStaffData): Promise<ApiResponse<StaffProfile>> {
    return apiClient.post<StaffProfile>('/pos/staff', staffData);
  }

  /**
   * Get all staff profiles for the current user
   */
  async getStaffProfiles(outletId?: string, activeOnly = true): Promise<ApiResponse<StaffListResponse>> {
    const params: Record<string, any> = { active_only: activeOnly };
    if (outletId) {
      params.outlet_id = outletId;
    }

    return apiClient.get<StaffListResponse>('/pos/staff', params);
  }

  /**
   * Get a specific staff profile by ID
   */
  async getStaffProfile(profileId: string): Promise<ApiResponse<StaffProfile>> {
    return apiClient.get<StaffProfile>(`/pos/staff/${profileId}`);
  }

  /**
   * Update a staff profile
   */
  async updateStaffProfile(profileId: string, updateData: UpdateStaffData): Promise<ApiResponse<StaffProfile>> {
    return apiClient.put<StaffProfile>(`/pos/staff/${profileId}`, updateData);
  }

  /**
   * Delete (deactivate) a staff profile
   */
  async deleteStaffProfile(profileId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.delete<{ message: string }>(`/pos/staff/${profileId}`);
  }

  /**
   * Reset failed login attempts for a staff profile
   */
  async resetFailedAttempts(profileId: string): Promise<ApiResponse<{ message: string }>> {
    return apiClient.post<{ message: string }>(`/pos/staff/reset-attempts/${profileId}`);
  }

  /**
   * Get staff profiles for a specific outlet (used by POS)
   */
  async getOutletStaff(outletId: string): Promise<ApiResponse<StaffListResponse>> {
    return apiClient.get<StaffListResponse>(`/pos/staff/outlet/${outletId}`);
  }
}

// Create singleton instance
export const staffService = new StaffService();

// Role permissions configuration
export const rolePermissions = {
  cashier: ['view_dashboard', 'create_sales', 'view_inventory', 'view_reports'],
  manager: ['view_dashboard', 'create_sales', 'edit_sales', 'view_inventory', 'manage_inventory', 'view_reports', 'manage_users'],
  waiter: ['view_dashboard', 'create_sales', 'view_reports'],
  inventory_staff: ['view_dashboard', 'view_inventory', 'manage_inventory', 'view_reports'],
  pharmacist: ['view_dashboard', 'create_sales', 'view_inventory', 'manage_inventory', 'view_reports', 'view_analytics'],
  // Backward compatibility for legacy records still carrying accountant role
  accountant: ['view_dashboard', 'create_sales', 'view_inventory', 'manage_inventory', 'view_reports', 'view_analytics']
};

export default staffService;
