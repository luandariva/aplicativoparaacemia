import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import {
  getCorsHeaders,
  handleOptions,
  requirePortalMe,
} from '../_shared/portalAuth.ts'

serve(async (req) => {
  const headers = {
    ...getCorsHeaders(),
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return handleOptions()

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers,
      })
    }

    const me = await requirePortalMe(req)
    return new Response(JSON.stringify(me), { status: 200, headers })
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), {
      status,
      headers,
    })
  }
})

