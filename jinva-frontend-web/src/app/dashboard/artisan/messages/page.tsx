import { MessagesPage } from "@/components/dashboard/messages-page"
import { mockArtisans } from "@/lib/data/mock-data"

export default function ArtisanMessages() {
  const user = {
    ...mockArtisans[0],
    role: "artisan" as const,
  }

  return <MessagesPage user={user} />
}
