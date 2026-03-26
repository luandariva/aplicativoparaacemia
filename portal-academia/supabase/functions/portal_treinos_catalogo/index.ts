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
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
    }

    const me = await requirePortalMe(req)
    if (me.membro.papel !== 'personal' && me.membro.papel !== 'gestor') {
      return new Response(JSON.stringify({ error: 'Sem permissão' }), { status: 403, headers })
    }

    const body = await req.json().catch(() => ({}))
    const treino_id = body?.treino_id != null ? String(body.treino_id).trim() : ''

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const base = admin
      .from('treinos_plano')
      .select(
        'id,nome,data_prevista,categoria,exercicios,created_at,personal_id,personais(nome)',
      )
      .eq('catalogo', true)
      .eq('academia_id', me.membro.academia_id)

    if (treino_id) {
      const { data: treino, error } = await base.eq('id', treino_id).maybeSingle()
      if (error) {
        return new Response(JSON.stringify({ error: error.message }), { status: 500, headers })
      }
      if (!treino) {
        return new Response(JSON.stringify({ error: 'Treino não encontrado' }), { status: 404, headers })
      }
      return new Response(JSON.stringify({ treino }), { status: 200, headers })
    }

    const { data: treinos, error: listErr } = await base.order('created_at', { ascending: false }).limit(80)

    if (listErr) {
      return new Response(JSON.stringify({ error: listErr.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ treinos: treinos ?? [] }), { status: 200, headers })
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})
