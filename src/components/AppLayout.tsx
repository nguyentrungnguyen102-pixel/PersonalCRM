import { useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useLabels } from '../hooks/useSettings'
import { Avatar } from './Avatar'
import { QuickAddFab } from './QuickAddFab'

interface NavItem {
  key: string
  path: string
  primary: boolean
  end?: boolean
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard', path: '/', primary: true, end: true },
  { key: 'contacts', path: '/danh-ba', primary: true },
  { key: 'map', path: '/so-do', primary: false },
  { key: 'reminders', path: '/nhac-nho', primary: true },
  { key: 'groups', path: '/nhom', primary: false },
  { key: 'settings', path: '/cai-dat', primary: false },
]

export function AppLayout() {
  const { t } = useLabels()
  const { profile, user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)

  const displayName = profile?.display_name || user?.email || '?'
  const primaryItems = NAV_ITEMS.filter((item) => item.primary)
  const moreItems = NAV_ITEMS.filter((item) => !item.primary)

  return (
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg text-ink">
      {/* Blob gradient nền */}
      <div
        aria-hidden
        className="anim-blob pointer-events-none fixed -top-20 -right-20 z-0 h-[500px] w-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle at 65%, rgba(249,115,22,0.08), transparent 60%)',
        }}
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-24 -left-16 z-0 h-[400px] w-[400px] rounded-full"
        style={{ background: 'radial-gradient(circle, rgba(251,113,133,0.05), transparent 60%)' }}
      />

      {/* Top nav */}
      <nav className="relative z-20 flex h-[54px] flex-shrink-0 items-center gap-0.5 border-b border-line bg-surface px-5 backdrop-blur-xl">
        <div className="mr-5 flex-shrink-0 font-heading text-xs font-bold tracking-[1.5px] uppercase">
          <span className="text-primary">Quan</span>He360
        </div>
        <div className="hidden items-center gap-0.5 md:flex">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.key}
              to={item.path}
              end={item.end}
              className={({ isActive }) =>
                `flex h-[54px] items-center border-b-2 px-3 text-xs whitespace-nowrap transition-colors ${
                  isActive
                    ? 'border-primary font-semibold text-ink'
                    : 'border-transparent text-muted hover:text-ink'
                }`
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </div>
        <div className="flex-1" />
        <div className="flex items-center gap-2.5">
          <Avatar name={displayName} size={28} />
          <button
            type="button"
            onClick={() => void signOut()}
            className="rounded-md border border-line px-2.5 py-1 text-[11px] text-muted transition-colors hover:text-ink"
          >
            {t('actions.logout')}
          </button>
        </div>
      </nav>

      <main className="relative z-10 flex-1 overflow-y-auto pb-16 md:pb-0">
        <Outlet />
      </main>

      <QuickAddFab />

      {/* Bottom tab bar — mobile */}
      <nav className="fixed right-0 bottom-0 left-0 z-20 flex h-14 flex-shrink-0 items-center justify-around border-t border-line bg-surface md:hidden">
        {primaryItems.map((item) => (
          <NavLink
            key={item.key}
            to={item.path}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-0.5 px-2 text-[10px] ${
                isActive ? 'font-semibold text-primary' : 'text-muted'
              }`
            }
          >
            {t(`nav.${item.key}`)}
          </NavLink>
        ))}
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          className={`flex flex-col items-center gap-0.5 px-2 text-[10px] ${
            menuOpen ? 'font-semibold text-primary' : 'text-muted'
          }`}
        >
          <span aria-hidden>☰</span>
          <span>{t('nav.menu')}</span>
        </button>
      </nav>

      {menuOpen && (
        <div
          className="fixed inset-0 z-20 md:hidden"
          onClick={() => setMenuOpen(false)}
          aria-hidden
        >
          <div
            className="anim-slide-up absolute right-0 bottom-14 left-0 rounded-t-[13px] border-t border-line bg-surface p-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex flex-col gap-1">
              {moreItems.map((item) => (
                <NavLink
                  key={item.key}
                  to={item.path}
                  onClick={() => setMenuOpen(false)}
                  className={({ isActive }) =>
                    `rounded-lg px-3 py-2.5 text-sm ${
                      isActive ? 'bg-card font-semibold text-primary' : 'text-muted'
                    }`
                  }
                >
                  {t(`nav.${item.key}`)}
                </NavLink>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default AppLayout
