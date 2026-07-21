const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcryptjs');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_API_KEY
);

async function checkAndFix() {
  const email = "admin@acme.com";
  console.log(`[fix-user] Checking account: ${email}`);

  const passwordHash = await bcrypt.hash("password123", 12);

  // 1. Ensure User exists
  let { data: user, error: userError } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (userError) {
    console.error("[fix-user] User lookup error:", userError.message);
    return;
  }

  if (!user) {
    console.log("[fix-user] User not found. Creating new user...");
    const { data: newUser, error: createErr } = await supabase
      .from('users')
      .insert({ email, name: 'Admin User', passwordHash, updatedAt: new Date().toISOString() })
      .select()
      .single();
    if (createErr) {
      console.error("[fix-user] Failed to create user:", createErr.message);
      return;
    }
    user = newUser;
  } else {
    console.log("[fix-user] User found. Resetting password...");
    await supabase.from('users').update({ passwordHash, updatedAt: new Date().toISOString() }).eq('id', user.id);
  }

  // 2. Ensure Organization exists
  let { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('*')
    .limit(1)
    .maybeSingle();

  if (!org) {
    console.log("[fix-user] No organization found. Creating one...");
    const { data: newOrg, error: createOrgErr } = await supabase
      .from('organizations')
      .insert({ 
        name: 'Acme Corp', 
        slug: 'acme-corp-' + Math.random().toString(36).slice(2, 7),
        updatedAt: new Date().toISOString()
      })
      .select()
      .single();
    if (createOrgErr) {
      console.error("[fix-user] Failed to create org:", createOrgErr.message);
      return;
    }
    org = newOrg;
  }

  // 3. Ensure Membership exists and is ACTIVE
  const { data: membership, error: memErr } = await supabase
    .from('organization_members')
    .select('*')
    .eq('userId', user.id)
    .maybeSingle();

  if (!membership) {
    console.log("[fix-user] Membership missing. Creating active owner membership...");
    const { error: createMemErr } = await supabase
      .from('organization_members')
      .insert({
        organizationId: org.id,
        userId: user.id,
        role: 'OWNER',
        isActive: true,
        joinedAt: new Date().toISOString()
      });
    if (createMemErr) console.error("[fix-user] Failed to create membership:", createMemErr.message);
    else console.log("[fix-user] SUCCESS: Created membership.");
  } else {
    console.log("[fix-user] Membership exists. Ensuring it is active...");
    await supabase.from('organization_members').update({ isActive: true, role: 'OWNER' }).eq('id', membership.id);
    console.log("[fix-user] SUCCESS: Membership updated to ACTIVE.");
  }

  console.log("[fix-user] ALL DONE. You can now login with password: password123");
}

checkAndFix();
