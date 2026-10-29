import type { Metadata } from "next"
import Link from "next/link"
import { Info, LifeBuoy, UserPlus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Reveal } from "@/components/public/reveal"

/**
 * PUB4 — `/contact`, per design-spec.md §8.4.
 *
 * FULLY STATIC and it must not consult a session: public routes may not call an
 * authenticated endpoint. So it cannot detect whether you are signed in — it
 * shows both paths, clearly labelled, and lets you pick.
 *
 * NO CONTACT FORM (nothing exists to receive it, and a form that posts nowhere
 * is worse than no form) and NO invented email address, phone number or postal
 * address — the same no-fabrication rule as LP8. Requirements.md Open Question 7
 * supplied no real support address, so none is invented.
 *
 * REVISIT TRIGGER: the moment a real support address is supplied, it becomes a
 * third Card at the top of this page with a `Mail` icon and a `mailto:` link, and
 * the note below shrinks to one line.
 */
export const metadata: Metadata = {
  title: "Contact & support",
  description:
    "Every JinVa support request goes through your account, so it arrives attached to you and to the job it is about.",
}

export default function ContactPage() {
  return (
    <main className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal>
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Support</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance sm:text-4xl">
            Get in touch.
          </h1>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Every support request goes through your JinVa account, so it arrives attached to you and to the
            job it&rsquo;s about.
          </p>
          <Separator className="my-8" />
        </Reveal>

        <div className="grid gap-4 md:grid-cols-2">
          <Reveal asChild delay={60}>
            <Card className="h-full gap-4 px-6 py-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <LifeBuoy className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-card-foreground">
                Already have a JinVa account?
              </h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Log in and open <strong className="font-medium text-foreground">Support</strong> in your
                sidebar. Every role has it. You can browse answers, open a ticket, or use{" "}
                <strong className="font-medium text-foreground">Report a problem</strong> if something&rsquo;s
                gone wrong with a specific job.
              </p>
              <Button asChild className="mt-auto w-fit">
                <Link href="/login">Log in</Link>
              </Button>
            </Card>
          </Reveal>

          <Reveal asChild delay={140}>
            <Card className="h-full gap-4 px-6 py-6">
              <span className="flex size-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <UserPlus className="size-5" aria-hidden="true" />
              </span>
              <h2 className="text-base font-semibold text-card-foreground">Not signed up yet?</h2>
              <p className="text-sm leading-relaxed text-muted-foreground">
                Create an account and you&rsquo;ll get the same support channel &mdash; plus the booking and
                payment record that makes a problem easy to sort out.
              </p>
              <Button variant="outline" asChild className="mt-auto w-fit">
                <Link href="/signup">Create an account</Link>
              </Button>
            </Card>
          </Reveal>
        </div>

        <Reveal delay={200}>
          <div className="mt-6 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <strong className="font-semibold text-foreground">
                We don&rsquo;t publish a support email address yet.
              </strong>{" "}
              Support runs through your account so that a request arrives with your jobs, bookings and
              payments already attached &mdash; which is usually what&rsquo;s needed to resolve it. If that
              changes, this page is where the address will appear.
            </p>
          </div>
        </Reveal>
      </div>
    </main>
  )
}
