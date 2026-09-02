"use client"

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"

/**
 * PUB5 — the FAQ, answered as an on-page `#faq` accordion on `/` rather than a
 * separate `/faq` route (requirements.md's own recommendation).
 *
 * NONE of the in-dashboard `support-page.tsx` FAQ copy is reused, and the word
 * "Plumbify" appears nowhere. That file also contains claims this page must not
 * repeat: a "10% platform fee", a "3–5 business day" refund window,
 * "insurance confirmation and background checks", and plumbing-only service
 * lists. All eight answers below are written fresh against the PRD.
 *
 * The fee answer is the one to get right: it answers honestly, shows no number,
 * and so satisfies both the visitor and the "no pricing tables"
 * anti-requirement. Do not let it be softened into "JinVa is free to use."
 */
const FAQS = [
  {
    question: "What is JinVa?",
    answer:
      "A marketplace that connects clients with skilled, verified artisans across all trade categories, and handles the discovery, booking, payment and reviews in one place.", // §1
  },
  {
    question: "Which trades are on JinVa?",
    answer:
      "Electrical, plumbing, carpentry, painting, cleaning, landscaping, beauty — and other trades besides. You choose your service category when you list.", // §1
  },
  {
    question: "How do I know an artisan is legitimate?",
    answer:
      "Artisans are manually verified by a JinVa admin before they get a verified badge, and their portfolio uploads are reviewed before they appear publicly. Reviews on a profile can only come from clients who had a completed job with that artisan.", // §5.3, §5.4, §5.8, §5.13
  },
  {
    question: "When does the artisan actually get paid?",
    answer:
      "Payment is taken at booking confirmation and held. It is released to the artisan once the job is confirmed complete — by you, or automatically 48 hours after the artisan marks it done.", // §5.6, §5.7
  },
  {
    question: "What if the work isn't done properly?",
    answer:
      "Either side can raise a dispute from the job page. An admin reviews the claim, the response and the job record, and can rule for the client (which triggers a refund), rule for the artisan (which releases the payment), or record it as mutually resolved. Both sides are notified of the outcome.", // §5.13
  },
  {
    question: "Does JinVa charge a fee?",
    answer:
      "Yes. JinVa takes a percentage of each completed job, deducted from the artisan's payout — clients pay the price shown on the booking and nothing on top. The percentage is set by JinVa and appears in the artisan's earnings breakdown; we don't publish a figure here because it isn't a fixed public rate.", // §5.7
  },
  {
    question: "How do reviews work?",
    answer:
      "Only a client with a completed job can review, one review per job, and every review carries a Verified Booking badge. The artisan can reply once, publicly. You can edit your own review within 48 hours.", // §5.8
  },
  {
    question: "I'm an artisan — how do I get listed?",
    answer:
      "Create an artisan account, add your services and prices, upload some past work, and set your weekly hours. Your profile has to be complete before you appear in client search results.", // §5.1, §5.3, §5.5
  },
] as const

export function FaqSection() {
  return (
    <section id="faq" className="scroll-mt-20 border-y border-border bg-muted/40">
      <div className="mx-auto w-full max-w-3xl px-4 py-16 sm:px-6 md:py-24">
        <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Questions people ask.</h2>

        <Accordion type="single" collapsible className="mt-8">
          {FAQS.map((faq) => (
            <AccordionItem value={faq.question} key={faq.question}>
              <AccordionTrigger className="text-base font-medium">{faq.question}</AccordionTrigger>
              <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                {faq.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
    </section>
  )
}
