import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Browser singleton — safe for client components */
export const supabase = createBrowserClient(supabaseUrl, supabaseKey);

/** Factory for SSR usage (e.g. Server Components / middleware) */
export const createClient = () => createBrowserClient(supabaseUrl, supabaseKey);