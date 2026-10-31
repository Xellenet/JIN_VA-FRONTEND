import type { Metadata } from "next"
import Link from "next/link"
import { LegalDocument, LegalFact, LegalHeading } from "@/components/public/legal-document"
import { LEGAL_ENTITY } from "@/lib/legal-entity"

export const metadata: Metadata = {
  title: "Terms of Service",
  description:
    "The agreement between you and JinVa: accounts, bookings, payment held until the job is done, cancellations, refunds, disputes and reviews.",
}

const SECTIONS = [
  { id: "about", heading: "About these terms" },
  { id: "what-jinva-is", heading: "What JinVa is, and what it isn’t" },
  { id: "account", heading: "Your account" },
  { id: "artisans", heading: "Using JinVa as an artisan" },
  { id: "hiring", heading: "Booking and hiring an artisan" },
  { id: "payment", heading: "Prices, payment and fees" },
  { id: "completion", heading: "Finishing a job and releasing payment" },
  { id: "cancellations", heading: "Cancellations and refunds" },
  { id: "disputes", heading: "Disputes between clients and artisans" },
  { id: "reviews", heading: "Reviews" },
  { id: "messages", heading: "Messages and staying on JinVa" },
  { id: "acceptable-use", heading: "What you must not do" },
  { id: "content", heading: "Your photos, reviews and other content" },
  { id: "suspension", heading: "Suspending and closing accounts" },
  { id: "responsibility", heading: "Our responsibility to you" },
  { id: "changes", heading: "Changes to JinVa and to these terms" },
  { id: "law", heading: "Complaints, governing law and courts" },
  { id: "contact", heading: "Contact us" },
]

export default function TermsPage() {
  const company = <LegalFact value={LEGAL_ENTITY.legalName} missing="registered company name" />

  return (
    <LegalDocument
      title="Terms of Service"
      current="/terms"
      sections={SECTIONS}
      standfirst="The agreement between you and JinVa when you use the platform to find, book, pay for or carry out work."
    >
      <LegalHeading id="about">1. About these terms</LegalHeading>
      <p>
        JinVa is run by {company} (“JinVa”, “we”, “us”). These terms are the agreement between you and us
        when you use the JinVa website and app. By creating an account or booking through JinVa, you agree to
        them. Please read them with our <Link href="/privacy">Privacy Policy</Link>, which explains how we
        handle your personal information, and our <Link href="/legal">Legal information</Link> page, which
        lists our company details and your rights as a consumer.
      </p>
      <p>
        You can save or print this page at any time to keep a copy. Nothing in these terms takes away the
        rights you have under the laws of Ghana, including the Electronic Transactions Act, 2008 (Act 772).
        If any part of these terms conflicts with those rights, the law applies instead.
      </p>

      <LegalHeading id="what-jinva-is">2. What JinVa is, and what it isn’t</LegalHeading>
      <p>
        JinVa is a marketplace. It connects people who need work done (“clients”) with skilled tradespeople
        (“artisans”) such as electricians, plumbers, carpenters, painters and cleaners. Through JinVa you can
        find an artisan, agree a job, pay, follow the job’s progress, message each other and leave a review.
      </p>
      <ul>
        <li>
          <strong>The work itself is agreed between the client and the artisan.</strong> Artisans are
          independent and run their own businesses. They are not JinVa’s employees or agents, and JinVa does
          not carry out the work.
        </li>
        <li>
          <strong>JinVa’s part</strong> is to run the platform, check artisans’ identity before they get a
          verified badge, hold the client’s payment until the job is finished, and review disputes as
          described in section 9.
        </li>
        <li>
          <strong>A verified badge means</strong> a JinVa administrator has checked the artisan’s identity
          documents. It is not a guarantee of the quality of their work, their qualifications or their
          licences. Their reviews, portfolio and job history help you judge that.
        </li>
      </ul>

      <LegalHeading id="account">3. Your account</LegalHeading>
      <ul>
        <li>You must be at least 18 years old to create an account or use JinVa.</li>
        <li>
          Give accurate, complete information and keep it up to date. Use your own name and contact details,
          and keep one account per person.
        </li>
        <li>
          Keep your password private. If you sign in with Google, keep that account secure too. Tell us
          straight away if you think someone else has used your account.
        </li>
        <li>You are responsible for what happens in your account unless it was used without your permission.</li>
      </ul>

      <LegalHeading id="artisans">4. Using JinVa as an artisan</LegalHeading>
      <p>If you offer your services on JinVa, you also agree that:</p>
      <ul>
        <li>
          Your profile must be complete before clients can find you. To receive a verified badge, you will be
          asked for a valid identity document such as a Ghana Card, photos of it and a selfie, which a JinVa
          administrator reviews. We may refuse or remove a badge if the documents can’t be verified.
        </li>
        <li>
          You set your own services, prices and working hours, and they must be accurate. You have 24 hours to
          accept or decline a booking request before it expires.
        </li>
        <li>
          You will do the work you accept with reasonable care and skill, at the agreed time, and to the
          standard you describe on your profile.
        </li>
        <li>
          You hold any licence, permit or qualification your trade requires, and you are responsible for your
          own taxes, social security contributions and business registration.
        </li>
        <li>
          Photos and videos you add to your portfolio must show your own work. They are reviewed before they
          appear publicly.
        </li>
      </ul>

      <LegalHeading id="hiring">5. Booking and hiring an artisan</LegalHeading>
      <p>There are two ways to hire through JinVa:</p>
      <ul>
        <li>
          <strong>Booking:</strong> you request an available slot from an artisan’s calendar. The artisan
          confirms the booking and its price, or declines it. A request that isn’t answered within 24 hours
          expires.
        </li>
        <li>
          <strong>Posting a job:</strong> you describe the work, artisans apply with a quote, and you choose
          one. Postings that nobody is chosen for expire after their deadline.
        </li>
      </ul>
      <p>
        Before you pay, you will see what the job is, who will do it, when, and the full price. Check these
        details and correct any mistake before you pay; you can still withdraw at that point. The agreement
        for the job is concluded when you pay.
      </p>

      <LegalHeading id="payment">6. Prices, payment and fees</LegalHeading>
      <ul>
        <li>
          <strong>Clients pay the price shown on the booking</strong> in Ghana cedis (GH₵), with nothing added
          by JinVa on top.
        </li>
        <li>
          You pay by card or mobile money through our payment provider, Paystack. JinVa never sees or stores
          your full card details.
        </li>
        <li>
          <strong>Your payment is held</strong> and is not passed to the artisan until the job is finished, as
          described in section 7.
        </li>
        <li>
          <strong>JinVa’s fee is paid by the artisan.</strong> It is a percentage of each completed job,
          deducted from the artisan’s payout and shown in the artisan’s earnings breakdown before they accept
          work.
        </li>
        <li>
          Artisans are paid to the mobile money or bank account they add in their settings. If a transfer
          fails, it shows as delayed in the artisan’s earnings and can be retried once the details are
          corrected.
        </li>
        <li>
          Pay only through JinVa. Payments made outside JinVa are not held, can’t be refunded by us and aren’t
          covered by our dispute process.
        </li>
      </ul>

      <LegalHeading id="completion">7. Finishing a job and releasing payment</LegalHeading>
      <p>
        When the artisan marks the job as done, the client is asked to confirm it. The payment is released to
        the artisan when the client confirms, or automatically 48 hours after the artisan marked it done if
        the client doesn’t respond. If the work isn’t finished or isn’t right, don’t confirm it: message the
        artisan, and contact us before the 48 hours are up so we can look into it. Once a job is completed,
        either side can still raise a dispute (see section 9). Both sides can follow every step on the job’s
        timeline.
      </p>

      <LegalHeading id="cancellations">8. Cancellations and refunds</LegalHeading>
      <ul>
        <li>
          <strong>Before the work starts,</strong> a client can cancel a job at any time and receive a full
          refund. This is more generous than the seven-day cancellation period that Ghanaian law gives you for
          services, and it does not reduce that right.
        </li>
        <li>
          <strong>If the artisan declines, doesn’t respond, or can’t do the job,</strong> we will tell you
          straight away and refund your payment in full within seven days.
        </li>
        <li>
          <strong>Once the work has started</strong> with your agreement, the job can’t be cancelled on its
          own. If something goes wrong, raise a dispute.
        </li>
        <li>
          Refunds go back to the card or mobile money account you paid with. After we send a refund, the time
          it takes to reach you depends on your bank or mobile money provider.
        </li>
        <li>
          Artisans should cancel only for good reason, and as early as possible. Repeated late cancellations
          can lead to an account being suspended.
        </li>
      </ul>

      <LegalHeading id="disputes">9. Disputes between clients and artisans</LegalHeading>
      <p>
        If a booked job goes wrong, either side can raise a dispute once the booking is completed or
        cancelled, from the booking page, and explain what happened. The other side is told and can respond. A JinVa administrator reviews the dispute, the
        response and the job’s record, including its timeline, messages and photos, and then:
      </p>
      <ul>
        <li>rules for the client, which refunds all or part of the payment;</li>
        <li>rules for the artisan, which releases the payment; or</li>
        <li>records that the two sides have settled it between them.</li>
      </ul>
      <p>
        Both sides are told the outcome. Our decision settles how the payment held on JinVa is
        handled. It does not stop either side from using the other options described in section 17, or from
        going to court.
      </p>

      <LegalHeading id="reviews">10. Reviews</LegalHeading>
      <ul>
        <li>
          Only a client who had a completed job with an artisan can review them, once per job. Reviews carry a
          Verified Booking badge.
        </li>
        <li>
          Reviews must be honest and about your own experience of that job. Don’t offer or accept anything in
          exchange for a review, and don’t review yourself.
        </li>
        <li>You can edit your review within 48 hours. The artisan can reply once, publicly.</li>
        <li>
          We may remove a review that breaks these rules, for example one that is abusive, shares someone’s
          personal information or isn’t about the job. We keep a record of the reason.
        </li>
      </ul>

      <LegalHeading id="messages">11. Messages and staying on JinVa</LegalHeading>
      <p>
        Use JinVa’s messages to arrange the job, and keep them respectful. Please don’t use details you get
        through JinVa to move a job off the platform to avoid its fee: the work, payment and any dispute would
        then not be protected by JinVa. We may review messages when they are relevant to a dispute, a report
        or a suspected breach of these terms.
      </p>

      <LegalHeading id="acceptable-use">12. What you must not do</LegalHeading>
      <ul>
        <li>give false information, pretend to be someone else, or use another person’s identity documents;</li>
        <li>offer, request or arrange anything illegal, unsafe or that you aren’t qualified to do;</li>
        <li>harass, threaten or discriminate against anyone;</li>
        <li>post fake, paid-for or misleading reviews, or manipulate ratings;</li>
        <li>
          use other users’ personal information for anything except the job it was shared for, including
          sending them marketing they haven’t agreed to;
        </li>
        <li>
          interfere with JinVa’s security, copy or scrape its content in bulk, or upload anything harmful, such
          as malware.
        </li>
      </ul>

      <LegalHeading id="content">13. Your photos, reviews and other content</LegalHeading>
      <p>
        You keep ownership of what you upload, such as portfolio photos, job photos, reviews and messages. You
        allow JinVa to store, display and process it to run the platform, for example showing your portfolio on
        your profile or your review on an artisan’s page. Only upload content you have the right to share. We
        may remove content that breaks these terms or the law.
      </p>

      <LegalHeading id="suspension">14. Suspending and closing accounts</LegalHeading>
      <ul>
        <li>
          We may suspend or close an account that breaks these terms or the law, or that puts other users at
          risk. Unless the law or safety reasons prevent it, we will tell you why.
        </li>
        <li>
          You can delete your account in your settings. Any job in progress or payment still being processed
          has to be settled first. For 30 days after deletion you can restore your account by signing in again.
          After that your personal details are permanently removed, as explained in our{" "}
          <Link href="/privacy">Privacy Policy</Link>. We keep payment and dispute records that the law
          requires us to keep, without your personal details attached.
        </li>
      </ul>

      <LegalHeading id="responsibility">15. Our responsibility to you</LegalHeading>
      <ul>
        <li>
          We will run JinVa with reasonable care and skill. We will also verify artisans, hold payments and
          review disputes as these terms describe.
        </li>
        <li>
          Because artisans are independent, the artisan is responsible for the work they carry out. Our
          dispute process is how we help when that work goes wrong.
        </li>
        <li>
          We may need to pause JinVa for maintenance or because of problems outside our control. We will try to
          keep this short and tell you about planned interruptions in advance.
        </li>
        <li>
          Nothing in these terms limits any liability that can’t be limited under Ghanaian law. That includes
          your consumer rights, and liability for death or personal injury caused by our negligence, or for
          fraud.
        </li>
        <li>
          Otherwise, we are not responsible for losses that weren’t reasonably foreseeable when you used
          JinVa. For any single job, our total liability to you is limited to the amount paid through JinVa
          for that job.
        </li>
      </ul>

      <LegalHeading id="changes">16. Changes to JinVa and to these terms</LegalHeading>
      <p>
        We may update JinVa and these terms, for example when the law or our services change. If a change
        affects you significantly, we will tell you by email or in the app at least 14 days before it takes
        effect. If you don’t agree, you can close your account before then. Any job already agreed continues
        under the terms that applied when you paid.
      </p>

      <LegalHeading id="law">17. Complaints, governing law and courts</LegalHeading>
      <ul>
        <li>
          If you have a complaint about JinVa itself, contact us first (see section 18) and we will try to put
          it right.
        </li>
        <li>
          If we can’t agree, either of us may suggest mediation under the Alternative Dispute Resolution Act,
          2010 (Act 798). Mediation is voluntary and doesn’t stop you going to court.
        </li>
        <li>These terms are governed by the laws of the Republic of Ghana, and the courts of Ghana can hear any dispute about them.</li>
        <li>
          Complaints about how we handle your personal information can also go to the Data Protection
          Commission, as explained in our <Link href="/privacy">Privacy Policy</Link>.
        </li>
      </ul>

      <LegalHeading id="contact">18. Contact us</LegalHeading>
      <p>
        {company}, <LegalFact value={LEGAL_ENTITY.physicalAddress} missing="physical address" />. Email{" "}
        <LegalFact value={LEGAL_ENTITY.supportEmail} missing="support email" />, telephone{" "}
        <LegalFact value={LEGAL_ENTITY.telephone} missing="telephone number" />. You can also reach us through
        the <Link href="/contact">contact page</Link>.
      </p>
    </LegalDocument>
  )
}
