import { NavLink, Outlet } from 'react-router'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'

export function AppShell() {
  const { user, logout } = useAuth()

  return (
    <div className="grid min-h-svh grid-cols-[208px_1fr]">
      <aside className="flex flex-col gap-6 border-r border-border px-3 py-4">
        <div className="flex items-baseline gap-1.5 pl-2.5">
          <span className="font-heading text-lg font-semibold tracking-wide">
            OCCASION
          </span>
          <span className="font-mono text-[9px] text-primary">+</span>
        </div>
        <nav className="flex flex-col gap-0.5">
          <NavLink
            to="/contacts"
            className={({ isActive }) =>
              `rounded-r-sm border-l-2 px-2.5 py-1.5 text-sm ${
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent text-foreground hover:bg-foreground/5'
              }`
            }
          >
            People
          </NavLink>
        </nav>
        <div className="mt-auto border-t border-border px-2.5 pt-3">
          <div className="truncate text-xs text-muted-foreground">
            {user?.email}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="mt-2 w-full"
            onClick={() => logout()}
          >
            Log out
          </Button>
        </div>
      </aside>
      <main className="overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
