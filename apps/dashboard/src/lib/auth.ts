import { supabase } from './supabase';
import logger from './logger';
import type { LoginCredentials, AuthResponse, Permission, UserInvitation, AuthUser } from '@/types';
import { getDefaultOpeningHours, getDefaultPermissions as getSharedDefaultPermissions } from '../../../../shared/services/authShared';

// Minimal signup - name, email, password + optional company
export interface OwnerSignupCredentials {
  name: string;
  email: string;
  password: string;
  companyName?: string; // Optional
}

export interface InviteCredentials {
  email: string;
  password: string;
  inviteId: string;
  name?: string;
}

class AuthService {
  constructor() {
    // No need for ApiClient in auth service
  }

  // Common default permissions for roles
  getDefaultPermissions(role: string): Permission[] {
    return getSharedDefaultPermissions(role) as Permission[];
  }

  // Company owner signup - creates outlet and owner account
  async signUpOwner(credentials: OwnerSignupCredentials): Promise<AuthResponse> {
    try {
      // Safe logging - no sensitive data
      if (import.meta.env.VITE_DEBUG === 'true') {
        logger.log('Starting owner signup process');
      }

      // Create auth user with minimal metadata
      const { data, error } = await supabase.auth.signUp({
        email: credentials.email,
        password: credentials.password,
        options: {
          data: {
            name: credentials.name,
            company_name: credentials.companyName || '' // Optional company name
          }
        }
      });

      if (error) {
        logger.error('Supabase auth signup error:', error);
        throw error;
      }

      logger.log('Auth user created successfully:', data.user?.id);

      if (data.user) {
        // The database trigger will automatically create:
        // 1. users table entry (minimal auth user)

        // Give the trigger a moment to complete
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Get the created user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          logger.error('Error fetching created profile:', profileError);
          throw profileError;
        }

        logger.log('Profile created by trigger:', profile);

        const authUser: AuthUser = {
          id: data.user.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
          outletId: null, // No outlet - they'll set up business later
          permissions: this.getDefaultPermissions('business_owner'),
          isOwner: true,
        };

        logger.log('User signup completed successfully:', authUser);
        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user data received' };
    } catch (error) {
      logger.error('Owner signup error details:', error);
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Owner signup failed'
      };
    }
  }

  // Invite team member to company
  async inviteTeamMember(outletId: string, invitedByUserId: string, inviteData: {
    email: string;
    role: 'outlet_admin' | 'staff';
    permissions: Permission[];
  }): Promise<{ data: UserInvitation | null; error: string | null }> {
    try {
      // Create invitation record
      const invitation = {
        email: inviteData.email,
        role: inviteData.role,
        permissions: inviteData.permissions,
        outlet_id: outletId,
        invited_by: invitedByUserId,
        status: 'pending',
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days
      };

      const { data: inviteRecord, error: inviteError } = await supabase
        .from('user_invitations')
        .insert(invitation)
        .select()
        .single();

      if (inviteError) throw inviteError;

      // Send invitation email
      try {
        // Get outlet details for the email
        const { data: outlet, error: outletError } = await supabase
          .from('outlets')
          .select('name')
          .eq('id', outletId)
          .single();

        if (outletError) {
          logger.warn('Could not fetch outlet details for email:', outletError);
        }

        // Get inviter details
        const { data: inviter, error: inviterError } = await supabase
          .from('users')
          .select('name')
          .eq('id', invitedByUserId)
          .single();

        if (inviterError) {
          logger.warn('Could not fetch inviter details for email:', inviterError);
        }

        // In a real app, you would send an email here
        const inviteLink = `${import.meta.env.VITE_APP_URL}/invite/${inviteRecord.id}`;
        logger.log('Team member invitation created:', {
          email: inviteData.email,
          inviteLink,
          outlet: outlet?.name,
          inviter: inviter?.name
        });

        return { data: inviteRecord, error: null };
      } catch (emailError) {
        logger.error('Error sending invitation email:', emailError);
        // Don't fail the invitation creation if email fails
        return { data: inviteRecord, error: null };
      }
    } catch (error) {
      logger.error('Invite team member error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to create invitation'
      };
    }
  }

  // Complete team member signup from invitation
  async signUpFromInvite(credentials: InviteCredentials): Promise<AuthResponse> {
    try {
      // Get invitation details
      const { data: invite, error: inviteError } = await supabase
        .from('user_invitations')
        .select('*')
        .eq('id', credentials.inviteId)
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
        password: credentials.password,
      });

      if (error) throw error;

      if (data.user) {
        // Create user profile with invited role and permissions
        const { error: profileError } = await supabase
          .from('users')
          .insert({
            id: data.user.id,
            email: invite.email,
            name: credentials.name || invite.email.split('@')[0],
            role: invite.role,
            outlet_id: invite.outlet_id,
            permissions: invite.permissions,
            is_active: true,
          });

        if (profileError) throw profileError;

        // Mark invitation as accepted
        await supabase
          .from('user_invitations')
          .update({ status: 'accepted' })
          .eq('id', credentials.inviteId);

        const authUser: AuthUser = {
          id: data.user.id,
          email: invite.email,
          name: credentials.name || invite.email.split('@')[0],
          role: invite.role,
          outletId: invite.outlet_id,
          permissions: invite.permissions,
          isOwner: invite.role === 'outlet_admin',
        };

        return { user: authUser, error: null };
      }

      return { user: null, error: 'No user data received' };
    } catch (error) {
      logger.error('Signup from invite error:', error);
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Signup from invitation failed'
      };
    }
  }

  // Sign in with Google OAuth
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${import.meta.env.VITE_APP_URL}/dashboard`
        }
      });

      if (error) throw error;

      // Note: With OAuth, the user will be redirected and we'll handle the callback
      // This method initiates the OAuth flow
      return { user: null, error: null };
    } catch (error) {
      logger.error('Google sign-in error:', error);
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

        if (profileError) {
          // If user doesn't exist in users table (OAuth user), create profile
          if (profileError.details === 'The result contains 0 rows') {
            logger.log('Creating profile for OAuth user during sign in:', data.user.id);

            // Extract name from user metadata (Google OAuth)
            const fullName = data.user.user_metadata?.full_name || data.user.user_metadata?.name || data.user.email?.split('@')[0] || '';

            // For OAuth users signing up independently, create them as business owners
            // Create outlet first
            const outletData = {
              name: `${fullName}'s Business`,
              business_type: 'retail',
              status: 'active',
              address: {
                street: '',
                city: '',
                state: '',
                zip: '',
                country: 'USA',
              },
              phone: '',
              email: data.user.email!,
              opening_hours: this.getDefaultOpeningHours('retail'),
              tax_rate: 8.25,
              currency: 'USD',
              timezone: 'America/New_York',
            };

            const { data: outlet, error: outletError } = await supabase
              .from('outlets')
              .insert(outletData)
              .select()
              .single();

            if (outletError) {
              logger.error('Outlet creation error during OAuth:', outletError);
              throw outletError;
            }

            // Create business settings with all required fields
            const { error: settingsError } = await supabase
              .from('business_settings')
              .insert({
                outlet_id: outlet.id,
                business_name: `${fullName}'s Business`,
                business_type: 'retail',
                theme: 'light',
                language: 'en',
                date_format: 'MM/DD/YYYY',
                time_format: '12h',
                currency: 'USD',
                timezone: 'America/New_York'
              });

            if (settingsError) {
              logger.error('Business settings creation error during OAuth:', settingsError);
              throw settingsError;
            }

            // Create user profile
            const { data: newProfile, error: createError } = await supabase
              .from('users')
              .insert({
                id: data.user.id,
                email: data.user.email!,
                name: fullName,
                role: 'business_owner',
                outlet_id: outlet.id,
                permissions: this.getDefaultPermissions('business_owner'),
                is_active: true,
              })
              .select()
              .single();

            if (createError) {
              logger.error('User profile creation error during OAuth:', createError);
              throw createError;
            }

            const authUser: AuthUser = {
              id: data.user.id,
              email: data.user.email!,
              name: fullName,
              role: 'business_owner',
              outletId: newProfile.outlet_id,
              permissions: newProfile.permissions || [],
              isOwner: true,
            };

            return { user: authUser, error: null };
          }

          throw profileError;
        }

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
      logger.error('Sign in error:', error);
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
      logger.error('Sign out error:', error);
      return { error: error instanceof Error ? error.message : 'Sign out failed' };
    }
  }

  // Reset password
  async resetPassword(email: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${import.meta.env.VITE_APP_URL}/reset-password`,
      });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error('Reset password error:', error);
      return { error: error instanceof Error ? error.message : 'Reset password failed' };
    }
  }

  // Get current session
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();

      // If there's an invalid refresh token error, clear the session
      if (error && error.message.includes('Invalid Refresh Token')) {
        logger.warn('Invalid refresh token detected, clearing session');
        await supabase.auth.signOut();
        return { session: null, error: null }; // Return null instead of error to allow fresh login
      }

      return { session, error: error ? error.message : null };
    } catch (error) {
      logger.error('Get session error:', error);

      // Handle refresh token errors
      if (error instanceof Error && error.message.includes('Invalid Refresh Token')) {
        logger.warn('Invalid refresh token in catch block, clearing session');
        await supabase.auth.signOut();
        return { session: null, error: null };
      }

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

      // Handle refresh token errors
      if (error && error.message.includes('Invalid Refresh Token')) {
        logger.warn('Invalid refresh token in getCurrentUser, clearing session');
        await supabase.auth.signOut();
        return { user: null, error: null };
      }

      if (error) throw error;

      if (user) {
        // Get user profile
        const { data: profile, error: profileError } = await supabase
          .from('users')
          .select('*')
          .eq('id', user.id)
          .maybeSingle();

        if (profileError) {
          logger.error('Error fetching user profile:', profileError);
          throw profileError;
        }

        // If user doesn't exist in users table (OAuth signup), return minimal user info
        // Profile will be created during onboarding flow
        if (!profile) {
          logger.log('No profile found for OAuth user:', user.id, '- user needs onboarding');

          // Extract name from user metadata (Google OAuth)
          const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '';

          // Return minimal user info - they'll complete profile during onboarding
          const authUser: AuthUser = {
            id: user.id,
            email: user.email!,
            name: fullName,
            role: 'business_owner',
            outletId: null, // No outlet - user will go through trial onboarding
            permissions: this.getDefaultPermissions('business_owner'),
            isOwner: true,
          };

          return { user: authUser, error: null };
        }

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
      logger.error('Get current user error:', error);

      // Handle refresh token errors in catch block
      if (error instanceof Error && error.message.includes('Invalid Refresh Token')) {
        logger.warn('Invalid refresh token in catch, clearing session');
        await supabase.auth.signOut();
        return { user: null, error: null };
      }

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
      logger.error('Get user outlets error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get user outlets'
      };
    }
  }

  // Reset password with token
  async updatePassword(password: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error('Update password error:', error);
      return { error: error instanceof Error ? error.message : 'Password update failed' };
    }
  }

  // Update user profile
  async updateUserProfile(updates: Partial<AuthUser>): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase
        .from('users')
        .update(updates)
        .eq('id', updates.id);

      if (error) throw error;
      return { error: null };
    } catch (error) {
      logger.error('Update user profile error:', error);
      return { error: error instanceof Error ? error.message : 'Profile update failed' };
    }
  }

  // Helper method to get default opening hours based on business type
  private getDefaultOpeningHours(businessType: string) {
    return getDefaultOpeningHours(businessType);
  }

  // Create user profile for OAuth users during onboarding
  async createUserProfile(userData: {
    name: string;
    role: 'outlet_admin' | 'business_owner';
    outletId: string;
  }): Promise<{ error: string | null }> {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return { error: 'Not authenticated' };
      }

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .insert({
          id: user.id,
          email: user.email!,
          name: userData.name,
          role: userData.role,
          outlet_id: userData.outletId,
          permissions: this.getDefaultPermissions(userData.role),
          is_active: true,
        });

      if (profileError) {
        logger.error('User profile creation error:', profileError);
        return { error: profileError.message };
      }

      return { error: null };
    } catch (error) {
      logger.error('Error creating user profile:', error);
      return {
        error: error instanceof Error ? error.message : 'Failed to create user profile'
      };
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(): Promise<{ data: any; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        logger.error('OAuth session error:', error);
        return { data: null, error: error.message };
      }

      if (data.session) {
        // Clean the URL hash
        if (window.location.hash) {
          window.history.replaceState(null, '', window.location.pathname);
        }

        return { data: data.session, error: null };
      }

      return { data: null, error: 'No session found' };
    } catch (error) {
      logger.error('Error handling OAuth callback:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'OAuth callback failed'
      };
    }
  }

  // Check if email exists in the system (to determine signin vs signup)
  async checkEmailExists(email: string): Promise<{ exists: boolean; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('id')
        .eq('email', email.toLowerCase())
        .maybeSingle();

      if (error) {
        logger.error('Email check error:', error);
        return { exists: false, error: error.message };
      }

      return { exists: !!data, error: null };
    } catch (error) {
      logger.error('Error checking if email exists:', error);
      return {
        exists: false,
        error: error instanceof Error ? error.message : 'Failed to check email'
      };
    }
  }
}

export const authService = new AuthService();
export * from '@/types';
