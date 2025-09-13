import { apiClient } from './apiClient';
import { supabase } from './supabase';
import { emailService } from './emailService';
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
  businessType?: 'supermarket' | 'restaurant' | 'lounge' | 'retail' | 'cafe';
  phone?: string;
  address?: {
    street?: string;
    city?: string;
    state?: string;
    zip?: string;
    country?: string;
  };
}

export interface InviteUserData {
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
      // Safe logging - no sensitive data
      if (import.meta.env.VITE_DEBUG === 'true') {
        console.log('Starting owner signup process');
      }
      
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) {
        console.error('Supabase auth signup error:', error);
        throw error;
      }

      console.log('Auth user created successfully:', data.user?.id);

      if (data.user) {
        const businessType = credentials.businessType || 'retail';
        const phone = credentials.phone ?? '';
        const address = {
          street: credentials.address?.street ?? '',
          city: credentials.address?.city ?? '',
          state: credentials.address?.state ?? '',
          zip: credentials.address?.zip ?? '',
          country: credentials.address?.country ?? 'USA',
        };

        console.log('Creating outlet with data:', { businessType, phone, address });

        // Create outlet first
        const outletData = {
          name: credentials.companyName,
          business_type: businessType,
          status: 'active',
          address: address,
          phone: phone,
          email: credentials.email,
          opening_hours: this.getDefaultOpeningHours(businessType),
          tax_rate: 8.25,
          currency: 'USD',
          timezone: 'America/New_York',
        };

        console.log('Outlet data being sent:', outletData);

        const { data: outlet, error: outletError } = await supabase
          .from('outlets')
          .insert(outletData)
          .select()
          .single();

        if (outletError) {
          console.error('Outlet creation error details:', {
            message: outletError.message,
            details: outletError.details,
            hint: outletError.hint,
            code: outletError.code
          });
          throw outletError;
        }

        console.log('Outlet created successfully:', outlet.id);

        // Create business settings
        const { error: settingsError } = await supabase
          .from('business_settings')
          .insert({
            outlet_id: outlet.id,
            business_name: credentials.companyName,
            business_type: businessType,
            tax_number: 'TAX-' + Date.now(),
            theme: 'auto',
            language: 'en',
            date_format: 'MM/DD/YYYY',
            time_format: '12h',
            currency: 'USD',
            timezone: 'America/New_York',
          });

        if (settingsError) {
          console.error('Business settings creation error:', settingsError);
          throw settingsError;
        }

        console.log('Business settings created successfully');

        // Create user profile as outlet owner
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: credentials.email,
            name: credentials.name,
            role: 'outlet_admin',
            outlet_id: outlet.id,
            permissions: this.getDefaultPermissions('outlet_admin'),
            is_active: true,
          });

        if (profileError) {
          console.error('User profile creation error:', profileError);
          throw profileError;
        }

        console.log('User profile created successfully');

        const authUser: AuthUser = {
          id: data.user.id,
          email: credentials.email,
          name: credentials.name,
          role: 'outlet_admin',
          outletId: outlet.id,
          permissions: this.getDefaultPermissions('outlet_admin'),
          isOwner: true,
        };

        console.log('Owner signup completed successfully:', authUser);
        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user data received' };
    } catch (error) {
      console.error('Owner signup error details:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Owner signup failed' 
      };
    }
  }

  // Invite team member to company
  async inviteUser(inviteData: InviteUserData, invitedByUserId: string): Promise<InviteResponse> {
    try {
      console.log('Starting user invitation with data:', { ...inviteData, invitedByUserId });
      
      // Create invitation record
      const { data: invite, error: inviteError } = await supabase
        .from('user_invitations')
        .insert({
          email: inviteData.email,
          name: inviteData.name,
          role: inviteData.role,
          outlet_id: inviteData.outletId,
          invited_by: invitedByUserId,
          status: 'pending',
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
        })
        .select()
        .single();

      if (inviteError) {
        console.error('Supabase invitation error details:', {
          message: inviteError.message,
          details: inviteError.details,
          hint: inviteError.hint,
          code: inviteError.code
        });
        throw inviteError;
      }

      console.log('Invitation created successfully:', invite.id);

      // Send invitation email using Supabase email service
      try {
        // Get outlet details for the email
        const { data: outlet, error: outletError } = await supabase
          .from('outlets')
          .select('name')
          .eq('id', inviteData.outletId)
          .single();

        if (outletError) {
          console.warn('Could not fetch outlet details for email:', outletError);
        }

        // Get inviter details
        const { data: inviter, error: inviterError } = await supabase
          .from('users')
          .select('name')
          .eq('id', invitedByUserId)
          .single();

        if (inviterError) {
          console.warn('Could not fetch inviter details for email:', inviterError);
        }

        // Generate invitation link (in production, this would be your app's URL)
        const invitationLink = `${window.location.origin}/accept-invitation?token=${invite.token}`;

        // Send the invitation email
        const emailResult = await emailService.sendInvitationEmail({
          to: inviteData.email,
          name: inviteData.name,
          role: inviteData.role,
          outletName: outlet?.name || 'Your Company',
          inviterName: inviter?.name || 'Team Admin',
          invitationLink,
          expiresIn: '7 days'
        });

        if (!emailResult.success) {
          console.warn('Email sending failed, but invitation was created:', emailResult.error);
        }
      } catch (emailError) {
        console.warn('Email sending failed, but invitation was created:', emailError);
      }

      return { 
        success: true, 
        error: null, 
        inviteId: invite.id 
      };
    } catch (error) {
      console.error('Invite user error details:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to invite user' 
      };
    }
  }

  // Accept invitation and create user account
  async acceptInvitation(inviteId: string, password: string): Promise<AuthResponse> {
    try {
      // Get invitation details
      const { data: invite, error: inviteError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('id', inviteId)
        .eq('status', 'pending')
        .single();

      if (inviteError || !invite) {
        throw new Error('Invalid or expired invitation');
      }

      // Check if invitation is expired
      if (new Date(invite.expires_at) < new Date()) {
        throw new Error('Invitation has expired');
      }

      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email: invite.email,
        password: password,
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: invite.email,
            name: invite.name,
            role: invite.role,
            outlet_id: invite.outlet_id,
            permissions: this.getDefaultPermissions(invite.role),
            is_active: true,
          });

        if (profileError) throw profileError;

        // Mark invitation as accepted
        await supabase
          .from('user_invitations')
          .update({ 
            status: 'accepted',
            accepted_at: new Date().toISOString(),
            accepted_by: data.user.id
          })
          .eq('id', inviteId);

        const authUser: AuthUser = {
          id: data.user.id,
          email: invite.email,
          name: invite.name,
          role: invite.role,
          outletId: invite.outlet_id,
          permissions: this.getDefaultPermissions(invite.role),
          isOwner: false,
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user data received' };
    } catch (error) {
      console.error('Accept invitation error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Failed to accept invitation' 
      };
    }
  }

  // Sign in with Google
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/dashboard`
        }
      });

      if (error) throw error;

      // Note: With OAuth, the user will be redirected and we'll handle the callback
      // This method initiates the OAuth flow
      return { user: null, error: null };
    } catch (error) {
      console.error('Google sign-in error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Google sign-in failed' 
      };
    }
  }

  // Sign in with email and password
  async signIn(credentials: LoginCredentials): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: credentials.email,
        password: credentials.password,
      });

      if (error) throw error;

      if (data.user) {
        // Get user profile from our users table
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) throw profileError;

        const authUser: AuthUser = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          outletId: profile.outlet_id,
          permissions: profile.permissions || [],
          isOwner: profile.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user data received' };
    } catch (error) {
      console.error('Sign in error:', error);
      return { 
        user: null, 
        error: error instanceof Error ? error.message : 'Sign in failed' 
      };
    }
  }

  // Sign out
  async signOut(): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Sign out failed' 
      };
    }
  }

  // Get current session
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;
      return { session, error: null };
    } catch (error) {
      console.error('Get session error:', error);
      return { 
        session: null, 
        error: error instanceof Error ? error.message : 'Failed to get session' 
      };
    }
  }

  // Get current user
  async getCurrentUser(): Promise<AuthResponse> {
    try {
      const { data: { user }, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (user) {
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        const authUser: AuthUser = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          outletId: profile.outlet_id,
          permissions: profile.permissions || [],
          isOwner: profile.role === 'outlet_admin',
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

  // Get user's outlets
  async getUserOutlets(userId: string): Promise<{ data: any[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .select('*')
        .eq('id', (await supabase.from('users').select('outlet_id').eq('id', userId).single()).data?.outlet_id);

      if (error) throw error;
      return { data: data || [], error: null };
    } catch (error) {
      console.error('Get user outlets error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get user outlets' 
      };
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Reset password error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Password reset failed' 
      };
    }
  }

  // Update password
  async updatePassword(newPassword: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Update password error:', error);
      return { 
        error: error instanceof Error ? error.message : 'Password update failed' 
      };
    }
  }

  // Get default opening hours based on business type
  private getDefaultOpeningHours(businessType: string) {
    switch (businessType) {
      case 'supermarket':
        return {
          monday: { open: '08:00', close: '22:00' },
          tuesday: { open: '08:00', close: '22:00' },
          wednesday: { open: '08:00', close: '22:00' },
          thursday: { open: '08:00', close: '22:00' },
          friday: { open: '08:00', close: '23:00' },
          saturday: { open: '09:00', close: '23:00' },
          sunday: { open: '09:00', close: '21:00' }
        };
      case 'restaurant':
        return {
          monday: { open: '11:00', close: '22:00' },
          tuesday: { open: '11:00', close: '22:00' },
          wednesday: { open: '11:00', close: '22:00' },
          thursday: { open: '11:00', close: '23:00' },
          friday: { open: '11:00', close: '00:00' },
          saturday: { open: '10:00', close: '00:00' },
          sunday: { open: '10:00', close: '22:00' }
        };
      case 'lounge':
        return {
          monday: { open: '17:00', close: '02:00' },
          tuesday: { open: '17:00', close: '02:00' },
          wednesday: { open: '17:00', close: '02:00' },
          thursday: { open: '17:00', close: '02:00' },
          friday: { open: '17:00', close: '03:00' },
          saturday: { open: '17:00', close: '03:00' },
          sunday: { open: '17:00', close: '02:00' }
        };
      default:
        return {
          monday: { open: '09:00', close: '18:00' },
          tuesday: { open: '09:00', close: '18:00' },
          wednesday: { open: '09:00', close: '18:00' },
          thursday: { open: '09:00', close: '18:00' },
          friday: { open: '09:00', close: '18:00' },
          saturday: { open: '10:00', close: '16:00' },
          sunday: { open: '10:00', close: '16:00' }
        };
    }
  }

  // Get default permissions based on role
  private getDefaultPermissions(role: UserRole): string[] {
    switch (role) {
      case 'super_admin':
        return [
          'view_dashboard', 'view_sales', 'create_sales', 'edit_sales', 'delete_sales',
          'view_inventory', 'manage_inventory', 'view_expenses', 'manage_expenses',
          'view_reports', 'generate_reports', 'manage_users', 'manage_outlets',
          'view_analytics', 'manage_settings'
        ];
      case 'outlet_admin':
        return [
          'view_dashboard', 'view_sales', 'create_sales', 'edit_sales', 'delete_sales',
          'view_inventory', 'manage_inventory', 'view_expenses', 'manage_expenses',
          'view_reports', 'generate_reports', 'manage_users', 'view_analytics', 'manage_settings'
        ];
      case 'manager':
        return [
          'view_dashboard', 'view_sales', 'create_sales', 'edit_sales',
          'view_inventory', 'view_expenses', 'manage_expenses',
          'view_reports', 'generate_reports', 'view_analytics'
        ];
      case 'cashier':
        return [
          'view_dashboard', 'view_sales', 'create_sales',
          'view_inventory', 'view_expenses'
        ];
      case 'waiter':
        return [
          'view_dashboard', 'view_sales', 'create_sales'
        ];
      case 'kitchen_staff':
        return [
          'view_dashboard', 'view_inventory'
        ];
      case 'inventory_staff':
        return [
          'view_dashboard', 'view_inventory', 'manage_inventory'
        ];
      case 'accountant':
        return [
          'view_dashboard', 'view_expenses', 'manage_expenses',
          'view_reports', 'generate_reports', 'view_analytics'
        ];
      case 'viewer':
        return [
          'view_dashboard', 'view_reports'
        ];
      default:
        return ['view_dashboard'];
    }
  }
}

export const authService = new AuthService();
