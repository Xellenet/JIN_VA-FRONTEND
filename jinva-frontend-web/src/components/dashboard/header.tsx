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
import { MessagesPopover } from "./messages-popover"
import { NotificationsPopover } from "./notifications-popover"

interface DashboardHeaderProps {
  onMenuToggle?: () => void
}

const PAGE_TITLES: Record<string, string> = {
  user:              "Overview",
  artisan:           "Overview",
  admin:             "Overview",
  search:            "Find Artisans",
  bookings:          "My Jobs",
  favourites:        "Favourites",
  messages:          "Messages",
  notifications:     "Notifications",
  settings:          "Settings",
  support:           "Support",
  report:            "Report",
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
  bookings: "Booking Details",
  artisan:  "Artisan Profile",
  book:     "Book a Service",
  jobs:     "Job Details",
}

function getPageTitle(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean)
  let idx = segments.length - 1
  const onDetailPage = ID_PATTERN.test(segments[idx])
  while (idx >= 0 && ID_PATTERN.test(segments[idx])) idx--
  const key = segments[idx] ?? ""
  if (!key) return "Dashboard"
  if (onDetailPage && DETAIL_TITLES[key]) return DETAIL_TITLES[key]
  return PAGE_TITLES[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/-/g, " ")
}

export function DashboardHeader({ onMenuToggle }: Readonly<DashboardHeaderProps>) {
  const { user, logout } = useAuth()
  const { resolvedTheme, setTheme } = useTheme()
  const pathname = usePathname()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  if (!user) return null

  let roleBase = "/dashboard/user"
  if (user.role === "admin")   roleBase = "/dashboard/admin"
  else if (user.role === "artisan") roleBase = "/dashboard/artisan"

  // Artisans have a dedicated profile page; others deep-link into settings tabs
  const profilePath  = user.role === "artisan" ? `${roleBase}/profile` : `${roleBase}/settings?tab=profile`
  const settingsPath = `${roleBase}/settings?tab=notifications`
  const pageTitle = getPageTitle(pathname)

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:h-14 md:px-6">
      {/* Left — hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0 h-8 w-8 lg:hidden"
          onClick={onMenuToggle}
          aria-label="Open menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Right — actions */}
      <div className="flex items-center gap-1">
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
                <AvatarImage src={user.avatar} alt={user.name} />
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
