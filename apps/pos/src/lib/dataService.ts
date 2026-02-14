import { supabase, TABLES } from './supabase';
import type {
  Outlet,
  User,
  Invoice,
  Expense,
  DailyReport,
  Vendor,
  Customer,
  AuditEntry,
  BusinessSettings,

  VendorInvoice
} from '@/types';
import { apiClient } from './apiClient';
import { DataServiceBase } from '../../../../shared/services/dataServiceBase';

export class DataService extends DataServiceBase {
  constructor() {
    super(supabase);
  }

  // Outlet operations with subscription gating
  async createOutlet(outlet: Partial<Outlet>, userId?: string): Promise<{ data: Outlet | null; error: string | null }> {
    if (userId) {
      // Logic for user-associated outlet creation can be added here if needed
      // ensuring standard limits are respected without gatedApiCalls dependency
    }
    return this.create<Outlet>(TABLES.OUTLETS, outlet);
  }

  async getOutlet(id: string): Promise<{ data: Outlet | null; error: string | null }> {
    return this.read<Outlet>(TABLES.OUTLETS, id);
  }

  async updateOutlet(id: string, outlet: Partial<Outlet>): Promise<{ data: Outlet | null; error: string | null }> {
    return this.update<Outlet>(TABLES.OUTLETS, id, outlet);
  }

  async deleteOutlet(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.OUTLETS, id);
  }

  async listOutlets(): Promise<{ data: Outlet[] | null; error: string | null }> {
    return this.list<Outlet>(TABLES.OUTLETS);
  }

  async getUserOutlets(userId: string): Promise<{ data: Outlet[] | null; error: string | null }> {
    try {
      // Prefer backend outlet visibility logic (avoids frontend RLS drift).
      const backendResponse = await apiClient.get<Outlet[]>('/outlets');
      if (!backendResponse.error && Array.isArray(backendResponse.data)) {
        return { data: backendResponse.data, error: null };
      }

      // Get user's outlet access
      const { data: user, error: userError } = await supabase
        .from(TABLES.USERS)
        .select('outlet_id, role')
        .eq('id', userId)
        .maybeSingle();

      if (userError) throw userError;
      if (!user) return { data: [], error: null };

      if (
        user.role === 'super_admin' ||
        user.role === 'business_owner' ||
        user.role === 'outlet_admin' ||
        user.role === 'manager'
      ) {
        // Manager-level roles can see all outlets for terminal setup and outlet switching
        return this.listOutlets();
      } else {
        // Regular users can only see their assigned outlet
        return this.list<Outlet>(TABLES.OUTLETS, { id: user.outlet_id });
      }
    } catch (error) {
      console.error('Get user outlets error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get user outlets'
      };
    }
  }

  // User operations
  async createUser(user: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    return this.create<User>(TABLES.USERS, user);
  }

  async getUser(id: string): Promise<{ data: User | null; error: string | null }> {
    return this.read<User>(TABLES.USERS, id);
  }

  async updateUser(id: string, user: Partial<User>): Promise<{ data: User | null; error: string | null }> {
    return this.update<User>(TABLES.USERS, id, user);
  }

  async deleteUser(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.USERS, id);
  }

  async listUsers(outletId?: string): Promise<{ data: User[] | null; error: string | null }> {
    const filters = outletId ? { outlet_id: outletId } : undefined;
    return this.list<User>(TABLES.USERS, filters);
  }

  // Invoice operations
  async createInvoice(invoice: Partial<Invoice>): Promise<{ data: Invoice | null; error: string | null }> {
    return this.create<Invoice>(TABLES.INVOICES, invoice);
  }

  async getInvoice(id: string): Promise<{ data: Invoice | null; error: string | null }> {
    return this.read<Invoice>(TABLES.INVOICES, id);
  }

  async updateInvoice(id: string, invoice: Partial<Invoice>): Promise<{ data: Invoice | null; error: string | null }> {
    return this.update<Invoice>(TABLES.INVOICES, id, invoice);
  }

  async deleteInvoice(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.INVOICES, id);
  }

  async listInvoices(outletId: string): Promise<{ data: Invoice[] | null; error: string | null }> {
    return this.list<Invoice>(TABLES.INVOICES, { outlet_id: outletId });
  }

  // Expense operations
  async createExpense(expense: Partial<Expense>): Promise<{ data: Expense | null; error: string | null }> {
    return this.create<Expense>(TABLES.EXPENSES, expense);
  }

  async getExpense(id: string): Promise<{ data: Expense | null; error: string | null }> {
    return this.read<Expense>(TABLES.EXPENSES, id);
  }

  async updateExpense(id: string, expense: Partial<Expense>): Promise<{ data: Expense | null; error: string | null }> {
    return this.update<Expense>(TABLES.EXPENSES, id, expense);
  }

  async deleteExpense(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.EXPENSES, id);
  }

  async listExpenses(outletId: string): Promise<{ data: Expense[] | null; error: string | null }> {
    return this.list<Expense>(TABLES.EXPENSES, { outlet_id: outletId });
  }

  // Daily Report operations
  async createDailyReport(report: Partial<DailyReport>): Promise<{ data: DailyReport | null; error: string | null }> {
    return this.create<DailyReport>(TABLES.DAILY_REPORTS, report);
  }

  async getDailyReport(id: string): Promise<{ data: DailyReport | null; error: string | null }> {
    return this.read<DailyReport>(TABLES.DAILY_REPORTS, id);
  }

  async updateDailyReport(id: string, report: Partial<DailyReport>): Promise<{ data: DailyReport | null; error: string | null }> {
    return this.update<DailyReport>(TABLES.DAILY_REPORTS, id, report);
  }

  async deleteDailyReport(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.DAILY_REPORTS, id);
  }

  async listDailyReports(outletId: string): Promise<{ data: DailyReport[] | null; error: string | null }> {
    return this.list<DailyReport>(TABLES.DAILY_REPORTS, { outlet_id: outletId });
  }

  // Vendor operations
  async createVendor(vendorData: Partial<Vendor>, outletId: string): Promise<{ data: Vendor | null; error: string | null }> {
    const vendor = { ...vendorData, outlet_id: outletId };
    return this.create<Vendor>(TABLES.VENDORS, vendor);
  }

  async getVendor(id: string): Promise<{ data: Vendor | null; error: string | null }> {
    return this.read<Vendor>(TABLES.VENDORS, id);
  }

  async updateVendor(vendorData: Partial<Vendor>): Promise<{ data: Vendor | null; error: string | null }> {
    const { id, ...updateData } = vendorData as any;
    if (!id) {
      return {
        data: null,
        error: 'Vendor ID is required for update'
      };
    }
    return this.update<Vendor>(TABLES.VENDORS, id, updateData);
  }

  async deleteVendor(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.VENDORS, id);
  }

  async getVendors(outletId: string): Promise<{ data: Vendor[] | null; error: string | null }> {
    return this.list<Vendor>(TABLES.VENDORS, { outlet_id: outletId });
  }

  async listVendors(_outletId: string): Promise<{ data: Vendor[] | null; error: string | null }> {
    // Gated API calls removed for POS
    return { data: null, error: 'Not supported in POS' };
  }

  // Get vendors available for a specific outlet (global + outlet-specific)
  async getVendorsForOutlet(outletId: string): Promise<{ data: Vendor[] | null; error: string | null }> {
    try {
      // First try to get vendors with scope column
      let { data, error } = await supabase
        .from(TABLES.VENDORS)
        .select('*')
        .or(`outlet_id.eq.${outletId},scope.eq.global`);

      // If scope column doesn't exist, fall back to just outlet-specific vendors
      if (error && error.message?.includes('column "scope"')) {
        console.warn('Scope column not found, falling back to outlet-specific vendors only');
        const fallbackResult = await supabase
          .from(TABLES.VENDORS)
          .select('*')
          .eq('outlet_id', outletId);

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      return { data: data as Vendor[], error: null };
    } catch (error) {
      console.error('Get vendors for outlet error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get vendors for outlet'
      };
    }
  }

  // Get vendors for multiple outlets (global + outlet-specific for each)
  async getVendorsForMultipleOutlets(outletIds: string[]): Promise<{ data: Vendor[] | null; error: string | null }> {
    try {
      const outletFilter = outletIds.map(id => `outlet_id.eq.${id}`).join(',');

      // First try with scope column
      let { data, error } = await supabase
        .from(TABLES.VENDORS)
        .select('*')
        .or(`${outletFilter},scope.eq.global`);

      // If scope column doesn't exist, fall back to just outlet-specific vendors
      if (error && error.message?.includes('column "scope"')) {
        console.warn('Scope column not found, falling back to outlet-specific vendors only');
        const fallbackResult = await supabase
          .from(TABLES.VENDORS)
          .select('*')
          .in('outlet_id', outletIds);

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      return { data: data as Vendor[], error: null };
    } catch (error) {
      console.error('Get vendors for multiple outlets error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get vendors for multiple outlets'
      };
    }
  }

  // Get specific vendor for outlet validation
  async getVendorForOutlet(vendorId: string, outletId: string): Promise<{ data: Vendor | null; error: string | null }> {
    try {
      // First try with scope column
      let { data, error } = await supabase
        .from(TABLES.VENDORS)
        .select('*')
        .eq('id', vendorId)
        .or(`outlet_id.eq.${outletId},scope.eq.global`)
        .single();

      // If scope column doesn't exist, fall back to checking outlet match
      if (error && error.message?.includes('column "scope"')) {
        console.warn('Scope column not found, checking vendor outlet match only');
        const fallbackResult = await supabase
          .from(TABLES.VENDORS)
          .select('*')
          .eq('id', vendorId)
          .eq('outlet_id', outletId)
          .single();

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      return { data: data as Vendor, error: null };
    } catch (error) {
      console.error('Get vendor for outlet error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get vendor for outlet'
      };
    }
  }

  // Search vendors
  async searchVendors(outletId: string, query: string): Promise<{ data: Vendor[] | null; error: string | null }> {
    try {
      // First try with scope column
      let { data, error } = await supabase
        .from(TABLES.VENDORS)
        .select('*')
        .or(`outlet_id.eq.${outletId},scope.eq.global`)
        .or(`name.ilike.%${query}%,email.ilike.%${query}%,contact_person.ilike.%${query}%`);

      // If scope column doesn't exist, fall back to outlet-specific search
      if (error && error.message?.includes('column "scope"')) {
        console.warn('Scope column not found, searching outlet-specific vendors only');
        const fallbackResult = await supabase
          .from(TABLES.VENDORS)
          .select('*')
          .eq('outlet_id', outletId)
          .or(`name.ilike.%${query}%,email.ilike.%${query}%,contact_person.ilike.%${query}%`);

        data = fallbackResult.data;
        error = fallbackResult.error;
      }

      if (error) throw error;
      return { data: data as Vendor[], error: null };
    } catch (error) {
      console.error('Search vendors error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search vendors'
      };
    }
  }

  // Customer operations
  async createCustomer(customer: Partial<Customer>): Promise<{ data: Customer | null; error: string | null }> {
    return this.create<Customer>(TABLES.CUSTOMERS, customer);
  }

  async getCustomer(id: string): Promise<{ data: Customer | null; error: string | null }> {
    return this.read<Customer>(TABLES.CUSTOMERS, id);
  }

  async updateCustomer(id: string, customer: Partial<Customer>): Promise<{ data: Customer | null; error: string | null }> {
    return this.update<Customer>(TABLES.CUSTOMERS, id, customer);
  }

  async deleteCustomer(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.CUSTOMERS, id);
  }

  async listCustomers(outletId: string): Promise<{ data: Customer[] | null; error: string | null }> {
    return this.list<Customer>(TABLES.CUSTOMERS, { outlet_id: outletId });
  }

  // Audit operations
  async createAuditEntry(entry: Partial<AuditEntry>): Promise<{ data: AuditEntry | null; error: string | null }> {
    return this.create<AuditEntry>(TABLES.AUDIT_ENTRIES, entry);
  }

  async listAuditEntries(outletId: string): Promise<{ data: AuditEntry[] | null; error: string | null }> {
    return this.list<AuditEntry>(TABLES.AUDIT_ENTRIES, { outlet_id: outletId });
  }

  // Business Settings operations
  async getBusinessSettings(outletId: string): Promise<{ data: BusinessSettings | null; error: string | null }> {
    try {
      // Check if outletId is provided
      if (!outletId) {
        return { data: null, error: null };
      }

      const { data, error } = await supabase
        .from(TABLES.BUSINESS_SETTINGS)
        .select('*')
        .eq('outlet_id', outletId)
        .maybeSingle();

      if (error) throw error;
      return { data: data as BusinessSettings, error: null };
    } catch (error) {
      console.error('Get business settings error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get business settings'
      };
    }
  }

  async updateBusinessSettings(outletId: string, settings: Partial<BusinessSettings>): Promise<{ data: BusinessSettings | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.BUSINESS_SETTINGS)
        .upsert({ ...settings, outlet_id: outletId })
        .select()
        .single();

      if (error) throw error;
      return { data: data as BusinessSettings, error: null };
    } catch (error) {
      console.error('Update business settings error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update business settings'
      };
    }
  }

  // Search functionality
  async searchInvoices(outletId: string, query: string): Promise<{ data: Invoice[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.INVOICES)
        .select('*')
        .eq('outlet_id', outletId)
        .or(`invoice_number.ilike.%${query}%,customer->>name.ilike.%${query}%`);

      if (error) throw error;
      return { data: data as Invoice[], error: null };
    } catch (error) {
      console.error('Search invoices error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search invoices'
      };
    }
  }

  async searchExpenses(outletId: string, query: string): Promise<{ data: Expense[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.EXPENSES)
        .select('*')
        .eq('outlet_id', outletId)
        .or(`description.ilike.%${query}%,category.ilike.%${query}%`);

      if (error) throw error;
      return { data: data as Expense[], error: null };
    } catch (error) {
      console.error('Search expenses error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to search expenses'
      };
    }
  }

  // Vendor Invoice operations
  async createVendorInvoice(invoice: Partial<VendorInvoice>): Promise<{ data: VendorInvoice | null; error: string | null }> {
    return this.create<VendorInvoice>(TABLES.VENDOR_INVOICES, invoice);
  }

  async getVendorInvoice(id: string): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.VENDOR_INVOICES)
        .select(`
          *,
          vendor:vendors(*)
        `)
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data: data as VendorInvoice, error: null };
    } catch (error) {
      console.error('Get vendor invoice error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get vendor invoice'
      };
    }
  }

  async updateVendorInvoice(id: string, invoice: Partial<VendorInvoice>): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from(TABLES.VENDOR_INVOICES)
        .update(invoice)
        .eq('id', id)
        .select(`
          *,
          vendor:vendors(*)
        `)
        .single();

      if (error) throw error;
      return { data: data as VendorInvoice, error: null };
    } catch (error) {
      console.error('Update vendor invoice error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to update vendor invoice'
      };
    }
  }

  async deleteVendorInvoice(id: string): Promise<{ error: string | null }> {
    return this.delete(TABLES.VENDOR_INVOICES, id);
  }

  async getVendorInvoices(outletIds: string[], filters?: any): Promise<{ data: VendorInvoice[] | null; error: string | null }> {
    try {
      let query = supabase
        .from(TABLES.VENDOR_INVOICES)
        .select(`
          *,
          vendor:vendors(*)
        `)
        .in('outlet_id', outletIds);

      // Apply filters if provided
      if (filters) {
        if (filters.status) {
          query = query.eq('status', filters.status);
        }
        if (filters.vendorId) {
          query = query.eq('vendor_id', filters.vendorId);
        }
        if (filters.outletId) {
          query = query.eq('outlet_id', filters.outletId);
        }
        if (filters.dateRange) {
          query = query
            .gte('created_at', filters.dateRange.startDate)
            .lte('created_at', filters.dateRange.endDate);
        }
      }

      // Order by created date (newest first)
      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return { data: data as VendorInvoice[], error: null };
    } catch (error) {
      console.error('Get vendor invoices error:', error);
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Failed to get vendor invoices'
      };
    }
  }
}

export const dataService = new DataService();
