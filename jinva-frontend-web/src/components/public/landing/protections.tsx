import type React from "react"
import Image from "next/image"
import { MessageSquareText, ShieldCheck, Star, Wallet } from "lucide-react"
import { cn } from "@/lib/utils"
import { LoopGate } from "./loop-gate"
import { PHOTOS, PROTECTIONS, type ProtectionIcon } from "./landing-content"
import { SectionHeading, SectionLead } from "./section-heading"

const ICONS: Record<ProtectionIcon, typeof ShieldCheck> = {
  shield: ShieldCheck,
  wallet: Wallet,
  star: Star,
  message: MessageSquareText,
}

/**
 * "Someone is actually checking": four protection cards. From 900px they float
 * over a full-width photo (a brand-tinted scrim keeps the photo calm under them
 * in both themes); below that the photo comes first and the cards stack under it.
 */
export function Protections() {
  return (
    <section id="safety" aria-labelledby="safe-h" className="scroll-mt-16 bg-background">
      <div className="mx-auto w-full max-w-310 px-4 py-18 sm:px-6 md:py-24 lg:px-8">
        <SectionHeading id="safe-h" className="max-w-[14em]">
          Someone is actually checking.
        </SectionHeading>
        <SectionLead className="mb-10 max-w-[36em]">
          Four rules protect both sides of every job, and our team steps in when something goes wrong.
        </SectionLead>

        <LoopGate className="relative overflow-hidden rounded-[1.75rem] bg-brand min-[900px]:min-h-140">
          <div className="relative h-60 min-[900px]:absolute min-[900px]:inset-0 min-[900px]:h-auto">
            <Image
              src={PHOTOS.painter}
              alt="An artisan in red overalls cleaning a kitchen wall"
              fill
              sizes="(min-width: 1240px) 1192px, 100vw"
              className="object-cover object-[50%_30%]"
            />
            <span
              aria-hidden="true"
              className="absolute inset-0 bg-linear-to-r from-brand/85 via-brand/35 to-brand/10"
            />
          </div>
          <ul className="relative m-0 flex list-none flex-col gap-3 p-4 min-[900px]:absolute min-[900px]:inset-0 min-[900px]:block min-[900px]:p-8">
            {PROTECTIONS.map((p) => {
              const Icon = ICONS[p.icon]
              return (
                <li
                  key={p.title}
                  style={{ "--lp-delay": p.delay } as React.CSSProperties}
                  className={cn(
                    "lp-float lp-float-desktop flex gap-3.5 rounded-2xl bg-card px-4.5 py-4 text-card-foreground shadow-xl shadow-black/30 min-[900px]:absolute min-[900px]:max-w-82.5",
                    p.position,
                  )}
                >
                  <span
                    aria-hidden="true"
                    className="grid size-10 flex-none place-items-center rounded-xl bg-primary/10 text-primary"
                  >
                    <Icon className="size-5" strokeWidth={2} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold">{p.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{p.text}</span>
                  </span>
                </li>
              )
            })}
          </ul>
        </LoopGate>
      </div>
    </section>
  )
}
