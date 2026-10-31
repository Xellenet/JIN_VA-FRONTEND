import Link from "next/link"
import { AlertTriangle } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Separator } from "@/components/ui/separator"
import { PublicProse } from "@/components/public/public-prose"
import { LEGAL_LAST_UPDATED, LEGAL_REVIEWED_BY_COUNSEL } from "@/lib/legal-entity"

const DOCUMENTS = [
  { href: "/legal", label: "Legal information" },
  { href: "/terms", label: "Terms of Service" },
  { href: "/privacy", label: "Privacy Policy" },
] as const

/**
 * Shared frame for /legal, /terms and /privacy: the title, a contents list
 * built from the sections passed in, the "pending legal review" banner while
 * LEGAL_REVIEWED_BY_COUNSEL is false, and links to the other two documents.
 */
export function LegalDocument({
  title,
  standfirst,
  current,
  sections,
  children,
}: Readonly<{
  title: string
  standfirst: React.ReactNode
  current: (typeof DOCUMENTS)[number]["href"]
  /** id + heading of every <h2> in the body, in order, for the contents list. */
  sections: { id: string; heading: string }[]
  children: React.ReactNode
}>) {
  return (
    <PublicProse
      eyebrow="Legal"
      title={title}
      standfirst={standfirst}
      footer={
        <>
          <Separator className="my-8" />
          <p className="text-sm text-muted-foreground">Last updated: {LEGAL_LAST_UPDATED}</p>
          <nav aria-label="Other legal documents" className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {DOCUMENTS.filter((d) => d.href !== current).map((d) => (
              <Link key={d.href} href={d.href} className="text-primary underline underline-offset-4">
                {d.label}
              </Link>
            ))}
          </nav>
        </>
      }
    >
      {!LEGAL_REVIEWED_BY_COUNSEL && (
        <Alert className="mb-8 border-warning/30 bg-warning/10 text-warning">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Pending legal review</AlertTitle>
          <AlertDescription className="text-foreground">
            This document has been drafted against Ghanaian law but has not yet been reviewed by a lawyer. It
            may change before JinVa opens to the public.
          </AlertDescription>
        </Alert>
      )}

      <nav aria-label="Contents" className="mb-10 rounded-xl border bg-muted/30 p-5">
        <p className="mb-3 text-sm font-semibold text-foreground">Contents</p>
        <ol className="list-decimal space-y-1.5 pl-5 text-sm text-muted-foreground marker:text-muted-foreground">
          {sections.map((s) => (
            <li key={s.id}>
              <a href={`#${s.id}`} className="!text-muted-foreground !no-underline hover:!text-foreground hover:!underline">
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {children}
    </PublicProse>
  )
}

/**
 * A fact about the business from LEGAL_ENTITY, or — when it hasn't been filled
 * in — a visibly highlighted note saying what's missing.
 */
export function LegalFact({ value, missing }: Readonly<{ value: string | null | undefined; missing: string }>) {
  if (value) return <>{value}</>
  return (
    <mark className="rounded bg-warning/15 px-1 text-foreground">[to be confirmed: {missing}]</mark>
  )
}

/** An <h2> with an id the contents list can link to. */
export function LegalHeading({ id, children }: Readonly<{ id: string; children: React.ReactNode }>) {
  return (
    <h2 id={id} className="scroll-mt-24">
      {children}
    </h2>
  )
}
