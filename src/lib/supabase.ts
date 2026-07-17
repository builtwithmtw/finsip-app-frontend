import { createClient } from '@supabase/supabase-js';

// NEXT_PUBLIC_ rather than VITE_: the prefix is what marks a variable as safe to
// inline into the browser bundle, and each bundler has its own. Both values are
// public by design -- the anon key is protected by row-level security, not secrecy.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
