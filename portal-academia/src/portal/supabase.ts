import { createClient } from '@supabase/supabase-js'

const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const rawUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim()

if (!rawUrl || !SUPABASE_ANON_KEY) {
  throw new Error('Configure VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no .env.local')
}

const PROJECT_SUPABASE_URL = rawUrl

/** Em dev, Auth/REST vão por `/supabase-api` (proxy Vite → *.supabase.co) para evitar falhas de rede tipo ERR_CONNECTION_CLOSED em alguns ambientes. */
function resolveSupabaseUrl(): string {
  if (import.meta.env.DEV && typeof window !== 'undefined') {
    return `${window.location.origin}/supabase-api`
  }
  return PROJECT_SUPABASE_URL
}

export const supabase = createClient(resolveSupabaseUrl(), SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
})

