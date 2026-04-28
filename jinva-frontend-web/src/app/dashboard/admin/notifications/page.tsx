import { NotificationsPage } from "@/components/dashboard/notifications-page"

export default function AdminNotificationsPage() {
  const user = {
    id: "1",
    name: "John Smith",
    email: "john@example.com",
    role: "admin" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }
  return <NotificationsPage user={user} />
}
