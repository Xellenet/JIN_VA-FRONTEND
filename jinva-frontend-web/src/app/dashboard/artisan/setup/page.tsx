"use client"

import { Suspense } from "react"
import { DashboardLayout } from "@/components/dashboard/layout"
import { SetupWizard } from "@/components/artisan/setup/setup-wizard"

/**
 * The artisan setup checklist. New artisan accounts land here after sign-up;
 * the artisan layout's role guard keeps everyone else out.
 */
export default function ArtisanSetupPage() {
  return (
    <DashboardLayout>
      <Suspense fallback={null}>
        <SetupWizard />
      </Suspense>
    </DashboardLayout>
  )
}
