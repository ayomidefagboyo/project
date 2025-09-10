/**
 * Authentication service using FastAPI backend
 */

import { apiClient } from './apiClient';
import { User, UserRole } from '@/types';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  outletId: string;
  permissions: string[];
  isOwner: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface OwnerSignupCredentials {
  email: string;
  password: string;
  name: string;
  companyName: string;
  businessType?: string;
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface InviteCredentials {
  email: string;
  name: string;
  role: UserRole;
  outletId: string;
}

export interface AuthResponse {
  user: AuthUser | null;
  error: string | null;
}

export interface InviteResponse {
  success: boolean;
  error: string | null;
  inviteId?: string;
}

class AuthService {
  // Company owner signup - creates outlet and owner account
  async signUpOwner(credentials: OwnerSignupCredentials): Promise<AuthResponse> {
    try {
      console.log('Starting owner signup with credentials:', { ...credentials, password: '[HIDDEN]' });
      
      const response = await apiClient.post('/auth/signup/owner', credentials);
      
      if (response.error) {
        console.error('Owner signup error:', response.error);
        return { user: null, error: response.error };
      }

      if (response.data) {
        // Store the token
        if (response.data.access_token) {
          apiClient.setToken(response.data.access_token);
          localStorage.setItem('auth_token', response.data.access_token);
        }

        const authUser: AuthUser = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          role: response.data.user.role,
          outletId: response.data.user.outlet_id,
          permissions: response.data.user.permissions || [],
          isOwner: response.data.user.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'Failed to create account' };
    } catch (error) {
      console.error('Owner signup error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Failed to create account' 
      };
    }
  }

  // User login
  async signIn(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/signin', credentials);
      
      if (response.error) {
        return { user: null, error: response.error };
      }

      if (response.data) {
        // Store the token
        if (response.data.access_token) {
          apiClient.setToken(response.data.access_token);
          localStorage.setItem('auth_token', response.data.access_token);
        }

        const authUser: AuthUser = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          role: response.data.user.role,
          outletId: response.data.user.outlet_id,
          permissions: response.data.user.permissions || [],
          isOwner: response.data.user.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'Login failed' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Login failed' 
      };
    }
  }

  // User logout
  async signOut(): Promise<void> {
    try {
      await apiClient.post('/auth/signout');
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      // Clear local authentication
      apiClient.clearAuth();
    }
  }

  // Get current user
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const response = await apiClient.get('/auth/me');
      
      if (response.error) {
        return { user: null, error: response.error };
      }

      if (response.data) {
        const authUser: AuthUser = {
          id: response.data.id,
          email: response.data.email,
          name: response.data.name,
          role: response.data.role,
          outletId: response.data.outlet_id,
          permissions: response.data.permissions || [],
          isOwner: response.data.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user found' };
    } catch (error) {
      console.error('Get current user error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Failed to get user' 
      };
    }
  }

  // Invite team member
  async inviteUser(credentials: InviteCredentials): Promise<InviteResponse> {
    try {
      const response = await apiClient.post('/auth/invite', credentials);
      
      if (response.error) {
        return { success: false, error: response.error };
      }

      return { 
        success: true, 
        error: null,
        inviteId: response.data?.invite_id 
      };
    } catch (error) {
      console.error('Invite user error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to send invitation' 
      };
    }
  }

  // Accept invitation
  async acceptInvitation(inviteId: string, password: string): Promise<AuthResponse> {
    try {
      const response = await apiClient.post('/auth/accept-invitation', {
        invite_id: inviteId,
        password: password
      });
      
      if (response.error) {
        return { user: null, error: response.error };
      }

      if (response.data) {
        // Store the token
        if (response.data.access_token) {
          apiClient.setToken(response.data.access_token);
          localStorage.setItem('auth_token', response.data.access_token);
        }

        const authUser: AuthUser = {
          id: response.data.user.id,
          email: response.data.user.email,
          name: response.data.user.name,
          role: response.data.user.role,
          outletId: response.data.user.outlet_id,
          permissions: response.data.user.permissions || [],
          isOwner: response.data.user.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'Failed to accept invitation' };
    } catch (error) {
      console.error('Accept invitation error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Failed to accept invitation' 
      };
    }
  }

  // Check if user is authenticated
  isAuthenticated(): boolean {
    return apiClient.isAuthenticated();
  }

  // Get stored token
  getToken(): string | null {
    return localStorage.getItem('auth_token');
  }

  // Refresh token
  async refreshToken(): Promise<boolean> {
    try {
      const response = await apiClient.post('/auth/refresh');
      
      if (response.error) {
        return false;
      }

      if (response.data?.access_token) {
        apiClient.setToken(response.data.access_token);
        localStorage.setItem('auth_token', response.data.access_token);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Refresh token error:', error);
      return false;
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await apiClient.post('/auth/reset-password', { email });
      
      if (response.error) {
        return { success: false, error: response.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to reset password' 
      };
    }
  }

  // Update password
  async updatePassword(currentPassword: string, newPassword: string): Promise<{ success: boolean; error: string | null }> {
    try {
      const response = await apiClient.post('/auth/update-password', {
        current_password: currentPassword,
        new_password: newPassword
      });
      
      if (response.error) {
        return { success: false, error: response.error };
      }

      return { success: true, error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to update password' 
      };
    }
  }
}

// Create singleton instance
export const authService = new AuthService();

// Export types
export type { AuthUser, LoginCredentials, OwnerSignupCredentials, InviteCredentials, AuthResponse, InviteResponse };




