"use client"

import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { SpendingPage } from "@/components/spending/spending-page"
import { SpendingSkeleton } from "@/components/spending/spending-skeleton"

/**
 * Spending (Customer Experience v2, item 4; FR-4.1). This route used to
 * redirect to My Bookings because the old page showed sample figures; it now
 * shows the customer's real spending and payment history.
 */
export default function ReportPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={<SpendingSkeleton />}>
        <SpendingPage />
      </Suspense>
    </DashboardLayout>
  )
}
