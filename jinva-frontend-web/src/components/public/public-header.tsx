"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, X } from "lucide-react"
import { Logo } from "@/components/logo"
import { cn } from "@/lib/utils"
import { PublicLink } from "@/components/public/public-link"
import { PublicThemeToggle } from "@/components/public/theme-toggle"
import { PUBLIC_NAV_LINKS } from "@/components/public/public-nav"

const MENU_ID = "public-menu"
const DESKTOP_QUERY = "(min-width: 820px)"

/**
 * Sticky header shared by `/` and every page in the `(public)` route group.
 *
 * On `/` it sits on the hero's deep brand surface ("on-brand" tone, the dark
 * brand token in dark mode); elsewhere it is the plain page background.
 *
 * Below 820px the links fold into a Menu disclosure: a real `<button>` with
 * `aria-expanded` / `aria-controls` that shows a panel under the bar. The
 * panel closes on a link click, on Escape (focus goes back to the button), on
 * a click outside, on route change, and when the window grows past 820px.
 *
 * Deliberately has NO session awareness — requirements.md Open Question 10 is
 * "no". `/` stays outside the middleware matcher and never consults a cookie, so
 * it renders identically with the backend down (LP2) and leaks no account state.
 */
export function PublicHeader() {
  const pathname = usePathname()
  const onBrand = pathname === "/"
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const headerRef = useRef<HTMLElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)

  const close = useCallback(() => setOpen(false), [])

  // A hairline border once the page has moved.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  // Route change closes the menu.
  useEffect(() => {
    setOpen(false)
  }, [pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return
      setOpen(false)
      buttonRef.current?.focus()
    }
    const onPointer = (e: PointerEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) setOpen(false)
    }
    const mq = window.matchMedia(DESKTOP_QUERY)
    const onWide = () => {
      if (mq.matches) setOpen(false)
    }
    document.addEventListener("keydown", onKey)
    document.addEventListener("pointerdown", onPointer)
    mq.addEventListener("change", onWide)
    return () => {
      document.removeEventListener("keydown", onKey)
      document.removeEventListener("pointerdown", onPointer)
      mq.removeEventListener("change", onWide)
    }
  }, [open])

  const focusRing = onBrand
    ? "outline-none focus-visible:ring-[3px] focus-visible:ring-brand-highlight/70"
    : "outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"

  return (
    <header
      ref={headerRef}
      data-scrolled={scrolled}
      className={cn(
        "sticky top-0 z-50 w-full border-b transition-colors duration-300",
        onBrand
          ? "border-transparent bg-brand text-brand-foreground data-[scrolled=true]:border-brand-foreground/10"
          : "border-transparent bg-background/90 backdrop-blur-md data-[scrolled=true]:border-border",
      )}
    >
      <div className="mx-auto flex h-16 w-full max-w-310 items-center gap-x-7 gap-y-3 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="JinVa home"
          className={cn("-my-1.5 flex min-h-11 items-center rounded-md py-1.5", focusRing)}
        >
          <Logo tone={onBrand ? "on-brand" : "default"} />
        </Link>

        <nav aria-label="Main" className="hidden flex-1 min-[820px]:block">
          <ul className="flex flex-wrap gap-x-6">
            {PUBLIC_NAV_LINKS.filter((l) => !l.menuOnly).map((link) => (
              <li key={link.href}>
                <PublicLink
                  href={link.href}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-md text-[0.9375rem] font-medium transition-colors",
                    onBrand
                      ? "text-brand-foreground/85 hover:text-brand-foreground"
                      : "text-muted-foreground hover:text-foreground",
                    focusRing,
                  )}
                >
                  {link.label}
                </PublicLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-1 min-[820px]:gap-2">
          <PublicThemeToggle tone={onBrand ? "on-brand" : "default"} />
          <Link
            href="/login"
            className={cn(
              "hidden min-h-11 items-center rounded-lg px-3.5 font-medium min-[820px]:inline-flex",
              onBrand ? "text-brand-foreground hover:bg-brand-foreground/10" : "text-foreground hover:bg-accent",
              focusRing,
            )}
          >
            Log in
          </Link>
          <Link
            href="/signup"
            className={cn(
              "hidden min-h-11 items-center rounded-xl px-4.5 font-semibold transition-opacity hover:opacity-90 min-[820px]:inline-flex",
              onBrand ? "bg-brand-foreground text-brand" : "bg-primary text-primary-foreground",
              focusRing,
            )}
          >
            Get started
          </Link>

          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={MENU_ID}
            onClick={() => setOpen((o) => !o)}
            className={cn(
              "inline-flex size-11 cursor-pointer items-center justify-center gap-2 rounded-xl border min-[820px]:hidden",
              onBrand
                ? "border-brand-foreground/25 bg-brand-foreground/5 text-brand-foreground"
                : "border-border bg-background text-foreground",
              focusRing,
            )}
          >
            {open ? <X aria-hidden="true" className="size-5" /> : <Menu aria-hidden="true" className="size-5" />}
            <span className="sr-only">Menu</span>
          </button>
        </div>
      </div>

      <div
        id={MENU_ID}
        hidden={!open}
        className="absolute inset-x-4 top-full mt-2 rounded-2xl border border-border bg-popover p-2 text-popover-foreground shadow-2xl shadow-black/30 min-[820px]:hidden"
      >
        <nav aria-label="Menu">
          <ul className="flex flex-col">
            {PUBLIC_NAV_LINKS.map((link) => (
              <li key={link.href}>
                <PublicLink
                  href={link.href}
                  onClick={close}
                  className="flex min-h-12 items-center rounded-xl px-3.5 font-medium outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  {link.label}
                </PublicLink>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-1 grid grid-cols-2 gap-2 border-t border-border px-1.5 pt-2 pb-1.5">
          <Link
            href="/login"
            onClick={close}
            className="flex min-h-12 items-center justify-center rounded-xl border border-border font-semibold outline-none hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50"
          >
            Log in
          </Link>
          <Link
            href="/signup"
            onClick={close}
            className="flex min-h-12 items-center justify-center rounded-xl bg-brand font-semibold text-brand-foreground outline-none hover:opacity-90 focus-visible:ring-[3px] focus-visible:ring-ring/50 dark:bg-brand-accent"
          >
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}
