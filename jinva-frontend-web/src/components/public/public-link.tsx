import type React from "react"
import Link from "next/link"

/**
 * One link component for the public site, which picks the right mechanism for
 * the target.
 *
 * WHY THIS EXISTS — it is not a stylistic preference. `next/link` does not
 * navigate for a same-page fragment: clicking `<Link href="/#services">` while
 * already on `/` leaves the URL at `/` and does not scroll at all (verified in a
 * browser against Next 15.5.4 — the App Router dedupes the push because the
 * pathname is unchanged). Every one of LP3's five header nav items and four of
 * LP9's footer links point at an on-page anchor, so on the landing page itself
 * they were all silently dead.
 *
 * A plain `<a href="/#services">` is the correct tool for a fragment target and
 * is strictly better here:
 *   • On `/` the browser does a same-document fragment navigation — it sets the
 *     hash, honours `scroll-mt-20`, and animates via `scroll-behavior: smooth`
 *     (which the reduced-motion guard in globals.css switches off).
 *   • On `/about`, `/terms` and friends it is a normal navigation to `/` with the
 *     hash, which lands on the section correctly. `/` is statically prerendered,
 *     so this costs very little.
 *   • It needs no JavaScript at all, so on-page nav keeps working if hydration
 *     fails — which the design spec's JS-disabled state asks for.
 *
 * Route targets (`/login`, `/signup`, `/about`, …) still go through `next/link`
 * for client-side navigation and prefetching.
 */
type PublicLinkProps = Omit<React.ComponentProps<"a">, "href"> & { href: string }

export function PublicLink({ href, children, ...props }: Readonly<PublicLinkProps>) {
  if (href.includes("#")) {
    return (
      <a href={href} {...props}>
        {children}
      </a>
    )
  }

  return (
    <Link href={href} {...props}>
      {children}
    </Link>
  )
}
