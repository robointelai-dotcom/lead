const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_API_KEY
);

// Test the connection
supabase
  .from('users')
  .select('*')
  .limit(1)
  .then(({ data, error }) => {
    if (error) console.error('Supabase connection error:', error);
    else console.log('Supabase connected:', data);
  });

module.exports = supabase;
