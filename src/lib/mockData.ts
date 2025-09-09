import { Invoice, Customer, Vendor, Expense, DailyReport, AuditEntry } from '@/types';
import { generateInvoiceNumber } from '@/lib/utils';

// Mock Customers
export const customers: Customer[] = [
  {
    id: '1',
    name: 'Acme Corporation',
    email: 'billing@acme.com',
    phone: '(555) 123-4567',
    address: {
      street: '123 Business Ave',
      city: 'Enterprise',
      state: 'CA',
      zip: '90210',
      country: 'USA'
    },
    createdAt: '2023-01-15T08:30:00Z'
  },
  {
    id: '2',
    name: 'TechNova Solutions',
    email: 'accounts@technova.io',
    phone: '(555) 987-6543',
    address: {
      street: '456 Tech Boulevard',
      city: 'Innovation',
      state: 'NY',
      zip: '10001',
      country: 'USA'
    },
    createdAt: '2023-02-20T10:15:00Z'
  },
  {
    id: '3',
    name: 'Global Retail Partners',
    email: 'finance@globalretail.com',
    phone: '(555) 456-7890',
    address: {
      street: '789 Market Street',
      city: 'Commerce',
      state: 'TX',
      zip: '75001',
      country: 'USA'
    },
    createdAt: '2023-03-10T14:45:00Z'
  }
];

// Mock Vendors
export const vendors: Vendor[] = [
  {
    id: '1',
    name: 'Office Supplies Plus',
    email: 'orders@officesuppliesplus.com',
    phone: '(555) 222-3333',
    address: {
      street: '101 Supply Road',
      city: 'Warehouse',
      state: 'IL',
      zip: '60007',
      country: 'USA'
    },
    paymentTerms: 'Net 30',
    contactPerson: 'John Supplier',
    createdAt: '2023-01-10T09:00:00Z'
  },
  {
    id: '2',
    name: 'Tech Hardware Inc',
    email: 'sales@techhardware.com',
    phone: '(555) 444-5555',
    address: {
      street: '202 Hardware Blvd',
      city: 'Techville',
      state: 'CA',
      zip: '94103',
      country: 'USA'
    },
    paymentTerms: 'Net 15',
    contactPerson: 'Sarah Tech',
    createdAt: '2023-02-05T11:30:00Z'
  },
  {
    id: '3',
    name: 'Marketing Experts Co',
    email: 'billing@marketingexperts.com',
    phone: '(555) 666-7777',
    address: {
      street: '303 Ad Avenue',
      city: 'Mediatown',
      state: 'NY',
      zip: '10018',
      country: 'USA'
    },
    paymentTerms: 'Net 45',
    contactPerson: 'Mike Marketing',
    createdAt: '2023-03-01T13:45:00Z'
  }
];

// Mock Invoices
export const invoices: Invoice[] = [
  {
    id: '1',
    invoiceNumber: generateInvoiceNumber(),
    customer: customers[0],
    issueDate: '2023-04-01T10:00:00Z',
    dueDate: '2023-05-01T10:00:00Z',
    items: [
      {
        id: '1',
        description: 'Web Development Services',
        quantity: 40,
        unitPrice: 75
      },
      {
        id: '2',
        description: 'UI/UX Design',
        quantity: 20,
        unitPrice: 85
      }
    ],
    status: 'pending',
    notes: 'Please pay within 30 days',
    taxRate: 8.25,
    createdAt: '2023-04-01T10:00:00Z',
    updatedAt: '2023-04-01T10:00:00Z'
  },
  {
    id: '2',
    invoiceNumber: generateInvoiceNumber(),
    customer: customers[1],
    issueDate: '2023-03-15T09:30:00Z',
    dueDate: '2023-04-15T09:30:00Z',
    items: [
      {
        id: '1',
        description: 'Server Maintenance (Monthly)',
        quantity: 1,
        unitPrice: 1200
      }
    ],
    status: 'paid',
    taxRate: 8.25,
    createdAt: '2023-03-15T09:30:00Z',
    updatedAt: '2023-03-20T14:15:00Z'
  },
  {
    id: '3',
    invoiceNumber: generateInvoiceNumber(),
    customer: customers[2],
    issueDate: '2023-02-28T15:45:00Z',
    dueDate: '2023-03-28T15:45:00Z',
    items: [
      {
        id: '1',
        description: 'Marketing Consultation',
        quantity: 10,
        unitPrice: 150
      },
      {
        id: '2',
        description: 'Social Media Campaign',
        quantity: 1,
        unitPrice: 2500
      }
    ],
    status: 'overdue',
    notes: 'Second reminder sent on April 10th',
    taxRate: 8.25,
    createdAt: '2023-02-28T15:45:00Z',
    updatedAt: '2023-04-10T11:20:00Z'
  },
  {
    id: '4',
    invoiceNumber: generateInvoiceNumber(),
    customer: customers[0],
    issueDate: '2023-04-10T13:15:00Z',
    dueDate: '2023-05-10T13:15:00Z',
    items: [
      {
        id: '1',
        description: 'System Integration Services',
        quantity: 35,
        unitPrice: 95
      }
    ],
    status: 'draft',
    taxRate: 8.25,
    createdAt: '2023-04-10T13:15:00Z',
    updatedAt: '2023-04-10T13:15:00Z'
  }
];

// Mock Expenses
export const expenses: Expense[] = [
  {
    id: '1',
    date: '2023-04-05T12:30:00Z',
    amount: 250.75,
    category: 'Office Supplies',
    description: 'Monthly stationery and supplies',
    vendor: vendors[0],
    paymentMethod: 'Credit Card',
    createdAt: '2023-04-05T12:35:00Z',
    updatedAt: '2023-04-05T12:35:00Z'
  },
  {
    id: '2',
    date: '2023-04-02T09:15:00Z',
    amount: 1895.00,
    category: 'Equipment',
    description: 'New laptop for design team',
    vendor: vendors[1],
    receipt: 'https://example.com/receipts/laptop.pdf',
    paymentMethod: 'Bank Transfer',
    createdAt: '2023-04-02T10:00:00Z',
    updatedAt: '2023-04-02T10:00:00Z'
  },
  {
    id: '3',
    date: '2023-04-08T15:20:00Z',
    amount: 500.00,
    category: 'Marketing',
    description: 'Facebook ad campaign',
    vendor: vendors[2],
    paymentMethod: 'Credit Card',
    createdAt: '2023-04-08T15:30:00Z',
    updatedAt: '2023-04-08T15:30:00Z'
  },
  {
    id: '4',
    date: '2023-04-10T11:45:00Z',
    amount: 75.25,
    category: 'Utilities',
    description: 'Internet bill for April',
    vendor: null,
    paymentMethod: 'Automatic Debit',
    createdAt: '2023-04-10T12:00:00Z',
    updatedAt: '2023-04-10T12:00:00Z'
  }
];

// Mock Daily Reports
export const dailyReports: DailyReport[] = [
  {
    id: '1',
    date: '2023-04-10T00:00:00Z',
    openingBalance: 12500.75,
    closingBalance: 15320.50,
    totalSales: 4250.00,
    totalExpenses: 1430.25,
    cashInHand: 850.00,
    bankDeposit: 3400.00,
    notes: 'Successful day with high sales volume',
    createdBy: 'Jane Manager',
    createdAt: '2023-04-10T21:15:00Z',
    updatedAt: '2023-04-10T21:15:00Z'
  },
  {
    id: '2',
    date: '2023-04-09T00:00:00Z',
    openingBalance: 10800.25,
    closingBalance: 12500.75,
    totalSales: 2500.50,
    totalExpenses: 800.00,
    cashInHand: 700.50,
    bankDeposit: 1800.00,
    notes: 'Standard Sunday operations',
    createdBy: 'Jane Manager',
    createdAt: '2023-04-09T20:30:00Z',
    updatedAt: '2023-04-09T20:30:00Z'
  },
  {
    id: '3',
    date: '2023-04-08T00:00:00Z',
    openingBalance: 8750.50,
    closingBalance: 10800.25,
    totalSales: 3500.75,
    totalExpenses: 1450.00,
    cashInHand: 950.25,
    bankDeposit: 2550.50,
    notes: 'Busy Saturday with promotion event',
    createdBy: 'John Admin',
    createdAt: '2023-04-08T22:00:00Z',
    updatedAt: '2023-04-08T22:00:00Z'
  }
];

// Mock Audit Entries
export const auditEntries: AuditEntry[] = [
  {
    id: '1',
    userId: 'user1',
    userName: 'John Admin',
    action: 'create',
    entityType: 'invoice',
    entityId: '1',
    details: 'Created new invoice INV-230401-001 for Acme Corporation',
    timestamp: '2023-04-01T10:05:00Z'
  },
  {
    id: '2',
    userId: 'user2',
    userName: 'Jane Manager',
    action: 'update',
    entityType: 'invoice',
    entityId: '2',
    details: 'Updated status from pending to paid for invoice INV-230315-002',
    timestamp: '2023-03-20T14:20:00Z'
  },
  {
    id: '3',
    userId: 'user1',
    userName: 'John Admin',
    action: 'create',
    entityType: 'expense',
    entityId: '2',
    details: 'Recorded expense of $1,895.00 for new laptop equipment',
    timestamp: '2023-04-02T10:05:00Z'
  },
  {
    id: '4',
    userId: 'user2',
    userName: 'Jane Manager',
    action: 'create',
    entityType: 'report',
    entityId: '1',
    details: 'Created daily report for April 10, 2023',
    timestamp: '2023-04-10T21:20:00Z'
  }
];