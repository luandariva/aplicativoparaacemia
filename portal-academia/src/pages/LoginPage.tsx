'use client'

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../portal/supabase'

export function LoginPage() {
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErro(null)
    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (error) throw error
      nav('/dashboard')
    } catch (err: any) {
      setErro(err?.message || 'Falha ao entrar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="portalShell">
      <div className="portalPage portalLoginPage">
        <div className="portalCard portalLoginCard">
          <header className="portalLoginHeader">
            <h1 className="portalCardTitle portalLoginTitle">Portal Academia</h1>
            <p className="portalLoginSubtitle">Login para Gestor e Personal</p>
          </header>

          <form className="portalLoginForm" onSubmit={(e) => void onSubmit(e)}>
            <div className="portalLoginField">
              <label className="portalLabel" htmlFor="portal-login-email">
                E-mail
              </label>
              <input
                id="portal-login-email"
                className="portalInput"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
              />
            </div>
            <div className="portalLoginField">
              <label className="portalLabel" htmlFor="portal-login-password">
                Senha
              </label>
              <input
                id="portal-login-password"
                className="portalInput"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {erro && <p className="portalLoginError">{erro}</p>}

            <button
              type="submit"
              className="portalBtn portalBtnPrimary portalLoginSubmit"
              disabled={loading}
            >
              {loading ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

