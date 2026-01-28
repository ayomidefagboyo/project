import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
});

// Database table names
export const TABLES = {
  OUTLETS: 'outlets',
  USERS: 'users',
  INVOICES: 'invoices',
  INVOICE_ITEMS: 'invoice_items',
  EXPENSES: 'expenses',
  DAILY_REPORTS: 'daily_reports',
  VENDORS: 'vendors',
  VENDOR_INVOICES: 'vendor_invoices',
  CUSTOMERS: 'customers',
  AUDIT_ENTRIES: 'audit_entries',
  BUSINESS_SETTINGS: 'business_settings',
  SUBSCRIPTIONS: 'subscriptions'
} as const;

// RLS (Row Level Security) policies will be set up in Supabase dashboard
export const POLICIES = {
  // Users can only access data from their assigned outlets
  OUTLET_ACCESS: 'outlet_access_policy',
  // Super admins can access all data
  SUPER_ADMIN: 'super_admin_policy',
  // Users can only modify their own profile
  USER_PROFILE: 'user_profile_policy'
} as const;

