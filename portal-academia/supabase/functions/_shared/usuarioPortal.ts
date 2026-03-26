import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2'

/** Dados de aluno para o portal (muitos projetos não têm `email` em `public.usuarios`). */
export type UsuarioPortalRow = {
  id: string
  email?: string | null
  display_name?: string | null
  ranking_opt_in?: boolean | null
}

/** Lista: só lê colunas que existem em `usuarios` (sem `email` na tabela). */
export async function fetchUsuariosByIdsForPortal(
  admin: SupabaseClient,
  ids: string[],
): Promise<Record<string, UsuarioPortalRow>> {
  const uniq = [...new Set(ids)].filter(Boolean)
  const out: Record<string, UsuarioPortalRow> = {}
  if (uniq.length === 0) return out

  const u1 = await admin.from('usuarios').select('id,display_name').in('id', uniq)
  let rows: Record<string, unknown>[]
  if (!u1.error) {
    rows = (u1.data ?? []) as Record<string, unknown>[]
  } else {
    const u2 = await admin.from('usuarios').select('id').in('id', uniq)
    if (u2.error) throw u2.error
    rows = ((u2.data ?? []) as { id: string }[]).map((x) => ({ id: x.id }))
  }

  for (const r of rows) {
    const id = String(r.id)
    out[id] = {
      id,
      email: null,
      display_name: r.display_name != null ? String(r.display_name) : null,
      ranking_opt_in: null,
    }
  }
  return out
}

/** Detalhe: enriquece com e-mail via Auth quando `usuario_id` é o UUID do `auth.users`. */
export async function fetchUsuarioByIdForPortal(
  admin: SupabaseClient,
  usuario_id: string,
): Promise<UsuarioPortalRow | null> {
  const tries = ['id,display_name,ranking_opt_in', 'id,display_name', 'id'] as const
  let row: Record<string, unknown> | null = null
  for (const sel of tries) {
    const { data, error } = await admin.from('usuarios').select(sel).eq('id', usuario_id).maybeSingle()
    if (!error && data) {
      row = data as Record<string, unknown>
      break
    }
  }
  if (!row) return null

  let email: string | null = null
  try {
    const { data: authData, error: authErr } = await admin.auth.admin.getUserById(usuario_id)
    if (!authErr && authData?.user?.email) email = authData.user.email
  } catch {
    /* ignorar */
  }

  return {
    id: String(row.id),
    email,
    display_name: row.display_name != null ? String(row.display_name) : null,
    ranking_opt_in: typeof row.ranking_opt_in === 'boolean' ? row.ranking_opt_in : null,
  }
}
