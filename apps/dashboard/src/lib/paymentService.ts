import { supabase, TABLES } from './supabase';
import { Payment, PaymentStatus, EnhancedInvoice, EnhancedVendor } from '@/types';

export class PaymentService {
  // Payment CRUD operations
  async createPayment(payment: Partial<Payment>): Promise<{ data: Payment | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .insert(payment)
        .select()
        .single();

      if (error) throw error;
      return { data: data as Payment, error: null };
    } catch (error) {
      console.error('Create payment error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to create payment' 
      };
    }
  }

  async updatePaymentStatus(
    paymentId: string, 
    status: PaymentStatus, 
    updates: Partial<Payment> = {}
  ): Promise<{ data: Payment | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .update({ 
          status, 
          ...updates,
          ...(status === 'paid' && { paid_at: new Date().toISOString() })
        })
        .eq('id', paymentId)
        .select()
        .single();

      if (error) throw error;
      return { data: data as Payment, error: null };
    } catch (error) {
      console.error('Update payment status error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to update payment status' 
      };
    }
  }

  async getPaymentsByInvoice(invoiceId: string): Promise<{ data: Payment[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('invoice_id', invoiceId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data as Payment[], error: null };
    } catch (error) {
      console.error('Get payments by invoice error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get payments' 
      };
    }
  }

  async getPaymentsByVendor(vendorId: string): Promise<{ data: Payment[] | null; error: string | null }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('vendor_id', vendorId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data as Payment[], error: null };
    } catch (error) {
      console.error('Get payments by vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get payments' 
      };
    }
  }

  // Payment Queue Operations
  async getPaymentQueue(outletId: string, filters?: {
    vendorId?: string;
    status?: PaymentStatus;
    dateFrom?: string;
    dateTo?: string;
  }): Promise<{ data: Array<{
    payment: Payment;
    invoice: EnhancedInvoice;
    vendor: EnhancedVendor;
    urgency: 'overdue' | 'due_soon' | 'normal';
    daysUntilDue: number;
  }> | null; error: string | null }> {
    try {
      let query = supabase
        .from('payments')
        .select(`
          *,
          invoices!inner (
            *,
            vendors!inner (*)
          )
        `)
        .eq('outlet_id', outletId)
        .in('status', ['pending', 'partially_paid', 'needs_clarification']);

      // Apply filters
      if (filters?.vendorId) {
        query = query.eq('vendor_id', filters.vendorId);
      }
      if (filters?.status) {
        query = query.eq('status', filters.status);
      }
      if (filters?.dateFrom) {
        query = query.gte('created_at', filters.dateFrom);
      }
      if (filters?.dateTo) {
        query = query.lte('created_at', filters.dateTo);
      }

      const { data, error } = await query.order('created_at', { ascending: true });

      if (error) throw error;

      // Process and add urgency indicators
      const processedData = data.map((item: any) => {
        const dueDate = new Date(item.invoices.due_date);
        const today = new Date();
        const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        let urgency: 'overdue' | 'due_soon' | 'normal' = 'normal';
        if (daysUntilDue < 0) urgency = 'overdue';
        else if (daysUntilDue <= 3) urgency = 'due_soon';

        return {
          payment: item as Payment,
          invoice: item.invoices as EnhancedInvoice,
          vendor: item.invoices.vendors as EnhancedVendor,
          urgency,
          daysUntilDue
        };
      });

      return { data: processedData, error: null };
    } catch (error) {
      console.error('Get payment queue error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get payment queue' 
      };
    }
  }

  // Group payments by vendor for better management
  async getPaymentQueueGroupedByVendor(outletId: string): Promise<{ 
    data: Record<string, {
      vendor: EnhancedVendor;
      payments: Array<{
        payment: Payment;
        invoice: EnhancedInvoice;
        urgency: 'overdue' | 'due_soon' | 'normal';
        daysUntilDue: number;
      }>;
      totalAmount: number;
      overdueAmount: number;
      dueSoonAmount: number;
    }> | null; 
    error: string | null 
  }> {
    try {
      const { data: queueData, error: queueError } = await this.getPaymentQueue(outletId);
      if (queueError || !queueData) {
        return { data: null, error: queueError };
      }

      // Group by vendor
      const groupedData: Record<string, any> = {};
      
      queueData.forEach(item => {
        const vendorId = item.vendor.id;
        
        if (!groupedData[vendorId]) {
          groupedData[vendorId] = {
            vendor: item.vendor,
            payments: [],
            totalAmount: 0,
            overdueAmount: 0,
            dueSoonAmount: 0
          };
        }
        
        groupedData[vendorId].payments.push(item);
        groupedData[vendorId].totalAmount += item.payment.amount;
        
        if (item.urgency === 'overdue') {
          groupedData[vendorId].overdueAmount += item.payment.amount;
        } else if (item.urgency === 'due_soon') {
          groupedData[vendorId].dueSoonAmount += item.payment.amount;
        }
      });

      return { data: groupedData, error: null };
    } catch (error) {
      console.error('Get payment queue grouped by vendor error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get grouped payment queue' 
      };
    }
  }

  // Bulk payment operations
  async markMultiplePaymentsAsPaid(
    paymentIds: string[], 
    paymentDetails: {
      paymentMethod?: string;
      bankReference?: string;
      paymentReceiptUrl?: string;
      paidBy: string;
      notes?: string;
    }
  ): Promise<{ data: Payment[] | null; error: string | null }> {
    try {
      const updates = {
        status: 'paid' as PaymentStatus,
        paid_at: new Date().toISOString(),
        ...paymentDetails
      };

      const { data, error } = await supabase
        .from('payments')
        .update(updates)
        .in('id', paymentIds)
        .select();

      if (error) throw error;
      return { data: data as Payment[], error: null };
    } catch (error) {
      console.error('Bulk mark payments as paid error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to mark payments as paid' 
      };
    }
  }

  // Payment analytics
  async getPaymentAnalytics(outletId: string, dateFrom: string, dateTo: string): Promise<{
    data: {
      totalPaid: number;
      totalPending: number;
      totalOverdue: number;
      paymentsByStatus: Record<PaymentStatus, number>;
      paymentsByVendor: Array<{ vendorName: string; amount: number; count: number }>;
      averagePaymentTime: number; // in days
      paymentTrends: Array<{ date: string; amount: number; count: number }>;
    } | null;
    error: string | null;
  }> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select(`
          *,
          invoices!inner (
            due_date,
            vendors!inner (name)
          )
        `)
        .eq('outlet_id', outletId)
        .gte('created_at', dateFrom)
        .lte('created_at', dateTo);

      if (error) throw error;

      // Calculate analytics
      const analytics = {
        totalPaid: 0,
        totalPending: 0,
        totalOverdue: 0,
        paymentsByStatus: {} as Record<PaymentStatus, number>,
        paymentsByVendor: [] as Array<{ vendorName: string; amount: number; count: number }>,
        averagePaymentTime: 0,
        paymentTrends: [] as Array<{ date: string; amount: number; count: number }>
      };

      const vendorMap: Record<string, { amount: number; count: number }> = {};
      const dateMap: Record<string, { amount: number; count: number }> = {};
      let totalPaymentTime = 0;
      let paidPaymentsCount = 0;

      data.forEach((payment: any) => {
        const amount = payment.amount;
        const status = payment.status as PaymentStatus;
        const vendorName = payment.invoices.vendors.name;
        const paymentDate = new Date(payment.created_at).toDateString();

        // Status totals
        if (status === 'paid') analytics.totalPaid += amount;
        else if (status === 'pending') analytics.totalPending += amount;
        else if (status === 'overdue') analytics.totalOverdue += amount;

        // Status counts
        analytics.paymentsByStatus[status] = (analytics.paymentsByStatus[status] || 0) + amount;

        // Vendor analytics
        if (!vendorMap[vendorName]) {
          vendorMap[vendorName] = { amount: 0, count: 0 };
        }
        vendorMap[vendorName].amount += amount;
        vendorMap[vendorName].count += 1;

        // Date trends
        if (!dateMap[paymentDate]) {
          dateMap[paymentDate] = { amount: 0, count: 0 };
        }
        dateMap[paymentDate].amount += amount;
        dateMap[paymentDate].count += 1;

        // Payment time calculation
        if (status === 'paid' && payment.paid_at) {
          const createdDate = new Date(payment.created_at);
          const paidDate = new Date(payment.paid_at);
          const daysDiff = (paidDate.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
          totalPaymentTime += daysDiff;
          paidPaymentsCount += 1;
        }
      });

      // Convert maps to arrays
      analytics.paymentsByVendor = Object.entries(vendorMap).map(([vendorName, data]) => ({
        vendorName,
        amount: data.amount,
        count: data.count
      }));

      analytics.paymentTrends = Object.entries(dateMap).map(([date, data]) => ({
        date,
        amount: data.amount,
        count: data.count
      }));

      analytics.averagePaymentTime = paidPaymentsCount > 0 ? totalPaymentTime / paidPaymentsCount : 0;

      return { data: analytics, error: null };
    } catch (error) {
      console.error('Get payment analytics error:', error);
      return { 
        data: null, 
        error: error instanceof Error ? error.message : 'Failed to get payment analytics' 
      };
    }
  }
}

export const paymentService = new PaymentService();