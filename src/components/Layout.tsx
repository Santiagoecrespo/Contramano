import type { ReactNode } from 'react'
import { Brand } from './Brand'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header"><Brand /><span className="header-note">Juego web para juntadas</span></header>
      <main>{children}</main>
    </div>
  )
}

