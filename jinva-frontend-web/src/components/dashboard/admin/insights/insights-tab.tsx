"use client"

/**
 * One insights tab: its sections, each in its own state. A section the server
 * couldn't calculate (named in `degraded`) shows as unavailable with Try
 * again, while the tab's other sections still render. A failed request shows
 * one error for the tab. A range change keeps the previous figures on screen,
 * dimmed, until the new ones arrive.
 */
import { LoadError } from "@/components/spending/shared"
import { TAB_SECTIONS, isDegraded, type AnalyticsTab, type InsightSection, type Insights } from "@/lib/admin-insights"
import { cn } from "@/lib/utils"
import {
  ArtisansSection,
  EconomicsSection,
  FunnelSection,
  MarketplaceSection,
  PaymentsSection,
  RetentionSection,
  ReviewsSection,
  SpeedSection,
  TrustSection,
} from "./sections"
import { SectionUnavailable, TabSkeleton } from "./ui"

export type InsightsState =
  | { status: "loading"; data: Insights | null; retryIn: 0; attempt: number }
  | { status: "ready"; data: Insights; retryIn: 0; attempt: number }
  | { status: "error"; data: Insights | null; retryIn: number; attempt: number }

const SECTION_NAMES: Record<InsightSection, string> = {
  funnel: "The hiring funnel",
  speed: "Speed",
  marketplace: "Supply and demand",
  economics: "Unit economics",
  payments: "Payments health",
  trust: "Trust and safety",
  artisans: "Artisan health",
  retention: "Retention",
  reviews: "Reviews",
}

function renderSection(section: InsightSection, data: Insights, period: string) {
  switch (section) {
    case "funnel":
      return data.funnel && <FunnelSection data={data.funnel} period={period} />
    case "speed":
      return data.speed && <SpeedSection data={data.speed} minSample={data.minSample} period={period} />
    case "marketplace":
      return data.marketplace && <MarketplaceSection data={data.marketplace} period={period} />
    case "economics":
      return data.economics && <EconomicsSection data={data.economics} period={period} />
    case "payments":
      return data.payments && <PaymentsSection data={data.payments} period={period} />
    case "trust":
      return data.trust && <TrustSection data={data.trust} period={period} />
    case "artisans":
      return data.artisans && <ArtisansSection data={data.artisans} period={period} />
    case "retention":
      return data.retention && <RetentionSection data={data.retention} period={period} />
    case "reviews":
      return data.reviews && <ReviewsSection data={data.reviews} bucket={data.bucket} period={period} />
  }
}

export function InsightsTab({
  tab,
  state,
  period,
  onRetry,
}: Readonly<{
  tab: Exclude<AnalyticsTab, "overview">
  state: InsightsState
  period: string
  onRetry: () => void
}>) {
  const { data } = state
  if (state.status === "error" && !data) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
        <LoadError
          title="Couldn't load these figures"
          body="Check your connection and try again. The Overview tab is not affected."
          onRetry={onRetry}
          retryIn={state.retryIn}
          attempt={state.attempt}
        />
      </div>
    )
  }
  if (!data) return <TabSkeleton />

  return (
    <div className={cn("space-y-8 transition-opacity", state.status === "loading" && "opacity-60")} aria-busy={state.status === "loading"}>
      {state.status === "error" ? (
        <div className="rounded-xl border border-border bg-card p-4 sm:p-6">
          <LoadError
            title="Couldn't refresh these figures"
            body="Showing the figures loaded before. Try again in a moment."
            onRetry={onRetry}
            retryIn={state.retryIn}
            attempt={state.attempt}
          />
        </div>
      ) : null}
      <p className="text-xs text-muted-foreground">
        Figures from{" "}
        {new Date(data.generatedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}
        {data.cached ? ", recalculated every few minutes." : "."}
      </p>
      {TAB_SECTIONS[tab].map((section) => (
        <div key={section}>
          {isDegraded(data, section) || data[section] == null ? (
            <SectionUnavailable name={SECTION_NAMES[section]} onRetry={onRetry} retryIn={0} attempt={state.attempt} />
          ) : (
            renderSection(section, data, period)
          )}
        </div>
      ))}
    </div>
  )
}
