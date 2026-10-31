"use client"

import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { AnalyticsPage } from "@/components/earnings/analytics-page"

/**
 * Analytics (C1): the artisan's real figures from `GET /analytics/artisan`.
 * The range is in the URL, so the page sits in Suspense.
 */
export default function ArtisanAnalyticsPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <AnalyticsPage />
      </Suspense>
    </DashboardLayout>
  )
}
