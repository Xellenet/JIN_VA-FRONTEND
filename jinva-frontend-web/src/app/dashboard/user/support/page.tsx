import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

export default function UserSupportPage() {
  return (
    <DashboardLayout>
      <SupportPage role="user" />
    </DashboardLayout>
  )
}
