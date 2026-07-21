const { Pool } = require('pg');

const urls = [
  "postgresql://postgres.jtgmqjgmcaynehrethhl:Sathvika%402020@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres",
  "postgresql://postgres.jtgmqjgmcaynehrethhl:Sathvika%402020@aws-0-ap-southeast-2.pooler.supabase.com:5432/postgres?sslmode=no-verify",
  "postgresql://postgres.jtgmqjgmcaynehrethhl:Sathvika%402020@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true",
  "postgresql://postgres.jtgmqjgmcaynehrethhl:Sathvika%402020@aws-0-ap-southeast-2.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=no-verify"
];

async function test(url) {
  console.log(`\nTesting: ${url.replace(/:[^@]+@/, ":****@")}`);
  
  // Test 1: With explicit SSL rejectUnauthorized: false
  try {
    const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, connectionTimeoutMillis: 5000 });
    const client = await pool.connect();
    console.log("  [Test 1 (Explicit SSL Obj)] SUCCESS");
    await client.release();
    await pool.end();
  } catch (err) {
    console.log(`  [Test 1 (Explicit SSL Obj)] FAILED: ${err.message}`);
  }

  // Test 2: Without explicit SSL object (relying on URL params)
  try {
    const pool = new Pool({ connectionString: url, connectionTimeoutMillis: 5000 });
    const client = await pool.connect();
    console.log("  [Test 2 (URL Params Only)] SUCCESS");
    await client.release();
    await pool.end();
  } catch (err) {
    console.log(`  [Test 2 (URL Params Only)] FAILED: ${err.message}`);
  }
}

async function run() {
  for (const url of urls) {
    await test(url);
  }
}

run();
