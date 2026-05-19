"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { Bell, Mail, ChevronDown, UserCircle, Settings, LogOut, Menu } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { clearAuthTokens } from "@/lib/auth"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User } from "@/lib/types"

interface DashboardHeaderProps {
  user: User
  onMenuToggle?: () => void
}

export function DashboardHeader({ user, onMenuToggle }: Readonly<DashboardHeaderProps>) {
  const router = useRouter()

  const handleLogout = () => {
    localStorage.removeItem("access_token")
    localStorage.removeItem("refresh_token")
    clearAuthTokens()
    router.push("/login")
    router.refresh()
  }

  let roleBase = "/dashboard/user"

  if (user.role === "admin") {
    roleBase = "/dashboard/admin"
  } else if (user.role === "plumber") {
    roleBase = "/dashboard/plumber"
  }

  const profilePath = user.role === "plumber" ? `${roleBase}/profile` : `${roleBase}/settings`

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4 md:h-16 md:px-6">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenuToggle} aria-label="Open menu">
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex items-center gap-1.5 md:gap-3">
        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href={`${roleBase}/messages`}>
            <Mail className="h-5 w-5 text-muted-foreground" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          </Link>
        </Button>

        <Button variant="ghost" size="icon" className="relative" asChild>
          <Link href={`${roleBase}/notifications`}>
            <Bell className="h-5 w-5 text-muted-foreground" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-primary" />
          </Link>
        </Button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="flex items-center gap-2 pl-2 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarImage src={user.avatar || "/placeholder.svg"} alt={user.name} />
                <AvatarFallback>{user.name.substring(0, 2).toUpperCase()}</AvatarFallback>
              </Avatar>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link href={profilePath} className="flex items-center gap-2">
                <UserCircle className="h-4 w-4" />
                Profile
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href={`${roleBase}/settings`} className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="flex items-center gap-2 text-destructive focus:text-destructive"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
              Logout
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
