import type React from "react"
import Link from "next/link"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import type { SelfSignupRole } from "@/lib/signup-flow"
import { BrandPanel, PhoneStrip } from "./auth-brand"
import "./auth-motion.css"

/**
 * The frame every auth screen sits in (auth redesign, approved 3 Nov 2026).
 *
 * - ≥ 980px: the form on the left (logo row above it), the brand panel on the
 *   right (./auth-brand.tsx): drifting photo columns under the brand
 *   gradient, a headline that follows `role`, a sample activity card and the
 *   "Need help?" link. The panel is sticky, so a long form scrolls past it.
 * - < 980px: no side panel. One screen: the slim brand strip replaces the
 *   logo row (it hides itself at 640px tall or less), and `strip={false}`
 *   drops it for the sign-up details step, which needs the room.
 *
 * The step / code / check motion lives in ./auth-motion.css, imported here
 * because this layout is on every auth page and nowhere else.
 */

interface AuthSplitLayoutProps {
  children: React.ReactNode
  /** The role chosen so far; the panel headline follows it (client copy when none). */
  role?: SelfSignupRole | null
  /** The phone brand strip (default on). Off for the sign-up details step. */
  strip?: boolean
}

export function AuthSplitLayout({ children, role = null, strip = true }: Readonly<AuthSplitLayoutProps>) {
  return (
    <div
      data-auth-compact={strip ? undefined : "true"}
      className="auth-frame grid min-h-dvh bg-background min-[980px]:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
    >
      <div className="flex min-w-0 flex-col">
        {strip ? <PhoneStrip /> : null}
        <header className="hidden items-center px-8 pt-7 min-[980px]:flex">
          <Link
            href="/"
            aria-label="JinVa home"
            className="inline-flex min-h-11 items-center rounded-md focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/30"
          >
            <Logo />
          </Link>
        </header>
        <main
          className={cn(
            "flex flex-1 items-start justify-center px-5 pb-5 min-[980px]:items-center min-[980px]:px-8 min-[980px]:pb-12 min-[980px]:pt-8",
            strip ? "pt-4" : "pt-3",
          )}
        >
          <div className="w-full max-w-[27.5rem]">{children}</div>
        </main>
      </div>

      <BrandPanel role={role} />
    </div>
  )
}
