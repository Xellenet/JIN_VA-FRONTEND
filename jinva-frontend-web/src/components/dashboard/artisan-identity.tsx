import Link from "next/link"
import type { ReactNode } from "react"
import { ChevronRight, UserRound } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { cn, resolveAvatarUrl } from "@/lib/utils"

/** The customer-facing public profile of an artisan, or null without an id. */
export function artisanProfileHref(profileId?: number | null): string | null {
  return profileId != null && Number(profileId) > 0 ? `/dashboard/user/artisan/${profileId}` : null
}

/**
 * An artisan's avatar and name (plus an optional second line) as one block.
 * With a profile id it is a single link to their public profile, with a hover
 * and focus state; without one it renders the same block as plain content, so
 * there is never a link that goes nowhere.
 */
export function ArtisanIdentity({
  profileId,
  name,
  picture,
  fallback,
  subtitle,
  trailing,
  avatarClassName = "h-11 w-11",
  nameClassName = "font-medium",
  className,
}: {
  profileId?: number | null
  name: string
  picture?: string | null
  /** Avatar fallback content; defaults to a person icon. */
  fallback?: ReactNode
  subtitle?: ReactNode
  /** Content to the right that is not part of the link (a price, say). */
  trailing?: ReactNode
  avatarClassName?: string
  nameClassName?: string
  className?: string
}) {
  const href = artisanProfileHref(profileId)
  const body = (
    <>
      <Avatar className={cn("shrink-0", avatarClassName)}>
        <AvatarImage src={resolveAvatarUrl(picture ?? undefined)} alt="" />
        <AvatarFallback className="text-sm font-medium text-foreground/80">
          {fallback ?? <UserRound aria-hidden className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>
      <span className="min-w-0 flex-1">
        <span
          dir="auto"
          className={cn(
            "block truncate text-foreground [unicode-bidi:isolate]",
            nameClassName,
            href && "group-hover:underline group-hover:underline-offset-4",
          )}
        >
          {name}
        </span>
        {subtitle && <span className="block truncate text-sm text-muted-foreground">{subtitle}</span>}
      </span>
      {href && (
        <>
          <span className="sr-only">, view profile</span>
          <ChevronRight aria-hidden className="h-4 w-4 shrink-0 text-muted-foreground" />
        </>
      )}
    </>
  )

  return (
    <div className={cn("flex items-center gap-3", className)}>
      {href ? (
        <Link
          href={href}
          className="group -m-2 flex min-h-11 min-w-0 flex-1 items-center gap-3 rounded-lg p-2 outline-none transition-colors hover:bg-muted focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {body}
        </Link>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3">{body}</div>
      )}
      {trailing}
    </div>
  )
}
