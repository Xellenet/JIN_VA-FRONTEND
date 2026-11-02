"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { useTheme } from "next-themes"
import { UserCircle, Settings, LogOut, Menu, Sun, Moon } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu"
import { useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import type { UserRole } from "@/lib/types"
import { MessagesPopover } from "./messages-popover"
import { NotificationsPopover } from "./notifications-popover"
import { navLinksFor } from "./sidebar"

interface DashboardHeaderProps {
  onMenuToggle?: () => void
}

/** Pages that aren't in the sidebar; everything in it takes its nav name (X3). */
const PAGE_TITLES: Record<string, string> = {
  user:              "Overview",
  artisan:           "Overview",
  admin:             "Overview",
  search:            "Find Artisans",
  bookings:          "My Bookings",
  favourites:        "Favourites",
  messages:          "Messages",
  notifications:     "Notifications",
  settings:          "Settings",
  support:           "Support",
  report:            "Spending",
  "post-job":        "Post a Job",
  jobs:              "My Jobs",
  profile:           "Profile",
  services:          "Services",
  portfolio:         "Portfolio",
  calendar:          "Calendar",
  analytics:         "Analytics",
  artisans:          "Artisans",
  clients:           "Clients",
  orders:            "Jobs",
  "portfolio-queue": "Portfolio Queue",
  reviews:           "Reviews",
  transactions:      "Transactions",
  disputes:          "Disputes",
  book:              "Book a Service",
}

const ID_PATTERN = /^[\d]+$|^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Titles used when on a detail page (parent/[id])
const DETAIL_TITLES: Record<string, string> = {
  bookings: "Booking details",
  artisan:  "Artisan profile",
  book:     "Book a service",
  jobs:     "Job details",
  disputes: "Dispute",
}

function getPageTitle(pathname: string, role: UserRole): string {
  const segments = pathname.split("/").filter(Boolean)
  let idx = segments.length - 1
  const onDetailPage = ID_PATTERN.test(segments[idx])
  while (idx >= 0 && ID_PATTERN.test(segments[idx])) idx--
  const key = segments[idx] ?? ""
  if (!key) return "Dashboard"
  if (onDetailPage && DETAIL_TITLES[key]) return DETAIL_TITLES[key]
  // X3: a page in the sidebar is called what the sidebar calls it.
  const base = "/" + segments.slice(0, idx + 1).join("/")
  const navLabel = navLinksFor(role).find((l) => l.href === base)?.label
  if (navLabel) return navLabel
  return PAGE_TITLES[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ")
}

/**
 * X1: the page owns the one `<h1>`. The header title is plain text, except on
 * a page that has no heading of its own yet (some admin lists, a loading
 * skeleton), where it steps in as the `<h1>` so the page is never without one.
 */
function usePageHasH1(pathname: string): boolean {
  const [hasH1, setHasH1] = useState(true)
  useEffect(() => {
    const main = document.querySelector("main")
    if (!main) return
    const check = () => setHasH1(main.querySelector("h1") !== null)
    check()
    const observer = new MutationObserver(check)
    observer.observe(main, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [pathname])
  return hasH1
}

export function DashboardHeader({ onMenuToggle }: Readonly<DashboardHeaderProps>) {
  const { user, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)
  const pageHasH1 = usePageHasH1(pathname)

  useEffect(() => setMounted(true), [])

  if (!user) return null

  let roleBase = "/dashboard/user"
  if (user.role === "admin")   roleBase = "/dashboard/admin"
  else if (user.role === "artisan") roleBase = "/dashboard/artisan"

  // Artisans have a dedicated profile page; others deep-link into settings tabs
  const profilePath  = user.role === "artisan" ? `${roleBase}/profile` : `${roleBase}/settings?tab=profile`
  const settingsPath = `${roleBase}/settings?tab=notifications`
  const pageTitle = getPageTitle(pathname, user.role)
  const TitleTag = pageHasH1 ? "p" : "h1"

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:h-14 md:px-6">
      {/* Left — hamburger (mobile) + page title */}
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-11 w-11 shrink-0 sm:ml-0 sm:h-8 sm:w-8 lg:hidden"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        {/* On a phone the page's own h1 sits right below, so the title only
            shows there when it is standing in as the h1. */}
        <TitleTag className={cn("truncate text-base font-semibold text-foreground", pageHasH1 && "max-sm:hidden")}>
          {pageTitle}
        </TitleTag>
      </div>

      {/* Right — actions. 44px tap targets on phones (M3), the popover
          triggers included; their menus render in portals, so this reaches
          only the header's own buttons. */}
      <div className="flex shrink-0 items-center gap-0 sm:gap-1 max-sm:[&_button]:h-11 max-sm:[&_button]:w-11">
        {/* Dark mode toggle */}
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          aria-label="Toggle theme"
          onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
        >
          {mounted && resolvedTheme === "dark" ? (
            <Sun className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
          ) : (
            <Moon className="h-[1.1rem] w-[1.1rem] text-muted-foreground" />
          )}
        </Button>

        {/* Messages — HB1: real unread badge + preview dropdown */}
        <MessagesPopover roleBase={roleBase} role={user.role} currentUserId={user.id} />

        {/* Notifications — HB1: real unread badge + preview dropdown */}
        <NotificationsPopover roleBase={roleBase} />

        {/* User menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full" aria-label="User menu">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar || undefined} alt={user.name} />
                <AvatarFallback className="text-xs bg-primary text-primary-foreground font-medium">
                  {user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{user.name}</span>
                <span className="text-xs text-muted-foreground truncate">{user.email}</span>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link href={profilePath} className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={settingsPath} className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              Log out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
