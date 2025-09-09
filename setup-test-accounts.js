#!/usr/bin/env node

/**
 * Automated Test Accounts Setup Script
 * 
 * This script helps you set up test accounts for all role levels
 * in your Compass app automatically.
 * 
 * Run with: node setup-test-accounts.js
 */

import { createClient } from '@supabase/supabase-js';
import readline from 'readline';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   VITE_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  console.error('');
  console.error('Please add these to your .env file:');
  console.error('   VITE_SUPABASE_URL=your_supabase_url');
  console.error('   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key');
  process.exit(1);
}

// Create Supabase client with service role key for admin operations
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test account data
const testAccounts = [
  {
    email: 'superadmin@compass.test',
    password: 'SuperAdmin123!',
    name: 'Super Admin',
    role: 'super_admin',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_sales', 'create_sales', 'edit_sales', 'delete_sales',
      'view_inventory', 'manage_inventory', 'view_expenses', 'manage_expenses',
      'view_reports', 'generate_reports', 'manage_users', 'manage_outlets',
      'view_analytics', 'manage_settings'
    ]
  },
  {
    email: 'outletadmin@compass.test',
    password: 'OutletAdmin123!',
    name: 'Outlet Admin',
    role: 'outlet_admin',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_sales', 'create_sales', 'edit_sales', 'delete_sales',
      'view_inventory', 'manage_inventory', 'view_expenses', 'manage_expenses',
      'view_reports', 'generate_reports', 'manage_users', 'view_analytics', 'manage_settings'
    ]
  },
  {
    email: 'manager@compass.test',
    password: 'Manager123!',
    name: 'Manager',
    role: 'manager',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_sales', 'create_sales', 'edit_sales',
      'view_inventory', 'view_expenses', 'manage_expenses',
      'view_reports', 'generate_reports', 'view_analytics'
    ]
  },
  {
    email: 'cashier@compass.test',
    password: 'Cashier123!',
    name: 'Cashier',
    role: 'cashier',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_sales', 'create_sales',
      'view_inventory', 'view_expenses'
    ]
  },
  {
    email: 'waiter@compass.test',
    password: 'Waiter123!',
    name: 'Waiter',
    role: 'waiter',
    outletId: '550e8400-e29b-41d4-a716-446655440002',
    permissions: [
      'view_dashboard', 'view_sales', 'create_sales'
    ]
  },
  {
    email: 'kitchen@compass.test',
    password: 'Kitchen123!',
    name: 'Kitchen Staff',
    role: 'kitchen_staff',
    outletId: '550e8400-e29b-41d4-a716-446655440002',
    permissions: [
      'view_dashboard', 'view_inventory'
    ]
  },
  {
    email: 'inventory@compass.test',
    password: 'Inventory123!',
    name: 'Inventory Staff',
    role: 'inventory_staff',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_inventory', 'manage_inventory'
    ]
  },
  {
    email: 'accountant@compass.test',
    password: 'Accountant123!',
    name: 'Accountant',
    role: 'accountant',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_expenses', 'manage_expenses',
      'view_reports', 'generate_reports', 'view_analytics'
    ]
  },
  {
    email: 'viewer@compass.test',
    password: 'Viewer123!',
    name: 'Viewer',
    role: 'viewer',
    outletId: '550e8400-e29b-41d4-a716-446655440001',
    permissions: [
      'view_dashboard', 'view_reports'
    ]
  }
];

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

function askQuestion(question) {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

async function createTestOutlets() {
  console.log('🏪 Creating test outlets...');
  
  const outlets = [
    {
      id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Compass Main Store',
      business_type: 'retail',
      status: 'active',
      address: {
        street: '123 Business Street',
        city: 'City',
        state: 'State',
        zip: '12345',
        country: 'USA'
      },
      phone: '(555) 123-4567',
      email: 'main@compass.test',
      opening_hours: {
        monday: { open: '09:00', close: '18:00' },
        tuesday: { open: '09:00', close: '18:00' },
        wednesday: { open: '09:00', close: '18:00' },
        thursday: { open: '09:00', close: '18:00' },
        friday: { open: '09:00', close: '18:00' },
        saturday: { open: '10:00', close: '16:00' },
        sunday: { open: '10:00', close: '16:00' }
      },
      tax_rate: 8.25,
      currency: 'USD',
      timezone: 'America/New_York'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Compass Downtown Branch',
      business_type: 'restaurant',
      status: 'active',
      address: {
        street: '456 Commerce Ave',
        city: 'City',
        state: 'State',
        zip: '12345',
        country: 'USA'
      },
      phone: '(555) 987-6543',
      email: 'downtown@compass.test',
      opening_hours: {
        monday: { open: '11:00', close: '22:00' },
        tuesday: { open: '11:00', close: '22:00' },
        wednesday: { open: '11:00', close: '22:00' },
        thursday: { open: '11:00', close: '23:00' },
        friday: { open: '11:00', close: '00:00' },
        saturday: { open: '10:00', close: '00:00' },
        sunday: { open: '10:00', close: '22:00' }
      },
      tax_rate: 8.25,
      currency: 'USD',
      timezone: 'America/New_York'
    }
  ];

  for (const outlet of outlets) {
    try {
      const { data, error } = await supabase
        .from('outlets')
        .upsert(outlet, { onConflict: 'id' });

      if (error) {
        console.log(`⚠️  Outlet ${outlet.name} may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created outlet: ${outlet.name}`);
      }
    } catch (err) {
      console.log(`⚠️  Outlet ${outlet.name} may already exist: ${err.message}`);
    }
  }

  // Create business settings
  const settings = [
    {
      outlet_id: '550e8400-e29b-41d4-a716-446655440001',
      business_name: 'Compass Main Store',
      business_type: 'retail',
      tax_number: 'TAX-001',
      theme: 'auto',
      language: 'en',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      currency: 'USD',
      timezone: 'America/New_York'
    },
    {
      outlet_id: '550e8400-e29b-41d4-a716-446655440002',
      business_name: 'Compass Downtown Branch',
      business_type: 'restaurant',
      tax_number: 'TAX-002',
      theme: 'auto',
      language: 'en',
      date_format: 'MM/DD/YYYY',
      time_format: '12h',
      currency: 'USD',
      timezone: 'America/New_York'
    }
  ];

  for (const setting of settings) {
    try {
      const { error } = await supabase
        .from('business_settings')
        .upsert(setting, { onConflict: 'outlet_id' });

      if (error) {
        console.log(`⚠️  Business settings may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created business settings for outlet`);
      }
    } catch (err) {
      console.log(`⚠️  Business settings may already exist: ${err.message}`);
    }
  }
}

async function createTestUsers() {
  console.log('👥 Creating test users...');
  
  for (const account of testAccounts) {
    try {
      // First, try to create the auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: account.email,
        password: account.password,
        email_confirm: true
      });

      if (authError) {
        console.log(`⚠️  User ${account.email} may already exist: ${authError.message}`);
        // Try to get existing user
        const { data: existingUser } = await supabase.auth.admin.getUserByEmail(account.email);
        if (existingUser.user) {
          console.log(`✅ Found existing user: ${account.email}`);
        }
        continue;
      }

      console.log(`✅ Created auth user: ${account.email}`);

      // Create user profile
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authData.user.id,
          email: account.email,
          name: account.name,
          role: account.role,
          outlet_id: account.outletId,
          permissions: account.permissions,
          is_active: true
        }, { onConflict: 'id' });

      if (profileError) {
        console.log(`⚠️  Profile creation failed for ${account.email}: ${profileError.message}`);
      } else {
        console.log(`✅ Created user profile: ${account.email}`);
      }

    } catch (error) {
      console.log(`❌ Error creating user ${account.email}: ${error.message}`);
    }
  }
}

async function createSampleData() {
  console.log('📊 Creating sample data...');
  
  // Sample daily reports
  const dailyReports = [
    {
      id: '550e8400-e29b-41d4-a716-446655440020',
      outlet_id: '550e8400-e29b-41d4-a716-446655440001',
      date: new Date().toISOString().split('T')[0],
      sales_cash: 1500.00,
      sales_transfer: 800.00,
      sales_pos: 1200.00,
      sales_credit: 300.00,
      opening_balance: 500.00,
      closing_balance: 2000.00,
      bank_deposit: 3000.00,
      created_by: '550e8400-e29b-41d4-a716-446655440011'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440021',
      outlet_id: '550e8400-e29b-41d4-a716-446655440002',
      date: new Date().toISOString().split('T')[0],
      sales_cash: 2200.00,
      sales_transfer: 1500.00,
      sales_pos: 1800.00,
      sales_credit: 400.00,
      opening_balance: 800.00,
      closing_balance: 3000.00,
      bank_deposit: 4500.00,
      created_by: '550e8400-e29b-41d4-a716-446655440011'
    }
  ];

  for (const report of dailyReports) {
    try {
      const { error } = await supabase
        .from('daily_reports')
        .upsert(report, { onConflict: 'id' });

      if (error) {
        console.log(`⚠️  Daily report may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created daily report for outlet`);
      }
    } catch (err) {
      console.log(`⚠️  Daily report may already exist: ${err.message}`);
    }
  }

  // Sample invoices
  const invoices = [
    {
      id: '550e8400-e29b-41d4-a716-446655440030',
      outlet_id: '550e8400-e29b-41d4-a716-446655440001',
      invoice_number: 'INV-001',
      customer_name: 'John Doe',
      customer_email: 'john@example.com',
      customer_phone: '(555) 123-4567',
      subtotal: 100.00,
      tax_rate: 8.25,
      tax_amount: 8.25,
      total: 108.25,
      status: 'paid',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_by: '550e8400-e29b-41d4-a716-446655440013'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440031',
      outlet_id: '550e8400-e29b-41d4-a716-446655440002',
      invoice_number: 'INV-002',
      customer_name: 'Jane Smith',
      customer_email: 'jane@example.com',
      customer_phone: '(555) 987-6543',
      subtotal: 150.00,
      tax_rate: 8.25,
      tax_amount: 12.38,
      total: 162.38,
      status: 'pending',
      due_date: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      created_by: '550e8400-e29b-41d4-a716-446655440014'
    }
  ];

  for (const invoice of invoices) {
    try {
      const { error } = await supabase
        .from('invoices')
        .upsert(invoice, { onConflict: 'id' });

      if (error) {
        console.log(`⚠️  Invoice may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created invoice: ${invoice.invoice_number}`);
      }
    } catch (err) {
      console.log(`⚠️  Invoice may already exist: ${err.message}`);
    }
  }

  // Sample expenses
  const expenses = [
    {
      id: '550e8400-e29b-41d4-a716-446655440040',
      outlet_id: '550e8400-e29b-41d4-a716-446655440001',
      description: 'Office Supplies',
      amount: 50.00,
      category: 'office',
      vendor: 'Office Depot',
      payment_method: 'credit_card',
      date: new Date().toISOString().split('T')[0],
      created_by: '550e8400-e29b-41d4-a716-446655440017'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440041',
      outlet_id: '550e8400-e29b-41d4-a716-446655440002',
      description: 'Food Ingredients',
      amount: 200.00,
      category: 'food',
      vendor: 'Local Supplier',
      payment_method: 'cash',
      date: new Date().toISOString().split('T')[0],
      created_by: '550e8400-e29b-41d4-a716-446655440015'
    }
  ];

  for (const expense of expenses) {
    try {
      const { error } = await supabase
        .from('expenses')
        .upsert(expense, { onConflict: 'id' });

      if (error) {
        console.log(`⚠️  Expense may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created expense: ${expense.description}`);
      }
    } catch (err) {
      console.log(`⚠️  Expense may already exist: ${err.message}`);
    }
  }

  // Sample vendors
  const vendors = [
    {
      id: '550e8400-e29b-41d4-a716-446655440050',
      outlet_id: '550e8400-e29b-41d4-a716-446655440001',
      name: 'Office Depot',
      email: 'orders@officedepot.com',
      phone: '(555) 111-2222',
      address: {
        street: '123 Office St',
        city: 'City',
        state: 'State',
        zip: '12345'
      },
      type: 'supplier',
      created_by: '550e8400-e29b-41d4-a716-446655440016'
    },
    {
      id: '550e8400-e29b-41d4-a716-446655440051',
      outlet_id: '550e8400-e29b-41d4-a716-446655440002',
      name: 'Local Food Supplier',
      email: 'orders@localfood.com',
      phone: '(555) 333-4444',
      address: {
        street: '456 Food Ave',
        city: 'City',
        state: 'State',
        zip: '12345'
      },
      type: 'supplier',
      created_by: '550e8400-e29b-41d4-a716-446655440015'
    }
  ];

  for (const vendor of vendors) {
    try {
      const { error } = await supabase
        .from('vendors')
        .upsert(vendor, { onConflict: 'id' });

      if (error) {
        console.log(`⚠️  Vendor may already exist: ${error.message}`);
      } else {
        console.log(`✅ Created vendor: ${vendor.name}`);
      }
    } catch (err) {
      console.log(`⚠️  Vendor may already exist: ${err.message}`);
    }
  }
}

async function main() {
  console.log('🚀 Compass Test Accounts Setup');
  console.log('================================\n');

  try {
    // Check if we can connect to Supabase
    console.log('🔌 Testing Supabase connection...');
    const { data, error } = await supabase.from('outlets').select('count').limit(1);
    if (error) {
      console.error('❌ Cannot connect to Supabase:', error.message);
      process.exit(1);
    }
    console.log('✅ Connected to Supabase successfully\n');

    // Ask user if they want to proceed
    const proceed = await askQuestion('Do you want to create test accounts and sample data? (y/N): ');
    if (proceed.toLowerCase() !== 'y' && proceed.toLowerCase() !== 'yes') {
      console.log('❌ Setup cancelled');
      process.exit(0);
    }

    console.log('\n📋 Setting up test accounts...\n');

    // Create outlets first
    await createTestOutlets();
    console.log('');

    // Create users
    await createTestUsers();
    console.log('');

    // Create sample data
    await createSampleData();
    console.log('');

    console.log('🎉 Test accounts setup completed!');
    console.log('\n📋 Test Account Credentials:');
    console.log('============================');
    
    testAccounts.forEach(account => {
      console.log(`${account.role.toUpperCase()}:`);
      console.log(`  Email: ${account.email}`);
      console.log(`  Password: ${account.password}`);
      console.log('');
    });

    console.log('🧪 Next Steps:');
    console.log('1. Go to your app: http://localhost:5173');
    console.log('2. Try logging in with any of the test accounts');
    console.log('3. Test role-based permissions and features');
    console.log('4. Check the Supabase Dashboard to verify data');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  } finally {
    rl.close();
  }
}

// Run the setup
main();
