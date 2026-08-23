import { api } from '@/lib/api'
import type { AuthTokens, LoginInput, SignupInput } from '@/schemas/auth'

export function signup(input: SignupInput) {
  return api.post<AuthTokens>('/auth/signup', input, { auth: false })
}

export function login(input: LoginInput) {
  return api.post<AuthTokens>('/auth/login', input, { auth: false })
}

export function logout() {
  return api.post<void>('/auth/logout')
}
