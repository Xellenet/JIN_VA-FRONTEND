/**
 * The landing page's copy and sample content, in one place.
 *
 * Everything shown as activity, a job, a portfolio or earnings is SAMPLE and
 * is labelled as such where it renders. Copy rules (owner-approved):
 *   • no cash payments; MoMo or card through Paystack;
 *   • no 24-hour or reminder timing promises; the one timing is the 48-hour
 *     release after the artisan marks a job done;
 *   • never "escrow": Paystack holds your payment until you confirm.
 */

export const PHOTOS = {
  blue: "/artisan-in-blue-uniform.jpg",
  hardhat: "/artisan-in-hard-hat.jpg",
  carpenter: "/artisan-in-orange-vest.jpg",
  painter: "/artisan-in-red-vest.jpg",
  bath: "/portfolio/job-bathroom-reno.jpg",
  drain: "/portfolio/job-drain-clean.jpg",
  sink: "/portfolio/job-kitchen-sink.jpg",
  pipe: "/portfolio/job-pipe-install.jpg",
  heater: "/portfolio/job-water-heater.jpg",
  before: "/landing/leak-before.jpg",
  after: "/landing/leak-after.jpg",
} as const

/** Intrinsic sizes, so next/image reserves the right box. */
export const PHOTO_SIZE: Record<string, { width: number; height: number }> = {
  portrait: { width: 1200, height: 1800 },
  square: { width: 1024, height: 1024 },
  leak: { width: 500, height: 910 },
}

export function sizeOf(src: string) {
  if (src.startsWith("/portfolio/")) return PHOTO_SIZE.square
  if (src.startsWith("/landing/")) return PHOTO_SIZE.leak
  return PHOTO_SIZE.portrait
}

/** Three drifting hero columns; each is rendered twice for a seamless loop. */
export const HERO_COLUMNS: readonly { photos: readonly string[]; direction: "up" | "down"; aspect: string; offset: string }[] = [
  { photos: [PHOTOS.hardhat, PHOTOS.sink, PHOTOS.carpenter], direction: "up", aspect: "aspect-[3/4.2]", offset: "mt-0" },
  { photos: [PHOTOS.pipe, PHOTOS.painter, PHOTOS.bath], direction: "down", aspect: "aspect-[1/1.15]", offset: "mt-15" },
  { photos: [PHOTOS.blue, PHOTOS.heater, PHOTOS.drain], direction: "up", aspect: "aspect-[3/4]", offset: "mt-5" },
]

export type ActivityIcon = "calendar" | "shield" | "wallet" | "star"

export const SAMPLE_ACTIVITY: readonly { title: string; text: string; icon: ActivityIcon }[] = [
  { title: "Booking confirmed", text: "Ama booked a plumber in Osu for Thursday", icon: "calendar" },
  { title: "Artisan verified", text: "Yaw, an electrician in Tema, got the badge", icon: "shield" },
  { title: "Job confirmed and paid", text: "GH₵ 350.00 sent to Kwame’s MoMo", icon: "wallet" },
  { title: "New 5-star review", text: "“Fixed the leak in an hour, very tidy.”", icon: "star" },
]

export const TRADES: readonly { name: string; detail: string; photo: string }[] = [
  { name: "Plumbing", detail: "Leaks, pipes, water heaters", photo: PHOTOS.pipe },
  { name: "Electrical", detail: "Wiring, rewires, faults", photo: PHOTOS.blue },
  { name: "Carpentry", detail: "Fittings, repairs, joinery", photo: PHOTOS.carpenter },
  { name: "Painting", detail: "Interiors, exteriors", photo: PHOTOS.painter },
  { name: "Tiling", detail: "Floors, walls, bathrooms", photo: PHOTOS.bath },
  { name: "Cleaning", detail: "Homes and offices", photo: PHOTOS.drain },
  { name: "Landscaping", detail: "Gardens and grounds", photo: PHOTOS.hardhat },
  { name: "Hair braiding", detail: "At home or in salon", photo: PHOTOS.heater },
]

export const PORTFOLIO: readonly { photo: string; alt: string; label: string }[] = [
  { photo: PHOTOS.bath, alt: "A renovated white bathroom", label: "Bathroom refit" },
  { photo: PHOTOS.pipe, alt: "New copper pipework on a wall", label: "Copper pipework" },
  { photo: PHOTOS.heater, alt: "A newly installed water heater", label: "Water heater" },
  { photo: PHOTOS.drain, alt: "A drain being cleared with a cable machine", label: "Drain clearing" },
]

export const JOB_FLOW: readonly { n: number; step: string; you: string; artisan: string }[] = [
  { n: 1, step: "Find", you: "Compare profiles, past work and typical prices.", artisan: "Keeps services, prices and hours up to date." },
  { n: 2, step: "Book", you: "Pick a free time slot and send a request.", artisan: "Accepts or declines the request." },
  { n: 3, step: "Pay", you: "Pay by MoMo or card. Paystack holds the money.", artisan: "Sees the job is paid before starting." },
  { n: 4, step: "Work", you: "Message about the job if anything changes.", artisan: "Does the work and marks it done." },
  { n: 5, step: "Confirm", you: "Confirm it’s done and leave a review.", artisan: "Gets paid to MoMo or bank, name checked." },
]

export const JOB_STAGES: readonly { label: string; title: string; text: string; row: number }[] = [
  {
    label: "Booked",
    title: "Booked for Thu 5 Nov, 09:00–11:00",
    text: "You paid GH₵ 350.00 by MoMo. Paystack holds it until you confirm the job is done.",
    row: 2,
  },
  { label: "In progress", title: "Kwame has started", text: "Message him on the job if anything changes.", row: 3 },
  {
    label: "Done",
    title: "Kwame marked the job done",
    text: "Check the sink, then confirm. If something is wrong, report a problem instead.",
    row: 3,
  },
  {
    label: "Paid out",
    title: "You confirmed. Kwame has been paid",
    text: "GH₵ 350.00, less JinVa’s fee, went to his MoMo. You can now leave a review.",
    row: 4,
  },
]

export type ProtectionIcon = "shield" | "wallet" | "star" | "message"

export const PROTECTIONS: readonly { title: string; text: string; icon: ProtectionIcon; position: string; delay: string }[] = [
  {
    title: "Verified artisans",
    text: "Our team checks a Ghana Card and a selfie before the badge appears.",
    icon: "shield",
    position: "min-[900px]:left-8 min-[900px]:top-8",
    delay: "0s",
  },
  {
    title: "Payment released after you confirm",
    text: "Paystack holds your payment until you confirm the work is done.",
    icon: "wallet",
    position: "min-[900px]:left-8 min-[900px]:bottom-8",
    delay: "1.5s",
  },
  {
    title: "Reviews only from real jobs",
    text: "Only a client who completed a job can review it.",
    icon: "star",
    position: "min-[900px]:right-8 min-[900px]:top-30",
    delay: "0.8s",
  },
  {
    title: "Problems reviewed by a person",
    text: "Report a problem and our team looks at the job, messages and photos.",
    icon: "message",
    position: "min-[900px]:right-8 min-[900px]:bottom-18",
    delay: "2.2s",
  },
]

export const FAQS: readonly { q: string; a: string }[] = [
  {
    q: "Is JinVa free for clients?",
    a: "Yes. Clients pay the artisan’s price and nothing more. Artisans pay a small percentage of each completed job, shown in their earnings breakdown.",
  },
  {
    q: "How do I know an artisan is legitimate?",
    a: "Artisans with the verified badge have had their Ghana Card and a selfie checked by our team. Reviews only come from clients who completed a job with them.",
  },
  {
    q: "When does the artisan get paid?",
    a: "After you confirm the job is done. If you don’t respond within 48 hours of the artisan marking it done, the payment is released to them.",
  },
  {
    q: "What if the work isn’t done properly?",
    a: "Report a problem before you confirm. Our team reviews the job, the messages and the photos, and decides what happens to the payment.",
  },
  {
    q: "How do I pay?",
    a: "By mobile money (MTN, Telecel or AirtelTigo) or card, through Paystack. You can save your number to pay in one tap next time. We never ask for your PIN.",
  },
  {
    q: "I’m an artisan. How do I get listed?",
    a: "Create an artisan account, add your services, rate and area, and you appear in search. Adding hours, a payout method and verification completes your profile.",
  },
]
