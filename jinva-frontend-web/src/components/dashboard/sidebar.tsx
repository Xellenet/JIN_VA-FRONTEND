"use client"

import type React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuth } from "@/contexts/auth-context"
import {
  LayoutGrid,
  Wrench,
  Users,
  UserCircle,
  ClipboardList,
  FileText,
  Settings,
  HelpCircle,
  Search,
  X,
  Heart,
  ImageIcon,
  CalendarDays,
  BarChart2,
  AlertTriangle,
  CreditCard,
  Star,
  MessageSquare,
  Plus,
  Wallet,
  ShieldCheck,
} from "lucide-react"
import type { UserRole } from "@/lib/types"

interface SidebarProps {
  readonly role: UserRole
  readonly open: boolean
  readonly onClose: () => void
}

export function Sidebar({ role, open, onClose }: Readonly<SidebarProps>) {
  const pathname = usePathname()
  const { user } = useAuth()

  const adminLinks = [
    { href: "/dashboard/admin",                  label: "Overview",        icon: LayoutGrid    },
    { href: "/dashboard/admin/artisans",          label: "Artisans",        icon: Users         },
    { href: "/dashboard/admin/clients",           label: "Clients",         icon: UserCircle    },
    { href: "/dashboard/admin/orders",            label: "Jobs",            icon: ClipboardList },
    { href: "/dashboard/admin/portfolio-queue",   label: "Portfolio Queue", icon: ImageIcon     },
    // Placed with the other moderation queue so the two sit together (AT1).
    { href: "/dashboard/admin/verifications",      label: "Verifications",   icon: ShieldCheck   },
    { href: "/dashboard/admin/reviews",           label: "Reviews",         icon: Star          },
    { href: "/dashboard/admin/transactions",      label: "Transactions",    icon: CreditCard    },
    { href: "/dashboard/admin/disputes",          label: "Disputes",        icon: AlertTriangle },
    { href: "/dashboard/admin/analytics",         label: "Analytics",       icon: BarChart2     },
  ]

  const artisanLinks = [
    { href: "/dashboard/artisan",                 label: "Overview",  icon: LayoutGrid    },
    { href: "/dashboard/artisan/jobs",            label: "My Jobs",   icon: ClipboardList },
    { href: "/dashboard/artisan/earnings",        label: "Earnings",  icon: Wallet        },
    { href: "/dashboard/artisan/profile",         label: "Profile",   icon: UserCircle    },
    { href: "/dashboard/artisan/services",        label: "Services",  icon: Wrench        },
    { href: "/dashboard/artisan/portfolio",       label: "Portfolio", icon: ImageIcon     },
    { href: "/dashboard/artisan/reviews",         label: "Reviews",   icon: Star          },
    { href: "/dashboard/artisan/calendar",        label: "Calendar",  icon: CalendarDays  },
    { href: "/dashboard/artisan/analytics",       label: "Analytics", icon: BarChart2     },
    { href: "/dashboard/artisan/messages",        label: "Messages",  icon: MessageSquare },
  ]

  const userLinks = [
    { href: "/dashboard/user",                    label: "Overview",      icon: LayoutGrid    },
    { href: "/dashboard/user/post-job",           label: "Post a Job",    icon: Plus          },
    { href: "/dashboard/user/search",             label: "Find Artisans", icon: Search        },
    { href: "/dashboard/user/bookings",           label: "My Bookings",   icon: CalendarDays  },
    { href: "/dashboard/user/jobs",               label: "My Jobs",       icon: ClipboardList },
    { href: "/dashboard/user/favourites",         label: "Favourites",    icon: Heart         },
    { href: "/dashboard/user/messages",           label: "Messages",      icon: MessageSquare },
  ]

  const navigationByRole = {
    admin: { links: adminLinks, roleBase: "/dashboard/admin" },
    artisan: { links: artisanLinks, roleBase: "/dashboard/artisan" },
    user: { links: userLinks, roleBase: "/dashboard/user" },
  } as const

  const { links, roleBase } = navigationByRole[role]

  const workspaceLinks = [
    { href: `${roleBase}/settings`, label: "Settings", icon: Settings },
    { href: `${roleBase}/support`,  label: "Support",  icon: HelpCircle },
    { href: `${roleBase}/report`,   label: "Report",   icon: FileText },
  ]

  const userInitials = user?.name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase()

  const roleLabel =
    role === "admin" ? "Administrator" : role === "artisan" ? "Artisan" : "Client"

  const navLink = (link: { href: string; label: string; icon: React.ElementType }) => {
    const Icon = link.icon
    const isActive = pathname === link.href
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={cn(
          "flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
          isActive
            ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
        )}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {link.label}
      </Link>
    )
  }

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
        <Logo />
        <button
          type="button"
          onClick={onClose}
          className="flex h-7 w-7 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Main nav — scrollbar hidden but scrollable */}
      <div className="flex-1 overflow-y-auto px-3 py-3 [&::-webkit-scrollbar]:hidden [scrollbar-width:none]">
        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
          Main
        </p>
        <nav className="space-y-0.5">
          {links.map(navLink)}
        </nav>

        <div className="my-3 border-t border-sidebar-border" />

        <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/45">
          Workspace
        </p>
        <nav className="space-y-0.5">
          {workspaceLinks.map(navLink)}
        </nav>
      </div>

      {/* User profile card */}
      {user && (
        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarImage src={user.avatar} alt={user.name} />
              <AvatarFallback className="bg-primary text-primary-foreground text-xs font-semibold">
                {userInitials}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium leading-tight text-sidebar-foreground">
                {user.name}
              </p>
              <p className="truncate text-xs leading-tight text-sidebar-foreground/55">
                {roleLabel}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* Mobile overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-foreground/40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Mobile drawer */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-sidebar transition-transform duration-200 ease-in-out lg:hidden",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {sidebarContent}
      </aside>

      {/* Desktop sidebar */}
      <aside className="hidden h-full w-56 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        {sidebarContent}
      </aside>
    </>
  )
}
