import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

const plumberUser = {
  id: "p1",
  name: "Robert Fox",
  email: "robert@plumbify.com",
  role: "plumber" as const,
  avatar: "/plumber-in-blue-uniform.jpg",
}

export default function PlumberSupportPage() {
  return (
    <DashboardLayout user={plumberUser}>
      <SupportPage role="plumber" />
    </DashboardLayout>
  )
}
