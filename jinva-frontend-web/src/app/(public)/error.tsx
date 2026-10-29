"use client"

import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

/**
 * Error boundary for every route in the `(public)` group — design-spec.md §4.1.
 *
 * NEVER A DEAD END: even a broken marketing page must still be able to convert,
 * so this offers three real actions rather than just "try again". The public
 * header and footer stay rendered above and below, because `error.tsx` inside the
 * group sits under its `layout.tsx`.
 */
export default function PublicError({ reset }: Readonly<{ error: Error; reset: () => void }>) {
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AlertTriangle aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>Something went wrong loading this page</EmptyTitle>
          <EmptyDescription>
            This is on us, not you. Try again &mdash; or head straight to your account.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={reset} className="w-full">
            Try again
          </Button>
          <Button variant="outline" asChild className="w-full">
            <Link href="/signup">Get started</Link>
          </Button>
          <Button variant="ghost" asChild className="w-full">
            <Link href="/login">Log in</Link>
          </Button>
        </EmptyContent>
      </Empty>
    </div>
  )
}
