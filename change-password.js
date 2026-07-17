const { createClient } = require('@supabase/supabase-js');

// Use environment variables - NEVER hardcode credentials
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set');
  console.error('Example: SUPABASE_SERVICE_ROLE_KEY=xxx node change-password.js');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

const userId = 'd8e54eec-4d65-45fb-bd6e-25c42cf981b6';

async function backupAndChangePassword() {
  try {
    console.log('Fetching user data...');
    const { data: userData, error: userError } = await supabase.auth.admin.getUserById(userId);
    
    if (userError) throw userError;
    
    const backup = {
      user: userData.user,
      timestamp: new Date().toISOString()
    };
    
    const fs = require('fs');
    const backupFileName = `user_backup_${userId}_${Date.now()}.json`;
    fs.writeFileSync(backupFileName, JSON.stringify(backup, null, 2));
    console.log(`Backup saved to: ${backupFileName}`);
    
    console.log('Changing password...');
    const { data: updateData, error: updateError } = await supabase.auth.admin.updateUserById(
      userId,
      { password: 'adnan123' }
    );
    
    if (updateError) throw updateError;
    
    console.log('Password changed successfully!');
    console.log('Updated user:', updateData.user.id);
    
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

backupAndChangePassword();
