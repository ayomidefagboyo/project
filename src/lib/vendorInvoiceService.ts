import { VendorInvoice, VendorInvoiceItem, InvoiceApprovalStatus, UserRole, Vendor } from '@/types';
import { dataService } from './services';

export interface CreateVendorInvoiceData {
  vendorId: string;
  amount: number;
  dueDate: string;
  items: Omit<VendorInvoiceItem, 'id'>[];
  description?: string;
  notes?: string;
  attachments?: string[];
}

export interface VendorInvoiceFilters {
  status?: InvoiceApprovalStatus;
  vendorId?: string;
  outletId?: string;
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

export class VendorInvoiceService {
  // Create vendor invoice (by outlet manager)
  async createVendorInvoice(
    data: CreateVendorInvoiceData, 
    outletId: string, 
    createdBy: string
  ): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      // Validate vendor exists and is accessible for this outlet
      const { data: vendor, error: vendorError } = await this.getVendorForOutlet(data.vendorId, outletId);
      if (vendorError || !vendor) {
        return { data: null, error: vendorError || 'Vendor not found' };
      }

      // Generate invoice number
      const invoiceNumber = await this.generateInvoiceNumber(outletId);

      const invoice: Omit<VendorInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
        invoiceNumber,
        outletId,
        vendorId: data.vendorId,
        vendor,
        amount: data.amount,
        dueDate: data.dueDate,
        status: 'pending_approval',
        items: data.items.map((item, index) => ({
          ...item,
          id: `${invoiceNumber}_item_${index + 1}`
        })),
        attachments: data.attachments || [],
        description: data.description,
        notes: data.notes,
        createdBy
      };

      // Save to database
      return await dataService.createVendorInvoice(invoice);
    } catch (error) {
      console.error('Error creating vendor invoice:', error);
      return { data: null, error: 'Failed to create vendor invoice' };
    }
  }

  // Get vendor invoices with filtering
  async getVendorInvoices(
    outletIds: string[], 
    filters?: VendorInvoiceFilters
  ): Promise<{ data: VendorInvoice[] | null; error: string | null }> {
    try {
      return await dataService.getVendorInvoices(outletIds, filters);
    } catch (error) {
      console.error('Error fetching vendor invoices:', error);
      return { data: null, error: 'Failed to fetch vendor invoices' };
    }
  }

  // Get pending invoices for approval (business owner view)
  async getPendingInvoicesForApproval(
    outletIds: string[]
  ): Promise<{ data: VendorInvoice[] | null; error: string | null }> {
    return this.getVendorInvoices(outletIds, { status: 'pending_approval' });
  }

  // Approve vendor invoice (by business owner)
  async approveVendorInvoice(
    invoiceId: string, 
    approvedBy: string, 
    notes?: string
  ): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      const updateData = {
        status: 'approved' as InvoiceApprovalStatus,
        approvedBy,
        approvedAt: new Date().toISOString(),
        notes: notes || ''
      };

      return await dataService.updateVendorInvoice(invoiceId, updateData);
    } catch (error) {
      console.error('Error approving vendor invoice:', error);
      return { data: null, error: 'Failed to approve vendor invoice' };
    }
  }

  // Reject vendor invoice (by business owner)
  async rejectVendorInvoice(
    invoiceId: string, 
    rejectedBy: string, 
    reason: string
  ): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      const updateData = {
        status: 'rejected' as InvoiceApprovalStatus,
        approvedBy: rejectedBy,
        approvedAt: new Date().toISOString(),
        notes: reason
      };

      return await dataService.updateVendorInvoice(invoiceId, updateData);
    } catch (error) {
      console.error('Error rejecting vendor invoice:', error);
      return { data: null, error: 'Failed to reject vendor invoice' };
    }
  }

  // Mark invoice as paid (by business owner)
  async markInvoiceAsPaid(
    invoiceId: string, 
    paidBy: string, 
    paymentReference?: string
  ): Promise<{ data: VendorInvoice | null; error: string | null }> {
    try {
      const updateData = {
        status: 'paid' as InvoiceApprovalStatus,
        notes: paymentReference ? `Payment Reference: ${paymentReference}` : ''
      };

      return await dataService.updateVendorInvoice(invoiceId, updateData);
    } catch (error) {
      console.error('Error marking invoice as paid:', error);
      return { data: null, error: 'Failed to mark invoice as paid' };
    }
  }

  // Get vendors available for an outlet (global + outlet-specific)
  async getAvailableVendors(outletId: string): Promise<{ data: Vendor[] | null; error: string | null }> {
    try {
      return await dataService.getVendorsForOutlet(outletId);
    } catch (error) {
      console.error('Error fetching available vendors:', error);
      return { data: null, error: 'Failed to fetch available vendors' };
    }
  }

  // Get specific vendor for outlet validation
  private async getVendorForOutlet(vendorId: string, outletId: string): Promise<{ data: Vendor | null; error: string | null }> {
    try {
      return await dataService.getVendorForOutlet(vendorId, outletId);
    } catch (error) {
      console.error('Error fetching vendor for outlet:', error);
      return { data: null, error: 'Vendor not accessible for this outlet' };
    }
  }

  // Generate unique invoice number
  private async generateInvoiceNumber(outletId: string): Promise<string> {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    // Get outlet prefix (first 3 letters of outlet name or ID)
    const outletPrefix = outletId.substring(0, 3).toUpperCase();
    
    // Generate sequential number (this would typically come from database)
    const sequence = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    
    return `INV-${outletPrefix}-${year}${month}${day}-${sequence}`;
  }

  // Get dashboard metrics for vendor invoices
  async getDashboardMetrics(outletIds: string[]): Promise<{
    pendingInvoices: { count: number; totalAmount: number; byOutlet: Record<string, number> };
    totalExpenses: number;
    expensesByOutlet: Record<string, number>;
  }> {
    try {
      const { data: invoices } = await this.getVendorInvoices(outletIds);
      
      if (!invoices) {
        return {
          pendingInvoices: { count: 0, totalAmount: 0, byOutlet: {} },
          totalExpenses: 0,
          expensesByOutlet: {}
        };
      }

      const pendingInvoices = invoices.filter(inv => inv.status === 'pending_approval');
      const paidInvoices = invoices.filter(inv => inv.status === 'paid');

      const pendingByOutlet: Record<string, number> = {};
      const expensesByOutlet: Record<string, number> = {};

      // Calculate pending invoices by outlet
      pendingInvoices.forEach(invoice => {
        pendingByOutlet[invoice.outletId] = (pendingByOutlet[invoice.outletId] || 0) + invoice.amount;
      });

      // Calculate expenses by outlet
      paidInvoices.forEach(invoice => {
        expensesByOutlet[invoice.outletId] = (expensesByOutlet[invoice.outletId] || 0) + invoice.amount;
      });

      return {
        pendingInvoices: {
          count: pendingInvoices.length,
          totalAmount: pendingInvoices.reduce((sum, inv) => sum + inv.amount, 0),
          byOutlet: pendingByOutlet
        },
        totalExpenses: paidInvoices.reduce((sum, inv) => sum + inv.amount, 0),
        expensesByOutlet
      };
    } catch (error) {
      console.error('Error calculating dashboard metrics:', error);
      return {
        pendingInvoices: { count: 0, totalAmount: 0, byOutlet: {} },
        totalExpenses: 0,
        expensesByOutlet: {}
      };
    }
  }
}

export const vendorInvoiceService = new VendorInvoiceService();