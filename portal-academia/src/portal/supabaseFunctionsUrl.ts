/** Base URL HTTPS das Edge Functions (sem barra final). */

export function normalizeFunctionsBaseUrl(input: string) {
  return input.replace(/\/$/, '')
}

/**
 * Resolve a partir de `VITE_SUPABASE_FUNCTIONS_URL` ou, em falta, de `VITE_SUPABASE_URL`
 * (`https://<ref>.supabase.co` → `https://<ref>.functions.supabase.co`).
 */
export function resolveEffectiveFunctionsUrlFromEnv(env: {
  VITE_SUPABASE_FUNCTIONS_URL?: string
  VITE_SUPABASE_URL?: string
}): string {
  const direct = env.VITE_SUPABASE_FUNCTIONS_URL?.trim()
  if (direct && /^https?:\/\//i.test(direct)) {
    return normalizeFunctionsBaseUrl(direct)
  }

  const projectUrl = env.VITE_SUPABASE_URL?.trim()
  if (!projectUrl || !/^https?:\/\//i.test(projectUrl)) {
    throw new Error('Defina VITE_SUPABASE_URL ou VITE_SUPABASE_FUNCTIONS_URL no .env.local')
  }

  let host: string
  try {
    host = new URL(projectUrl).hostname
  } catch {
    throw new Error('VITE_SUPABASE_URL inválido')
  }

  if (!host.toLowerCase().endsWith('.supabase.co')) {
    throw new Error(
      'Para derivar o host das Edge Functions, VITE_SUPABASE_URL deve ser *.supabase.co ou defina VITE_SUPABASE_FUNCTIONS_URL.',
    )
  }

  const ref = host.replace(/\.supabase\.co$/i, '')
  if (!ref) throw new Error('Referência do projeto Supabase inválida')
  return normalizeFunctionsBaseUrl(`https://${ref}.functions.supabase.co`)
}
