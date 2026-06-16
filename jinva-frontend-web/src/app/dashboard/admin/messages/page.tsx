import { MessagesPage } from "@/components/dashboard/messages-page"
import { mockUsers } from "@/lib/data/mock-data"

export default function AdminMessages() {
  const user = {
    ...mockUsers[0],
    role: "admin" as const,
  }

  return <MessagesPage user={user} />
}
