import type React from "react"
import { cn } from "@/lib/utils"

/** The landing page's h2: Bricolage Grotesque, tight, balanced. */
export function SectionHeading({ className, ...props }: React.ComponentProps<"h2">) {
  return (
    <h2
      className={cn(
        "mb-4 font-display text-[clamp(2rem,4.4vw,3.375rem)] leading-[1.02] font-extrabold tracking-[-0.03em] text-balance",
        className,
      )}
      {...props}
    />
  )
}

export function SectionLead({ className, ...props }: React.ComponentProps<"p">) {
  return <p className={cn("text-lg text-muted-foreground", className)} {...props} />
}
