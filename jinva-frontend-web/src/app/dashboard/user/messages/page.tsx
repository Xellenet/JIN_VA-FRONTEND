"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { MessagesPage } from "@/components/dashboard/messages-page"

/** A positive safe integer from a URL parameter, or undefined (SEC-19). */
function positiveIntParam(value: string | null): number | undefined {
  if (!value || !/^[1-9][0-9]{0,15}$/.test(value)) return undefined
  const n = Number(value)
  return Number.isSafeInteger(n) ? n : undefined
}

/**
 * `?artisan=<userId>` opens that conversation; MC2's optional `&job=`/
 * `&booking=` carries the job/booking the customer came from, so the send
 * action can reference it and the thread header can show the context chip.
 *
 * Item 6: `?conversation=<conversationId>` opens a conversation by its own id
 * (message notifications and deleted contacts have no usable user id), and
 * `?reply=1` focuses the reply box (Q9: "Reply" opens the thread).
 */
function UserMessagesContent() {
  const searchParams = useSearchParams()
  const artisanId = searchParams.get("artisan") || undefined
  const jobId = searchParams.get("job") || undefined
  const bookingId = searchParams.get("booking") || undefined
  const conversationId = positiveIntParam(searchParams.get("conversation"))
  const focusReply = searchParams.get("reply") === "1"

  return (
    <MessagesPage
      openConversationId={artisanId}
      jobId={jobId}
      bookingId={bookingId}
      openConversationRowId={conversationId}
      focusReply={focusReply}
    />
  )
}

export default function UserMessages() {
  return (
    <Suspense>
      <UserMessagesContent />
    </Suspense>
  )
}
