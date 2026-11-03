"use client"

/**
 * The nine insight sections. Each takes its own (non-null) slice of
 * `GET /admin/analytics/insights`; the tab decides whether a section is
 * loading, unavailable or shown. Every figure carries a plain-language note on
 * what it means and how it is counted.
 */
import { useState } from "react"
import { ChartCard, DataTable, ViewToggle } from "@/components/spending/shared"
import {
  NOT_ENOUGH_DATA,
  actorLabel,
  actorRows,
  disputeCategoryLabel,
  disputeOutcomeLabel,
  formatCohort,
  formatCount,
  formatDuration,
  formatGhs,
  formatPercent,
  formatRatio,
  funnelLabel,
  funnelSummary,
  holdLabel,
  methodLabel,
  moderationLabel,
  networkLabel,
  refundStatusLabel,
  sampleLabel,
  securityEventLabel,
  type Insights,
} from "@/lib/admin-insights"
import { cn } from "@/lib/utils"
import { BarCard, DurationTile, Empty, Help, Section, StatTile, TileGrid, WarnBadge } from "./ui"

type Data<K extends keyof Insights> = NonNullable<Insights[K]>

const pct = (n: number | null) => formatPercent(n)

// ─── 1. Funnel ────────────────────────────────────────────────────────────────

export function FunnelSection({ data, period }: Readonly<{ data: Data<"funnel">; period: string }>) {
  const posted = data.steps[0]?.count ?? 0
  return (
    <Section
      id="ins-funnel"
      title="Hiring funnel"
      intro={`Jobs clients posted in the ${period}, and how far each one got. Jobs created by confirming a booking skip this funnel and are counted separately.`}
    >
      <BarCard
        id="ins-funnel-steps"
        title="From posted to completed"
        summary={funnelSummary(data)}
        firstColumn="Step"
        valueLabel="Jobs"
        extraColumns={[{ label: "Of the step before", numeric: true }]}
        rows={
          posted
            ? data.steps.map((s) => ({
                key: s.key,
                label: funnelLabel(s.key),
                value: s.count,
                display:
                  s.conversionFromPrevious == null
                    ? formatCount(s.count)
                    : `${formatCount(s.count)} · ${pct(s.conversionFromPrevious)}`,
                extra: [s.conversionFromPrevious == null ? "—" : pct(s.conversionFromPrevious)],
              }))
            : []
        }
        help="Each step counts posted jobs that reached it: at least one application, an artisan hired (an accepted application), work started (moved to in progress), and completed. The percentage is the share of the step before."
      />
      <TileGrid>
        <StatTile
          label="Expired without a hire"
          value={formatCount(data.expiredWithoutHire)}
          help="Posted jobs that ran out of time before the client hired anyone."
        />
        <StatTile
          label="Cancelled"
          value={formatCount(data.cancelled)}
          sub={`${formatCount(data.cancelledBeforeHire)} before anyone was hired`}
          help="Posted jobs that are now cancelled, by anyone."
        />
        <StatTile
          label="Still in progress"
          value={formatCount(data.inFlight)}
          help="Posted jobs that are open, waiting to start or in progress, so not finished either way yet."
        />
        <StatTile
          label="Jobs from bookings"
          value={formatCount(data.fromBookings)}
          help="Jobs created when an artisan confirmed a direct booking. They have no applications, so they are left out of the funnel."
        />
      </TileGrid>
    </Section>
  )
}

// ─── 2. Speed ─────────────────────────────────────────────────────────────────

export function SpeedSection({
  data,
  minSample,
  period,
}: Readonly<{ data: Data<"speed">; minSample: number; period: string }>) {
  return (
    <Section
      id="ins-speed"
      title="Speed"
      intro={`How long things take, for the ones that finished in the ${period}. The median is the typical case: half took less, half took longer. A figure needs at least ${minSample} examples before it is shown.`}
    >
      <TileGrid>
        <DurationTile
          label="Time to first application"
          stat={data.firstApplication}
          unit={["job", "jobs"]}
          minSample={minSample}
          help="From a job being posted to its first application."
        />
        <DurationTile
          label="Time to hire"
          stat={data.hire}
          unit={["job", "jobs"]}
          minSample={minSample}
          help="From a job being posted to the client accepting an application."
        />
        <DurationTile
          label="Hire to completion"
          stat={data.hireToCompletion}
          unit={["job", "jobs"]}
          minSample={minSample}
          help="From the artisan being hired to the job being marked completed."
        />
        <DurationTile
          label="Artisan reply to a booking"
          stat={data.bookingResponse}
          unit={["booking", "bookings"]}
          minSample={minSample}
          help="From a booking request to the artisan confirming it. Declines aren't included: the app doesn't record when a booking was declined."
        />
        <DurationTile
          label="Payout time"
          stat={data.payout}
          unit={["payout", "payouts"]}
          minSample={minSample}
          help="From the client's payment to the artisan's payout being confirmed."
        />
        <DurationTile
          label="Dispute resolution"
          stat={data.disputeResolution}
          unit={["dispute", "disputes"]}
          minSample={minSample}
          help="From a dispute being raised to an admin's ruling."
        />
        <DurationTile
          label="Verification review"
          stat={data.verificationReview}
          unit={["review", "reviews"]}
          minSample={minSample}
          help="From an artisan submitting ID documents to an admin approving or rejecting them."
        />
      </TileGrid>
    </Section>
  )
}

// ─── 3. Marketplace ───────────────────────────────────────────────────────────

export function MarketplaceSection({ data, period }: Readonly<{ data: Data<"marketplace">; period: string }>) {
  const services = data.byService
  const short = services.filter((s) => s.flag).length
  const areaRows = [
    ...data.byArea.top.map((a) => ({
      key: a.area,
      label: a.area.replace(/\b\p{L}/gu, (c) => c.toUpperCase()),
      value: a.jobs,
      display: `${formatCount(a.jobs)} · ${pct(a.share)}`,
    })),
    ...(data.byArea.other.jobs > 0
      ? [
          {
            key: "__other",
            label: `Other (${formatCount(data.byArea.other.areas)} places)`,
            value: data.byArea.other.jobs,
            display: `${formatCount(data.byArea.other.jobs)} · ${pct(data.byArea.other.share)}`,
          },
        ]
      : []),
  ]
  return (
    <Section
      id="ins-market"
      title="Supply and demand"
      intro={`Jobs posted in the ${period} against the artisans who can take them.`}
    >
      <BarCard
        id="ins-market-services"
        title="By service"
        summary={
          services.length === 0
            ? "No jobs or artisans for any service yet."
            : short
              ? `${formatCount(short)} ${short === 1 ? "service has" : "services have"} demand but too few artisans.`
              : "Every service with demand has artisans offering it."
        }
        firstColumn="Service"
        valueLabel="Jobs posted"
        extraColumns={[
          { label: "Hired", numeric: true },
          { label: "Artisans", numeric: true },
          { label: "Jobs per artisan", numeric: true },
        ]}
        rows={services.map((s) => ({
          key: String(s.serviceId),
          label: s.isActive ? s.serviceName : `${s.serviceName} (hidden)`,
          value: s.jobs,
          display: `${formatCount(s.jobs)} ${s.jobs === 1 ? "job" : "jobs"} · ${formatCount(s.artisans)} ${s.artisans === 1 ? "artisan" : "artisans"}`,
          badge:
            s.flag === "no_artisans" ? (
              <WarnBadge>No artisans</WarnBadge>
            ) : s.flag === "few_artisans" ? (
              <WarnBadge>Few artisans</WarnBadge>
            ) : null,
          extra: [formatCount(s.hired), formatCount(s.artisans), formatRatio(s.demandPerArtisan)],
        }))}
        help="Jobs posted counts every job created for the service in the period (bookings included). Artisans counts those who offer the service and show in search today: a complete profile, not suspended or banned. Flagged: jobs but no artisans, or 3 or more jobs per artisan."
      />
      <BarCard
        id="ins-market-areas"
        title="By area"
        summary={
          data.byArea.totalJobs
            ? `The ${formatCount(data.byArea.top.length)} busiest places, from ${formatCount(data.byArea.totalJobs)} jobs with a location.`
            : NOT_ENOUGH_DATA
        }
        firstColumn="Area"
        valueLabel="Jobs"
        rows={areaRows}
        help="Location is free text typed by the client, so the same place can be spelt more than one way. Spaces and capitals are evened out before counting; spelling isn't. Places after the top 10 are grouped as Other."
      />
    </Section>
  )
}

// ─── 4. Unit economics ────────────────────────────────────────────────────────

export function EconomicsSection({ data, period }: Readonly<{ data: Data<"economics">; period: string }>) {
  const actors = actorRows(data.cancellation.byActor)
  return (
    <Section id="ins-econ" title="Unit economics" intro={`Payments clients made in the ${period}.`}>
      <TileGrid>
        <StatTile
          label="Average job value"
          value={data.averageJobValue == null ? NOT_ENOUGH_DATA : formatGhs(data.averageJobValue)}
          muted={data.averageJobValue == null}
          sub={`${formatGhs(data.grossRevenue)} from ${formatCount(data.paidPayments)} ${data.paidPayments === 1 ? "payment" : "payments"}`}
          help="Everything clients paid, divided by the number of payments."
        />
        <StatTile
          label="Effective take rate"
          value={pct(data.takeRate)}
          muted={data.takeRate == null}
          sub={`${formatGhs(data.netRevenue)} in platform fees`}
          help="Platform fees as a share of what clients paid."
        />
        <StatTile
          label="Refunded"
          value={pct(data.refundRateByAmount)}
          muted={data.refundRateByAmount == null}
          sub={`${formatGhs(data.refundedAmount)} · ${formatCount(data.refundedPayments)} ${data.refundedPayments === 1 ? "payment" : "payments"}${data.refundRateByCount == null ? "" : ` (${pct(data.refundRateByCount)} of payments)`}`}
          help="Money refunded as a share of what was paid, and the share of payments with any refund."
        />
        <StatTile
          label="Cancellation rate"
          value={pct(data.cancellation.rate)}
          muted={data.cancellation.rate == null}
          sub={`${formatCount(data.cancellation.cancelled)} of ${formatCount(data.cancellation.terminalJobs)} finished jobs`}
          help="Jobs created in the period that were cancelled, out of those that finished (completed, cancelled or expired)."
        />
      </TileGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard
          id="ins-econ-services"
          title="Revenue by service"
          summary={data.revenueByService.length ? `What clients paid, per service.` : "No payments in this period."}
          empty="No payments in this period."
          firstColumn="Service"
          valueLabel="Paid"
          extraColumns={[
            { label: "Platform fees", numeric: true },
            { label: "Payments", numeric: true },
          ]}
          rows={data.revenueByService.map((r) => ({
            key: String(r.serviceId),
            label: r.serviceName,
            value: Number(r.gross) || 0,
            display: `${formatGhs(r.gross)} · ${pct(r.share)}`,
            extra: [formatGhs(r.net), formatCount(r.paidPayments)],
          }))}
          help="Counted when the client paid, by the service of the job."
        />
        <BarCard
          id="ins-econ-cancel"
          title="Who cancelled"
          summary={
            data.cancellation.cancelled
              ? `${formatCount(data.cancellation.cancelled)} cancelled ${data.cancellation.cancelled === 1 ? "job" : "jobs"}.`
              : "No cancelled jobs in this period."
          }
          empty="No cancelled jobs in this period."
          firstColumn="Cancelled by"
          valueLabel="Jobs"
          rows={actors.map((a) => ({
            key: a.key,
            label: actorLabel(a.key),
            value: a.count,
            display: formatCount(a.count),
          }))}
          help="Taken from each job's status history: who made the change to cancelled. Not recorded means the job has no history entry for it (older jobs)."
        />
      </div>
    </Section>
  )
}

// ─── 5. Payments health ───────────────────────────────────────────────────────

export function PaymentsSection({ data, period }: Readonly<{ data: Data<"payments">; period: string }>) {
  const a = data.attempts
  const outcomes = [
    ["succeeded", "Succeeded", a.succeeded],
    ["failed", "Failed", a.failed],
    ["expired", "Expired", a.expired],
    ["cancelled", "Cancelled", a.cancelled],
    ["duplicate", "Paid twice (refunded)", a.duplicate],
    ["inProgress", "Still in progress", a.inProgress],
  ] as const
  const holdTotal = data.payoutsOnHold.reduce((t, h) => t + h.count, 0)
  return (
    <Section id="ins-pay" title="Payments health" intro={`Payment attempts started in the ${period}, and payouts as they stand now.`}>
      <TileGrid>
        <StatTile
          label="Payment success rate"
          value={pct(a.successRate)}
          muted={a.successRate == null}
          sub={sampleLabel(a.total, "attempt")}
          help="Attempts that succeeded, out of those that ended (succeeded, failed, expired or cancelled). A client can make several attempts for one payment."
        />
        <StatTile
          label="Payouts on hold now"
          value={formatCount(holdTotal)}
          sub={holdTotal ? formatGhs(data.payoutsOnHold.reduce((t, h) => t + (Number(h.amount) || 0), 0)) : undefined}
          help="Artisan payouts waiting on something before they can be sent. Not limited to the period."
        />
        <StatTile
          label="Failed transfers now"
          value={formatCount(data.transferFailed.count)}
          sub={data.transferFailed.count ? formatGhs(data.transferFailed.amount) : undefined}
          help="Payouts Paystack couldn't deliver, waiting for a retry. Not limited to the period: the app keeps no failure date."
        />
        <StatTile
          label="Clients with a saved method"
          value={pct(data.savedMethods.adoptionRate)}
          muted={data.savedMethods.adoptionRate == null}
          sub={`${formatCount(data.savedMethods.customersWithMethod)} of ${formatCount(data.savedMethods.customers)} clients`}
          help="Clients who have saved at least one mobile money number or card. Not limited to the period."
        />
      </TileGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard
          id="ins-pay-outcomes"
          title="Payment attempts"
          summary={a.total ? `${formatCount(a.total)} attempts in the ${period}.` : "No payment attempts in this period."}
          empty="No payment attempts in this period."
          firstColumn="Outcome"
          valueLabel="Attempts"
          rows={
            a.total
              ? outcomes.map(([key, label, n]) => ({ key, label, value: n, display: formatCount(n) }))
              : []
          }
          help="Every checkout, mobile money prompt or card charge counts as one attempt. Paid twice means a second successful charge for an already-paid job, which is refunded automatically."
        />
        <BarCard
          id="ins-pay-methods"
          title="How clients paid"
          summary={data.methodMix.length ? "Payment attempts by method." : "No payment attempts in this period."}
          empty="No payment attempts in this period."
          firstColumn="Method"
          valueLabel="Attempts"
          extraColumns={[{ label: "Succeeded", numeric: true }]}
          rows={data.methodMix.map((m) => ({
            key: m.method,
            label: methodLabel(m.method),
            value: m.attempts,
            display: `${formatCount(m.attempts)} · ${pct(m.share)}`,
            extra: [formatCount(m.succeeded)],
          }))}
          help="Paystack checkout is the hosted page; mobile money and card are charges made in the app, including saved methods."
        />
        <BarCard
          id="ins-pay-holds"
          title="Why payouts are on hold"
          summary={holdTotal ? `${formatCount(holdTotal)} on hold now.` : "No payouts are on hold."}
          empty="No payouts are on hold."
          firstColumn="Reason"
          valueLabel="Payouts"
          extraColumns={[{ label: "Amount", numeric: true }]}
          rows={data.payoutsOnHold.map((h) => ({
            key: h.reason,
            label: holdLabel(h.reason),
            value: h.count,
            display: `${formatCount(h.count)} · ${formatGhs(h.amount)}`,
            extra: [formatGhs(h.amount)],
          }))}
          help="The reason recorded when the payout was held. The amount is what the artisans are owed."
        />
        <BarCard
          id="ins-pay-dupes"
          title="Duplicate payment refunds"
          summary={
            data.duplicateRefunds.count
              ? `${formatCount(data.duplicateRefunds.count)} duplicate ${data.duplicateRefunds.count === 1 ? "payment" : "payments"}, ${formatGhs(data.duplicateRefunds.amount)}.`
              : "No duplicate payments in this period."
          }
          empty="No duplicate payments in this period."
          firstColumn="Refund"
          valueLabel="Payments"
          extraColumns={[
            { label: "Amount", numeric: true },
            { label: "Refunded", numeric: true },
          ]}
          rows={data.duplicateRefunds.byRefundStatus.map((r) => ({
            key: r.refundStatus,
            label: refundStatusLabel(r.refundStatus),
            value: r.count,
            display: `${formatCount(r.count)} · ${formatGhs(r.amount)}`,
            extra: [formatGhs(r.amount), formatGhs(r.refundedAmount)],
          }))}
          help="A client charged twice for the same job is refunded the second charge automatically. Failed refunds need an admin."
        />
      </div>
      <BarCard
        id="ins-pay-networks"
        title="Saved mobile money networks"
        summary={
          data.savedMethods.mobileMoney
            ? `${formatCount(data.savedMethods.mobileMoney)} saved mobile money ${data.savedMethods.mobileMoney === 1 ? "number" : "numbers"} and ${formatCount(data.savedMethods.card)} saved ${data.savedMethods.card === 1 ? "card" : "cards"}.`
            : "No saved mobile money numbers yet."
        }
        empty="No saved mobile money numbers yet."
        firstColumn="Network"
        valueLabel="Numbers"
        rows={data.savedMethods.momoNetworks.map((n) => ({
          key: n.network,
          label: networkLabel(n.network),
          value: n.count,
          display: `${formatCount(n.count)} · ${pct(n.share)}`,
        }))}
        help="Saved numbers as they stand now, by network."
      />
    </Section>
  )
}

// ─── 6. Trust and safety ──────────────────────────────────────────────────────

function countedRows(rows: { key: string; count: number }[], toLabel: (k: string) => string) {
  return rows.map((r) => ({ key: r.key, label: toLabel(r.key), value: r.count, display: formatCount(r.count) }))
}

export function TrustSection({ data, period }: Readonly<{ data: Data<"trust">; period: string }>) {
  const d = data.disputes
  const v = data.verifications
  return (
    <Section id="ins-trust" title="Trust and safety" intro={`Disputes, verification, suspensions and account events in the ${period}.`}>
      <TileGrid>
        <StatTile
          label="Disputes per 100 completed jobs"
          value={d.per100CompletedJobs == null ? NOT_ENOUGH_DATA : formatRatio(d.per100CompletedJobs)}
          muted={d.per100CompletedJobs == null}
          sub={`${formatCount(d.filed)} raised · ${formatCount(d.completedJobs)} jobs completed`}
          help="Disputes raised in the period for every 100 jobs completed in it. Disputes are raised on bookings, so this is a rough comparison."
        />
        <StatTile
          label="Verification approval rate"
          value={pct(v.approvalRate)}
          muted={v.approvalRate == null}
          sub={`${formatCount(v.approved)} approved · ${formatCount(v.rejected)} rejected${v.rejectionRate == null ? "" : ` (${pct(v.rejectionRate)})`}`}
          help="ID checks an admin decided in the period."
        />
        <StatTile
          label="Verifications waiting"
          value={formatCount(v.pendingBacklog)}
          sub={v.oldestPendingHours == null ? "None waiting" : `Oldest waiting ${formatDuration(v.oldestPendingHours)}`}
          help="Submitted or under review right now. Not limited to the period."
        />
        <StatTile
          label="Suspended accounts"
          value={formatCount(data.suspensions.current)}
          sub={`${formatCount(data.suspensions.newInRange)} suspended and ${formatCount(data.suspensions.bansInRange)} banned in the ${period}`}
          help="Accounts suspended right now. New suspensions and bans come from the admin audit log."
        />
      </TileGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard
          id="ins-trust-category"
          title="Disputes by category"
          summary={d.filed ? `${formatCount(d.filed)} raised in the ${period}.` : "No disputes in this period."}
          empty="No disputes in this period."
          firstColumn="Category"
          valueLabel="Disputes"
          rows={countedRows(d.byCategory, disputeCategoryLabel)}
          help="The category the person raising the dispute picked."
        />
        <BarCard
          id="ins-trust-outcome"
          title="Dispute verdicts"
          summary={d.byOutcome.length ? "Disputes resolved in the period, by verdict." : "No disputes resolved in this period."}
          empty="No disputes resolved in this period."
          firstColumn="Verdict"
          valueLabel="Disputes"
          rows={countedRows(d.byOutcome, disputeOutcomeLabel)}
          help="The verdict an admin recorded when resolving."
        />
        <BarCard
          id="ins-trust-moderation"
          title="Review moderation"
          summary={data.moderationActions.length ? "Admin actions on reviews." : "No review moderation in this period."}
          empty="No review moderation in this period."
          firstColumn="Action"
          valueLabel="Actions"
          rows={countedRows(data.moderationActions, moderationLabel)}
          help="Each flag, removal or restore by an admin counts once."
        />
        <BarCard
          id="ins-trust-security"
          title="Account security events"
          summary={data.securityEvents.length ? "Sensitive account changes, by type." : "No account security events in this period."}
          empty="No account security events in this period."
          firstColumn="Event"
          valueLabel="Events"
          rows={countedRows(data.securityEvents, securityEventLabel)}
          help="Counts only: no names, emails or devices are shown here."
        />
      </div>
    </Section>
  )
}

// ─── 7. Artisan health ────────────────────────────────────────────────────────

export function ArtisansSection({ data, period }: Readonly<{ data: Data<"artisans">; period: string }>) {
  const act = data.activation
  const checks = [
    ["complete", "Profile complete", act.profileComplete],
    ["verified", "ID verified", act.verified],
    ["service", "Offers at least one service", act.hasService],
    ["hours", "Has working hours", act.hasWorkingHours],
    ["payout", "Has a payout method", act.hasPayoutMethod],
    ["visible", "Shows in search", act.visibleInSearch],
  ] as const
  const e = data.earnings
  const b = data.bookingResponse
  return (
    <Section id="ins-artisans" title="Artisan health" intro="Where artisans are in getting set up, and how active they are.">
      <TileGrid>
        <StatTile
          label="Fully set up"
          value={pct(act.fullyActivatedRate)}
          muted={act.fullyActivatedRate == null}
          sub={`${formatCount(act.fullyActivated)} of ${formatCount(act.total)} artisans`}
          help="Artisans who meet all six checks below. Not limited to the period."
        />
        <StatTile
          label="Active in the last 30 days"
          value={formatCount(data.activeLast30Days)}
          sub={`${data.activeLast30DaysRate == null ? "" : `${pct(data.activeLast30DaysRate)} of artisans · `}always the last 30 days`}
          help="Applied for a job, had a change on a job they were hired for, or received a booking in the last 30 days, whatever period is selected."
        />
        <StatTile
          label="Booking response rate"
          value={pct(b.responseRate)}
          muted={b.responseRate == null}
          sub={`${formatCount(b.responded)} answered · ${formatCount(b.expired)} expired · ${formatCount(b.pending)} waiting`}
          help={`Booking requests made in the ${period} that the artisan confirmed or declined, out of those answered or left to expire. Requests the client withdrew first (${formatCount(b.withdrawn)}) aren't counted.`}
        />
        <StatTile
          label="Median earnings"
          value={e.median == null ? NOT_ENOUGH_DATA : formatGhs(e.median)}
          muted={e.median == null}
          sub={
            e.median == null
              ? `${formatCount(e.n)} ${e.n === 1 ? "artisan" : "artisans"} paid so far, needs at least 5`
              : `Middle half earned ${formatGhs(e.q1)} to ${formatGhs(e.q3)} · ${formatCount(e.n)} artisans`
          }
          help={`What artisans were paid out in the ${period}, after the platform fee, for those paid at least once.`}
        />
      </TileGrid>
      <BarCard
        id="ins-artisans-checklist"
        title="Set-up checklist"
        summary={act.total ? `Out of ${formatCount(act.total)} artisan accounts.` : "No artisan accounts yet."}
        empty="No artisan accounts yet."
        firstColumn="Check"
        valueLabel="Artisans"
        extraColumns={[{ label: "Share", numeric: true }]}
        rows={
          act.total
            ? checks.map(([key, label, n]) => ({
                key,
                label,
                value: n,
                display: `${formatCount(n)} · ${pct(act.total ? Math.round((n / act.total) * 1000) / 10 : null)}`,
                extra: [pct(act.total ? Math.round((n / act.total) * 1000) / 10 : null)],
              }))
            : []
        }
        help="Shows in search means a complete profile on an account that isn't suspended or banned, the same rule search uses."
      />
      {e.median != null ? (
        <ChartCard id="ins-artisans-earnings" title="Earnings spread" summary="Payouts per artisan in the period, from lowest to highest.">
          <DataTable
            caption="Earnings spread"
            columns={[{ label: "Point" }, { label: "Earned", numeric: true }]}
            rows={[
              { key: "min", cells: ["Lowest", formatGhs(e.min)] },
              { key: "q1", cells: ["A quarter earned less than", formatGhs(e.q1)] },
              { key: "median", cells: ["Median", formatGhs(e.median)] },
              { key: "q3", cells: ["Three quarters earned less than", formatGhs(e.q3)] },
              { key: "max", cells: ["Highest", formatGhs(e.max)] },
            ]}
          />
        </ChartCard>
      ) : null}
    </Section>
  )
}

// ─── 8. Retention ─────────────────────────────────────────────────────────────

export function RetentionSection({ data, period }: Readonly<{ data: Data<"retention">; period: string }>) {
  const cohorts = data.cohorts
  const anySignups = cohorts.some((c) => c.size > 0)
  return (
    <Section id="ins-retention" title="Retention" intro={`Clients who came back, from payments in the ${period}.`}>
      <TileGrid className="xl:grid-cols-2">
        <StatTile
          label="Repeat clients"
          value={pct(data.repeatClientRate)}
          muted={data.repeatClientRate == null}
          sub={`${formatCount(data.repeatClients)} of ${formatCount(data.payingClients)} paying clients`}
          help="Clients who paid for two or more jobs in the period, out of those who paid for at least one."
        />
        <StatTile
          label="Repeat client–artisan pairs"
          value={pct(data.repeatPairRate)}
          muted={data.repeatPairRate == null}
          sub={`${formatCount(data.repeatPairs)} of ${formatCount(data.pairs)} pairs`}
          help="A client and an artisan with two or more paid jobs together in the period."
        />
      </TileGrid>
      <ChartCard
        id="ins-retention-cohorts"
        title="Sign-up cohorts"
        summary="Always the last 6 months, whatever period is selected."
        footer={
          <div className="border-t border-border px-4 py-3 sm:px-6">
            <Help>
              Each row is the clients who signed up that month. Each column is the share of them who posted or paid for a
              job in that month after signing up (month 0 is the sign-up month). A dash means that month hasn&apos;t
              happened yet.
            </Help>
          </div>
        }
      >
        {anySignups ? (
          <div className="-mx-1 overflow-x-auto px-1">
            <table className="w-full min-w-[520px] text-sm">
              <caption className="sr-only">Share of each sign-up month who posted or paid for a job, by month after sign-up</caption>
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="pb-2 font-medium">
                    Signed up
                  </th>
                  <th scope="col" className="pb-2 pl-3 text-right font-medium">
                    Clients
                  </th>
                  {cohorts[0].months.map((_, k) => (
                    <th key={k} scope="col" className="pb-2 pl-3 text-right font-medium">
                      Month {k}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {cohorts.map((c) => (
                  <tr key={c.cohort} className="border-b border-border/70 last:border-0">
                    <th scope="row" className="py-2.5 text-left font-normal text-foreground">
                      {formatCohort(c.cohort)}
                    </th>
                    <td className="tnum py-2.5 pl-3 text-right tabular-nums">{formatCount(c.size)}</td>
                    {c.months.map((m, k) => (
                      <td
                        key={k}
                        className={cn("tnum py-2.5 pl-3 text-right tabular-nums", m == null && "text-muted-foreground")}
                        style={
                          m != null && m > 0
                            ? { backgroundColor: `color-mix(in oklab, var(--primary) ${Math.round(6 + (m / 100) * 26)}%, transparent)` }
                            : undefined
                        }
                      >
                        {m == null ? "—" : formatPercent(m)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>No client sign-ups in the last 6 months.</Empty>
        )}
      </ChartCard>
    </Section>
  )
}

// ─── 9. Reviews ───────────────────────────────────────────────────────────────

function formatBucket(iso: string, bucket: Insights["bucket"]): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const opts: Intl.DateTimeFormatOptions =
    bucket === "month" ? { month: "short", year: "numeric", timeZone: "UTC" } : { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }
  const s = d.toLocaleDateString("en-GB", opts).replace("Sept", "Sep")
  return bucket === "week" ? `Week of ${s}` : s
}

export function ReviewsSection({
  data,
  bucket,
  period,
}: Readonly<{ data: Data<"reviews">; bucket: Insights["bucket"]; period: string }>) {
  const [view, setView] = useState<"chart" | "table">("chart")
  const trend = data.trend
  return (
    <Section id="ins-reviews" title="Reviews" intro={`Reviews clients left in the ${period}.`}>
      <TileGrid className="xl:grid-cols-2">
        <StatTile
          label="Average rating"
          value={data.averageRating == null ? NOT_ENOUGH_DATA : `${data.averageRating.toLocaleString("en-GB")} out of 5`}
          muted={data.averageRating == null}
          sub={sampleLabel(data.count, "review")}
          help="The plain average of every review left in the period."
        />
        <StatTile
          label="Review rate"
          value={pct(data.reviewRate)}
          muted={data.reviewRate == null}
          sub={`${formatCount(data.reviewedJobs)} of ${formatCount(data.completedJobs)} completed jobs`}
          help="Completed jobs (posted in the period) that have a review."
        />
      </TileGrid>
      <div className="grid gap-4 lg:grid-cols-2">
        <BarCard
          id="ins-reviews-dist"
          title="Ratings"
          summary={data.count ? `${formatCount(data.count)} reviews by star rating.` : "No reviews in this period."}
          empty="No reviews in this period."
          firstColumn="Rating"
          valueLabel="Reviews"
          rows={
            data.count
              ? [...data.distribution].reverse().map((d) => ({
                  key: String(d.star),
                  label: `${d.star} ${d.star === 1 ? "star" : "stars"}`,
                  value: d.count,
                  display: formatCount(d.count),
                }))
              : []
          }
          help="Half stars are rounded to the nearest whole star."
        />
        <ChartCard
          id="ins-reviews-trend"
          title="Average rating over time"
          summary={trend.length ? "Only periods with at least one review are shown." : "No reviews in this period."}
          toggle={trend.length ? <ViewToggle view={view} onChange={setView} controls="ins-reviews-trend" /> : undefined}
        >
          {trend.length === 0 ? (
            <Empty>No reviews in this period.</Empty>
          ) : view === "chart" ? (
            <ol className="space-y-3.5">
              {trend.map((t) => (
                <li key={t.bucket}>
                  <div className="flex flex-wrap items-baseline justify-between gap-x-3 text-sm">
                    <span className="text-foreground">{formatBucket(t.bucket, bucket)}</span>
                    <span className="tnum tabular-nums text-muted-foreground">
                      {t.averageRating == null ? "—" : `${t.averageRating.toLocaleString("en-GB")} · ${formatCount(t.count)} ${t.count === 1 ? "review" : "reviews"}`}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${((t.averageRating ?? 0) / 5) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <DataTable
              caption="Average rating over time"
              columns={[{ label: bucket === "month" ? "Month" : bucket === "week" ? "Week" : "Day" }, { label: "Average", numeric: true }, { label: "Reviews", numeric: true }]}
              rows={trend.map((t) => ({
                key: t.bucket,
                cells: [formatBucket(t.bucket, bucket), t.averageRating == null ? "—" : t.averageRating.toLocaleString("en-GB"), formatCount(t.count)],
              }))}
            />
          )}
        </ChartCard>
      </div>
    </Section>
  )
}
