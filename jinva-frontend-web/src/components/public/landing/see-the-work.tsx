import Image from "next/image"
import { BeforeAfter } from "./before-after"
import { PORTFOLIO, PHOTO_SIZE } from "./landing-content"
import { SectionHeading, SectionLead } from "./section-heading"

/** "See the work before you book": a 4-photo sample portfolio and the before/after slider. */
export function SeeTheWork() {
  return (
    <section id="work" aria-labelledby="work-h" className="scroll-mt-16 bg-background">
      <div className="mx-auto grid w-full max-w-310 items-center gap-14 px-4 py-18 sm:px-6 md:py-24 lg:grid-cols-2 lg:px-8">
        <div className="min-w-0">
          <SectionHeading id="work-h">See the work before you book.</SectionHeading>
          <SectionLead className="mb-7 max-w-[30em]">
            Every artisan shows photos of jobs they have finished. Drag the slider to compare a leaking joint with the
            repair.
          </SectionLead>
          <ul aria-label="Sample portfolio photos" className="m-0 grid list-none grid-cols-2 gap-3 p-0">
            {PORTFOLIO.map((item) => (
              <li key={item.label} className="min-w-0">
                <figure className="lp-zoom relative m-0 overflow-hidden rounded-2xl">
                  <Image
                    src={item.photo}
                    alt={item.alt}
                    width={PHOTO_SIZE.square.width}
                    height={PHOTO_SIZE.square.height}
                    sizes="(min-width: 1024px) 290px, 50vw"
                    className="block aspect-[4/3] w-full object-cover"
                  />
                  <figcaption className="absolute bottom-2.5 left-2.5 max-w-[calc(100%-1.25rem)] truncate rounded-full bg-card/95 px-2.5 py-1 text-[0.8125rem] font-medium text-card-foreground">
                    {item.label}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-[0.8125rem] text-muted-foreground">Sample portfolio photos.</p>
        </div>
        <BeforeAfter />
      </div>
    </section>
  )
}
