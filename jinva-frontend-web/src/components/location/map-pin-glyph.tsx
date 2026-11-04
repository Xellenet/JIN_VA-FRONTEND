import type { SVGProps } from "react"

/**
 * The map pin, tip at the bottom centre. Filled with `currentColor` (set a
 * text-* token class) with a background-coloured dot, so it follows the theme.
 */
export function MapPinGlyph(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 32 40" aria-hidden focusable="false" {...props}>
      <path
        d="M16 1C8.3 1 2 7.1 2 14.7c0 9.6 11.6 22.6 13.1 24.2a1.2 1.2 0 0 0 1.8 0C18.4 37.3 30 24.3 30 14.7 30 7.1 23.7 1 16 1Z"
        fill="currentColor"
        className="stroke-background"
        strokeWidth="2"
      />
      <circle cx="16" cy="14.5" r="5.5" className="fill-background" />
    </svg>
  )
}
