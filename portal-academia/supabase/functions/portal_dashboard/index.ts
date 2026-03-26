import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  getCorsHeaders,
  handleOptions,
  getSemanaInicioSaoPaulo,
  requirePortalMe,
} from '../_shared/portalAuth.ts'

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
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers,
      })
    }

    const me = await requirePortalMe(req)

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    // Função de "recorte" para personal
    async function getPersonalIdIfNeeded(): Promise<string | null> {
      if (me.membro.papel !== 'personal') return null
      const { data, error } = await admin
        .from('personais')
        .select('id')
        .eq('membro_portal_id', me.membro.id)
        .maybeSingle()

      if (error || !data?.id) return null
      return data.id
    }

    const personalId = await getPersonalIdIfNeeded()

    const baseStudents = admin
      .from('alunos_academia')
      .select('usuario_id,status', { count: 'exact' })
      .eq('academia_id', me.membro.academia_id)

    if (me.membro.papel === 'personal') {
      if (!personalId) {
        return new Response(
          JSON.stringify({
            alunosAtivos: 0,
            totalAlunos: 0,
            treinosSemana: 0,
            pontosSemanaAgregados: 0,
            proximosTreinos: [],
          }),
          { status: 200, headers },
        )
      }
    }

    const studentsQuery =
      me.membro.papel === 'personal'
        ? baseStudents.eq('personal_principal_id', personalId)
        : baseStudents

    const { data: studentsAll, count } = await studentsQuery
    const students = studentsAll ?? []

    const usuarioIds = students.map((s: any) => s.usuario_id)
    const alunosAtivos = students.filter((s: any) => s.status === 'ativo').length
    const totalAlunos = count ?? students.length

    const semanaInicio = getSemanaInicioSaoPaulo(new Date())

    let treinosSemana = 0
    let pontosSemanaAgregados = 0
    if (usuarioIds.length > 0) {
      const { count: c } = await admin
        .from('treinos_realizados')
        .select('*', { count: 'exact', head: true })
        .in('usuario_id', usuarioIds)
        .gte('data_hora', `${semanaInicio}T00:00:00`)

      treinosSemana = c ?? 0

      const { data: pontosRows } = await admin
        .from('gamificacao_pontos_semana')
        .select('pontos')
        .in('usuario_id', usuarioIds)
        .eq('semana_inicio', semanaInicio)

      pontosSemanaAgregados = (pontosRows ?? []).reduce(
        (acc, r: { pontos?: number | null }) => acc + (Number(r?.pontos) || 0),
        0,
      )
    }

    const hojeIso = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date())

    const { data: proximos } = await admin
      .from('treinos_plano')
      .select('id,nome,data_prevista,usuario_id')
      .in('usuario_id', usuarioIds.length > 0 ? usuarioIds : ['00000000-0000-0000-0000-000000000000'])
      .gte('data_prevista', hojeIso)
      .eq('criado_pelo_aluno', false)
      .order('data_prevista', { ascending: true })
      .limit(8)

    return new Response(
      JSON.stringify({
        alunosAtivos,
        totalAlunos,
        treinosSemana,
        pontosSemanaAgregados,
        proximosTreinos: proximos ?? [],
      }),
      { status: 200, headers },
    )
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), {
      status,
      headers,
    })
  }
})

