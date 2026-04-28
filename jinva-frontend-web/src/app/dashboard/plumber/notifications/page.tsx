import { NotificationsPage } from "@/components/dashboard/notifications-page"
import { mockPlumbers } from "@/lib/data/mock-data"

export default function PlumberNotificationsPage() {
  const user = { ...mockPlumbers[0], role: "plumber" as const }
  return <NotificationsPage user={user} />
}
