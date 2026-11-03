"use client"

import type React from "react"
import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { FormField } from "@/components/forms/form-field"
import { ApiError, apiFetch } from "@/lib/api"
import type { User } from "@/lib/types"
import { USERNAME_HINT, USERNAME_MESSAGES, sanitizeUsername, validateUsername } from "@/lib/username"

/**
 * Settings → Account, for both roles: the username (generated at sign-up by
 * auth v2, so people should be able to change it) and gender (no longer asked
 * at sign-up; optional here, where "Prefer not to say" is stored as null).
 *
 * Only changed fields are sent to `PATCH /users/me`, so an account whose
 * stored username predates the rule can still save its gender (the backend
 * checks only a new username), and an untouched older OTHER gender is never
 * rewritten.
 */

const UNSET = "UNSET"
const GENDER_CHOICES = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: UNSET, label: "Prefer not to say" },
] as const

function genderChoice(stored: string | null | undefined): string {
  if (stored === "MALE" || stored === "FEMALE" || stored === "OTHER") return stored
  return UNSET
}

export function AccountIdentityCard({
  user,
  refreshUser,
  headingLevel = "h2",
}: {
  user: User
  refreshUser: () => Promise<void>
  headingLevel?: "h2" | "h3"
}) {
  const [username, setUsername] = useState(user.username ?? "")
  const [gender, setGender] = useState(genderChoice(user.gender))
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setUsername(user.username ?? "")
    setGender(genderChoice(user.gender))
    setUsernameError(null)
  }, [user.username, user.gender])

  const storedGender = genderChoice(user.gender)
  const usernameChanged = username.trim() !== (user.username ?? "")
  const genderChanged = gender !== storedGender
  const dirty = usernameChanged || genderChanged

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target
    const { value, caret } = sanitizeUsername(input.value, input.selectionStart)
    if (value !== input.value) {
      input.value = value
      if (caret !== null) input.setSelectionRange(caret, caret)
    }
    setUsername(value)
    if (usernameError) setUsernameError(null)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!dirty) return
    if (usernameChanged) {
      const problem = validateUsername(username, true)
      if (problem) {
        setUsernameError(problem)
        document.getElementById("account-username")?.focus()
        return
      }
    }
    setSaving(true)
    try {
      await apiFetch("/users/me", {
        method: "PATCH",
        body: JSON.stringify({
          ...(usernameChanged ? { username: username.trim() } : {}),
          ...(genderChanged ? { gender: gender === UNSET ? null : gender } : {}),
        }),
      })
      await refreshUser()
      toast.success("Account details saved.")
    } catch (err) {
      if (err instanceof ApiError && (err.status === 409 || (err.status === 400 && /username/i.test(err.message)))) {
        setUsernameError(err.status === 409 ? USERNAME_MESSAGES.taken : USERNAME_MESSAGES.characters)
        document.getElementById("account-username")?.focus()
        return
      }
      toast.error(err instanceof Error && err.message ? err.message : "Couldn't save your changes.")
    } finally {
      setSaving(false)
    }
  }

  const Heading = headingLevel
  return (
    <Card className="gap-0 py-0">
      <div className="border-b p-4 sm:p-6">
        <Heading className="font-semibold">Username and gender</Heading>
        <p className="text-sm text-muted-foreground">
          Your username is made from your name when you sign up. You can change it here.
        </p>
      </div>
      <CardContent className="p-4 sm:p-6">
        <form onSubmit={handleSave} noValidate className="grid gap-6 md:grid-cols-2">
          <FormField id="account-username" label="Username" hint={USERNAME_HINT} error={usernameError}>
            {(control) => (
              <Input
                {...control}
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={30}
                value={username}
                onChange={handleUsernameChange}
                disabled={saving}
                className="max-sm:h-11"
              />
            )}
          </FormField>
          <FormField id="account-gender" label="Gender" optional>
            {(control) => (
              <Select value={gender} onValueChange={setGender} disabled={saving}>
                <SelectTrigger {...control} className="w-full max-sm:data-[size=default]:h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GENDER_CHOICES.map((choice) => (
                    <SelectItem key={choice.value} value={choice.value}>
                      {choice.label}
                    </SelectItem>
                  ))}
                  {/* DI5: OTHER still reads back for older rows but can't be chosen. */}
                  {storedGender === "OTHER" && (
                    <SelectItem value="OTHER" disabled>
                      Other
                    </SelectItem>
                  )}
                </SelectContent>
              </Select>
            )}
          </FormField>
          <div className="flex justify-end md:col-span-2">
            <Button type="submit" className="max-sm:h-11 max-sm:w-full" disabled={saving || !dirty}>
              {saving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
              Save
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
