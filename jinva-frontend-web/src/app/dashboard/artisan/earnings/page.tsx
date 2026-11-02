"use client"

import { Suspense } from "react"
import { BarChart2, ReceiptText } from "lucide-react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EarningsBandSkeleton } from "@/components/earnings/earnings-band"
import { EarningsPage } from "@/components/earnings/earnings-page"
import { AnalyticsPage } from "@/components/earnings/analytics-page"
import { useTabParam } from "@/lib/use-tab-param"

const TABS = ["statement", "analytics"] as const
type Tab = (typeof TABS)[number]

/**
 * Earnings: the statement (H7, `GET /payments/my-earnings/statement`) and,
 * as a second tab, Analytics (C1, `GET /analytics/artisan`). Each tab keeps
 * its own period in the URL (`period`, `range`) and loads only when opened.
 */
function ArtisanEarningsContent() {
  const [activeTab, changeTab] = useTabParam<Tab>(TABS, "statement")

  return (
    <div className="mx-auto w-full max-w-[1200px] space-y-5 sm:space-y-6 min-[1920px]:max-w-[1440px]">
      <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Earnings</h1>
      <Tabs value={activeTab} onValueChange={changeTab} className="gap-5 sm:gap-6">
        <TabsList aria-label="Earnings" className="h-auto w-full sm:w-fit">
          <TabsTrigger value="statement" className="min-h-11 gap-2 sm:min-h-8 sm:px-3">
            <ReceiptText className="h-4 w-4" aria-hidden="true" />
            Statement
          </TabsTrigger>
          <TabsTrigger value="analytics" className="min-h-11 gap-2 sm:min-h-8 sm:px-3">
            <BarChart2 className="h-4 w-4" aria-hidden="true" />
            Analytics
          </TabsTrigger>
        </TabsList>
        <TabsContent value="statement">
          <EarningsPage />
        </TabsContent>
        <TabsContent value="analytics">
          <AnalyticsPage />
        </TabsContent>
      </Tabs>
    </div>
  )
}

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
        <ArtisanEarningsContent />
      </Suspense>
    </DashboardLayout>
  )
}
