import Link from "next/link"
import { Logo } from "@/components/logo"
import { FOOTER_COLUMNS } from "@/components/public/public-nav"
import { PublicLink } from "@/components/public/public-link"

/**
 * Footer shared by `/` and every page in the `(public)` group
 * (design-spec.md §3.12).
 *
 * A server component on purpose: the copyright year is computed at render, so it
 * is always current and costs no client JS (LP9 explicitly forbids a hardcoded
 * literal).
 *
 * No social icon row — requirements.md Open Question 5 supplied no real account
 * URLs, and "every nav works" leaves no room for an icon pointing at `#`. No
 * newsletter form either: nothing exists to receive one.
 */
export function PublicFooter() {
  const year = new Date().getFullYear()

  return (
    <footer className="border-t border-border bg-muted/40">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8">
        {/*
          SIX columns at lg, not five: the brand block spans two and there are
          four link columns, so a 5-column grid orphans "Legal" onto a second row
          on its own. (design-spec.md §3.12 says 5, which doesn't add up — 2 + 4
          is 6.) At sm the brand block spans the full two-column row, which is the
          spec's intended "2 cols" shape at 768.
        */}
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-6">
          <div className="sm:col-span-2">
            <Logo />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              An artisan services marketplace. Find verified artisans, book them, pay safely, and rate the
              work.
            </p>
          </div>

          {FOOTER_COLUMNS.map((column) => (
            <nav key={column.heading} aria-labelledby={`footer-${column.heading.toLowerCase()}`}>
              <h2
                id={`footer-${column.heading.toLowerCase()}`}
                className="text-sm font-semibold text-foreground"
              >
                {column.heading}
              </h2>
              <ul className="mt-4 space-y-3">
                {column.links.map((link) => (
                  <li key={`${column.heading}-${link.href}`}>
                    <PublicLink
                      href={link.href}
                      className="rounded-md text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {link.label}
                    </PublicLink>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>&copy; {year} JinVa. All rights reserved.</p>
          <div className="flex items-center gap-4">
            <Link
              href="/terms"
              className="rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Terms
            </Link>
            <Link
              href="/privacy"
              className="rounded-md outline-none transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
            >
              Privacy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
