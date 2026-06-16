import { DashboardLayout } from "@/components/dashboard/layout"
import { SupportPage } from "@/components/dashboard/support-page"

const artisanUser = {
  id: "p1",
  name: "Robert Fox",
  email: "robert@plumbify.com",
  role: "artisan" as const,
  avatar: "/artisan-in-blue-uniform.jpg",
}

export default function ArtisanSupportPage() {
  return (
    <DashboardLayout user={artisanUser}>
      <SupportPage role="artisan" />
    </DashboardLayout>
  )
}
