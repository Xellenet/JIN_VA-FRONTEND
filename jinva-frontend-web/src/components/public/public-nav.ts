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
}

/** Header nav + the mobile sheet. Also reused by the footer's Product column. */
export const PUBLIC_NAV_LINKS: readonly PublicNavLink[] = [
  { label: "Services", href: "/#services" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "For artisans", href: "/#for-artisans" },
  { label: "Why JinVa", href: "/#features" },
  { label: "FAQ", href: "/#faq" },
]

/** Footer link columns — design-spec.md §3.12. */
export const FOOTER_COLUMNS: readonly { heading: string; links: readonly PublicNavLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Service categories", href: "/#services" },
      { label: "For artisans", href: "/#for-artisans" },
      { label: "Why JinVa", href: "/#features" },
      { label: "Log in", href: "/login" },
      { label: "Get started", href: "/signup" },
    ],
  },
  {
    heading: "Company",
    links: [
      { label: "About JinVa", href: "/about" },
      { label: "How JinVa keeps the platform safe", href: "/#platform-governance" },
    ],
  },
  {
    heading: "Support",
    links: [
      { label: "FAQ", href: "/#faq" },
      { label: "Contact", href: "/contact" },
    ],
  },
  {
    heading: "Legal",
    links: [
      { label: "Terms of Service", href: "/terms" },
      { label: "Privacy Policy", href: "/privacy" },
    ],
  },
]
