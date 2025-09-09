#!/usr/bin/env node

/**
 * Supabase Setup Helper Script
 * This script helps you configure Supabase credentials for the Compass app
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('🚀 Compass Supabase Setup Helper\n');

console.log('To get your Supabase credentials:');
console.log('1. Go to https://supabase.com');
console.log('2. Create a new project or use existing one');
console.log('3. Go to Settings → API');
console.log('4. Copy your Project URL and anon public key\n');

rl.question('Enter your Supabase Project URL (e.g., https://your-project-id.supabase.co): ', (supabaseUrl) => {
  if (!supabaseUrl || !supabaseUrl.includes('supabase.co')) {
    console.log('❌ Invalid URL. Please enter a valid Supabase URL.');
    process.exit(1);
  }

  rl.question('Enter your Supabase anon key (starts with eyJ...): ', (supabaseKey) => {
    if (!supabaseKey || !supabaseKey.startsWith('eyJ')) {
      console.log('❌ Invalid key. Please enter a valid Supabase anon key.');
      process.exit(1);
    }

    // Update .env file
    const envPath = path.join(__dirname, '.env');
    const envContent = `# FastAPI Backend Configuration
VITE_API_BASE_URL=http://localhost:8000/api/v1

# Debug Mode
VITE_DEBUG=true

# Supabase Configuration
VITE_SUPABASE_URL=${supabaseUrl}
VITE_SUPABASE_ANON_KEY=${supabaseKey}
`;

    try {
      fs.writeFileSync(envPath, envContent);
      console.log('\n✅ .env file updated successfully!');
      console.log('\n📋 Next steps:');
      console.log('1. Set up your database schema in Supabase SQL Editor');
      console.log('2. Configure authentication settings');
      console.log('3. Restart your development server: yarn dev');
      console.log('\n📖 See SUPABASE_SETUP_GUIDE.md for detailed instructions');
    } catch (error) {
      console.log('❌ Error writing .env file:', error.message);
    }

    rl.close();
  });
});

rl.on('close', () => {
  process.exit(0);
});
