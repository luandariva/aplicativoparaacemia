import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getCorsHeaders, handleOptions, requirePortalMe } from '../_shared/portalAuth.ts'

function requireEnv(name: string): string {
  const v = Deno.env.get(name)
  if (!v) throw new Error(`Env ${name} não configurada no Edge Function`)
  return v
}

function generateToken(bytes = 24): string {
  const arr = new Uint8Array(bytes)
  crypto.getRandomValues(arr)
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

serve(async (req) => {
  const headers = { ...getCorsHeaders(), 'Content-Type': 'application/json' }
  if (req.method === 'OPTIONS') return handleOptions()

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
    }

    const me = await requirePortalMe(req)
    if (me.membro.papel !== 'gestor') {
      return new Response(JSON.stringify({ error: 'Apenas gestor' }), { status: 403, headers })
    }

    const body = await req.json().catch(() => ({}))
    const email = String(body?.email ?? '').trim().toLowerCase()
    const display_name = body?.display_name ? String(body.display_name).trim() : null
    const personal_principal_id = body?.personal_principal_id ? String(body.personal_principal_id) : null

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'E-mail inválido' }), { status: 400, headers })
    }

    let personalIdToAssign: string | null = personal_principal_id
    if (personalIdToAssign) {
      const supabaseUrl = requireEnv('SUPABASE_URL')
      const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
      const admin = createClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      })

      const { data: personal, error: pErr } = await admin
        .from('personais')
        .select('id,membro_portal_id')
        .eq('id', personalIdToAssign)
        .maybeSingle()

      if (pErr || !personal?.id) {
        return new Response(JSON.stringify({ error: 'Personal inválido' }), { status: 400, headers })
      }

      const { data: mp } = await admin
        .from('membros_portal')
        .select('id')
        .eq('id', personal.membro_portal_id)
        .eq('academia_id', me.membro.academia_id)
        .maybeSingle()

      if (!mp) {
        return new Response(JSON.stringify({ error: 'Personal não pertence à academia' }), { status: 400, headers })
      }
    }

    const supabaseUrl = requireEnv('SUPABASE_URL')
    const serviceRoleKey = requireEnv('SUPABASE_SERVICE_ROLE_KEY')
    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    const password = `${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}Aa1!`
    const { data: created, error: authErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: display_name ? { display_name } : undefined,
    })

    if (authErr || !created?.user?.id) {
      return new Response(
        JSON.stringify({ error: authErr?.message ?? 'Falha ao criar usuário (e-mail pode existir)' }),
        { status: 400, headers },
      )
    }

    const userId = created.user.id

    // Perfil em `public.usuarios`: alinhado ao PWA (`resolveUsuarioDb` usa auth_user_id e id).
    // Isto assume que novas linhas podem usar o mesmo UUID para `id` e `auth_user_id` (Auth).
    // Se o teu schema usar `id` distinto de `auth.users.id`, ajusta o insert aqui e o FK em `alunos_academia`.
    const usuariosBase: Record<string, unknown> = {
      id: userId,
      auth_user_id: userId,
      display_name: display_name ?? null,
    }
    let { error: uErr } = await admin
      .from('usuarios')
      .upsert({ ...usuariosBase, email }, { onConflict: 'id' })
    if (uErr && /column.*email|email.*does not exist/i.test(String(uErr.message ?? ''))) {
      uErr = (await admin.from('usuarios').upsert(usuariosBase, { onConflict: 'id' })).error
    }
    if (uErr) {
      await admin.auth.admin.deleteUser(userId)
      return new Response(JSON.stringify({ error: `Falha ao criar perfil usuarios: ${uErr.message}` }), {
        status: 500,
        headers,
      })
    }

    // Vínculo com a academia (fonte da verdade)
    const { error: aErr } = await admin.from('alunos_academia').insert({
      usuario_id: userId,
      academia_id: me.membro.academia_id,
      personal_principal_id: personalIdToAssign,
      status: 'ativo',
    })

    if (aErr) {
      return new Response(JSON.stringify({ error: `Falha ao vincular aluno: ${aErr.message}` }), { status: 500, headers })
    }

    // Registro de convite (opcional no MVP, mas útil para auditoria)
    const token = generateToken(18)
    const expira = new Date()
    expira.setDate(expira.getDate() + 7)

    await admin.from('convites_aluno').insert({
      academia_id: me.membro.academia_id,
      email,
      token,
      expira_em: expira.toISOString(),
      consumido_em: new Date().toISOString(),
      usuario_id: userId,
      criado_por: me.membro.id,
    })

    return new Response(
      JSON.stringify({
        ok: true,
        usuario_id: userId,
        senha_temporaria: password,
        mensagem:
          'Aluno criado e vinculado. Use a senha temporária para o aluno entrar no app (ou altere após login).',
      }),
      { status: 200, headers },
    )
  } catch (err: any) {
    const status = err?.status ?? 500
    return new Response(JSON.stringify({ error: err?.message ?? 'Erro' }), { status, headers })
  }
})

