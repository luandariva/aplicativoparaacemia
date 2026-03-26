import { resolveEffectiveFunctionsUrlFromEnv } from './supabaseFunctionsUrl'

export class EdgeError extends Error {
  status: number
  payload: unknown

  constructor(status: number, message: string, payload: unknown) {
    super(message)
    this.status = status
    this.payload = payload
  }
}

/** Em `vite dev`, usa path relativo para o proxy (evita CORS). Em build/preview, URL absoluta. */
function resolveFunctionsBase(): string {
  const full = resolveEffectiveFunctionsUrlFromEnv({
    VITE_SUPABASE_FUNCTIONS_URL: import.meta.env.VITE_SUPABASE_FUNCTIONS_URL,
    VITE_SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
  })
  if (import.meta.env.DEV && /^https?:\/\//i.test(full)) {
    return '/supabase-functions'
  }
  return full
}

export async function callPortalEdge<T>(
  functionName: string,
  accessToken: string,
  body: unknown = {},
): Promise<T> {
  const base = resolveFunctionsBase()
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

  const url = `${base}/${functionName}`

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...(anonKey ? { apikey: anonKey } : {}),
    },
    body: JSON.stringify(body),
  })

  const text = await res.text()
  let json: any = null
  try {
    json = text ? JSON.parse(text) : null
  } catch {
    // ignore
  }

  if (!res.ok) {
    if (import.meta.env.DEV && json && res.status >= 400) {
      console.warn(`[portal] ${functionName}`, res.status, json)
    }
    let msg = json?.error || json?.message || json?.msg || `HTTP ${res.status}`
    if (
      res.status === 404 &&
      (json?.code === 'NOT_FOUND' || String(msg).toLowerCase().includes('not found'))
    ) {
      msg =
        `Edge Function "${functionName}" não existe neste projeto Supabase. ` +
        `Na pasta portal-academia: supabase login && supabase link && supabase functions deploy ${functionName}`
    }
    throw new EdgeError(res.status, String(msg), json)
  }

  return (json ?? {}) as T
}

