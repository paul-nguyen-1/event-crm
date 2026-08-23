import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '@/contexts/auth-context'

export function GoogleCallbackPage() {
  const { loginWithTokens } = useAuth()
  const navigate = useNavigate()
  const ran = useRef(false)

  useEffect(() => {
    if (ran.current) return
    ran.current = true

    const params = new URLSearchParams(window.location.hash.slice(1))
    const accessToken = params.get('accessToken')
    const refreshToken = params.get('refreshToken')

    if (accessToken && refreshToken) {
      loginWithTokens(accessToken, refreshToken)
      navigate('/contacts', { replace: true })
    } else {
      navigate('/login', { replace: true })
    }
  }, [loginWithTokens, navigate])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <p className="text-sm text-muted-foreground">Signing you in…</p>
    </div>
  )
}
