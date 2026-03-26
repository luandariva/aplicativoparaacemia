import type { ReactNode } from 'react'
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from './supabase'
import { callPortalEdge, type EdgeError } from './edge'

export type PortalPapel = 'gestor' | 'personal'

export type PortalMember = {
  id: string
  user_id: string
  academia_id: string
  papel: PortalPapel
  ativo: boolean
  academia?: { id: string; nome: string; slug?: string } | null
}

type PortalContextValue = {
  status: 'loading' | 'guest' | 'member' | 'noAccess'
  member: PortalMember | null
  portalCall: <T,>(functionName: string, body?: unknown) => Promise<T>
  logout: () => Promise<void>
}

const PortalContext = createContext<PortalContextValue | null>(null)

export function usePortal() {
  const v = useContext(PortalContext)
  if (!v) throw new Error('usePortal deve ser usado dentro de <PortalProvider />')
  return v
}

type PortalMeResponse = {
  membro: PortalMember
  academia: { id: string; nome: string; slug?: string } | null
}

export function PortalProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<PortalContextValue['status']>('loading')
  const [member, setMember] = useState<PortalMember | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)

  const portalCall = useCallback(
    async <T,>(functionName: string, body?: unknown): Promise<T> => {
      if (!accessToken) throw new Error('Nao autenticado')
      return await callPortalEdge<T>(functionName, accessToken, body ?? {})
    },
    [accessToken],
  )

  const logout = useCallback(async () => {
    setStatus('guest')
    setMember(null)
    setAccessToken(null)
    await supabase.auth.signOut()
  }, [])

  const refreshMember = useCallback(
    async (token: string) => {
      try {
        const j = await callPortalEdge<PortalMeResponse>('portal_me', token, {})
        const m = j.membro
        setMember({
          ...m,
          academia: j.academia ?? m.academia ?? null,
        })
        setStatus('member')
      } catch (err) {
        const e = err as EdgeError
        if (import.meta.env.DEV && e?.status === 404) {
          console.warn('[portal]', e.message)
        }
        if (e?.status === 403) {
          setStatus('noAccess')
        } else {
          setStatus('guest')
        }
        setMember(null)
      }
    },
    [],
  )

  useEffect(() => {
    let mounted = true

    ;(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!mounted) return

      if (!session?.access_token) {
        setStatus('guest')
        setAccessToken(null)
        setMember(null)
        return
      }

      setAccessToken(session.access_token)
      await refreshMember(session.access_token)
    })()

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return
      if (!session?.access_token) {
        setStatus('guest')
        setAccessToken(null)
        setMember(null)
        return
      }
      setAccessToken(session.access_token)
      await refreshMember(session.access_token)
    })

    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [refreshMember])

  const value = useMemo<PortalContextValue>(
    () => ({
      status,
      member,
      portalCall,
      logout,
    }),
    [status, member, portalCall, logout],
  )

  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>
}

