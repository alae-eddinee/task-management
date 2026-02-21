import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Singleton instance for general use (backwards compat)
// Realtime disabled to prevent hanging with multiple tabs/accounts
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  realtime: {
    timeout: 20000,
  },
});

// Factory to create fresh clients when the singleton gets stuck
// These also have realtime disabled to prevent update hangs
export function createFreshClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey, {
    realtime: {
      timeout: 20000,
    },
  });
}
