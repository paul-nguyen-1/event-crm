import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import * as authApi from '@/api/auth'
import {
  clearTokens,
  decodeAccessToken,
  getAccessToken,
  setTokens,
  type AccessTokenPayload,
} from '@/lib/auth-storage'
import type { LoginInput, SignupInput } from '@/schemas/auth'

interface AuthContextValue {
  user: AccessTokenPayload | null
  isAuthenticated: boolean
  signup: (input: SignupInput) => Promise<void>
  login: (input: LoginInput) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AccessTokenPayload | null>(() => {
    const token = getAccessToken()
    return token ? decodeAccessToken(token) : null
  })

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: user !== null,
      async signup(input) {
        const tokens = await authApi.signup(input)
        setTokens(tokens.accessToken, tokens.refreshToken)
        setUser(decodeAccessToken(tokens.accessToken))
      },
      async login(input) {
        const tokens = await authApi.login(input)
        setTokens(tokens.accessToken, tokens.refreshToken)
        setUser(decodeAccessToken(tokens.accessToken))
      },
      async logout() {
        try {
          await authApi.logout()
        } finally {
          clearTokens()
          setUser(null)
        }
      },
    }),
    [user],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider')
  return ctx
}
