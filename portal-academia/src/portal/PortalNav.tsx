'use client'

import { NavLink, useNavigate } from 'react-router-dom'
import type { PortalMember } from './PortalContext'
import { supabase } from './supabase'

function IconHome() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="portalNavIconStroke"
        d="M4 10.5L12 4l8 6.5V20a1 1 0 0 1-1 1h-5v-6H10v6H5a1 1 0 0 1-1-1v-9.5z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconUsers() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="portalNavIconStroke"
        d="M17 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 20v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconDumbbell() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="portalNavIconStroke"
        d="M4 12h3M17 12h3M7 10v4M14 10v4M9 12h6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconMail() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="portalNavIconStroke"
        d="M4 4h16a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="portalNavIconStroke"
        d="m22 6-10 7L2 6"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function IconLogout() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        className="portalNavIconStroke"
        d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function PortalNav({ member }: { member: PortalMember }) {
  const nav = useNavigate()
  const academiaNome = member.academia?.nome ?? 'Academia'

  async function onLogout() {
    await supabase.auth.signOut()
    nav('/login')
  }

  const linkClass = ({ isActive }: { isActive: boolean }) =>
    `portalNavItem${isActive ? ' portalNavItemActive' : ''}`

  return (
    <aside className="portalSidebar" aria-label="Navegação principal">
      <div className="portalSidebarBrand">
        <p className="portalBrandTitle">Portal Academia</p>
        <p className="portalBrandSub">{academiaNome}</p>
      </div>

      <nav className="portalSidebarNav">
        <NavLink to="/dashboard" className={linkClass} end>
          <IconHome />
          <span>Início</span>
        </NavLink>
        <NavLink to="/alunos" className={linkClass}>
          <IconUsers />
          <span>Alunos</span>
        </NavLink>
        {(member.papel === 'personal' || member.papel === 'gestor') && (
          <NavLink to="/treinos-academia" className={linkClass}>
            <IconDumbbell />
            <span>Treinos academia</span>
          </NavLink>
        )}
        {member.papel === 'gestor' && (
          <NavLink to="/convites" className={linkClass}>
            <IconMail />
            <span>Convites</span>
          </NavLink>
        )}
      </nav>

      <div className="portalSidebarFooter">
        <button
          type="button"
          className="portalBtn portalBtnGhost portalBtnLogout"
          onClick={() => void onLogout()}
        >
          <IconLogout />
          Sair
        </button>
      </div>
    </aside>
  )
}
