import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

export default function AdminSupportPage() {
  return (
    <DashboardLayout>
      <SupportPage role="admin" />
    </DashboardLayout>
  )
}
