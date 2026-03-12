const { createClient } = require("@supabase/supabase-js");

// Admin client — uses service_role key, bypasses RLS.
// Use this for all server-side DB operations.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Auth client — uses anon key for Supabase Auth operations
// (signUp, signIn, OTP, OAuth).
const supabaseAuth = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

module.exports = { supabase, supabaseAuth };
