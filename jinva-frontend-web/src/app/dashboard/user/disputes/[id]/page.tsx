import { DashboardLayout } from "@/components/dashboard/layout"
import { PartyDisputePage } from "@/components/disputes/party-dispute-page"

export default function UserDisputeDetailPage() {
  return (
    <DashboardLayout>
      <PartyDisputePage role="user" />
    </DashboardLayout>
  )
}
