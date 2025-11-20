// Common types used throughout the application

export type Status = 'pending' | 'paid' | 'overdue' | 'cancelled' | 'draft';

export type PaymentStatus = 'pending' | 'partially_paid' | 'paid' | 'needs_clarification' | 'overdue';

export type OCRStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'manual_review';

export type AnomalyType = 'duplicate_payment' | 'price_spike' | 'missing_info' | 'unauthorized_account' | 'supply_gap' | 'eod_mismatch';

export type BusinessType = 'supermarket' | 'restaurant' | 'lounge' | 'retail' | 'cafe';

export type UserRole = 'business_owner' | 'outlet_admin' | 'outlet_staff' | 'super_admin' | 'manager' | 'cashier' | 'waiter' | 'kitchen_staff' | 'inventory_staff' | 'accountant' | 'viewer';

export type OutletStatus = 'active' | 'inactive' | 'maintenance' | 'closed';

export type VendorType = 'supplier' | 'service_provider' | 'contractor';

export type VendorScope = 'global' | 'outlet_specific';

export type ExpenseCategory = 'outlet_operational' | 'corporate_shared';

export type InvoiceApprovalStatus = 'pending_approval' | 'approved' | 'paid' | 'rejected';

export type Permission = 
  | 'view_dashboard'
  | 'view_sales'
  | 'create_sales'
  | 'edit_sales'
  | 'delete_sales'
  | 'view_inventory'
  | 'manage_inventory'
  | 'view_expenses'
  | 'manage_expenses'
  | 'view_reports'
  | 'generate_reports'
  | 'manage_users'
  | 'manage_outlets'
  | 'view_analytics'
  | 'manage_settings'
  | 'view_all_outlets'
  | 'create_global_vendors'
  | 'approve_vendor_invoices'
  | 'view_consolidated_reports'
  | 'process_payments';

export interface Outlet {
  id: string;
  name: string;
  businessType: BusinessType;
  status: OutletStatus;
  address: Address;
  phone: string;
  email: string;
  openingHours: OpeningHours;
  taxRate: number;
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface OpeningHours {
  monday: { open: string; close: string; isOpen: boolean };
  tuesday: { open: string; close: string; isOpen: boolean };
  wednesday: { open: string; close: string; isOpen: boolean };
  thursday: { open: string; close: string; isOpen: boolean };
  friday: { open: string; close: string; isOpen: boolean };
  saturday: { open: string; close: string; isOpen: boolean };
  sunday: { open: string; close: string; isOpen: boolean };
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: UserRole;
  avatar?: string;
  outletId: string;
  permissions: Permission[];
  isActive: boolean;
  lastLogin?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Role {
  id: string;
  name: string;
  description: string;
  permissions: Permission[];
  businessType: BusinessType[];
  createdAt: string;
  updatedAt: string;
}

export interface VendorInvoice {
  id: string;
  invoiceNumber: string;
  outletId: string;
  vendorId: string;
  vendor: Vendor;
  amount: number;
  dueDate: string;
  status: InvoiceApprovalStatus;
  items: VendorInvoiceItem[];
  attachments: string[];
  description?: string;
  notes?: string;
  createdBy: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface VendorInvoiceItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  category: ExpenseCategory;
}

export interface Invoice {
  id: string;
  invoiceNumber: string;
  outletId: string;
  customer: Customer;
  issueDate: string;
  dueDate: string;
  items: InvoiceItem[];
  status: Status;
  notes?: string;
  taxRate: number;
  subtotal: number;
  taxAmount: number;
  total: number;
  paymentMethod: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface InvoiceItem {
  id: string;
  productId: string;
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface Customer {
  id: string;
  outletId: string;
  name: string;
  email: string;
  phone?: string;
  address?: Address;
  customerType: 'regular' | 'vip' | 'wholesale';
  loyaltyPoints?: number;
  totalSpent: number;
  lastVisit?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  outletId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  paymentTerms?: string;
  contactPerson?: string;
  vendorType: VendorType;
  scope: VendorScope;
  outlets: string[];
  creditLimit?: number;
  currentBalance: number;
  defaultPaymentTerms?: number;
  taxId?: string;
  preferredCategories?: ExpenseCategory[];
  createdBy: 'owner' | 'outlet_manager';
  createdAt: string;
  updatedAt: string;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

export interface Product {
  id: string;
  outletId: string;
  name: string;
  description?: string;
  sku: string;
  barcode?: string;
  category: string;
  subcategory?: string;
  unitPrice: number;
  costPrice: number;
  stockQuantity: number;
  minStockLevel: number;
  maxStockLevel: number;
  unit: string;
  isActive: boolean;
  image?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Category {
  id: string;
  outletId: string;
  name: string;
  description?: string;
  parentCategoryId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Expense {
  id: string;
  outletId: string;
  date: string;
  amount: number;
  category: ExpenseCategory;
  subcategory?: string;
  description: string;
  vendor: Vendor | null;
  receipt?: string;  // URL to receipt image
  paymentMethod: string;
  approvedBy?: string;
  status: 'pending' | 'approved' | 'rejected';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface DailyReport {
  id: string;
  outlet_id: string;
  date: string;
  opening_balance: number;
  closing_balance: number;
  total_sales: number;
  total_expenses: number;
  cash_in_hand: number;
  bank_deposit: number;
  notes?: string;
  created_by: string;
  approved_by?: string;
  status: 'draft' | 'submitted' | 'approved' | 'rejected';
  created_at: string;
  updated_at: string;
}

export interface SalesTransaction {
  id: string;
  outletId: string;
  transactionNumber: string;
  customerId?: string;
  items: SalesItem[];
  subtotal: number;
  taxAmount: number;
  discountAmount: number;
  total: number;
  paymentMethod: string;
  cashierId: string;
  status: 'completed' | 'refunded' | 'cancelled';
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SalesItem {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  total: number;
}

export interface InventoryTransaction {
  id: string;
  outletId: string;
  productId: string;
  type: 'in' | 'out' | 'adjustment' | 'transfer';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason: string;
  reference?: string;
  performedBy: string;
  createdAt: string;
}

export interface AuditEntry {
  id: string;
  outletId: string;
  userId: string;
  userName: string;
  action: string;
  entityType: 'invoice' | 'expense' | 'customer' | 'vendor' | 'report' | 'user' | 'product' | 'inventory' | 'sales';
  entityId: string;
  details: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: string;
}

export interface BusinessSettings {
  id: string;
  outletId: string;
  businessName: string;
  businessType: BusinessType;
  taxNumber?: string;
  logo?: string;
  theme: 'light' | 'dark' | 'auto';
  language: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  currency: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
}

export interface Vendor {
  id: string;
  outletId: string;
  name: string;
  email?: string;
  phone?: string;
  address?: Address;
  paymentTerms?: string;
  contactPerson?: string;
  vendorType: VendorType;
  creditLimit?: number;
  currentBalance: number;
  createdAt: string;
  updatedAt: string;
}

// Enhanced types for Floww features

export interface Payment {
  id: string;
  invoiceId: string;
  vendorId: string;
  outletId: string;
  amount: number;
  status: PaymentStatus;
  paymentMethod?: string;
  bankReference?: string;
  paymentReceiptUrl?: string;
  paidBy?: string;
  paidAt?: string;
  confirmedBy?: string;
  confirmedAt?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface EnhancedVendor extends Vendor {
  accountName?: string;
  accountNumber?: string;
  bankName?: string;
  totalPaid: number;
  totalOutstanding: number;
  rating?: number;
  lastPaymentDate?: string;
}

export interface EnhancedInvoice extends Invoice {
  vendorId?: string;
  vendorPhone?: string;
  vendorAccountNumber?: string;
  vendorBankName?: string;
  description?: string;
  fileUrl?: string;
  originalFileUrl?: string;
  ocrStatus: OCRStatus;
  ocrData?: OCRExtractedData;
  ocrConfidence?: number;
  requiresReview: boolean;
  approvalStatus: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface OCRExtractedData {
  vendorName?: string;
  vendorPhone?: string;
  amount?: number;
  description?: string;
  date?: string;
  accountNumber?: string;
  bankName?: string;
  invoiceNumber?: string;
  lineItems?: Array<{
    description: string;
    quantity?: number;
    unitPrice?: number;
    total?: number;
  }>;
}

export interface Anomaly {
  id: string;
  outletId: string;
  type: AnomalyType;
  relatedEntity: string;
  relatedId: string;
  description: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  detectedAt: string;
  resolved: boolean;
  resolvedBy?: string;
  resolvedAt?: string;
  resolutionNotes?: string;
  aiConfidence?: number;
  createdAt: string;
}

export interface PriceBenchmark {
  id: string;
  outletId: string;
  vendorId?: string;
  itemName: string;
  category?: string;
  price: number;
  unit?: string;
  date: string;
  source: 'invoice' | 'market_data' | 'manual';
  qualityGrade?: string;
  createdAt: string;
}

export interface EnhancedDailyReport extends DailyReport {
  sales_cash: number;
  sales_transfer: number;
  sales_pos: number;
  expenses: number;
  total_sales: number;
  images?: string[];
  discrepancies?: Record<string, any>;
  aiReconciliationNotes?: string;
}

export interface UserInvitation {
  id: string;
  outletId: string;
  email: string;
  name: string;
  role: UserRole;
  invitedBy: string;
  status: 'pending' | 'accepted' | 'expired' | 'cancelled';
  expiresAt: string;
  acceptedAt?: string;
  acceptedBy?: string;
  createdAt: string;
}

export interface ApprovalWorkflow {
  id: string;
  outletId: string;
  entityType: 'invoice' | 'expense' | 'payment';
  entityId: string;
  workflowStep: number;
  approverRole: UserRole;
  assignedTo?: string;
  status: 'pending' | 'approved' | 'rejected' | 'escalated';
  comments?: string;
  approvedBy?: string;
  approvedAt?: string;
  createdAt: string;
  updatedAt: string;
}

// Multi-Store Architecture Interfaces

export interface DashboardView {
  scope: 'all' | 'outlet_specific';
  selectedOutlets: string[];
  dateRange: DateRange;
}

export interface DateRange {
  startDate: string;
  endDate: string;
}

export interface DashboardMetrics {
  totalRevenue: number;
  pendingInvoices: {
    count: number;
    totalAmount: number;
    byOutlet: Record<string, number>;
  };
  totalExpenses: number;
  expensesByCategory: Record<ExpenseCategory, number>;
  expensesByOutlet: Record<string, number>;
  netProfit: number;
  profitMargin: number;
}

export interface UserPermissions {
  role: UserRole;
  outlets: string[];
  permissions: {
    viewAllOutlets: boolean;
    createGlobalVendors: boolean;
    createOutletVendors: boolean;
    createVendorInvoices: boolean;
    approveVendorInvoices: boolean;
    viewAllPendingInvoices: boolean;
    viewConsolidatedReports: boolean;
    processPayments: boolean;
    manageOutletSettings: boolean;
  };
}

// Subscription Plan Types
export type SubscriptionPlan = 'free' | 'startup' | 'business' | 'enterprise';

export interface SubscriptionFeatures {
  maxOutlets: number;
  corePos: boolean;
  basicInventory: boolean;
  standardReporting: boolean;
  emailSupport: boolean;
  mobileApp: boolean;
  basicPayments: boolean;
  multiLocationManagement: boolean;
  advancedAnalytics: boolean;
  staffManagement: boolean;
  inventorySync: boolean;
  prioritySupport: boolean;
  loyaltyPrograms: boolean;
  advancedPayments: boolean;
  apiAccess: boolean;
  customBranding: boolean;
  dedicatedAccountManager: boolean;
  advancedSecurity: boolean;
  customReports: boolean;
  phoneSupport: boolean;
  priorityFeatures: boolean;
}

export interface Subscription {
  id: string;
  userId: string;
  plan: SubscriptionPlan;
  status: 'active' | 'inactive' | 'cancelled' | 'past_due' | 'trialing';
  stripeSubscriptionId?: string;
  stripePriceId?: string;
  currentPeriodStart: string;
  currentPeriodEnd: string;
  features: SubscriptionFeatures;
  outlets: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PlanConfig {
  name: string;
  description: string;
  features: SubscriptionFeatures;
  pricing: {
    monthly: {
      USD: number;
      EUR: number;
      GBP: number;
    };
  };
  stripePriceIds: {
    monthly: {
      USD: string;
      EUR: string;
      GBP: string;
    };
  };
}