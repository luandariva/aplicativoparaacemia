import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

export type PortalPapel = 'gestor' | 'personal'

export type PortalMember = {
  id: string
  user_id: string
  academia_id: string
  papel: PortalPapel
  ativo: boolean
}

export type PortalAcademia = {
  id: string
  nome: string
  slug?: string | null
}

export type PortalMeResult = {
  membro: PortalMember
  academia: PortalAcademia | null
}

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Env ${name} não configurada no Edge Function`)
  return v
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  } as const
}

export function getCorsHeaders() {
  return corsHeaders()
}

export function handleOptions() {
  return new Response('ok', { status: 204, headers: corsHeaders() })
}

export function getBearerToken(req: Request): string | null {
  const auth = req.headers.get('authorization') || req.headers.get('Authorization')
  if (!auth) return null
  const parts = auth.split(' ')
  if (parts.length !== 2) return null
  if (parts[0].toLowerCase() !== 'bearer') return null
  return parts[1]
}

export async function requirePortalMe(req: Request): Promise<PortalMeResult> {
  const jwt = getBearerToken(req)
  if (!jwt) {
    throw Object.assign(new Error('Nao autenticado'), { status: 401 })
  }

  const supabaseUrl = requireEnv('SUPABASE_URL')
  const anonKey = requireEnv('SUPABASE_ANON_KEY')
  const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  const { data: userData, error: userErr } = await admin.auth.getUser(jwt)
  if (userErr || !userData?.user) {
    throw Object.assign(new Error('Token invalido'), { status: 401 })
  }

  const userId = userData.user.id

  const { data: membro, error: mErr } = await admin
    .from('membros_portal')
    .select('id,user_id,academia_id,papel,ativo')
    .eq('user_id', userId)
    .eq('ativo', true)
    .maybeSingle()

  if (mErr || !membro) {
    throw Object.assign(new Error('Sem acesso ao portal'), { status: 403 })
  }

  const { data: academia } = await admin
    .from('academias')
    .select('id,nome,slug')
    .eq('id', membro.academia_id)
    .maybeSingle()

  return { membro: membro as PortalMember, academia: academia as PortalAcademia | null }
}

export function saoPauloIsoDate(d = new Date()): string {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Sao_Paulo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
  return fmt.format(d) // YYYY-MM-DD
}

export function isoWeekStartFromIsoDate(isoDate: string): string {
  const [y, m, day] = isoDate.split('-').map((x) => Number(x))
  const utc = new Date(Date.UTC(y, m - 1, day))
  const dow = utc.getUTCDay() // 0=Sun..6=Sat
  const diffToMonday = (dow + 6) % 7 // Mon=0
  utc.setUTCDate(utc.getUTCDate() - diffToMonday)
  return utc.toISOString().slice(0, 10)
}

export function getSemanaInicioSaoPaulo(now = new Date()): string {
  return isoWeekStartFromIsoDate(saoPauloIsoDate(now))
}

