import { NotificationsPage } from "@/components/dashboard/notifications-page"
import { mockArtisans } from "@/lib/data/mock-data"

export default function ArtisanNotificationsPage() {
  const user = { ...mockArtisans[0], role: "artisan" as const }
  return <NotificationsPage user={user} />
}
