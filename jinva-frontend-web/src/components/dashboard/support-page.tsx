import Link from "next/link"
import type { ReactNode } from "react"
import { AlertTriangle, Mail, MessageSquare } from "lucide-react"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { LEGAL_ENTITY } from "@/lib/legal-entity"
import type { UserRole } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * C3 — Support, for every role.
 *
 * Only real channels: "Report a problem" on a job (the dispute flow), Messages
 * with the other side, and JinVa's support email from `legal-entity.ts`. While
 * that address is not set (`null`) the page points to /contact instead of
 * inventing one. No tickets, chat, phone line, opening hours or response times:
 * none of them exist, so none are shown.
 *
 * Every answer matches the backend and the Terms (/terms#payment, #completion,
 * #cancellations, #disputes): the client pays the booking price with nothing
 * added; JinVa's fee (`PLATFORM_FEE_PERCENT`) is deducted from the artisan's
 * payout; payment is held until the client confirms, or released 48 hours after
 * the artisan marks the job done if the client doesn't respond (the J2
 * auto-complete job). The fee percentage is config, so it is never printed here.
 */

interface SupportPageProps {
  readonly role: UserRole
}

interface Faq {
  readonly question: string
  readonly answer: ReactNode
}

interface FaqGroup {
  readonly topic: string
  readonly items: readonly Faq[]
}

interface Route {
  readonly icon: typeof Mail
  readonly title: string
  readonly body: ReactNode
  readonly links: readonly { label: string; href: string; external?: boolean }[]
}

const linkClass =
  "font-medium text-foreground underline decoration-foreground/30 underline-offset-4 outline-none hover:decoration-foreground focus-visible:ring-2 focus-visible:ring-primary dark:focus-visible:ring-ring"

function TextLink({ href, children }: Readonly<{ href: string; children: ReactNode }>) {
  return (
    <Link href={href} className={linkClass}>
      {children}
    </Link>
  )
}

const DISPUTE_TERMS = <TextLink href="/terms#disputes">disputes section of the Terms</TextLink>

const CLIENT_FAQ: readonly FaqGroup[] = [
  {
    topic: "Paying for a job",
    items: [
      {
        question: "What do I pay?",
        answer: (
          <>
            The price shown on the booking, in Ghana cedis. JinVa adds nothing on top. You pay by card or mobile
            money on Paystack&rsquo;s checkout, and JinVa never sees or stores your full card details.
          </>
        ),
      },
      {
        question: "When does the artisan get paid?",
        answer: (
          <>
            Your payment is held while the work is done. When the artisan marks the job as done, you&rsquo;re asked
            to confirm it. The payment is released to the artisan when you confirm, or 48 hours after they marked it
            done if you don&rsquo;t respond.
          </>
        ),
      },
      {
        question: "What if the work isn't finished or isn't right?",
        answer: (
          <>
            Don&rsquo;t confirm the job. Message the artisan first; most problems are sorted out that way. If it
            isn&rsquo;t, open the job or booking and choose <strong className="font-medium text-foreground">Report a
            problem</strong> once it&rsquo;s completed or cancelled.
          </>
        ),
      },
      {
        question: "Can I cancel and get my money back?",
        answer: (
          <>
            Before the work starts you can cancel and get a full refund, back to the card or mobile money account you
            paid with. How long a refund takes to reach you depends on your bank or mobile money provider. Once the
            work has started, the job can&rsquo;t be cancelled on its own; report a problem instead.
          </>
        ),
      },
    ],
  },
  {
    topic: "Disputes",
    items: [
      {
        question: "How does a dispute work?",
        answer: (
          <>
            Choose <strong className="font-medium text-foreground">Report a problem</strong> on the job or booking
            once it&rsquo;s completed or cancelled, and explain what happened. The artisan is told and can respond. A
            JinVa administrator reviews both sides and the job&rsquo;s record, including its timeline, messages and
            photos, then refunds all or part of your payment, releases it to the artisan, or records that you settled
            it between you. You&rsquo;re both told the outcome. The full rules are in the {DISPUTE_TERMS}.
          </>
        ),
      },
    ],
  },
  {
    topic: "Jobs and bookings",
    items: [
      {
        question: "Should I book an artisan or post a job?",
        answer: (
          <>
            Book when you know who you want: choose one of their services and a date and time from their profile.
            Post a job when you&rsquo;d like quotes: artisans apply and you choose one.
          </>
        ),
      },
      {
        question: "How do I change my details or notifications?",
        answer: (
          <>
            In <TextLink href="/dashboard/user/settings?tab=profile">Settings</TextLink>, on the Profile and
            Notifications tabs.
          </>
        ),
      },
    ],
  },
]

const ARTISAN_FAQ: readonly FaqGroup[] = [
  {
    topic: "Getting paid",
    items: [
      {
        question: "What does JinVa charge?",
        answer: (
          <>
            JinVa&rsquo;s fee is a percentage of each completed job. It&rsquo;s deducted from your payout, and you
            can see it in your <TextLink href="/dashboard/artisan/earnings">earnings</TextLink>. Clients pay the
            price on the booking, with nothing added by JinVa.
          </>
        ),
      },
      {
        question: "When do I get paid?",
        answer: (
          <>
            The client&rsquo;s payment is held while you do the work. When you mark the job as done, the client is
            asked to confirm it. Your payout starts when they confirm, or 48 hours after you marked it done if they
            don&rsquo;t respond. How long the transfer takes to reach you depends on your bank or mobile money
            provider.
          </>
        ),
      },
      {
        question: "Where is my money sent?",
        answer: (
          <>
            To the mobile money or bank account in{" "}
            <TextLink href="/dashboard/artisan/settings?tab=payments">Settings → Payments</TextLink>. If a transfer fails, it shows in your
            earnings and can be sent again once the account details are corrected.
          </>
        ),
      },
    ],
  },
  {
    topic: "Finding work",
    items: [
      {
        question: "How do clients hire me?",
        answer: (
          <>
            Two ways. Clients book one of your services for a date and time, and the request appears in your{" "}
            <TextLink href="/dashboard/artisan/calendar">Calendar</TextLink> for you to accept or decline. Or a
            client posts a job, you apply from <TextLink href="/dashboard/artisan/jobs">My jobs</TextLink>, and they
            choose who does it.
          </>
        ),
      },
      {
        question: "How do I get verified?",
        answer: (
          <>
            Submit your ID documents in{" "}
            <TextLink href="/dashboard/artisan/settings?tab=verification">Settings → Verification</TextLink>. An
            administrator reviews them and you get a notification with the result.
          </>
        ),
      },
    ],
  },
  {
    topic: "Disputes",
    items: [
      {
        question: "A client reported a problem. What happens now?",
        answer: (
          <>
            You get a notification. Open it to read what the client reported and send your response. A JinVa
            administrator reviews both sides and the job&rsquo;s record, including its timeline, messages and photos,
            then refunds all or part of the payment to the client, releases it to you, or records that you settled it
            between you. You&rsquo;re both told the outcome. The full rules are in the {DISPUTE_TERMS}.
          </>
        ),
      },
      {
        question: "Can I report a problem myself?",
        answer: (
          <>
            Yes. Open the job in <TextLink href="/dashboard/artisan/jobs">My Jobs</TextLink> and choose{" "}
            <strong className="font-medium text-foreground">Report a problem</strong> once it&rsquo;s completed or
            cancelled.
          </>
        ),
      },
    ],
  },
]

const ADMIN_FAQ: readonly FaqGroup[] = [
  {
    topic: "Queues",
    items: [
      {
        question: "Where do disputes wait for a decision?",
        answer: (
          <>
            In <TextLink href="/dashboard/admin/disputes">Disputes</TextLink>. The rules you apply are in the{" "}
            {DISPUTE_TERMS}.
          </>
        ),
      },
      {
        question: "Where are verifications and portfolio uploads reviewed?",
        answer: (
          <>
            In <TextLink href="/dashboard/admin/verifications">Verifications</TextLink> and{" "}
            <TextLink href="/dashboard/admin/portfolio-queue">Portfolio Queue</TextLink>.
          </>
        ),
      },
    ],
  },
]

const FAQ_BY_ROLE: Record<UserRole, readonly FaqGroup[]> = {
  user: CLIENT_FAQ,
  artisan: ARTISAN_FAQ,
  admin: ADMIN_FAQ,
}

function contactRoute(): Route {
  const email = LEGAL_ENTITY.supportEmail?.trim()
  if (email) {
    return {
      icon: Mail,
      title: "Anything else",
      body: <>Email JinVa support. Include the job or booking number if your question is about one.</>,
      links: [{ label: email, href: `mailto:${email}`, external: true }],
    }
  }
  return {
    icon: Mail,
    title: "Anything else",
    body: <>For a question that isn&rsquo;t about one job, see how to reach JinVa on the contact page.</>,
    links: [{ label: "Contact page", href: "/contact" }],
  }
}

function routesFor(role: UserRole): readonly Route[] {
  if (role === "artisan") {
    return [
      {
        icon: AlertTriangle,
        title: "A problem with a job",
        body: (
          <>
            Open the job and choose Report a problem once it&rsquo;s completed or cancelled. If a client has reported
            one, open it from your notification to respond.
          </>
        ),
        links: [{ label: "My Jobs", href: "/dashboard/artisan/jobs" }],
      },
      {
        icon: MessageSquare,
        title: "Questions for a client",
        body: <>Times, access, materials or the work itself: ask the client directly in Messages.</>,
        links: [{ label: "Messages", href: "/dashboard/artisan/messages" }],
      },
      contactRoute(),
    ]
  }
  if (role === "user") {
    return [
      {
        icon: AlertTriangle,
        title: "A problem with a job",
        body: <>Open the job or booking and choose Report a problem once it&rsquo;s completed or cancelled.</>,
        links: [
          { label: "My Jobs", href: "/dashboard/user/jobs" },
          { label: "My Bookings", href: "/dashboard/user/bookings" },
        ],
      },
      {
        icon: MessageSquare,
        title: "Questions for an artisan",
        body: <>Times, access, materials or the work itself: ask the artisan directly in Messages.</>,
        links: [{ label: "Messages", href: "/dashboard/user/messages" }],
      },
      contactRoute(),
    ]
  }
  return [contactRoute()]
}

interface PathStep {
  readonly title: string
  readonly body: string
}

/** The money path, told from each side. A real sequence, so it is an ordered list. */
const PATH_BY_ROLE: Partial<Record<UserRole, { heading: string; steps: readonly PathStep[] }>> = {
  user: {
    heading: "How paying works",
    steps: [
      { title: "You pay", body: "The price on the booking, with nothing added." },
      { title: "It's held", body: "JinVa holds it while the artisan does the work." },
      { title: "The artisan marks it done", body: "You're asked to confirm the job." },
      {
        title: "The artisan is paid",
        body: "When you confirm, or 48 hours after they marked it done if you don't respond.",
      },
    ],
  },
  artisan: {
    heading: "How you get paid",
    steps: [
      { title: "The client pays", body: "The price on the booking, with nothing added." },
      { title: "It's held", body: "JinVa holds it while you do the work." },
      { title: "You mark it done", body: "The client is asked to confirm the job." },
      {
        title: "Your payout starts",
        body: "When the client confirms, or 48 hours after you marked it done if they don't respond. JinVa's fee is deducted first.",
      },
    ],
  },
}

function MoneyPath({ heading, steps }: Readonly<{ heading: string; steps: readonly PathStep[] }>) {
  return (
    <section aria-labelledby="money-path" className="rounded-2xl bg-brand p-5 text-brand-foreground sm:p-6">
      <h2 id="money-path" className="text-[17px] font-semibold tracking-tight">
        {heading}
      </h2>
      <ol className="mt-5 space-y-5">
        {steps.map((step, i) => (
          <li key={step.title} className="relative flex gap-4">
            {i < steps.length - 1 && (
              <span aria-hidden="true" className="absolute -bottom-5 left-[5.5px] top-[17px] w-px bg-brand-foreground/35" />
            )}
            <span
              aria-hidden="true"
              className="relative z-10 mt-[5px] block h-3 w-3 shrink-0 rounded-full bg-brand-foreground ring-[5px] ring-brand"
            />
            <div className="min-w-0">
              <p className="text-sm font-semibold">{step.title}</p>
              <p className="mt-0.5 text-[13px] leading-relaxed text-brand-foreground/80">{step.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

const INTRO: Record<UserRole, string> = {
  user: "Where to go when something about a job, a booking or a payment needs sorting out.",
  artisan: "Where to go when something about a job, a client or a payout needs sorting out.",
  admin: "Where the admin queues are, and how to reach JinVa.",
}

export function SupportPage({ role }: Readonly<SupportPageProps>) {
  const routes = routesFor(role)
  const faq = FAQ_BY_ROLE[role]
  const path = PATH_BY_ROLE[role]

  return (
    <div className="mx-auto w-full max-w-5xl space-y-8">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-[1.75rem]">Support</h1>
        <p className="mt-1 max-w-[60ch] text-sm text-muted-foreground sm:text-base">{INTRO[role]}</p>
      </header>

      <section aria-labelledby="help-routes">
        <h2 id="help-routes" className="text-base font-semibold text-foreground">
          Get help
        </h2>
        <ul className="mt-3 divide-y divide-border rounded-xl border border-border bg-card">
          {routes.map((route) => {
            const Icon = route.icon
            return (
              <li
                key={route.title}
                className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 sm:px-5"
              >
                <div className="flex min-w-0 flex-1 gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted" aria-hidden="true">
                    <Icon className="h-4 w-4 text-foreground" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-sm font-semibold text-foreground">{route.title}</h3>
                    <p className="mt-0.5 text-[13px] leading-relaxed text-muted-foreground">{route.body}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 pl-12 sm:shrink-0 sm:pl-0">
                  {route.links.map((link) => {
                    const cls = cn(
                      "inline-flex h-11 min-w-0 items-center justify-center rounded-md border border-border bg-background px-4 text-sm font-medium text-foreground outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-primary sm:h-9 dark:focus-visible:ring-ring",
                      link.external && "break-all",
                    )
                    return link.external ? (
                      <a key={link.href} href={link.href} className={cls}>
                        {link.label}
                      </a>
                    ) : (
                      <Link key={link.href} href={link.href} className={cls}>
                        {link.label}
                      </Link>
                    )
                  })}
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className={cn("grid items-start gap-8", path && "lg:grid-cols-[minmax(0,1fr)_320px]")}>
        <section aria-labelledby="faq-heading" className="min-w-0">
          <h2 id="faq-heading" className="text-base font-semibold text-foreground">
            Common questions
          </h2>
          <div className="mt-3 space-y-6">
            {faq.map((group) => (
              <div key={group.topic}>
                <h3 className="text-sm font-medium text-muted-foreground">{group.topic}</h3>
                <Accordion type="multiple" className="mt-1">
                  {group.items.map((item) => (
                    <AccordionItem key={item.question} value={item.question}>
                      <AccordionTrigger className="min-h-11 text-[15px] text-foreground">
                        {item.question}
                      </AccordionTrigger>
                      <AccordionContent className="max-w-[68ch] leading-relaxed text-muted-foreground">
                        {item.answer}
                      </AccordionContent>
                    </AccordionItem>
                  ))}
                </Accordion>
              </div>
            ))}
          </div>
        </section>

        {path && (
          <div className="lg:sticky lg:top-4">
            <MoneyPath heading={path.heading} steps={path.steps} />
          </div>
        )}
      </div>
    </div>
  )
}
