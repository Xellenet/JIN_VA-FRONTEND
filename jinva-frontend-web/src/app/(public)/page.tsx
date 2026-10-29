import type { Metadata } from "next"
import { Hero } from "@/components/public/landing/hero"
import { TrustStrip } from "@/components/public/landing/trust-strip"
import { ServiceCategories } from "@/components/public/landing/service-categories"
import { HowItWorks } from "@/components/public/landing/how-it-works"
import {
  ArtisansSection,
  ClientsSection,
  GovernanceSection,
} from "@/components/public/landing/role-sections"
import { FeatureHighlights } from "@/components/public/landing/feature-highlights"
import { Testimonials } from "@/components/public/landing/testimonials"
import { FaqSection } from "@/components/public/landing/faq-section"
import { FinalCta } from "@/components/public/landing/final-cta"

/**
 * The marketing landing page at `/` — LP1–LP14.
 *
 * Replaces the five-line `redirect("/signup")` that used to live at
 * `src/app/page.tsx`: a first-time visitor was asked to create an account before
 * being told what the product was.
 *
 * Route-group note: this file is `(public)/page.tsx`, not `page.tsx`. Route
 * groups contribute nothing to the URL, so it still resolves to `/`, and it is
 * the only way `/` can share a layout with `/about`, `/contact`, `/terms` and
 * `/privacy`. The old `src/app/page.tsx` is deleted in the same commit — two
 * files resolving to `/` is a duplicate-route conflict.
 *
 * ZERO DATA DEPENDENCIES, on purpose (LP2). No fetch, no auth, no session check,
 * so the page renders identically with the backend stopped and stays outside
 * `src/middleware.ts`'s matcher. That is also why it has no loading state and no
 * empty state: there is nothing that could be absent. The only client islands
 * are the theme toggle, the mobile sheet, the how-it-works tabs, the FAQ
 * accordion, and the scroll-reveal wrappers.
 */
/**
 * NO `openGraph` / `twitter` BLOCK HERE — ON PURPOSE. Both fields are set once
 * in `src/app/layout.tsx` and inherited.
 *
 * Next.js REPLACES rather than merges those two fields across segments, so the
 * `openGraph` block this page used to declare (title + description + type +
 * siteName, but no `images`) overwrote the root's resolved object and threw away
 * the `app/opengraph-image.tsx` card. `/` was the only public page declaring
 * `openGraph`, which is why it was the only one unfurling without an image while
 * `/about`, `/terms`, `/privacy` and `/contact` — all of which set just `title`
 * and `description` — were fine. Setting `title`/`description` alone is enough:
 * Next derives `og:title`/`og:description` from them.
 */
export const metadata: Metadata = {
  title: "Find verified artisans — book, pay and rate in one place",
  description:
    "Hiring an artisan shouldn't depend on word of mouth. JinVa replaces fragmented, informal hiring with a structured platform for discovery, booking, payment and reputation-building.",
}

export default function LandingPage() {
  return (
    <main className="flex flex-col">
      <Hero />
      <TrustStrip />
      <ServiceCategories />
      <HowItWorks />
      <ClientsSection />
      <ArtisansSection />
      <GovernanceSection />
      <FeatureHighlights />
      <Testimonials />
      <FaqSection />
      <FinalCta />
    </main>
  )
}
