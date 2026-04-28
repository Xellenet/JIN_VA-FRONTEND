import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

const adminUser = {
  id: "1",
  name: "John Smith",
  email: "admin@plumbify.com",
  role: "admin" as const,
  avatar: "/placeholder.svg?height=40&width=40",
}

export default function AdminSupportPage() {
  return (
    <DashboardLayout user={adminUser}>
      <SupportPage role="admin" />
    </DashboardLayout>
  )
}
