"use client"

import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

export default function UserMessages() {
  const searchParams = useSearchParams()
  const artisanId = searchParams.get("artisan") || undefined

  const user = {
    id: "c1",
    name: "Devon Lane",
    email: "devon.lane@email.com",
    role: "user" as const,
    avatar: "/placeholder.svg?height=40&width=40",
  }

  return <MessagesPage user={user} openConversationId={artisanId} />
}
