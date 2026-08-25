import { useEffect, useMemo, useRef, useState } from 'react'
import { useForm, Controller } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import * as usersApi from '@/api/users'
import { preferencesFormSchema, type PreferencesFormInput } from '@/schemas/user'
import { ApiError } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: String(h),
  label: new Date(2000, 0, 1, h).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }),
}))

export function SettingsPage() {
  const queryClient = useQueryClient()
  const [serverError, setServerError] = useState<string | null>(null)

  const timezones = useMemo(() => Intl.supportedValuesOf('timeZone'), [])
  const browserTimezone = useMemo(
    () => Intl.DateTimeFormat().resolvedOptions().timeZone,
    [],
  )

  const { data: profile, isLoading } = useQuery({
    queryKey: ['users', 'me'],
    queryFn: usersApi.getMe,
  })

  const {
    control,
    handleSubmit,
    watch,
    reset,
    formState: { isSubmitting },
  } = useForm<PreferencesFormInput>({
    resolver: zodResolver(preferencesFormSchema),
    // Real defaults (not undefined) so the Select/checkbox inputs are
    // controlled from the very first render — reset() below then just
    // updates the same controlled values once the profile loads, instead
    // of transitioning uncontrolled -> controlled.
    defaultValues: {
      quietHoursEnabled: false,
      quietHoursStartHour: '22',
      quietHoursEndHour: '7',
      timezone: '',
    },
  })

  // Guarded to fire once: this form is uncontrolled-from-the-server after
  // the first load, so a later refetch of the same query (e.g. on window
  // focus) must not clobber in-progress edits by resetting again.
  const initialized = useRef(false)
  useEffect(() => {
    if (!profile || initialized.current) return
    initialized.current = true
    reset({
      quietHoursEnabled: profile.quietHoursStartHour !== null,
      quietHoursStartHour:
        profile.quietHoursStartHour !== null ? String(profile.quietHoursStartHour) : '22',
      quietHoursEndHour:
        profile.quietHoursEndHour !== null ? String(profile.quietHoursEndHour) : '7',
      timezone: profile.timezone ?? browserTimezone,
    })
  }, [profile, browserTimezone, reset])

  const mutation = useMutation({
    mutationFn: usersApi.updatePreferences,
    onSuccess: (updated) => {
      queryClient.setQueryData(['users', 'me'], updated)
      toast.success('Notification preferences saved.')
    },
  })

  const quietHoursEnabled = watch('quietHoursEnabled')

  async function onSubmit(input: PreferencesFormInput) {
    setServerError(null)
    try {
      await mutation.mutateAsync({
        quietHoursStartHour: input.quietHoursEnabled ? Number(input.quietHoursStartHour) : null,
        quietHoursEndHour: input.quietHoursEnabled ? Number(input.quietHoursEndHour) : null,
        timezone: input.timezone,
      })
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Something went wrong.')
    }
  }

  if (isLoading || !profile) {
    return <p className="p-6 text-sm text-muted-foreground">Loading…</p>
  }

  return (
    <div className="p-6">
      <h3 className="mb-4">Notification preferences</h3>

      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex max-w-md flex-col gap-4"
      >
        {serverError && (
          <Alert variant="destructive">
            <AlertDescription>{serverError}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="s-timezone">Timezone</Label>
          <Controller
            control={control}
            name="timezone"
            render={({ field }) => (
              // A plain native <select>, not the Radix-based Select used
              // elsewhere: Radix's Select only recognizes an item as valid
              // once it has actually been rendered into the DOM, which only
              // happens when the dropdown is opened. Setting a controlled
              // value programmatically (as reset() does here) before the
              // user ever opens a 400+ item list caused Radix to silently
              // revert the value back to empty — confirmed live, reproduced
              // in a production build too, so not a dev-only StrictMode
              // artifact. A native select has no such limitation.
              <select
                id="s-timezone"
                value={field.value}
                onChange={(e) => field.onChange(e.target.value)}
                className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
              >
                {timezones.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            )}
          />
          <p className="text-xs text-muted-foreground">
            Used to work out your local quiet hours below.
          </p>
        </div>

        <Controller
          control={control}
          name="quietHoursEnabled"
          render={({ field }) => (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={field.value}
                onChange={(e) => field.onChange(e.target.checked)}
                className="size-4"
              />
              Don&apos;t notify me during quiet hours
            </label>
          )}
        />

        {quietHoursEnabled && (
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-start">From</Label>
              <Controller
                control={control}
                name="quietHoursStartHour"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="s-start" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="s-end">Until</Label>
              <Controller
                control={control}
                name="quietHoursEndHour"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="s-end" className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {HOURS.map((h) => (
                        <SelectItem key={h.value} value={h.value}>
                          {h.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>
        )}

        <Button type="submit" disabled={isSubmitting} className="self-start">
          Save
        </Button>
      </form>
    </div>
  )
}
