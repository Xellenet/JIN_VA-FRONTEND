import type { Metadata } from "next"
import { DraftLegalPage } from "@/components/public/draft-legal-page"

/** PUB2 — `/privacy`. Ships as a labelled draft placeholder; see DraftLegalPage. */
export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "JinVa's Privacy Policy has not been published yet. This page is a placeholder pending legal review.",
}

export default function PrivacyPage() {
  return <DraftLegalPage title="Privacy Policy" documentName="Privacy Policy" />
}
