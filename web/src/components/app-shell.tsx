import { NavLink, Outlet } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import * as contactsApi from '@/api/contacts'
import { useAuth } from '@/contexts/auth-context'
import { useNotifications } from '@/contexts/notifications-context'
import { FREE_CONTACT_LIMIT } from '@/schemas/user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'

const NAV_LINK_CLASS = ({ isActive }: { isActive: boolean }) =>
  `flex items-center justify-between rounded-r-sm border-l-2 px-2.5 py-1.5 text-sm ${
    isActive
      ? 'border-primary bg-primary/10 text-primary'
      : 'border-transparent text-foreground hover:bg-foreground/5'
  }`

export function AppShell() {
  const { user, logout } = useAuth()
  const { unreadCount } = useNotifications()

  const { data: contacts } = useQuery({
    queryKey: ['contacts'],
    queryFn: contactsApi.listContacts,
  })

  const isFree = user?.tier !== 'PAID'
  const contactCount = contacts?.length ?? 0

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
          <NavLink to="/dashboard" className={NAV_LINK_CLASS}>
            Dashboard
            {unreadCount > 0 && <Badge>{unreadCount}</Badge>}
          </NavLink>
          <NavLink to="/contacts" className={NAV_LINK_CLASS}>
            People
          </NavLink>
          <NavLink to="/settings" className={NAV_LINK_CLASS}>
            Settings
          </NavLink>
        </nav>
        <div className="mt-auto flex flex-col gap-3">
          {isFree && (
            <div className="border-t border-border px-2.5 pt-3">
              <div className="mb-1.5 text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
                Free plan
              </div>
              <div className="mb-1.5 text-xs text-muted-foreground">
                {contactCount} of {FREE_CONTACT_LIMIT} people tracked
              </div>
              <div className="mb-2 h-1 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full bg-primary"
                  style={{
                    width: `${Math.min(100, (contactCount / FREE_CONTACT_LIMIT) * 100)}%`,
                  }}
                />
              </div>
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled
                title="Coming soon"
              >
                Upgrade
              </Button>
            </div>
          )}
          <div className="border-t border-border px-2.5 pt-3">
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
        </div>
      </aside>
      <main className="overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
