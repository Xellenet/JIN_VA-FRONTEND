"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * How it works — design-spec.md §3.6. Two journeys behind a `Tabs` control so
 * the section stays compact and the visitor self-selects.
 *
 * `Tabs` is a client component, but Radix server-renders the DEFAULT panel, so
 * the client journey is readable with JS disabled. The artisan journey is not —
 * which is why it is also stated as prose in the `#for-artisans` section below.
 *
 * Every step traces to a PRD §5 module (noted per step).
 */
const CLIENT_STEPS = [
  "Search verified artisans by trade, location and rating", // §5.2
  "Check their profile, portfolio and reviews", // §5.3, §5.4, §5.8
  "Pick an available slot and send a booking request", // §5.5
  "Pay — your money stays withheld until the job is confirmed complete", // §5.7
  "Confirm completion and leave a review", // §5.6, §5.8
] as const

const ARTISAN_STEPS = [
  "Create your profile with your services and your prices", // §5.3
  "Upload photos and video of work you've already done", // §5.4
  "Set your weekly hours and block the dates you're away", // §5.5
  "Accept or decline requests within 24 hours", // §5.5
  "Get paid to your bank account or mobile wallet", // §5.7
  "Track your earnings, ratings and repeat clients", // §5.12
] as const

function StepList({ steps, wide }: { readonly steps: readonly string[]; readonly wide?: boolean }) {
  return (
    <ol
      className={`space-y-6 border-l border-border pl-10 md:grid md:gap-6 md:space-y-0 md:border-l-0 md:pl-0 md:grid-cols-3 ${
        wide ? "lg:grid-cols-6" : "lg:grid-cols-5"
      }`}
    >
      {steps.map((step, index) => (
        <li key={step} className="relative">
          {/* A real digit, not a CSS counter, so screen readers read the order */}
          <span className="absolute -left-14 top-0 flex size-8 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground md:static md:mb-3">
            {index + 1}
          </span>
          <p className="text-sm leading-relaxed text-foreground">{step}</p>
        </li>
      ))}
    </ol>
  )
}

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-y border-border bg-muted/40">
      <div className="mx-auto w-full max-w-[96rem] px-4 py-16 sm:px-6 md:py-24 lg:px-8">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">How JinVa works.</h2>

        <Tabs defaultValue="clients" className="mt-10 gap-8">
          <TabsList className="mx-auto">
            <TabsTrigger value="clients">For clients</TabsTrigger>
            <TabsTrigger value="artisans">For artisans</TabsTrigger>
          </TabsList>

          <TabsContent value="clients">
            <StepList steps={CLIENT_STEPS} />
          </TabsContent>
          <TabsContent value="artisans">
            <StepList steps={ARTISAN_STEPS} wide />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}
