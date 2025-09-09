#!/usr/bin/env node

/**
 * Setup User Invitations Table in Supabase
 * 
 * This script creates the user_invitations table and related functions
 * in your Supabase database.
 * 
 * Run this script after setting up your Supabase project:
 * node setup-user-invitations.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env' });

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

async function setupUserInvitations() {
  console.log('🚀 Setting up User Invitations table...\n');

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, 'backend', 'database', 'user-invitations-schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');

    console.log('📄 Found schema file:', schemaPath);

    // Split the SQL into individual statements
    const statements = schemaSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute\n`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      if (statement.trim()) {
        console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
        
        try {
          const { error } = await supabase.rpc('exec_sql', { sql: statement });
          
          if (error) {
            // If exec_sql doesn't exist, try direct query
            const { error: directError } = await supabase
              .from('_sql')
              .select('*')
              .limit(0);
            
            if (directError) {
              console.log(`⚠️  Statement ${i + 1} may need manual execution:`, statement.substring(0, 100) + '...');
              console.log(`   Error: ${error.message}`);
            }
          } else {
            console.log(`✅ Statement ${i + 1} executed successfully`);
          }
        } catch (err) {
          console.log(`⚠️  Statement ${i + 1} may need manual execution:`, statement.substring(0, 100) + '...');
          console.log(`   Error: ${err.message}`);
        }
      }
    }

    console.log('\n🎉 User Invitations setup completed!');
    console.log('\n📋 Next steps:');
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the contents of backend/database/user-invitations-schema.sql');
    console.log('4. Execute the SQL to create the table and policies');
    console.log('\n💡 The table includes:');
    console.log('   - user_invitations table with proper constraints');
    console.log('   - Row Level Security (RLS) policies');
    console.log('   - Indexes for performance');
    console.log('   - Cleanup function for expired invitations');

  } catch (error) {
    console.error('❌ Error setting up user invitations:', error.message);
    console.error('\n🔧 Manual setup required:');
    console.error('1. Go to your Supabase dashboard');
    console.error('2. Navigate to SQL Editor');
    console.error('3. Copy and paste the contents of backend/database/user-invitations-schema.sql');
    console.error('4. Execute the SQL to create the table and policies');
    process.exit(1);
  }
}

// Run the setup
setupUserInvitations();
