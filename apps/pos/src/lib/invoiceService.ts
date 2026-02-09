/**
 * Invoice Service for POS — Vendor Invoices / Receive Items
 * Talks to the backend /invoices endpoints
 */

import { apiClient } from './apiClient';
import logger from './logger';

export interface InvoiceItem {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  total?: number;
  product_id?: string | null;
  sku?: string;
  barcode?: string;
  category?: string;
}

export interface Invoice {
  id: string;
  outlet_id: string;
  invoice_number: string;
  vendor_id?: string;
  customer_id?: string;
  issue_date: string;
  due_date: string;
  status: string;
  notes?: string;
  tax_rate: number;
  subtotal: number;
  tax_amount: number;
  total: number;
  payment_method?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  invoice_items?: InvoiceItem[];
  vendors?: any;
}

export interface CreateInvoiceData {
  outlet_id: string;
  vendor_id?: string;
  invoice_number?: string;
  invoice_type?: string;
  issue_date?: string;
  due_date?: string;
  notes?: string;
  tax_rate?: number;
  items: InvoiceItem[];
}

export interface ReceiveGoodsResponse {
  message: string;
  invoice_id: string;
  invoice_number: string;
  products_created: Array<{
    product_id: string;
    name: string;
    quantity: number;
    cost_price: number;
    selling_price: number;
  }>;
  products_updated: Array<{
    product_id: string;
    name: string;
    quantity_added: number;
    new_total: number;
  }>;
  stock_movements_count: number;
}

class InvoiceService {
  private baseUrl = '/invoices';

  /** Get invoices for an outlet */
  async getInvoices(outletId: string, options: {
    invoiceType?: string;
    status?: string;
    page?: number;
    size?: number;
  } = {}): Promise<{ items: Invoice[]; total: number }> {
    try {
      const params = new URLSearchParams({ outlet_id: outletId });
      if (options.invoiceType) params.append('invoice_type', options.invoiceType);
      if (options.status) params.append('status', options.status);
      if (options.page) params.append('page', String(options.page));
      if (options.size) params.append('size', String(options.size));

      const response = await apiClient.get<any>(`${this.baseUrl}?${params}`);
      if (response.error) throw new Error(response.error);
      return response.data || { items: [], total: 0 };
    } catch (error) {
      logger.error('Error fetching invoices:', error);
      return { items: [], total: 0 };
    }
  }

  /** Get a single invoice */
  async getInvoice(invoiceId: string): Promise<Invoice | null> {
    try {
      const response = await apiClient.get<Invoice>(`${this.baseUrl}/${invoiceId}`);
      if (response.error) throw new Error(response.error);
      return response.data;
    } catch (error) {
      logger.error('Error fetching invoice:', error);
      return null;
    }
  }

  /** Create a vendor invoice */
  async createInvoice(data: CreateInvoiceData): Promise<Invoice> {
    const response = await apiClient.post<Invoice>(this.baseUrl, data);
    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to create invoice');
    }
    return response.data;
  }

  /** Update invoice status */
  async updateInvoice(invoiceId: string, data: Partial<Invoice>): Promise<Invoice> {
    const response = await apiClient.put<Invoice>(`${this.baseUrl}/${invoiceId}`, data);
    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to update invoice');
    }
    return response.data;
  }

  /** Delete a draft invoice */
  async deleteInvoice(invoiceId: string): Promise<void> {
    const response = await apiClient.delete(`${this.baseUrl}/${invoiceId}`);
    if (response.error) throw new Error(response.error);
  }

  /** 
   * Receive goods from a vendor invoice → auto-adds items to inventory/products 
   * - Existing products: updates stock quantity + cost price
   * - New items: creates new products with 30% default markup
   */
  async receiveGoods(invoiceId: string, options: {
    addToInventory?: boolean;
    updateCostPrices?: boolean;
  } = {}): Promise<ReceiveGoodsResponse> {
    const response = await apiClient.post<ReceiveGoodsResponse>(
      `${this.baseUrl}/${invoiceId}/receive`,
      {
        add_to_inventory: options.addToInventory ?? true,
        update_cost_prices: options.updateCostPrices ?? true,
      }
    );
    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to receive goods');
    }
    return response.data;
  }

  /** Add an item to an existing invoice */
  async addItem(invoiceId: string, item: InvoiceItem): Promise<Invoice> {
    const response = await apiClient.post<Invoice>(`${this.baseUrl}/${invoiceId}/items`, item);
    if (response.error || !response.data) {
      throw new Error(response.error || 'Failed to add item');
    }
    return response.data;
  }

  /** Remove an item from an invoice */
  async removeItem(invoiceId: string, itemId: string): Promise<void> {
    const response = await apiClient.delete(`${this.baseUrl}/${invoiceId}/items/${itemId}`);
    if (response.error) throw new Error(response.error);
  }

  /** Get invoice stats for an outlet */
  async getStats(outletId: string): Promise<any> {
    try {
      const response = await apiClient.get<any>(`${this.baseUrl}/stats/summary?outlet_id=${outletId}`);
      return response.data || {};
    } catch (error) {
      logger.error('Error fetching invoice stats:', error);
      return {};
    }
  }
}

export const invoiceService = new InvoiceService();
