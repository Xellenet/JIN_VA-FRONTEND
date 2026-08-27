import { ImageResponse } from "next/og"

/**
 * LP11 — the generated OpenGraph card, per design-spec.md §9. Built with Next's
 * built-in `next/og`; no new dependency, and no new committed image asset.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DT5 ALLOWLIST ENTRY — THE ONLY LEGITIMATE HEX LITERALS IN THIS ROUND.
 *
 * `ImageResponse` renders outside the CSS cascade in a Satori runtime: it cannot
 * read `var(--brand)` or any other custom property, and it cannot see the
 * Tailwind theme. So the two brand colours have to be inlined here as literals.
 * This file is the single documented exception to the "tokens only, no hex"
 * rule, recorded in docs/team/routes-frontend-patterns-backend-infra/
 * requirements.md's DT5 allowlist and enforced as an exception by
 * `scripts/check-color-tokens.mjs`.
 *
 * If `--brand` or `--brand-accent` in globals.css ever change, change these two
 * values with them — nothing links them automatically, so this card would
 * otherwise silently desync from the site.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * NOTE ON PATH: design-spec.md §2 lists this at `(public)/opengraph-image.tsx`.
 * A root-level `src/app/opengraph-image.tsx` already existed, and a second one
 * inside the route group would resolve to the same `/opengraph-image` route — a
 * duplicate-route conflict — as well as stripping the card from the auth and
 * dashboard routes that currently inherit it. So the existing root file is
 * rewritten to the §9 composition instead of a second one being added. Same
 * card, one source, wider coverage.
 */

/** = `--brand` in `:root` (globals.css). Keep in sync by hand. */
const BRAND = "#1c4532"
/** = `--brand-accent` in `:root` (globals.css). Keep in sync by hand. */
const BRAND_ACCENT = "#2d5a42"

export const alt = "JinVa — Find verified artisans. Book, pay and rate."
export const size = { width: 1200, height: 630 }
export const contentType = "image/png"

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 80,
          backgroundImage: `linear-gradient(135deg, ${BRAND} 0%, ${BRAND_ACCENT} 100%)`,
          fontFamily: "sans-serif",
        }}
      >
        {/* Dot pattern at 10%, matching <BrandPattern /> on the site itself */}
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            opacity: 0.1,
            backgroundImage: "radial-gradient(#ffffff 1.5px, transparent 1.5px)",
            backgroundSize: "20px 20px",
          }}
        />

        {/* Mark + wordmark, top-left */}
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              width: 72,
              height: 72,
              borderRadius: 16,
              backgroundColor: "#ffffff",
            }}
          >
            <svg width="44" height="44" viewBox="0 0 32 32" fill="none">
              <path
                d="M12 8C12 7.44772 12.4477 7 13 7C13.5523 7 14 7.44772 14 8V18C14 20.7614 16.2386 23 19 23C19.5523 23 20 23.4477 20 24C20 24.5523 19.5523 25 19 25C15.134 25 12 21.866 12 18V8Z"
                fill={BRAND}
              />
              <circle cx="19" cy="9" r="2" fill={BRAND} />
            </svg>
          </div>
          <div style={{ fontSize: 48, fontWeight: 700, color: "#ffffff", letterSpacing: "-1px" }}>
            JinVa
          </div>
        </div>

        {/* One line of type. No photo, no statistics. */}
        <div
          style={{
            fontSize: 64,
            fontWeight: 600,
            color: "#ffffff",
            lineHeight: 1.2,
            maxWidth: 900,
            letterSpacing: "-2px",
          }}
        >
          Find verified artisans. Book, pay and rate.
        </div>
      </div>
    ),
    { ...size },
  )
}
