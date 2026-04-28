import { MessagesPage } from "@/components/dashboard/messages-page"
import { mockPlumbers } from "@/lib/data/mock-data"

export default function PlumberMessages() {
  const user = {
    ...mockPlumbers[0],
    role: "plumber" as const,
  }

  return <MessagesPage user={user} />
}
