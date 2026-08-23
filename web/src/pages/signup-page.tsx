import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '@/contexts/auth-context'
import { signupSchema, type SignupInput } from '@/schemas/auth'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableRow,
} from '@/components/ui/table'

const PITCH_ROWS = [
  ['People you can track', '10 free'],
  ['Dates per person', 'Unlimited'],
  ['Reminder channel', 'Email'],
  ['Card required', 'No'],
]

export function SignupPage() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<SignupInput>({ resolver: zodResolver(signupSchema) })

  async function onSubmit(input: SignupInput) {
    setServerError(null)
    try {
      await signup(input)
      navigate('/contacts')
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  return (
    <div className="grid min-h-svh md:grid-cols-2">
      <div className="flex flex-col justify-center px-6 py-12">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6 flex items-baseline gap-1.5">
            <span className="font-heading text-lg font-semibold tracking-wide">
              OCCASION
            </span>
            <span className="font-mono text-[9px] text-primary">+</span>
          </div>
          <h1 className="mb-4 text-3xl">Create an account</h1>
          <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-3">
            {serverError && (
              <Alert variant="destructive">
                <AlertDescription>{serverError}</AlertDescription>
              </Alert>
            )}
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email">
                Email address <span className="text-muted-foreground">(required)</span>
              </Label>
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
              <Label htmlFor="name">Name</Label>
              <Input id="name" autoComplete="name" {...register('name')} />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password">
                Password <span className="text-muted-foreground">(required)</span>
              </Label>
              <Input
                id="password"
                type="password"
                autoComplete="new-password"
                {...register('password')}
              />
              <span className="text-xs text-muted-foreground">
                At least 8 characters.
              </span>
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>
            <Button type="submit" className="mt-2 w-full" disabled={isSubmitting}>
              Create account
            </Button>
            <p className="mt-2 text-xs text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-primary underline-offset-4 hover:underline">
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
      <div className="hidden flex-col justify-center gap-4 border-l border-border px-6 py-12 md:flex">
        <div className="mx-auto flex w-full max-w-sm flex-col gap-4">
          <div className="text-[10px] tracking-[0.1em] text-muted-foreground uppercase">
            What it does
          </div>
          <Table>
            <TableBody>
              {PITCH_ROWS.map(([label, value]) => (
                <TableRow key={label}>
                  <TableCell>{label}</TableCell>
                  <TableCell className="text-right font-mono">{value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          <p className="text-xs text-muted-foreground">
            Nothing is charged on the free plan and no card is stored.
          </p>
        </div>
      </div>
    </div>
  )
}
