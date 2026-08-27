import type { Metadata } from "next"
import { DraftLegalPage } from "@/components/public/draft-legal-page"

/** PUB1 — `/terms`. Ships as a labelled draft placeholder; see DraftLegalPage. */
export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "JinVa's Terms of Service have not been published yet. This page is a placeholder pending legal review.",
}

export default function TermsPage() {
  return <DraftLegalPage title="Terms of Service" documentName="Terms of Service" />
}
