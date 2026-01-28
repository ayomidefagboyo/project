import { supabase } from './supabase';

export interface User {
  id: string;
  email: string;
  name: string;
  company_name?: string;
  business_type?: string;
  created_at: string;
}

export interface SignupData {
  email: string;
  password: string;
  name: string;
  companyName?: string;
  businessType?: string;
}

export interface AuthResponse {
  user: User | null;
  error: string | null;
  session_token?: string;
}

class CustomAuthService {
  private generateToken(): string {
    return Math.random().toString(36).substr(2) + Date.now().toString(36);
  }

  private hashPassword(password: string): string {
    // Simple hash for demo - in production use proper bcrypt
    return btoa(password + 'salt_key_2025');
  }

  async signup(data: SignupData): Promise<AuthResponse> {
    try {
      // Check if user already exists
      const { data: existingUser } = await supabase
        .from('users')
        .select('email')
        .eq('email', data.email)
        .single();

      if (existingUser) {
        return { user: null, error: 'User with this email already exists' };
      }

      // Create user directly in users table
      const userId = crypto.randomUUID();
      const hashedPassword = this.hashPassword(data.password);

      const { data: newUser, error } = await supabase
        .from('users')
        .insert([{
          id: userId,
          email: data.email,
          name: data.name,
          company_name: data.companyName,
          business_type: data.businessType,
          password_hash: hashedPassword,
          created_at: new Date().toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Signup error:', error);
        return { user: null, error: 'Failed to create account' };
      }

      // Generate session token
      const sessionToken = this.generateToken();

      // Store session
      localStorage.setItem('auth_token', sessionToken);
      localStorage.setItem('user_data', JSON.stringify(newUser));

      return {
        user: newUser,
        error: null,
        session_token: sessionToken
      };
    } catch (error) {
      console.error('Signup error:', error);
      return { user: null, error: 'Failed to create account' };
    }
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    try {
      const hashedPassword = this.hashPassword(password);

      const { data: user, error } = await supabase
        .from('users')
        .select('*')
        .eq('email', email)
        .eq('password_hash', hashedPassword)
        .single();

      if (error || !user) {
        return { user: null, error: 'Invalid email or password' };
      }

      // Generate session token
      const sessionToken = this.generateToken();

      // Store session
      localStorage.setItem('auth_token', sessionToken);
      localStorage.setItem('user_data', JSON.stringify(user));

      return {
        user,
        error: null,
        session_token: sessionToken
      };
    } catch (error) {
      console.error('Login error:', error);
      return { user: null, error: 'Login failed' };
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem('auth_token');
    localStorage.removeItem('user_data');
  }

  getCurrentUser(): User | null {
    try {
      const userData = localStorage.getItem('user_data');
      const token = localStorage.getItem('auth_token');

      if (!userData || !token) return null;

      return JSON.parse(userData);
    } catch {
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!this.getCurrentUser();
  }

  getAuthToken(): string | null {
    return localStorage.getItem('auth_token');
  }
}

export const customAuth = new CustomAuthService();