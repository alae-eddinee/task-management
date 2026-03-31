const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://aenapquipggskuulycbk.supabase.co';
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFlbmFwcXVpcGdnc2t1dWx5Y2JrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MTY2NzMzMywiZXhwIjoyMDg3MjQzMzMzfQ.zTMq7LlebAAb8dsDu5UzJ2wpDFuw_J9feN5XKpcqTdI';

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
