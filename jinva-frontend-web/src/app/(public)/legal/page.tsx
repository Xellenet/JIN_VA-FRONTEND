import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument, LegalFact, LegalHeading } from "@/components/public/legal-document"
import { LEGAL_ENTITY } from "@/lib/legal-entity"

export const metadata: Metadata = {
  title: "Legal information",
  description:
    "Who runs JinVa, how prices, payment, cancellations and disputes work, and your rights as a consumer under Ghanaian law.",
}

const SECTIONS = [
  { id: "company", heading: "Who runs JinVa" },
  { id: "registrations", heading: "Registrations and codes of conduct" },
  { id: "service", heading: "What JinVa offers" },
  { id: "prices", heading: "Prices, fees and how you pay" },
  { id: "timing", heading: "When work is carried out" },
  { id: "records", heading: "Your records" },
  { id: "refunds", heading: "Cancellations and refunds" },
  { id: "disputes", heading: "Disputes and complaints" },
  { id: "security", heading: "Security and privacy" },
  { id: "your-rights", heading: "Your rights as a consumer" },
]

/**
 * The supplier information Ghana's Electronic Transactions Act, 2008 (Act 772)
 * s.47(1) requires on the platform, in the order the Act lists it, with the
 * company facts drawn from LEGAL_ENTITY.
 */
export default function LegalInformationPage() {
  const e = LEGAL_ENTITY

  return (
    <LegalDocument
      title="Legal information"
      current="/legal"
      sections={SECTIONS}
      standfirst="The details Ghana’s Electronic Transactions Act, 2008 asks every online business to make available, in one place."
    >
      <LegalHeading id="company">1. Who runs JinVa</LegalHeading>
      <ul>
        <li>
          <strong>Company:</strong> <LegalFact value={e.legalName} missing="registered company name" />,{" "}
          <LegalFact value={e.legalStatus} missing="legal status, e.g. private company limited by shares" />
        </li>
        <li>
          <strong>Registration number:</strong>{" "}
          <LegalFact value={e.registrationNumber} missing="company registration number" />, registered in{" "}
          <LegalFact value={e.placeOfRegistration} missing="place of registration" />
        </li>
        <li>
          <strong>Directors:</strong>{" "}
          <LegalFact value={e.officeBearers?.join(", ")} missing="names of directors / office bearers" />
        </li>
        <li>
          <strong>Address:</strong> <LegalFact value={e.physicalAddress} missing="physical address" />
          {e.digitalAddress ? ` (GhanaPost GPS ${e.digitalAddress})` : null}
        </li>
        <li>
          <strong>Telephone:</strong> <LegalFact value={e.telephone} missing="telephone number" />
        </li>
        <li>
          <strong>Email:</strong> <LegalFact value={e.supportEmail} missing="support email" />
        </li>
        <li>
          <strong>Website:</strong> <LegalFact value={e.website} missing="website address" />
        </li>
      </ul>

      <LegalHeading id="registrations">2. Registrations and codes of conduct</LegalHeading>
      <ul>
        <li>
          <strong>Data Protection Commission registration:</strong>{" "}
          <LegalFact value={e.dpcRegistrationNumber} missing="DPC registration number" />
        </li>
        <li>
          <strong>Self-regulatory bodies and codes of conduct:</strong>{" "}
          <LegalFact
            value={e.selfRegulatoryMembership}
            missing="membership and code of conduct, or a statement that JinVa has none"
          />
        </li>
      </ul>

      <LegalHeading id="service">3. What JinVa offers</LegalHeading>
      <p>
        JinVa is an online marketplace for artisan services in Ghana, such as electrical, plumbing, carpentry,
        painting, cleaning, landscaping and beauty work. Clients use it to find artisans, book or hire them,
        pay, follow the job and leave a review. Artisans are independent businesses: each artisan’s profile
        describes their services, prices, working hours, past work and reviews, so you can decide before you
        book. A verified badge means JinVa has checked the artisan’s identity documents.
      </p>

      <LegalHeading id="prices">4. Prices, fees and how you pay</LegalHeading>
      <ul>
        <li>
          The price on a booking, in Ghana cedis (GH₵), is the full price you pay. JinVa adds no fee or charge
          for clients.
        </li>
        <li>
          JinVa’s fee is a percentage of each completed job. It is paid by the artisan and deducted from their
          payout.
        </li>
        <li>
          You pay by card or mobile money through Paystack, our payment provider. Your payment is held until
          the job is finished, then released to the artisan.
        </li>
      </ul>

      <LegalHeading id="timing">5. When work is carried out</LegalHeading>
      <p>
        The date and time of each job are agreed in the booking or job posting before you pay. An artisan has
        24 hours to accept or decline a booking request; if they don’t answer, it expires and you aren’t
        charged.
      </p>

      <LegalHeading id="records">6. Your records</LegalHeading>
      <p>
        Every job has a timeline of its status changes, which both sides can see in their dashboard for as long
        as their account is open. A receipt is emailed to you for each payment. You can save or print these
        terms and our other legal pages at any time. If you need a copy of a record, contact us.
      </p>

      <LegalHeading id="refunds">7. Cancellations and refunds</LegalHeading>
      <ul>
        <li>You can cancel a job at any time before the work starts, for a full refund.</li>
        <li>If an artisan declines or can’t do the job, you get a full refund within seven days.</li>
        <li>
          Refunds go back to the card or mobile money account you paid with. The full rules are in section 8
          of our <Link href="/terms#cancellations">Terms of Service</Link>.
        </li>
      </ul>

      <LegalHeading id="disputes">8. Disputes and complaints</LegalHeading>
      <p>
        If a booked job goes wrong, either side can raise a dispute, which a JinVa administrator reviews and
        decides as set out in our <Link href="/terms#disputes">Terms of Service</Link>. For complaints about
        JinVa itself, contact us first. If we can’t resolve it, either side may propose mediation under the
        Alternative Dispute Resolution Act, 2010 (Act 798), and you can always go to the courts of Ghana.
      </p>

      <LegalHeading id="security">9. Security and privacy</LegalHeading>
      <p>
        Payments are processed by Paystack; JinVa never stores your full card details. Connections to JinVa are
        encrypted, and identity documents are kept in private storage. How we collect, use, share and protect
        personal information, and your rights over it, are explained in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <LegalHeading id="your-rights">10. Your rights as a consumer</LegalHeading>
      <p>Under the Electronic Transactions Act, 2008 (Act 772), you have the right:</p>
      <ul>
        <li>
          to read, save and print these terms, to spot and correct any mistake in a booking, and to withdraw
          before you pay;
        </li>
        <li>
          to cancel an agreement for services within seven days of making it, without giving a reason and
          without penalty, unless the work has already started with your agreement;
        </li>
        <li>
          to be told straight away if a service you paid for isn’t available, and to get your money back
          within seven days;
        </li>
        <li>
          to cancel within fourteen days if we haven’t given you the information on this page, with a refund
          within thirty days;
        </li>
        <li>not to receive marketing messages unless you have agreed to them, and to unsubscribe at any time.</li>
      </ul>
      <p>No agreement with JinVa can take these rights away. Any term that tries to is void under the Act.</p>
    </LegalDocument>
  )
}
