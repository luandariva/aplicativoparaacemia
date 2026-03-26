import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions, requirePortalMe } from '../_shared/portalAuth.ts'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Env ${name} não configurada no Edge Function`)
  return v
}

serve(async (req) => {
  const headers = {
    ...getCorsHeaders(),
    'Content-Type': 'application/json',
  }

  if (req.method === 'OPTIONS') return handleOptions()

  try {
    if (req.method !== 'POST' && req.method !== 'GET') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
    }

    const me = await requirePortalMe(req)

    if (me.membro.papel !== 'gestor') {
      return new Response(JSON.stringify({ error: 'Apenas gestor' }), { status: 403, headers })
    }

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: membros } = await admin
      .from('membros_portal')
      .select('id')
      .eq('academia_id', me.membro.academia_id)
      .eq('papel', 'personal')
      .eq('ativo', true)

    const ids = (membros ?? []).map((m: any) => m.id)
    if (ids.length === 0) {
      return new Response(JSON.stringify({ personais: [] }), { status: 200, headers })
    }

    const { data: personais } = await admin
      .from('personais')
      .select('id,nome,email,membro_portal_id')
      .in('membro_portal_id', ids)
      .order('nome')

    return new Response(JSON.stringify({ personais: personais ?? [] }), { status: 200, headers })
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})

