import type { Metadata } from "next"
import Link from "next/link"
import { Briefcase, Info, Mail, MessageSquare, UserCog, Wallet } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { Reveal } from "@/components/public/reveal"
import { LEGAL_ENTITY } from "@/lib/legal-entity"

/**
 * `/contact`. The dashboard's Support entry points here, for both roles.
 *
 * FULLY STATIC and it must not consult a session: public routes may not call an
 * authenticated endpoint. So it cannot tell whether you are signed in. It lists
 * where each kind of problem is actually handled in the app (every place named
 * here exists), and the support email from `LEGAL_ENTITY` when one is set.
 *
 * NO CONTACT FORM (nothing exists to receive it) and NO invented email address,
 * phone number or postal address. With `supportEmail` blank, the page says so
 * plainly instead of pointing at a ticket system that doesn't exist.
 */
export const metadata: Metadata = {
  title: "Contact & support",
  description: "Where to get help with a job, a payment or your JinVa account.",
}

const SUPPORT_EMAIL = LEGAL_ENTITY.supportEmail?.trim() || null

const ROUTES = [
  {
    icon: Briefcase,
    title: "Something went wrong with a job",
    body: (
      <>
        Open the job from <strong className="font-medium text-foreground">My Jobs</strong> and choose{" "}
        <strong className="font-medium text-foreground">Report a problem</strong>. The report goes to our team with
        the job, the booking and the payment attached, and you can follow it from there.
      </>
    ),
  },
  {
    icon: MessageSquare,
    title: "A question for the client or artisan",
    body: (
      <>
        Use <strong className="font-medium text-foreground">Messages</strong> in your dashboard. Keeping the
        conversation there means it&rsquo;s on record if you need to report a problem later.
      </>
    ),
  },
  {
    icon: Wallet,
    title: "A payment or payout",
    body: (
      <>
        Clients can see every payment, refund and receipt in{" "}
        <strong className="font-medium text-foreground">Spending</strong>. Artisans can see what&rsquo;s on its way,
        what needs their action and why in <strong className="font-medium text-foreground">Earnings</strong>, and
        change where they&rsquo;re paid in Settings, under Payouts.
      </>
    ),
  },
  {
    icon: UserCog,
    title: "Your account",
    body: (
      <>
        Change your details, password and notifications, or delete your account, in{" "}
        <strong className="font-medium text-foreground">Settings</strong>.
      </>
    ),
  },
]

export default function ContactPage() {
  return (
    <main className="py-12 md:py-16">
      <div className="mx-auto w-full max-w-3xl px-4 sm:px-6">
        <Reveal>
          <h1 className="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Get help</h1>
          <p className="mt-3 max-w-[60ch] text-base leading-relaxed text-muted-foreground">
            Most problems are fastest to sort out from inside your JinVa account, where the job, the booking and the
            payment are already on record. Here&rsquo;s where to go.
          </p>
          <Separator className="my-8" />
        </Reveal>

        <Reveal delay={60}>
          <ul className="divide-y divide-border rounded-xl border border-border bg-card">
            {ROUTES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-4 px-5 py-5 sm:px-6">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-card-foreground">{title}</h2>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p>
                </div>
              </li>
            ))}
          </ul>
          <div className="mt-5 flex flex-col gap-2 sm:flex-row">
            <Button asChild className="h-11 sm:w-auto">
              <Link href="/login">Log in to your account</Link>
            </Button>
            <Button variant="outline" asChild className="h-11 bg-transparent sm:w-auto">
              <Link href="/signup">Create an account</Link>
            </Button>
          </div>
        </Reveal>

        <Reveal delay={140}>
          {SUPPORT_EMAIL ? (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <Mail className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">Anything else?</strong> Email us at{" "}
                <a
                  href={`mailto:${SUPPORT_EMAIL}`}
                  className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
                >
                  {SUPPORT_EMAIL}
                </a>
                . If it&rsquo;s about a job, include the job title so we can find it.
              </p>
            </div>
          ) : (
            <div className="mt-8 flex items-start gap-3 rounded-lg border border-border bg-muted/40 p-4">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <p className="text-sm leading-relaxed text-muted-foreground">
                <strong className="font-semibold text-foreground">We don&rsquo;t have a support email address yet.</strong>{" "}
                For a problem with a job, Report a problem is the way to reach our team. When an address is set up, it
                will appear here.
              </p>
            </div>
          )}
        </Reveal>
      </div>
    </main>
  )
}
