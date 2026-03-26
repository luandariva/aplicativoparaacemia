import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getCorsHeaders,
  handleOptions,
  getSemanaInicioSaoPaulo,
  requirePortalMe,
} from '../_shared/portalAuth.ts'
import { fetchUsuarioByIdForPortal } from '../_shared/usuarioPortal.ts'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Env ${name} não configurada no Edge Function`)
  return v
}

/** Início do intervalo em ISO (UTC meia-noite), N dias atrás — evita setDate() em fuso local do Edge. */
function refeicoesDesdeIsoUtc(dias: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - dias)
  d.setUTCHours(0, 0, 0, 0)
  return d.toISOString()
}

serve(async (req) => {
  const headers = { ...getCorsHeaders(), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return handleOptions()

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
    }

    const body = await req.json().catch(() => ({}))
    const usuario_id = body?.usuario_id
    if (!usuario_id) {
      return new Response(JSON.stringify({ error: 'usuario_id é obrigatório' }), { status: 400, headers })
    }

    const me = await requirePortalMe(req)
    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Valida vínculo + permissão
    const { data: vinculo } = await admin
      .from('alunos_academia')
      .select('id, personal_principal_id, status')
      .eq('academia_id', me.membro.academia_id)
      .eq('usuario_id', usuario_id)
      .maybeSingle()

    if (!vinculo) {
      return new Response(JSON.stringify({ error: 'Aluno não encontrado' }), { status: 404, headers })
    }

    if (me.membro.papel === 'personal') {
      const { data: personal } = await admin
        .from('personais')
        .select('id')
        .eq('membro_portal_id', me.membro.id)
        .maybeSingle()

      if (!personal?.id || vinculo.personal_principal_id !== personal.id) {
        return new Response(JSON.stringify({ error: 'Sem permissão para este aluno' }), {
          status: 403,
          headers,
        })
      }
    }

    const usuario = await fetchUsuarioByIdForPortal(admin, usuario_id)

    // Refeições / metas podem estar gravadas com auth.users.id enquanto o vínculo usa public.usuarios.id (ou o inverso).
    const refeicaoUsuarioIds: string[] = [String(usuario_id)]
    const { data: uRow } = await admin
      .from('usuarios')
      .select('id,auth_user_id')
      .eq('id', usuario_id)
      .maybeSingle()
    if (uRow?.auth_user_id) {
      const aid = String(uRow.auth_user_id)
      if (aid && !refeicaoUsuarioIds.includes(aid)) refeicaoUsuarioIds.push(aid)
    }

    const { data: planos } = await admin
      .from('treinos_plano')
      .select('id,nome,data_prevista,categoria,criado_pelo_aluno,created_at,exercicios')
      .eq('usuario_id', usuario_id)
      .order('data_prevista', { ascending: false })
      .limit(50)

    const { data: realizados } = await admin
      .from('treinos_realizados')
      .select('id,nome,data_hora,duracao_min,concluido,plano_id')
      .eq('usuario_id', usuario_id)
      .order('data_hora', { ascending: false })
      .limit(80)

    const semanaInicio = getSemanaInicioSaoPaulo(new Date())

    const { data: pontosRow } = await admin
      .from('gamificacao_pontos_semana')
      .select('pontos,semana_inicio,detalhe')
      .eq('usuario_id', usuario_id)
      .eq('semana_inicio', semanaInicio)
      .maybeSingle()

    const { data: desafioRow } = await admin
      .from('gamificacao_desafio_progresso')
      .select('dias_atividade,treinos_semana,dias_macros,completo')
      .eq('usuario_id', usuario_id)
      .eq('semana_inicio', semanaInicio)
      .maybeSingle()

    const { data: metasArr, error: metasErr } = await admin
      .from('metas_macros')
      .select('*')
      .in('usuario_id', refeicaoUsuarioIds)
      .order('data_referencia', { ascending: false, nullsFirst: false })
      .limit(1)
    const metasMacros = metasArr?.[0] ?? null
    if (metasErr) console.error('portal_aluno_detail metas_macros', metasErr)

    // Janela larga (90d): evita sumir dados de demo / testes quando a data do servidor avança além de 14 dias.
    const desdeIso = refeicoesDesdeIsoUtc(90)
    const { data: refeicoesRecentes, error: refeicoesErr } = await admin
      .from('refeicoes')
      .select('*')
      .in('usuario_id', refeicaoUsuarioIds)
      .gte('data_hora', desdeIso)
      .order('data_hora', { ascending: false })
      .limit(60)
    if (refeicoesErr) console.error('portal_aluno_detail refeicoes', refeicoesErr, { desdeIso, refeicaoUsuarioIds })

    return new Response(
      JSON.stringify({
        usuario: usuario ?? null,
        planos: planos ?? [],
        realizados: realizados ?? [],
        metas_macros: metasMacros ?? null,
        refeicoes_recentes: refeicoesRecentes ?? [],
        gamificacao: {
          semana_inicio: semanaInicio,
          pontos_semana: pontosRow?.pontos ?? 0,
          detalhe: pontosRow?.detalhe ?? null,
          desafio: desafioRow ?? null,
        },
      }),
      { status: 200, headers },
    )
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})

