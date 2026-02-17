import { apiClient } from './apiClient';
import logger from './logger';
import type {
  StaffProfile,
  StaffProfileCreate,
  StaffProfileUpdate,
  StaffPinAuth,
  StaffAuthResponse
} from '@/types';

class StaffService {
  private baseUrl = '/pos';

  /**
   * Create a new staff profile
   */
  async createStaffProfile(data: StaffProfileCreate): Promise<StaffProfile> {
    try {
      const response = await apiClient.post<StaffProfile>(`${this.baseUrl}/staff`, data);
      if (!response.data) throw new Error(response.error || 'Failed to create staff profile');
      return response.data;
    } catch (error) {
      logger.error('Error creating staff profile:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get staff profiles for current user
   */
  async getStaffProfiles(outletId?: string, activeOnly: boolean = true): Promise<{ profiles: StaffProfile[]; total: number }> {
    try {
      const params = new URLSearchParams();
      if (outletId) params.append('outlet_id', outletId);
      if (activeOnly) params.append('active_only', 'true');

      const response = await apiClient.get<{ profiles: StaffProfile[]; total: number }>(
        `${this.baseUrl}/staff?${params.toString()}`
      );

      if (!response.data) throw new Error(response.error || 'Failed to fetch staff profiles');
      return response.data;
    } catch (error) {
      logger.error('Error fetching staff profiles:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get a specific staff profile
   */
  async getStaffProfile(profileId: string): Promise<StaffProfile> {
    try {
      const response = await apiClient.get<StaffProfile>(`${this.baseUrl}/staff/${profileId}`);
      if (!response.data) throw new Error(response.error || 'Failed to fetch staff profile');
      return response.data;
    } catch (error) {
      logger.error('Error fetching staff profile:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Update a staff profile
   */
  async updateStaffProfile(profileId: string, data: StaffProfileUpdate): Promise<StaffProfile> {
    try {
      const response = await apiClient.put<StaffProfile>(`${this.baseUrl}/staff/${profileId}`, data);
      if (!response.data) throw new Error(response.error || 'Failed to update staff profile');
      return response.data;
    } catch (error) {
      logger.error('Error updating staff profile:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Delete (deactivate) a staff profile
   */
  async deleteStaffProfile(profileId: string): Promise<void> {
    try {
      const response = await apiClient.delete(`${this.baseUrl}/staff/${profileId}`);
      if (response.error) throw new Error(response.error);
    } catch (error) {
      logger.error('Error deleting staff profile:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Reset failed login attempts for a staff profile
   */
  async resetFailedAttempts(profileId: string): Promise<void> {
    try {
      const response = await apiClient.post(`${this.baseUrl}/staff/reset-attempts/${profileId}`, {});
      if (response.error) throw new Error(response.error);
    } catch (error) {
      logger.error('Error resetting failed attempts:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Authenticate staff with PIN
   */
  async authenticateWithPin(auth: StaffPinAuth): Promise<StaffAuthResponse> {
    try {
      const response = await apiClient.post<StaffAuthResponse>(`${this.baseUrl}/auth/pin`, auth);
      if (!response.data) throw new Error(response.error || 'Authentication failed');
      return response.data;
    } catch (error) {
      logger.error('Error authenticating with PIN:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get staff profiles for a specific outlet (public endpoint)
   */
  async getOutletStaff(outletId: string): Promise<{ profiles: StaffProfile[]; total: number }> {
    try {
      const response = await apiClient.get<{ profiles: StaffProfile[]; total: number }>(
        `${this.baseUrl}/staff/outlet/${outletId}`
      );

      if (!response.data) throw new Error(response.error || 'Failed to fetch outlet staff');
      return response.data;
    } catch (error) {
      logger.error('Error fetching outlet staff:', error);
      throw this.handleError(error);
    }
  }

  /**
   * Get default permissions for a role
   */
  getDefaultPermissionsForRole(role: string): string[] {
    const rolePermissions: Record<string, string[]> = {
      'cashier': [
        'view_dashboard',
        'create_sales',
        'view_inventory',
        'view_reports'
      ],
      'manager': [
        'view_dashboard',
        'create_sales',
        'edit_sales',
        'view_inventory',
        'manage_inventory',
        'view_reports',
        'manage_users'
      ],
      'waiter': [
        'view_dashboard',
        'create_sales',
        'view_reports'
      ],
      'kitchen_staff': [
        'view_dashboard',
        'view_reports'
      ],
      'inventory_staff': [
        'view_dashboard',
        'view_inventory',
        'manage_inventory',
        'view_reports'
      ],
      'pharmacist': [
        'view_dashboard',
        'create_sales',
        'view_inventory',
        'manage_inventory',
        'view_reports',
        'view_analytics'
      ],
      // Backward compatibility for legacy staff profiles
      'accountant': [
        'view_dashboard',
        'create_sales',
        'view_inventory',
        'manage_inventory',
        'view_reports',
        'view_analytics'
      ]
    };

    return rolePermissions[role] || [];
  }

  /**
   * Validate PIN format
   */
  validatePin(pin: string): { valid: boolean; error?: string } {
    if (!pin) {
      return { valid: false, error: 'PIN is required' };
    }

    if (pin.length !== 6) {
      return { valid: false, error: 'PIN must be exactly 6 digits' };
    }

    if (!/^\d+$/.test(pin)) {
      return { valid: false, error: 'PIN must contain only numbers' };
    }

    return { valid: true };
  }

  /**
   * Generate a secure PIN suggestion
   */
  generateSecurePin(): string {
    // Generate a random 6-digit PIN avoiding common patterns
    const avoidPatterns = [
      '111111', '222222', '333333', '444444', '555555',
      '666666', '777777', '888888', '999999', '000000',
      '123456', '654321', '123123', '456789', '987654'
    ];

    let pin: string;
    do {
      pin = Math.floor(100000 + Math.random() * 900000).toString();
    } while (avoidPatterns.includes(pin));

    return pin;
  }

  private handleError(error: any): Error {
    if (error instanceof Error) {
      return error;
    }

    if (typeof error === 'object' && error.message) {
      return new Error(error.message);
    }

    return new Error('An unexpected error occurred');
  }
}

export const staffService = new StaffService();
