import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

const normalUser = {
  id: "u1",
  name: "Sarah Williams",
  email: "sarah@example.com",
  role: "user" as const,
  avatar: "/placeholder.svg?height=40&width=40",
}

export default function UserSupportPage() {
  return (
    <DashboardLayout user={normalUser}>
      <SupportPage role="user" />
    </DashboardLayout>
  )
}
