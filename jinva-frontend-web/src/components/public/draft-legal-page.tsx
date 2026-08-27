import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { PublicProse } from "@/components/public/public-prose"

/**
 * PUB1 / PUB2 — the shared body of `/terms` and `/privacy`, per design-spec.md
 * §8.3. One component, one prop; the two pages are otherwise identical, so they
 * must not be forked.
 *
 * BOTH SHIP AS A VISIBLY LABELLED DRAFT PLACEHOLDER (user decision, 2026-08-27).
 * No agent authors binding legal text, and this deliberately does not sketch
 * section headings either: a plausible-looking skeleton of "1. Acceptance of
 * Terms / 2. Limitation of Liability" is STILL authoring the structure of a legal
 * document, and a reviewer skimming it could easily mistake it for real.
 *
 * HANDOFF TO A HUMAN, NOT TO AN ENGINEER: supply the real copy. A marketplace
 * that handles payments and personal data with no published terms or privacy
 * policy is a compliance exposure, and this page is a placeholder, not a
 * resolution of it (requirements.md Open Question 4).
 */
export function DraftLegalPage({
  title,
  documentName,
}: Readonly<{
  /** The `<h1>`, e.g. "Terms of Service". */
  title: string
  /** How the document is named mid-sentence, e.g. "Terms of Service" / "Privacy Policy". */
  documentName: string
}>) {
  return (
    <PublicProse
      eyebrow="Legal"
      title={title}
      footer={
        <>
          <Separator className="my-8" />
          <p className="text-sm text-muted-foreground">Last updated: not yet published.</p>
        </>
      }
    >
      {/* The status is carried by an icon and the explicit word "Draft", never by
          colour alone. `text-warning` on `bg-warning/10` measures 5.90:1 light /
          9.22:1 dark; the description drops to `text-foreground` so a longer
          paragraph reads at full contrast. */}
      <Alert className="mb-8 border-warning/30 bg-warning/10 text-warning">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Draft &mdash; pending legal review</AlertTitle>
        <AlertDescription className="text-foreground">
          JinVa&rsquo;s {documentName} has not been published yet. This page is a placeholder so that links
          to it resolve; it is not a legal agreement and nothing on it is binding.
        </AlertDescription>
      </Alert>

      <p>
        The published version will be added here before JinVa is open to the public. If you need to
        understand how JinVa handles bookings, payments or your personal information in the meantime, please{" "}
        <Link href="/contact">get in touch</Link>.
      </p>
    </PublicProse>
  )
}
