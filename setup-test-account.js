// Simple script to create a test account for local development
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env' });

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseAnonKey = process.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function createTestAccount() {
  try {
    console.log('Creating test account...');
    
    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email: 'test@compazz.com',
      password: 'Test123!',
    });

    if (authError) {
      console.error('Auth error:', authError);
      return;
    }

    console.log('Auth user created:', authData.user?.id);

    if (authData.user) {
      // Create outlet
      const { data: outletData, error: outletError } = await supabase
        .from('outlets')
        .insert({
          name: 'Test Outlet',
          business_type: 'retail',
          status: 'active',
          address: {
            street: '123 Test St',
            city: 'Test City',
            state: 'TS',
            zip: '12345',
            country: 'USA'
          },
          phone: '555-0123',
          email: 'test@compazz.com',
          opening_hours: {
            monday: { open: '09:00', close: '17:00' },
            tuesday: { open: '09:00', close: '17:00' },
            wednesday: { open: '09:00', close: '17:00' },
            thursday: { open: '09:00', close: '17:00' },
            friday: { open: '09:00', close: '17:00' },
            saturday: { open: '10:00', close: '16:00' },
            sunday: { open: '10:00', close: '16:00' }
          },
          tax_rate: 8.25,
          currency: 'USD',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (outletError) {
        console.error('Outlet error:', outletError);
        return;
      }

      console.log('Outlet created:', outletData.id);

      // Create user profile
      const { data: userData, error: userError } = await supabase
        .from('users')
        .insert({
          id: authData.user.id,
          email: 'test@compazz.com',
          name: 'Test User',
          role: 'outlet_admin',
          outlet_id: outletData.id,
          permissions: ['all'],
          is_active: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) {
        console.error('User error:', userError);
        return;
      }

      console.log('User profile created:', userData.id);
      console.log('\n✅ Test account created successfully!');
      console.log('Email: test@compazz.com');
      console.log('Password: Test123!');
      console.log('Role: Outlet Admin');
    }
  } catch (error) {
    console.error('Error creating test account:', error);
  }
}

createTestAccount();
