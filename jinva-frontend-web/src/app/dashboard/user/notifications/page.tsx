import { NotificationsPage } from "@/components/dashboard/notifications-page"

export default function UserNotificationsPage() {
  const user = {
    id: "u1",
    name: "Sarah Williams",
    email: "sarah@example.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }
  return <NotificationsPage user={user} />
}
