"use client"

import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { EarningsBandSkeleton } from "@/components/earnings/earnings-band"
import { EarningsPage } from "@/components/earnings/earnings-page"

/**
 * Earnings (H7): the artisan's statement from `GET /payments/my-earnings/statement`.
 * The period, stage and page are in the URL, so the page sits in Suspense.
 */
export default function ArtisanEarningsPage() {
  return (
    <DashboardLayout>
      <Suspense
        fallback={
          <div className="mx-auto w-full max-w-[1200px]">
            <EarningsBandSkeleton />
          </div>
        }
      >
        <EarningsPage />
      </Suspense>
    </DashboardLayout>
  )
}
