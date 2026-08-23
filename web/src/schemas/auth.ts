import { z } from 'zod'

// Mirrors api/src/auth/dto/signup.dto.ts
export const signupSchema = z.object({
  email: z.email(),
  password: z.string().min(8, 'At least 8 characters.'),
  name: z.string().optional(),
})
export type SignupInput = z.infer<typeof signupSchema>

// Mirrors api/src/auth/dto/login.dto.ts
export const loginSchema = z.object({
  email: z.email(),
  password: z.string().min(1, 'Password is required.'),
})
export type LoginInput = z.infer<typeof loginSchema>

export interface AuthTokens {
  accessToken: string
  refreshToken: string
}
