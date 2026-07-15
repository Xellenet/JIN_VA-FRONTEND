"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

function UserMessagesContent() {
  const searchParams = useSearchParams()
  const artisanId = searchParams.get("artisan") || undefined

  return <MessagesPage openConversationId={artisanId} />
}

export default function UserMessages() {
  return (
    <Suspense>
      <UserMessagesContent />
    </Suspense>
  )
}
