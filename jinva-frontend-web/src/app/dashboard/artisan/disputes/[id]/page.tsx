import { DashboardLayout } from "@/components/dashboard/layout"
import { PartyDisputePage } from "@/components/disputes/party-dispute-page"

export default function ArtisanDisputeDetailPage() {
  return (
    <DashboardLayout>
      <PartyDisputePage role="artisan" />
    </DashboardLayout>
  )
}
