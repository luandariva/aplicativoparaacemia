import { supabase } from './supabase'

function pick(obj, keys, fallback = null) {
  for (const key of keys) {
    if (obj && obj[key] !== undefined && obj[key] !== null) return obj[key]
  }
  return fallback
}

/**
 * Associa o utilizador Auth a `public.usuarios` (mesma ordem que Treino/Nutricao).
 * @returns {{ row: object | null, usuarioId: string }}
 */
export async function resolveUsuarioDb(user) {
  if (!user?.id) return { row: null, usuarioId: null }

  const tentativas = [
    supabase.from('usuarios').select('*').eq('auth_user_id', user.id).limit(1).maybeSingle(),
    supabase.from('usuarios').select('*').eq('id', user.id).limit(1).maybeSingle(),
  ]
  if (user.email) {
    tentativas.push(
      supabase.from('usuarios').select('*').eq('email', user.email).limit(1).maybeSingle(),
    )
  }

  for (const req of tentativas) {
    const { data, error } = await req
    if (error) continue
    if (data) {
      const usuarioId = pick(data, ['id', 'usuario_id'], user.id)
      return { row: data, usuarioId }
    }
  }

  return { row: null, usuarioId: user.id }
}
