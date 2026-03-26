import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions, requirePortalMe } from '../_shared/portalAuth.ts'
import { fetchUsuariosByIdsForPortal } from '../_shared/usuarioPortal.ts'

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
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Sem embed `usuarios(...)`: evita erros PostgREST ("could not find relationship") se a FK
    // não estiver exposta na cache do schema; fazemos duas queries e juntamos no servidor.
    let q = admin
      .from('alunos_academia')
      .select('id,usuario_id,status,personal_principal_id')
      .eq('academia_id', me.membro.academia_id)
      .order('id', { ascending: false })

    if (me.membro.papel === 'personal') {
      const { data: personal } = await admin
        .from('personais')
        .select('id')
        .eq('membro_portal_id', me.membro.id)
        .maybeSingle()

      if (!personal?.id) {
        return new Response(JSON.stringify({ alunos: [] }), { status: 200, headers })
      }

      q = q.eq('personal_principal_id', personal.id)
    }

    const { data: rows, error } = await q
    if (error) throw error

    const list = rows ?? []
    const usuarioIds = [...new Set(list.map((r: { usuario_id: string }) => r.usuario_id).filter(Boolean))]

    const usuariosById =
      usuarioIds.length > 0 ? await fetchUsuariosByIdsForPortal(admin, usuarioIds) : {}

    const alunos = list.map((r: { id: string; usuario_id: string; status: string; personal_principal_id: string | null }) => ({
      ...r,
      usuarios: usuariosById[r.usuario_id] ?? null,
    }))

    return new Response(JSON.stringify({ alunos }), { status: 200, headers })
  } catch (err: unknown) {
    const e = err as {
      message?: string
      details?: string
      hint?: string
      code?: string
      status?: number
    }
    const status = typeof e?.status === 'number' && e.status >= 400 && e.status < 600 ? e.status : 500
    return new Response(
      JSON.stringify({
        error: e?.message ?? String(err),
        details: e?.details,
        hint: e?.hint,
        code: e?.code,
      }),
      { status, headers },
    )
  }
})

