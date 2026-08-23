import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/contexts/auth-context'
import { loginSchema, type LoginInput } from '@/schemas/auth'
import { ApiError, API_URL } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(input: LoginInput) {
    setServerError(null)
    try {
      await login(input)
      navigate('/contacts')
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="flex min-h-svh flex-col justify-center px-6 py-12">
      <div className="mx-auto w-full max-w-sm">
        <div className="mb-6 flex items-baseline gap-1.5">
          <span className="font-heading text-lg font-semibold tracking-wide">
            OCCASION
          </span>
          <span className="font-mono text-[9px] text-primary">+</span>
        </div>
        <h1 className="mb-4 text-3xl">Log in</h1>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
          {serverError && (
            <Alert variant="destructive">
              <AlertDescription>{serverError}</AlertDescription>
            </Alert>
          )}
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email address</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@work.com"
              {...register('email')}
            />
            {errors.email && (
              <p className="text-xs text-destructive">{errors.email.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              autoComplete="current-password"
              {...register('password')}
            />
            {errors.password && (
              <p className="text-xs text-destructive">{errors.password.message}</p>
            )}
          </div>
          <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
            Log in
          </Button>
          <div className="my-1 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
              Or
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => {
              window.location.href = `${API_URL}/auth/google`
            }}
          >
            <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
              <path
                fill="#4285F4"
                d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.63v3h3.88c2.27-2.09 3.54-5.17 3.54-8.87Z"
              />
              <path
                fill="#34A853"
                d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.87-3a7.4 7.4 0 0 1-11.03-3.9H1.06v3.09A12 12 0 0 0 12 24Z"
              />
              <path
                fill="#FBBC05"
                d="M5.03 14.19a7.2 7.2 0 0 1 0-4.38V6.72H1.06a12 12 0 0 0 0 10.56Z"
              />
              <path
                fill="#EA4335"
                d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.94 1.19 15.24 0 12 0A12 12 0 0 0 1.06 6.72l3.97 3.09A7.17 7.17 0 0 1 12 4.77Z"
              />
            </svg>
            Continue with Google
          </Button>
          <p className="mt-2 text-xs text-muted-foreground">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="text-primary underline-offset-4 hover:underline">
              Create one
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
