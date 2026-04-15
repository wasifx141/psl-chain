/**
 * src/utils/supabase/client.ts
 *
 * Singleton Supabase client for client-side (browser) usage.
 * Uses NEXT_PUBLIC_SUPABASE_ANON_KEY — safe to expose in browser.
 * Do NOT use service key on the client side.
 */
import { createClient } from '@supabase/supabase-js'

const supabaseUrl  = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl || !supabaseAnon) {
  console.warn(
    '[Supabase] NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is not set. ' +
    'Supabase features will be disabled.'
  )
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnon ?? '')
