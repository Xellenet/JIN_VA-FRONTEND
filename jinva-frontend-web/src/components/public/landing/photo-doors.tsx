import Image from "next/image"
import Link from "next/link"
import { signupHref, type SignupAudience } from "@/lib/landing-search"
import { PHOTOS } from "./landing-content"
import { SectionHeading } from "./section-heading"

const DOORS: readonly { audience: SignupAudience; title: string; text: string; cta: string; photo: string; position: string }[] = [
  {
    audience: "client",
    title: "I need work done",
    text: "Post a job or book an artisan. Free for clients.",
    cta: "Create a client account",
    photo: PHOTOS.bath,
    position: "object-center",
  },
  {
    audience: "artisan",
    title: "I offer a service",
    text: "Get booked and get paid to MoMo or bank.",
    cta: "Create an artisan account",
    photo: PHOTOS.hardhat,
    position: "object-[50%_40%]",
  },
]

/**
 * Two photo doors into signup. Each link carries only `?role=` with one of the
 * two whitelisted values (`signupHref`). The brand scrim under the text is the
 * same in both themes, so the white type always sits on deep green.
 */
export function PhotoDoors() {
  return (
    <section aria-labelledby="cta-h" className="bg-primary/5">
      <div className="mx-auto w-full max-w-310 px-4 py-18 sm:px-6 md:py-24 lg:px-8">
        <SectionHeading id="cta-h" className="mb-8">
          How will you use JinVa?
        </SectionHeading>
        <div className="grid gap-5 md:grid-cols-2">
          {DOORS.map((door) => (
            <Link
              key={door.audience}
              href={signupHref(door.audience)}
              className="lp-zoom relative block min-h-90 overflow-hidden rounded-3xl text-brand-foreground outline-none focus-visible:ring-[3px] focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Image src={door.photo} alt="" fill sizes="(min-width: 768px) 50vw, 100vw" className={`object-cover ${door.position}`} />
              <span aria-hidden="true" className="absolute inset-0 bg-linear-to-b from-brand/0 from-30% to-brand/95" />
              <span className="absolute inset-x-6.5 bottom-6.5">
                <span className="block font-display text-[1.875rem] leading-tight font-extrabold tracking-[-0.02em]">
                  {door.title}
                </span>
                <span className="mt-1 block text-brand-foreground/90">{door.text}</span>
                <span className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-brand-foreground px-4 font-semibold text-brand">
                  {door.cta}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
