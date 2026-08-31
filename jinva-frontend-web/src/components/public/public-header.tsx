"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { Menu } from "lucide-react"
import { Logo } from "@/components/logo"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
} from "@/components/ui/navigation-menu"
import { PublicLink } from "@/components/public/public-link"
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { PublicThemeToggle } from "@/components/public/theme-toggle"
import { PUBLIC_NAV_LINKS } from "@/components/public/public-nav"

/**
 * Sticky header shared by `/` and every page in the `(public)` route group
 * (design-spec.md §3.2).
 *
 * Deliberately has NO session awareness — requirements.md Open Question 10 is
 * "no". `/` stays outside the middleware matcher and never consults a cookie, so
 * it renders identically with the backend down (LP2) and leaks no account state.
 * An already-signed-in visitor who clicks "Log in" is bounced to their role home
 * by the middleware's existing isAuthPage branch.
 */
export function PublicHeader() {
  const [open, setOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  // A hairline border once the page has moved — pure decoration, so it is a
  // passive listener and the server-rendered default is border-transparent.
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    onScroll()
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      data-scrolled={scrolled}
      className="sticky top-0 z-50 w-full border-b border-transparent bg-background/90 backdrop-blur-md transition-colors duration-300 data-[scrolled=true]:border-border"
    >
      <div className="mx-auto flex h-16 w-full max-w-[96rem] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          aria-label="JinVa home"
          className="rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          <Logo />
        </Link>

        <NavigationMenu viewport={false} className="hidden lg:flex">
          <NavigationMenuList>
            {PUBLIC_NAV_LINKS.map((link) => (
              <NavigationMenuItem key={link.href}>
                <NavigationMenuLink
                  asChild
                  className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                >
                  <PublicLink href={link.href}>{link.label}</PublicLink>
                </NavigationMenuLink>
              </NavigationMenuItem>
            ))}
          </NavigationMenuList>
        </NavigationMenu>

        <div className="flex items-center gap-1 sm:gap-2">
          <PublicThemeToggle />

          <Button variant="ghost" asChild className="hidden lg:inline-flex">
            <Link href="/login">Log in</Link>
          </Button>
          <Button asChild className="hidden lg:inline-flex">
            <Link href="/signup">Get started</Link>
          </Button>

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" aria-label="Open menu" className="lg:hidden">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="flex flex-col gap-0 p-0">
              <SheetHeader className="border-b border-border px-4 py-4 text-left">
                <SheetTitle asChild>
                  <Link href="/" aria-label="JinVa home" onClick={() => setOpen(false)}>
                    <Logo />
                  </Link>
                </SheetTitle>
              </SheetHeader>

              <nav className="flex flex-col px-2 py-2">
                {PUBLIC_NAV_LINKS.map((link) => (
                  // SheetClose closes the panel on selection — LP3 requires it
                  <SheetClose asChild key={link.href}>
                    <PublicLink
                      href={link.href}
                      className="flex h-12 items-center rounded-md px-3 text-base font-medium text-foreground outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {link.label}
                    </PublicLink>
                  </SheetClose>
                ))}
              </nav>

              <Separator />

              <div className="flex flex-col gap-3 p-4">
                <SheetClose asChild>
                  <Button variant="outline" asChild className="w-full">
                    <Link href="/login">Log in</Link>
                  </Button>
                </SheetClose>
                <SheetClose asChild>
                  <Button asChild className="w-full">
                    <Link href="/signup">Get started</Link>
                  </Button>
                </SheetClose>
              </div>

              <Separator />

              <div className="p-2">
                <PublicThemeToggle showLabel />
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  )
}
