"use client"

import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

export default function UserMessages() {
  const searchParams = useSearchParams()
  const artisanId = searchParams.get("artisan") || undefined

  return <MessagesPage openConversationId={artisanId} />
}
