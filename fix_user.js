const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkAndFix() {
  const email = "admin@acme.com";
  console.log(`Checking for user: ${email}`);

  // 1. Check if user exists
  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error("Error fetching user:", error.message);
    return;
  }

  const passwordHash = await bcrypt.hash("password123", 12);

  if (!user) {
    console.log("User not found. Creating default admin user...");
    
    // Create Org first
    const { data: org, error: orgErr } = await supabase
      .from('organizations')
      .insert({ name: 'Acme Corp', slug: 'acme-corp-' + Math.random().toString(36).slice(2, 7) })
      .select()
      .single();
    
    if (orgErr) {
      console.error("Failed to create org:", orgErr.message);
      return;
    }

    // Create User
    const { data: newUser, error: userErr } = await supabase
      .from('users')
      .insert({ email, name: 'Admin User', passwordHash })
      .select()
      .single();
    
    if (userErr) {
      console.error("Failed to create user:", userErr.message);
      return;
    }

    // Create Member
    await supabase.from('organization_members').insert({
      organization_id: org.id,
      user_id: newUser.id,
      role: 'OWNER',
      is_active: true,
      joined_at: new Date().toISOString()
    });

    // Create Subscription
    await supabase.from('subscriptions').insert({
      organization_id: org.id,
      plan: 'FREE',
      status: 'ACTIVE',
      current_period_start: new Date().toISOString(),
      current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
    });

    console.log("SUCCESS: Created user admin@acme.com with password: password123");
  } else {
    console.log("User exists. Updating password to 'password123' to be 100% sure...");
    const { error: upErr } = await supabase
      .from('users')
      .update({ passwordHash })
      .eq('id', user.id);
    
    if (upErr) console.error("Update failed:", upErr.message);
    else console.log("SUCCESS: Password reset to 'password123'");
  }
}

checkAndFix();
