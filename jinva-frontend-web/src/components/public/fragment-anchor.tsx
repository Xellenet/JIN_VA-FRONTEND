"use client"

import type React from "react"

/**
 * The same-document half of `PublicLink`: a plain `<a>` for `/#section`
 * targets, which keeps working without JS.
 *
 * With JS, a click while already on that path is handled here instead of by
 * the browser: the URL goes through `history.pushState`, which Next.js patches
 * to keep its router state on the entry, then the section is scrolled to and
 * focused. A native fragment navigation creates a history entry with `null`
 * state, and Next's popstate handler ignores those, so Back from another page
 * to `/#how` used to change the URL and leave the old page on screen.
 */
export function FragmentAnchor({ href, onClick, children, ...props }: Readonly<React.ComponentProps<"a"> & { href: string }>) {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    const url = new URL(href, window.location.href)
    if (url.origin !== window.location.origin || url.pathname !== window.location.pathname || !url.hash) return
    const target = document.getElementById(decodeURIComponent(url.hash.slice(1)))
    if (!target) return
    event.preventDefault()
    if (url.hash !== window.location.hash) window.history.pushState(null, "", url.pathname + url.search + url.hash)
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    if (!target.hasAttribute("tabindex")) target.setAttribute("tabindex", "-1")
    target.focus({ preventScroll: true })
  }

  return (
    <a href={href} onClick={handleClick} {...props}>
      {children}
    </a>
  )
}
