"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/logo"
import {
  LayoutGrid,
  Wrench,
  Users,
  Package,
  UserCircle,
  ClipboardList,
  FileText,
  Settings,
  HelpCircle,
  Search,
  X,
} from "lucide-react"
import type { UserRole } from "@/lib/types"

interface SidebarProps {
  role: UserRole
  open: boolean
  onClose: () => void
}

export function Sidebar({ role, open, onClose }: SidebarProps) {
  const pathname = usePathname()

  const adminLinks = [
    { href: "/dashboard/admin", label: "Overview", icon: LayoutGrid },
    { href: "/dashboard/admin/services", label: "Services", icon: Wrench },
    { href: "/dashboard/admin/plumbers", label: "Plumbers", icon: Users },
    { href: "/dashboard/admin/products", label: "Products", icon: Package },
    { href: "/dashboard/admin/clients", label: "Clients", icon: UserCircle },
    { href: "/dashboard/admin/orders", label: "Orders", icon: ClipboardList },
  ]

  const plumberLinks = [
    { href: "/dashboard/plumber", label: "Overview", icon: LayoutGrid },
    { href: "/dashboard/plumber/jobs", label: "My Jobs", icon: ClipboardList },
    { href: "/dashboard/plumber/profile", label: "Profile", icon: UserCircle },
    { href: "/dashboard/plumber/services", label: "Services", icon: Wrench },
  ]

  const userLinks = [
    { href: "/dashboard/user", label: "Overview", icon: LayoutGrid },
    { href: "/dashboard/user/search", label: "Find Plumbers", icon: Search },
    { href: "/dashboard/user/bookings", label: "My Bookings", icon: ClipboardList },
    { href: "/dashboard/user/services", label: "Services", icon: Wrench },
  ]

  const links = role === "admin" ? adminLinks : role === "plumber" ? plumberLinks : userLinks

  const roleBase =
    role === "admin"
      ? "/dashboard/admin"
      : role === "plumber"
        ? "/dashboard/plumber"
        : "/dashboard/user"

  const bottomLinks = [
    { href: `${roleBase}/report`, label: "Report", icon: FileText },
    { href: `${roleBase}/settings`, label: "Settings", icon: Settings },
    { href: `${roleBase}/support`, label: "Support", icon: HelpCircle },
  ]

  const sidebarContent = (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-6">
        <div className="flex items-center gap-2">
          {/* JinVa Logo and Name (from auth pages) */}
          <Logo />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent/50 lg:hidden"
          aria-label="Close sidebar"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Main nav */}
      <div className="flex-1 overflow-y-auto px-3 py-4">
        <div className="mb-2 px-3 text-xs font-medium uppercase tracking-wider text-sidebar-foreground/60">Main</div>
        <nav className="space-y-1">
          {links.map((link) => {
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
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>

      {/* Bottom nav */}
      <div className="border-t border-sidebar-border px-3 py-4">
        <nav className="space-y-1">
          {bottomLinks.map((link) => {
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
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50",
                )}
              >
                <Icon className="h-4 w-4" />
                {link.label}
              </Link>
            )
          })}
        </nav>
      </div>
    </>
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
      <aside className="hidden h-full w-56 flex-col border-r border-border bg-sidebar lg:flex">
        {sidebarContent}
      </aside>

    </>
  )
}
