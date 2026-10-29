import { cn } from "@/lib/utils"

/**
 * Which surface the logo is sitting on. DT4 requires the mark to be legible on
 * the light page background, on the dark-green sidebar (`--sidebar`), AND in
 * dark mode — and no single token pair can do all three, because in light mode
 * `--primary` (the deep brand green) and `--sidebar` are nearly the same
 * colour, so a `text-primary` mark on the sidebar would simply disappear.
 *
 * So the caller says which it is:
 *   • "default"  — light page background, `bg-card`, or the dark theme's
 *                  background. Mark is filled `--primary`, glyph is
 *                  `--primary-foreground`, wordmark is `--foreground`.
 *   • "on-brand" — any brand-green surface: the dashboard sidebar, the auth
 *                  layout's gradient panel, the landing page's CTA band.
 *                  Inverted — mark is filled `--brand-foreground` with a
 *                  `--brand` glyph, wordmark is `--brand-foreground`.
 */
export type LogoTone = "default" | "on-brand"

const MARK_CLASSES: Record<LogoTone, string> = {
  default: "text-primary",
  "on-brand": "text-brand-foreground",
}

const GLYPH_CLASSES: Record<LogoTone, string> = {
  default: "text-primary-foreground",
  "on-brand": "text-brand",
}

const WORDMARK_CLASSES: Record<LogoTone, string> = {
  default: "text-foreground",
  "on-brand": "text-brand-foreground",
}

export function Logo({
  className = "",
  tone = "default",
}: {
  readonly className?: string
  readonly tone?: LogoTone
}) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <svg
        width="32"
        height="32"
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
        className={cn("shrink-0", MARK_CLASSES[tone])}
      >
        <rect width="32" height="32" rx="6" fill="currentColor" />
        <g className={GLYPH_CLASSES[tone]}>
          <path
            d="M12 8C12 7.44772 12.4477 7 13 7C13.5523 7 14 7.44772 14 8V18C14 20.7614 16.2386 23 19 23C19.5523 23 20 23.4477 20 24C20 24.5523 19.5523 25 19 25C15.134 25 12 21.866 12 18V8Z"
            fill="currentColor"
          />
          <circle cx="19" cy="9" r="2" fill="currentColor" />
        </g>
      </svg>
      <span className={cn("text-2xl font-bold", WORDMARK_CLASSES[tone])}>JinVa</span>
    </div>
  )
}
