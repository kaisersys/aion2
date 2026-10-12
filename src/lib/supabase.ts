import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const suppliedUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const suppliedKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// Never let a misconfigured Supabase project blank the public website.
// Client keys are publishable; RLS is the actual access control.
function makeClient(): SupabaseClient | null {
  if (!suppliedUrl || !suppliedKey) return null;
  try {
    const parsed = new URL(suppliedUrl);
    if (!['https:', 'http:'].includes(parsed.protocol) || !parsed.hostname) return null;
    return createClient(parsed.toString(), suppliedKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
  } catch {
    console.warn('Guide Studio disabled: invalid Supabase configuration. Verify VITE_SUPABASE_URL.');
    return null;
  }
}

export const supabase = makeClient();
export const isSupabaseConfigured = Boolean(supabase);
