import type { ReactNode } from 'react'
import { Brand } from './Brand'

export function Layout({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <header className="site-header"><Brand /><span className="header-note">Juego de mesa, pero web</span></header>
      <main>{children}</main>
    </div>
  )
}
