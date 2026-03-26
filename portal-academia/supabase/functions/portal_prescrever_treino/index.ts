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

    const body = await req.json().catch(() => ({}))
    const catalogo = Boolean(body?.catalogo)
    const usuario_id = String(body?.usuario_id ?? '').trim()
    const nome = String(body?.nome ?? '').trim()
    const data_prevista = String(body?.data_prevista ?? '').trim()
    const categoria = String(body?.categoria ?? 'chest').trim()
    const exerciciosIn = Array.isArray(body?.exercicios) ? body.exercicios : []

    if (!nome || !data_prevista || !exerciciosIn.length) {
      return new Response(JSON.stringify({ error: 'Campos obrigatórios ausentes' }), { status: 400, headers })
    }
    if (!catalogo && !usuario_id) {
      return new Response(JSON.stringify({ error: 'usuario_id é obrigatório para treino do aluno' }), {
        status: 400,
        headers,
      })
    }

    const me = await requirePortalMe(req)
    if (me.membro.papel !== 'personal') {
      return new Response(JSON.stringify({ error: 'Apenas personal pode prescrever' }), { status: 403, headers })
    }

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const { data: personal } = await admin
      .from('personais')
      .select('id')
      .eq('membro_portal_id', me.membro.id)
      .maybeSingle()

    if (!personal?.id) {
      return new Response(JSON.stringify({ error: 'Personal não mapeado em personais' }), {
        status: 403,
        headers,
      })
    }

    if (!catalogo) {
      // Confirma se o aluno está atribuído a este personal (para manter a RLS lógica do MVP).
      const { data: vinculo } = await admin
        .from('alunos_academia')
        .select('id')
        .eq('academia_id', me.membro.academia_id)
        .eq('usuario_id', usuario_id)
        .eq('personal_principal_id', personal.id)
        .maybeSingle()

      if (!vinculo) {
        return new Response(JSON.stringify({ error: 'Aluno não pertence ao seu conjunto de trabalho' }), {
          status: 403,
          headers,
        })
      }
    }

    const exercicios = exerciciosIn.map((ex: any, idx: number) => ({
      id: `ex-${idx + 1}`,
      nome: String(ex?.nome ?? '').trim(),
      series: Math.max(1, Number(ex?.series ?? 1)),
      repeticoes: Math.max(0, Number(ex?.repeticoes ?? 0)),
      carga: Math.max(0, Number(ex?.carga ?? 0)),
      met: Math.max(0, Number(ex?.met ?? 0)),
      video_url: ex?.video_url ?? null,
      concluido: false,
    }))

    if (exercicios.some((e: any) => !e.nome)) {
      return new Response(JSON.stringify({ error: 'Cada exercício precisa de nome' }), { status: 400, headers })
    }

    const { data: inserted, error: insErr } = await admin
      .from('treinos_plano')
      .insert({
        usuario_id: catalogo ? null : usuario_id,
        nome,
        personal_id: personal.id,
        data_prevista,
        exercicios,
        criado_pelo_aluno: false,
        categoria,
        catalogo,
        academia_id: catalogo ? me.membro.academia_id : null,
      })
      .select('id,nome,data_prevista,categoria,usuario_id,personal_id,catalogo,academia_id')
      .single()

    if (insErr) {
      return new Response(JSON.stringify({ error: insErr.message }), { status: 500, headers })
    }

    return new Response(JSON.stringify({ ok: true, treino: inserted }), { status: 200, headers })
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})

