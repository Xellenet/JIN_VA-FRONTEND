import type { Metadata } from "next"
import Link from "next/link"
import { PublicLink } from "@/components/public/public-link"
import { PublicProse } from "@/components/public/public-prose"

/**
 * PUB3 — `/about`, per design-spec.md §8.2.
 *
 * Every sentence below is drawn from PRD §1–§3. EXPLICITLY ABSENT, and must stay
 * absent: founding date, headcount, funding, team bios, office location,
 * investor logos, press mentions, user counts, "founded in…", "trusted by…".
 * None of it exists in the PRD and PUB3 forbids inventing it. A short honest
 * About page is not a weakness; a fabricated one is a liability.
 *
 * The honesty constraint that matters most here is section 3: PRD §3's five
 * points are OBJECTIVES, not achievements. Every bullet stays in the
 * infinitive — "to give clients…", never "We give clients…", which would
 * silently convert a goal into a claim.
 */
export const metadata: Metadata = {
  title: "About JinVa",
  description:
    "JinVa replaces fragmented, informal hiring with a structured platform for discovery, booking, payment and reputation-building.",
}

export default function AboutPage() {
  return (
    <PublicProse
      eyebrow="About"
      title="An operating system for the artisan services industry."
      standfirst="JinVa replaces fragmented, informal hiring with a structured platform for discovery, booking, payment and reputation-building."
    >
      <h2>What JinVa is</h2>
      <p>
        JinVa is a marketplace that connects clients with skilled, verified artisans across all trade
        categories &mdash; electrical, plumbing, carpentry, painting, cleaning, landscaping, beauty and more.
      </p>
      <p>
        It replaces fragmented, informal hiring with a structured platform for discovery, booking, payment
        and reputation-building &mdash; so that finding someone competent is a process rather than a matter
        of luck.
      </p>

      <h2>The problem we&rsquo;re solving</h2>
      <p>
        <strong>For clients.</strong> Hiring an artisan usually depends on word of mouth. There is no
        reliable way to evaluate quality, price or availability before committing, no dependable booking or
        payment trail afterwards, and very little recourse when work goes wrong.
      </p>
      <p>
        <strong>For artisans.</strong> Demand is inconsistent and clients no-show. There is often no digital
        payment infrastructure, no way to showcase completed work to someone who has never met you, and no
        tooling for managing a schedule or building a reputation that travels.
      </p>
      <p>
        <strong>For whoever runs the market.</strong> Without a centralised view of platform health there is
        no way to enforce quality standards or moderate a dispute except by fully manual processes.
      </p>

      <h2>What we&rsquo;re building toward</h2>
      <p>These are our objectives for the platform, not a description of a finished product:</p>
      <ul>
        <li>
          To give clients transparent, trustworthy and frictionless access to verified artisans.
        </li>
        <li>
          To give artisans the tools to build a professional reputation, manage their schedule, and get paid
          reliably.
        </li>
        <li>
          To give administrators full visibility into platform activity, with tools to enforce quality and
          resolve disputes.
        </li>
        <li>
          To establish a digital payment habit as the default way a job gets paid for on the platform.
        </li>
        <li>
          To improve, measurably, how often bookings convert, how often jobs get completed, and how often
          clients come back.
        </li>
      </ul>

      <h2>Who runs the platform</h2>
      <p>
        JinVa has an internal admin team that verifies artisans, moderates portfolios and reviews, oversees
        transactions and resolves disputes. Admin accounts are created by JinVa internally and are not open
        for registration.
      </p>
      <p>
        You can read more about{" "}
        <PublicLink href="/#platform-governance">how JinVa keeps the platform safe</PublicLink>.
      </p>

      <h2>Next</h2>
      <p>
        <PublicLink href="/#services">See the trades we cover</PublicLink> or{" "}
        <Link href="/signup">get started</Link>.
      </p>
    </PublicProse>
  )
}
