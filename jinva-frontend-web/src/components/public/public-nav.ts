/**
 * The public site's navigation targets, in one place so the header, the mobile
 * sheet and the footer can never disagree — requirements.md LP3/LP9 make "every
 * single link resolves" a hard gate, and three hand-maintained copies of the
 * same list is how that gate gets missed.
 *
 * Every on-page anchor is written ROOT-RELATIVE (`/#services`, not
 * `#services`). The header and footer render on `/about`, `/contact`, `/terms`
 * and `/privacy` too, where a bare `#services` would resolve to
 * `/about#services` and silently do nothing. This is design-spec.md §3.12's
 * "single most likely dead-link bug in the whole round".
 */
export interface PublicNavLink {
  label: string
  href: string
  /** Shown in the phone menu and footer, not in the desktop header row. */
  menuOnly?: boolean
}

/** Header nav + the phone menu. Anchors are the landing page's section ids. */
export const PUBLIC_NAV_LINKS: readonly PublicNavLink[] = [
  { label: "See the work", href: "/#work" },
  { label: "How a job runs", href: "/#how" },
  { label: "For artisans", href: "/#artisans" },
  { label: "Questions", href: "/#questions", menuOnly: true },
]

/** Footer link columns — design-spec.md §3.12. */
export const FOOTER_COLUMNS: readonly { heading: string; links: readonly PublicNavLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How a job runs", href: "/#how" },
      { label: "See the work", href: "/#work" },
      { label: "For artisans", href: "/#artisans" },
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About JinVa", href: "/about" },
      { label: "How JinVa keeps the platform safe", href: "/#safety" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "Questions", href: "/#questions" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Legal information", href: "/legal" },
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
]
