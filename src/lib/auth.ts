import { supabase } from './supabase';
import { LoginCredentials, OwnerSignupCredentials, AuthResponse, User, Outlet, Permission, UserInvitation, AuthUser } from '@/types';

export interface InviteCredentials {
  email: string;
  password: string;
  inviteId: string;
}

class AuthService {
  constructor() {
    // No need for ApiClient in auth service
  }

  // Common default permissions for roles
  getDefaultPermissions(role: string): Permission[] {
    switch (role) {
      case 'outlet_admin':
        return [
          'view_dashboard',
          'manage_invoices',
          'manage_expenses',
          'view_reports',
          'manage_vendors',
          'approve_invoices',
          'view_analytics',
          'manage_staff',
          'view_audit_trail'
        ] as Permission[];
      case 'staff':
        return [
          'view_dashboard',
          'create_invoices',
          'create_expenses',
          'view_reports'
        ] as Permission[];
      case 'business_owner':
        return [
          'view_dashboard',
          'manage_invoices',
          'manage_expenses',
          'view_reports',
          'manage_vendors',
          'approve_invoices',
          'view_analytics',
          'manage_staff',
          'view_audit_trail',
          'view_all_outlets',
          'create_global_vendors',
          'approve_vendor_invoices',
          'view_consolidated_reports'
        ] as Permission[];
      case 'super_admin':
        return [
          'view_dashboard',
          'manage_invoices',
          'manage_expenses',
          'view_reports',
          'manage_vendors',
          'approve_invoices',
          'view_analytics',
          'manage_staff',
          'view_audit_trail',
          'view_all_outlets',
          'create_global_vendors',
          'approve_vendor_invoices',
          'view_consolidated_reports',
          'manage_system'
        ] as Permission[];
      default:
        return [];
    }
  }

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
        // Create outlet first
        const outletData = {
          name: credentials.companyName,
          business_type: credentials.businessType,
          status: 'active',
          address: {
            street: credentials.address.street,
            city: credentials.address.city,
            state: credentials.address.state,
            zip: credentials.address.zip,
            country: credentials.address.country || 'USA',
          },
          phone: credentials.phone,
          email: credentials.email,
          opening_hours: this.getDefaultOpeningHours(credentials.businessType),
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
            business_type: credentials.businessType,
            default_currency: 'USD',
            default_tax_rate: 8.25,
            fiscal_year_end: '12-31',
            accounting_method: 'accrual',
            invoice_numbering: 'auto',
            expense_approval_required: false,
            multi_location_enabled: false,
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

        // In a real app, you would send an email here
        const inviteLink = `${import.meta.env.VITE_APP_URL}/invite/${inviteRecord.id}`;
        console.log('Team member invitation created:', {
          email: inviteData.email,
          inviteLink,
          outlet: outlet?.name,
          inviter: inviter?.name
        });

        return { data: inviteRecord, error: null };
      } catch (emailError) {
        console.error('Error sending invitation email:', emailError);
        // Don't fail the invitation creation if email fails
        return { data: inviteRecord, error: null };
      }
    } catch (error) {
      console.error('Invite team member error:', error);
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
          .eq('id', inviteId);

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
      console.error('Signup from invite error:', error);
      return {
        user: null,
        error: error instanceof Error ? error.message : 'Signup from invitation failed'
      };
    }
  }

  // Sign in with Google OAuth
  async signInWithGoogle(): Promise<AuthResponse> {
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
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

        if (profileError) {
          // If user doesn't exist in users table (OAuth user), create profile
          if (profileError.details === 'The result contains 0 rows') {
            console.log('Creating profile for OAuth user during sign in:', data.user.id);

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
              console.error('Outlet creation error during OAuth:', outletError);
              throw outletError;
            }

            // Create business settings
            const { error: settingsError } = await supabase
              .from('business_settings')
              .insert({
                outlet_id: outlet.id,
                business_name: `${fullName}'s Business`,
                business_type: 'retail',
                default_currency: 'USD',
                default_tax_rate: 8.25,
                fiscal_year_end: '12-31',
                accounting_method: 'accrual',
                invoice_numbering: 'auto',
                expense_approval_required: false,
                multi_location_enabled: false,
              });

            if (settingsError) {
              console.error('Business settings creation error during OAuth:', settingsError);
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
              console.error('User profile creation error during OAuth:', createError);
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
      console.error('Reset password error:', error);
      return { error: error instanceof Error ? error.message : 'Reset password failed' };
    }
  }

  // Get current session
  async getCurrentSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      return { session, error: error ? error.message : null };
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
          .maybeSingle();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
          throw profileError;
        }

        // If user doesn't exist in users table (OAuth signup), create profile
        if (!profile) {
            console.log('Creating profile for OAuth user:', user.id);

            // Extract name from user metadata (Google OAuth)
            const fullName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || '';

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
              email: user.email!,
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
              console.error('Outlet creation error during getCurrentUser:', outletError);
              throw outletError;
            }

            // Create business settings
            const { error: settingsError } = await supabase
              .from('business_settings')
              .insert({
                outlet_id: outlet.id,
                business_name: `${fullName}'s Business`,
                business_type: 'retail',
                default_currency: 'USD',
                default_tax_rate: 8.25,
                fiscal_year_end: '12-31',
                accounting_method: 'accrual',
                invoice_numbering: 'auto',
                expense_approval_required: false,
                multi_location_enabled: false,
              });

            if (settingsError) {
              console.error('Business settings creation error during getCurrentUser:', settingsError);
              throw settingsError;
            }

            // Create user profile
            const { data: newProfile, error: createError } = await supabase
              .from('users')
              .insert({
                id: user.id,
                email: user.email!,
                name: fullName,
                role: 'business_owner',
                outlet_id: outlet.id,
                permissions: this.getDefaultPermissions('business_owner'),
                is_active: true,
              })
              .select()
              .single();

            if (createError) {
              console.error('User profile creation error during getCurrentUser:', createError);
              throw createError;
            }

            const authUser: AuthUser = {
              id: user.id,
              email: user.email!,
              name: fullName,
              role: 'business_owner',
              outletId: newProfile.outlet_id,
              permissions: newProfile.permissions || [],
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

  // Reset password with token
  async updatePassword(password: string): Promise<{ error: string | null }> {
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      return { error: null };
    } catch (error) {
      console.error('Update password error:', error);
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
      console.error('Update user profile error:', error);
      return { error: error instanceof Error ? error.message : 'Profile update failed' };
    }
  }

  // Helper method to get default opening hours based on business type
  private getDefaultOpeningHours(businessType: string) {
    const defaultHours = {
      monday: { open: '09:00', close: '17:00', closed: false },
      tuesday: { open: '09:00', close: '17:00', closed: false },
      wednesday: { open: '09:00', close: '17:00', closed: false },
      thursday: { open: '09:00', close: '17:00', closed: false },
      friday: { open: '09:00', close: '17:00', closed: false },
      saturday: { open: '10:00', close: '16:00', closed: false },
      sunday: { open: '10:00', close: '16:00', closed: true },
    };

    switch (businessType) {
      case 'restaurant':
        return {
          monday: { open: '11:00', close: '22:00', closed: false },
          tuesday: { open: '11:00', close: '22:00', closed: false },
          wednesday: { open: '11:00', close: '22:00', closed: false },
          thursday: { open: '11:00', close: '22:00', closed: false },
          friday: { open: '11:00', close: '23:00', closed: false },
          saturday: { open: '11:00', close: '23:00', closed: false },
          sunday: { open: '11:00', close: '21:00', closed: false },
        };
      case 'lounge':
        return {
          monday: { open: '17:00', close: '02:00', closed: true },
          tuesday: { open: '17:00', close: '02:00', closed: true },
          wednesday: { open: '17:00', close: '02:00', closed: false },
          thursday: { open: '17:00', close: '02:00', closed: false },
          friday: { open: '17:00', close: '03:00', closed: false },
          saturday: { open: '17:00', close: '03:00', closed: false },
          sunday: { open: '17:00', close: '02:00', closed: false },
        };
      case 'cafe':
        return {
          monday: { open: '07:00', close: '19:00', closed: false },
          tuesday: { open: '07:00', close: '19:00', closed: false },
          wednesday: { open: '07:00', close: '19:00', closed: false },
          thursday: { open: '07:00', close: '19:00', closed: false },
          friday: { open: '07:00', close: '20:00', closed: false },
          saturday: { open: '08:00', close: '20:00', closed: false },
          sunday: { open: '08:00', close: '18:00', closed: false },
        };
      case 'supermarket':
        return {
          monday: { open: '06:00', close: '22:00', closed: false },
          tuesday: { open: '06:00', close: '22:00', closed: false },
          wednesday: { open: '06:00', close: '22:00', closed: false },
          thursday: { open: '06:00', close: '22:00', closed: false },
          friday: { open: '06:00', close: '22:00', closed: false },
          saturday: { open: '06:00', close: '22:00', closed: false },
          sunday: { open: '08:00', close: '20:00', closed: false },
        };
      default:
        return defaultHours;
    }
  }

  // Handle OAuth callback
  async handleOAuthCallback(): Promise<{ data: any; error: string | null }> {
    try {
      const { data, error } = await supabase.auth.getSession();

      if (error) {
        console.error('OAuth session error:', error);
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
      console.error('Error handling OAuth callback:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'OAuth callback failed'
      };
    }
  }
}

export const authService = new AuthService();
export * from '@/types';