import Link from "next/link"
import { PublicLink } from "@/components/public/public-link"
import { Compass } from "lucide-react"
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
 * The public 404 body — design-spec.md §4.2.
 *
 * Worth designing rather than leaving to Next's default: the footer's
 * no-dead-links guarantee makes a public 404 the visible failure mode of any
 * future typo, and a visitor who guesses `/faq` (reasonable, since the FAQ lives
 * at `/#faq`) should land somewhere useful rather than nowhere.
 *
 * Lives in its own component because it is rendered from two places, and it has
 * to be:
 *   • `src/app/(public)/not-found.tsx` — for a `notFound()` call from inside the
 *     group, where `(public)/layout.tsx` already supplies the header and footer;
 *   • `src/app/not-found.tsx` — for any URL that matches no route at all, which
 *     is the case that actually matters here. A route-group `not-found` does NOT
 *     catch unmatched URLs, so without the root file `/faq` would fall through to
 *     Next's bare built-in 404. The root copy renders its own header and footer,
 *     since no `(public)` layout wraps it.
 */
const SUGGESTIONS = [
  { label: "About", href: "/about" },
  { label: "FAQ", href: "/#faq" },
  { label: "Contact", href: "/contact" },
  { label: "Log in", href: "/login" },
] as const

/**
 * The page-not-found metadata both `not-found.tsx` boundaries export, kept here
 * next to the copy it has to agree with. See those files for why it is exported
 * from this module rather than written inline in each.
 */
export const notFoundMetadata = {
  title: "Page not found",
  description: "The link may be old, or the address may have a typo.",
  // No `robots` key on purpose: Next.js already emits
  // `<meta name="robots" content="noindex"/>` for a not-found boundary, and
  // setting it here produced a second, duplicate robots tag in the rendered HTML.
} as const

export function NotFoundContent() {
  return (
    <main className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Compass aria-hidden="true" />
          </EmptyMedia>
          {/*
            The `<h1>` is required, not decorative: this was the only public page
            in the app with no `h1` at all, so its heading outline started at the
            footer's `<h2>` column headings (LP10 — "heading levels descend
            without skipping"). `EmptyTitle` renders a `div`, so the heading is
            nested inside it; Tailwind's preflight resets heading `font-size` and
            `font-weight` to `inherit`, so it picks up `EmptyTitle`'s type styles
            and looks identical.
          */}
          <EmptyTitle>
            <h1>We couldn&rsquo;t find that page</h1>
          </EmptyTitle>
          <EmptyDescription>The link may be old, or the address may have a typo.</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button asChild className="w-full">
            <Link href="/">Back to home</Link>
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-sm text-muted-foreground">
            {SUGGESTIONS.map((suggestion) => (
              <PublicLink
                key={suggestion.href}
                href={suggestion.href}
                className="rounded-md underline underline-offset-4 outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
              >
                {suggestion.label}
              </PublicLink>
            ))}
          </div>
        </EmptyContent>
      </Empty>
    </main>
  )
}
