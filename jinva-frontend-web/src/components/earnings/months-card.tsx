"use client"

import type { EarningsStatement } from "@/lib/earnings-api"
import { feeShare, isZero, monthLong, monthShort, rangePhrase, type EarningsPeriod } from "@/lib/earnings"
import { formatMoney, plural } from "@/lib/spending"
import { cn } from "@/lib/utils"

/**
 * H7: the statement by month: what clients paid, JinVa's fee and what's
 * yours, newest month first, with the period total underneath. A table on
 * tablets and up; a list on phones, where five columns can't fit.
 */
export function MonthsCard({ data, period }: Readonly<{ data: EarningsStatement; period: EarningsPeriod }>) {
  const months = [...data.months].reverse()
  const { summary } = data
  const share = feeShare(summary.gross, summary.fee)

  return (
    <section aria-labelledby="months-title" className="rounded-xl border border-border bg-card">
      <div className="px-4 pt-4 sm:px-6 sm:pt-5">
        <h2 id="months-title" className="text-[15px] font-semibold text-foreground">
          Month by month
        </h2>
        <p className="mt-1 max-w-[70ch] text-sm text-muted-foreground">
          {summary.jobs > 0 ? (
            <>
              Clients paid <span className="tnum tabular-nums">{formatMoney(summary.gross)}</span> for{" "}
              {plural(summary.jobs, "job")} {rangePhrase(period)}. JinVa&apos;s fee was{" "}
              <span className="tnum tabular-nums">{formatMoney(summary.fee)}</span>
              {share ? ` (${share})` : ""}, leaving <span className="tnum tabular-nums">{formatMoney(summary.net)}</span>{" "}
              for you.
            </>
          ) : (
            <>No paid jobs {rangePhrase(period)}.</>
          )}
        </p>
      </div>

      {months.length === 0 ? null : (
        <>
          <div className="hidden px-6 pb-5 pt-4 sm:block">
            <table className="w-full text-sm">
              <caption className="sr-only">Earnings by month, newest first</caption>
              <thead>
                <tr className="border-b border-border text-left text-[13px] text-muted-foreground">
                  <th scope="col" className="pb-2 font-medium">Month</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-medium">Jobs</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-medium">Paid by clients</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-medium">JinVa fee</th>
                  <th scope="col" className="pb-2 pl-4 text-right font-medium">Your earnings</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => {
                  const empty = m.jobs === 0 && isZero(m.gross)
                  return (
                    <tr key={m.month} className={cn("border-b border-border/70", empty && "text-muted-foreground")}>
                      <th scope="row" className="py-2.5 text-left font-normal">
                        {monthLong(m.month)}
                      </th>
                      <td className="tnum py-2.5 pl-4 text-right tabular-nums">{m.jobs.toLocaleString("en-GB")}</td>
                      <td className="tnum whitespace-nowrap py-2.5 pl-4 text-right tabular-nums">{formatMoney(m.gross)}</td>
                      <td className="tnum whitespace-nowrap py-2.5 pl-4 text-right tabular-nums">{formatMoney(m.fee)}</td>
                      <td
                        className={cn(
                          "tnum whitespace-nowrap py-2.5 pl-4 text-right tabular-nums",
                          !empty && "font-medium text-foreground",
                        )}
                      >
                        {formatMoney(m.net)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="font-semibold text-foreground">
                  <th scope="row" className="pt-3 text-left">
                    Total
                  </th>
                  <td className="tnum pt-3 pl-4 text-right tabular-nums">{summary.jobs.toLocaleString("en-GB")}</td>
                  <td className="tnum whitespace-nowrap pt-3 pl-4 text-right tabular-nums">{formatMoney(summary.gross)}</td>
                  <td className="tnum whitespace-nowrap pt-3 pl-4 text-right tabular-nums">{formatMoney(summary.fee)}</td>
                  <td className="tnum whitespace-nowrap pt-3 pl-4 text-right tabular-nums">{formatMoney(summary.net)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <ul className="mt-3 divide-y divide-border/70 border-t border-border sm:hidden">
            {months.map((m) => {
              const empty = m.jobs === 0 && isZero(m.gross)
              return (
                <li key={m.month} className="px-4 py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className={cn("text-sm", empty ? "text-muted-foreground" : "font-medium text-foreground")}>
                      {monthShort(m.month)}
                    </span>
                    <span
                      className={cn(
                        "tnum whitespace-nowrap text-sm tabular-nums",
                        empty ? "text-muted-foreground" : "font-semibold text-foreground",
                      )}
                    >
                      {formatMoney(m.net)}
                    </span>
                  </div>
                  {empty ? null : (
                    <p className="tnum mt-0.5 text-[13px] tabular-nums text-muted-foreground">
                      {plural(m.jobs, "job")}. Clients paid {formatMoney(m.gross)}, fee {formatMoney(m.fee)}.
                    </p>
                  )}
                </li>
              )
            })}
            <li className="flex items-baseline justify-between gap-3 px-4 py-3 font-semibold text-foreground">
              <span className="text-sm">Total</span>
              <span className="tnum whitespace-nowrap text-sm tabular-nums">{formatMoney(summary.net)}</span>
            </li>
          </ul>
        </>
      )}
    </section>
  )
}
