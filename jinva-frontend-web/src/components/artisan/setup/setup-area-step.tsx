"use client"

import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import {
  LocationFields,
  formatLocation,
  useRegionList,
  validateRegion,
  validateTown,
} from "@/components/auth/location-field"
import { useAuth } from "@/contexts/auth-context"
import { apiFetch } from "@/lib/api"
import { splitStoredPhone } from "@/lib/phone"
import { matchRegion } from "@/lib/regions"
import type { SetupProfile } from "@/lib/artisan-setup-api"

/**
 * "Where you work": the town-and-region fields sign-up uses (driven by the
 * phone number's country), saved as the profile's one `location` string,
 * e.g. "Osu, Greater Accra", which is what client search matches on.
 */

/** "Osu, Greater Accra" → town "Osu", region "Greater Accra" when the last part is a known region. */
function splitLocation(location: string | null | undefined, regions: readonly string[] | null): { town: string; region: string } {
  const value = (location ?? "").trim()
  const cut = value.lastIndexOf(",")
  if (cut > 0 && regions) {
    const region = matchRegion(value.slice(cut + 1).trim(), regions)
    if (region) return { town: value.slice(0, cut).trim(), region }
  }
  return { town: value, region: "" }
}

export function SetupAreaStep({
  formId,
  profile,
  onSaved,
  onSavingChange,
}: Readonly<{
  formId: string
  profile: SetupProfile
  onSaved: (saved: SetupProfile) => void
  onSavingChange: (saving: boolean) => void
}>) {
  const { user } = useAuth()
  const country = splitStoredPhone(user?.phone).country
  const regions = useRegionList(country)

  const [town, setTown] = useState("")
  const [region, setRegion] = useState("")
  const [errors, setErrors] = useState<{ town?: string | null; region?: string | null }>({})
  const [announcement, setAnnouncement] = useState("")
  const [saving, setSaving] = useState(false)

  // Filled once, when the country's region list is known (to split the stored string).
  const filled = useRef(false)
  useEffect(() => {
    if (filled.current || regions === undefined) return
    filled.current = true
    const parts = splitLocation(profile.location, regions)
    setTown(parts.town)
    setRegion(parts.region)
  }, [regions, profile.location])

  useEffect(() => {
    onSavingChange(saving)
  }, [saving, onSavingChange])

  const save = async () => {
    const list = regions === undefined ? null : regions
    const next = {
      town: validateTown(town, region, { requireValue: true }),
      region: validateRegion(region, list, { requireValue: true }),
    }
    setErrors(next)
    if (next.town || next.region) {
      document.getElementById(next.town ? "setup-town" : "setup-region")?.focus()
      return
    }
    setSaving(true)
    try {
      const saved = await apiFetch<SetupProfile>("/users/me/artisan-profile", {
        method: "PATCH",
        body: JSON.stringify({ location: formatLocation(town, list ? (matchRegion(region, list) ?? region) : region) }),
      })
      // No toast: the step moves on, and the step list shows it done.
      onSaved(saved)
    } catch (err) {
      toast.error(err instanceof Error && err.message ? err.message : "Couldn’t save your area. Try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <form
      id={formId}
      noValidate
      // 44px inputs on phones, as on the other setup steps.
      className="max-sm:[&_input]:h-11"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <LocationFields
        country={country}
        regions={regions}
        town={town}
        region={region}
        onTownChange={(value) => {
          setTown(value)
          setErrors((e) => ({ ...e, town: null }))
        }}
        onRegionChange={(value) => {
          setRegion(value)
          setErrors((e) => ({ ...e, region: null }))
        }}
        townError={errors.town ?? undefined}
        regionError={errors.region ?? undefined}
        onAnnounce={setAnnouncement}
        disabled={saving}
        townId="setup-town"
        regionId="setup-region"
      />
      <p aria-live="polite" className="sr-only">
        {announcement}
      </p>
    </form>
  )
}
