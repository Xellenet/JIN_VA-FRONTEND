"use client"

import { useState } from "react"
import Link from "next/link"
import { Minus, Plus } from "lucide-react"
import { FAQS } from "./landing-content"
import { SectionHeading } from "./section-heading"

/**
 * Questions: disclosure buttons (`aria-expanded` + `aria-controls`) inside
 * h3s, one answer open at a time, the first open to begin with. Closed
 * answers use the `hidden` attribute, so they are out of the tab order and
 * the accessibility tree.
 */
export function Questions() {
  const [open, setOpen] = useState(0)

  return (
    <section id="questions" aria-labelledby="faq-h" className="scroll-mt-16 bg-background">
      <div className="mx-auto flex w-full max-w-310 flex-wrap items-start gap-x-16 gap-y-10 px-4 py-18 sm:px-6 md:py-24 lg:px-8">
        <div className="min-w-0 flex-[1_1_17.5rem]">
          <SectionHeading id="faq-h">Questions people ask.</SectionHeading>
          <p className="text-muted-foreground">
            Something else?{" "}
            <Link
              href="/contact"
              className="inline-flex min-h-11 items-center rounded-sm font-semibold text-primary underline underline-offset-4 outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60 sm:min-h-0"
            >
              Contact us
            </Link>
          </p>
        </div>
        <div className="min-w-0 flex-[2_1_32.5rem] border-t border-border">
          {FAQS.map((item, i) => {
            const expanded = open === i
            const buttonId = `faq-q-${i}`
            const panelId = `faq-a-${i}`
            const Icon = expanded ? Minus : Plus
            return (
              <div key={item.q} className="border-b border-border">
                <h3 className="m-0 text-[1.0625rem]">
                  <button
                    id={buttonId}
                    type="button"
                    aria-expanded={expanded}
                    aria-controls={panelId}
                    onClick={() => setOpen(expanded ? -1 : i)}
                    className="flex min-h-14 w-full cursor-pointer items-center justify-between gap-4 rounded-md py-5 text-left font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/60"
                  >
                    <span>{item.q}</span>
                    <span
                      aria-hidden="true"
                      className="grid size-8 flex-none place-items-center rounded-full bg-primary/10 text-primary"
                    >
                      <Icon className="size-4" strokeWidth={2.4} />
                    </span>
                  </button>
                </h3>
                <div id={panelId} role="region" aria-labelledby={buttonId} hidden={!expanded}>
                  <p data-swap className="-mt-1.5 mb-5.5 max-w-[44em] text-muted-foreground">
                    {item.a}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
