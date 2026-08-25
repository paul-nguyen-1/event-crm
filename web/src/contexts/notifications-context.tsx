import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { toast } from 'sonner'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from './auth-context'
import { getAccessToken } from '@/lib/auth-storage'
import type { ReminderNotification } from '@/schemas/notification'

const WS_URL = import.meta.env.VITE_WS_URL
const RECONNECT_DELAY_MS = 3000

export type ConnectionState = 'connecting' | 'connected' | 'polling'

interface NotificationsContextValue {
  connectionState: ConnectionState
  unreadCount: number
  clearUnread: () => void
}

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
)

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth()
  const queryClient = useQueryClient()
  const [connectionState, setConnectionState] =
    useState<ConnectionState>('connecting')
  const [unreadCount, setUnreadCount] = useState(0)
  // Client-side dedup safety net — the Go service already guarantees no
  // duplicate push for the same eventId, this just protects against this
  // effect re-running (e.g. StrictMode double-invoke) within one session.
  const seenEventIds = useRef(new Set<string>())

  useEffect(() => {
    if (!isAuthenticated || !WS_URL) {
      setConnectionState('polling')
      return
    }

    let cancelled = false
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    function handleMessage(event: MessageEvent<string>) {
      let notification: ReminderNotification
      try {
        notification = JSON.parse(event.data) as ReminderNotification
      } catch {
        return
      }
      if (seenEventIds.current.has(notification.eventId)) return
      seenEventIds.current.add(notification.eventId)

      setUnreadCount((count) => count + 1)
      toast(notification.title, { description: notification.body })
      void queryClient.invalidateQueries({ queryKey: ['events', 'upcoming'] })
    }

    function connect() {
      const token = getAccessToken()
      if (!token) return

      setConnectionState((prev) => (prev === 'connected' ? prev : 'connecting'))
      socket = new WebSocket(`${WS_URL}/ws?token=${encodeURIComponent(token)}`)

      socket.onopen = () => {
        if (cancelled) return
        setConnectionState('connected')
      }
      socket.onmessage = handleMessage
      socket.onerror = () => {
        socket?.close()
      }
      socket.onclose = () => {
        if (cancelled) return
        // Documented fallback: while disconnected, the dashboard polls
        // instead of relying on a push that isn't arriving.
        setConnectionState('polling')
        reconnectTimer = setTimeout(connect, RECONNECT_DELAY_MS)
      }
    }

    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close()
    }
  }, [isAuthenticated, queryClient])

  return (
    <NotificationsContext.Provider
      value={{
        connectionState,
        unreadCount,
        clearUnread: () => setUnreadCount(0),
      }}
    >
      {children}
    </NotificationsContext.Provider>
  )
}

export function useNotifications() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) {
    throw new Error(
      'useNotifications must be used within a NotificationsProvider',
    )
  }
  return ctx
}
