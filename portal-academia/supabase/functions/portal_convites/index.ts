import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions, requirePortalMe } from '../_shared/portalAuth.ts'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Env ${name} não configurada no Edge Function`)
  return v
}

serve(async (req) => {
  const headers = { ...getCorsHeaders(), 'Content-Type': 'application/json' }
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

    const { data, error } = await admin
      .from('convites_aluno')
      .select('id,email,token,expira_em,consumido_em,created_at,usuario_id')
      .eq('academia_id', me.membro.academia_id)
      .order('created_at', { ascending: false })
      .limit(200)

    if (error) throw error
    return new Response(JSON.stringify({ convites: data ?? [] }), { status: 200, headers })
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})

