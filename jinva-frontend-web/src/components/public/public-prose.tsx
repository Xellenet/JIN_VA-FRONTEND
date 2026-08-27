import type React from "react"
import { Separator } from "@/components/ui/separator"
import { Reveal } from "@/components/public/reveal"

/**
 * The shared shell for the four public prose pages — design-spec.md §8.1.
 *
 * `max-w-3xl` at 16px / `leading-relaxed` gives roughly 70 characters per line,
 * which is the readable range. No hero, no cards, no illustrations: these pages
 * exist to make the footer honest, not to be designed individually.
 *
 * `@tailwindcss/typography` is NOT installed and must not be added, so the prose
 * rhythm is hand-rolled as a small set of child selectors on the `<article>`.
 * Every value used is already in the app.
 */
const PROSE = [
  "[&>h2]:mt-10 [&>h2]:mb-3 [&>h2]:text-xl [&>h2]:font-semibold [&>h2]:text-foreground",
  "[&>h3]:mt-6 [&>h3]:mb-2 [&>h3]:text-base [&>h3]:font-semibold [&>h3]:text-foreground",
  "[&>p]:mb-4 [&>p]:text-base [&>p]:leading-relaxed [&>p]:text-foreground",
  "[&>ul]:mb-4 [&>ul]:list-disc [&>ul]:pl-6 [&>ul]:space-y-2 [&>ul]:text-base [&>ul]:leading-relaxed",
  "[&_a]:text-primary [&_a]:underline [&_a]:underline-offset-4",
].join(" ")

export function PublicProse({
  eyebrow,
  title,
  standfirst,
  children,
  footer,
}: Readonly<{
  eyebrow: string
  title: string
  standfirst?: React.ReactNode
  children: React.ReactNode
  /**
   * Rendered as a sibling BELOW the `<article>`, deliberately outside the prose
   * selectors — anything that needs its own type treatment (a "last updated"
   * line, say) goes here rather than fighting `[&>p]`'s specificity.
   */
  footer?: React.ReactNode
}>) {
  return (
    <main className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{eyebrow}</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">{title}</h1>
          {standfirst ? (
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">{standfirst}</p>
          ) : null}
          <Separator className="my-8" />
        </Reveal>
        <Reveal delay={80}>
          <article className={PROSE}>{children}</article>
          {footer}
        </Reveal>
      </div>
    </main>
  )
}
