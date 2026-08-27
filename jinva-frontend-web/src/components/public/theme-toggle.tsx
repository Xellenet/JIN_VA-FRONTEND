"use client"

import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Sun, Moon } from "lucide-react"
import { Button } from "@/components/ui/button"

/**
 * The public site's light/dark switch — the same pattern
 * `src/components/dashboard/header.tsx` uses, including the `mounted` guard.
 *
 * The guard is not stylistic: `resolvedTheme` is unknown on the server, so
 * rendering the resolved icon before mount is a hydration mismatch. Pre-mount
 * both variants render `Moon`, which is what the server emits too.
 *
 * `showLabel` is for the mobile sheet, where an unlabelled icon on a touch
 * target has no affordance at all.
 */
export function PublicThemeToggle({ showLabel = false }: { readonly showLabel?: boolean }) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = mounted && resolvedTheme === "dark"
  const Icon = isDark ? Sun : Moon

  if (showLabel) {
    return (
      <Button
        variant="ghost"
        className="h-12 w-full justify-start gap-3 px-3 text-base font-medium"
        onClick={() => setTheme(isDark ? "light" : "dark")}
      >
        <Icon className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
        {isDark ? "Light mode" : "Dark mode"}
      </Button>
    )
  }

  return (
    <Button
      variant="ghost"
      size="icon"
      aria-label="Toggle theme"
      onClick={() => setTheme(isDark ? "light" : "dark")}
    >
      <Icon className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
    </Button>
  )
}
