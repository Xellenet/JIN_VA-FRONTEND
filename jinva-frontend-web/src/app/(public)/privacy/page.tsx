import type { Metadata } from "next"
import { LegalDocument, LegalFact, LegalHeading } from "@/components/public/legal-document"
import { LEGAL_ENTITY } from "@/lib/legal-entity"

export const metadata: Metadata = {
  title: "Privacy Policy",
  description:
    "What personal information JinVa collects, why, who it is shared with, how long it is kept, and your rights under Ghana's Data Protection Act.",
}

const SECTIONS = [
  { id: "who-we-are", heading: "Who is responsible for your information" },
  { id: "what-we-collect", heading: "What we collect" },
  { id: "required", heading: "What you have to give us, and what is optional" },
  { id: "why", heading: "Why we use it" },
  { id: "sharing", heading: "Who we share it with" },
  { id: "outside-ghana", heading: "Storage outside Ghana" },
  { id: "retention", heading: "How long we keep it" },
  { id: "security", heading: "How we protect it" },
  { id: "rights", heading: "Your rights" },
  { id: "marketing", heading: "Marketing and notifications" },
  { id: "cookies", heading: "Cookies and similar technologies" },
  { id: "children", heading: "Children" },
  { id: "changes", heading: "Changes to this policy" },
]

export default function PrivacyPage() {
  const company = <LegalFact value={LEGAL_ENTITY.legalName} missing="registered company name" />
  const privacyEmail = <LegalFact value={LEGAL_ENTITY.privacyEmail} missing="privacy contact email" />

  return (
    <LegalDocument
      title="Privacy Policy"
      current="/privacy"
      sections={SECTIONS}
      standfirst="How JinVa collects, uses, shares and protects your personal information, and the rights the Data Protection Act, 2012 (Act 843) gives you."
    >
      <LegalHeading id="who-we-are">1. Who is responsible for your information</LegalHeading>
      <p>
        {company} (“JinVa”, “we”, “us”) runs JinVa and is the data controller for the personal information
        described here. We are registered with Ghana’s Data Protection Commission under number{" "}
        <LegalFact value={LEGAL_ENTITY.dpcRegistrationNumber} missing="Data Protection Commission registration number" />.
      </p>
      <p>
        Address: <LegalFact value={LEGAL_ENTITY.physicalAddress} missing="physical address" />. For anything about
        your personal information, email {privacyEmail}.
      </p>

      <LegalHeading id="what-we-collect">2. What we collect</LegalHeading>
      <h3>Everyone with an account</h3>
      <ul>
        <li>Your name, email address, phone number and password (stored only in scrambled form).</li>
        <li>If you sign in with Google: your name, email address and profile photo from Google.</li>
        <li>Optional details you add, such as a profile photo, your date of birth, gender and addresses.</li>
        <li>
          Clients can choose to add their Ghana Card number in settings. It can be set once and only you can see
          it.
        </li>
      </ul>
      <h3>Artisans</h3>
      <ul>
        <li>Your business name, services, prices, working hours, location area and portfolio photos or videos.</li>
        <li>
          For identity verification: the type and number of your identity document (such as a Ghana Card), your
          full legal name and date of birth, photos of the front and back of the document, and a selfie.
        </li>
        <li>The mobile money number or bank account you want to be paid into.</li>
      </ul>
      <h3>When you use JinVa</h3>
      <ul>
        <li>Jobs and bookings: what the work is, where and when it happens, prices and every status change.</li>
        <li>Messages and the photos you attach, job photos, reviews, ratings and dispute statements.</li>
        <li>
          Payments: the amount, status and reference of each payment, and whether you paid by card or mobile
          money. Your card or mobile money details are collected by our payment provider, Paystack, not by us.
        </li>
        <li>
          Location: the addresses you enter. If you use your device’s location to fill in an address, we use
          an approximate position, rounded to about 100 metres.
        </li>
        <li>
          Technical information: your IP address and device information, which we use for security and to
          prevent abuse. We also store a notification token if you turn on push notifications on a device.
        </li>
      </ul>

      <LegalHeading id="required">3. What you have to give us, and what is optional</LegalHeading>
      <ul>
        <li>
          <strong>Required to have an account:</strong> your name, email address and either a password or a
          Google sign-in. Without these we can’t create or secure your account.
        </li>
        <li>
          <strong>Required to book or be booked:</strong> the job details and its location, and for artisans,
          a payout account to receive payment.
        </li>
        <li>
          <strong>Required for a verified badge:</strong> the identity document, its photos and the selfie
          described above. You can use JinVa without a badge, but it won’t appear on your profile.
        </li>
        <li>
          <strong>Optional:</strong> everything else, such as a profile photo, date of birth, gender and your
          Ghana Card number as a client.
        </li>
      </ul>

      <LegalHeading id="why">4. Why we use it</LegalHeading>
      <p>We only use your information for purposes connected with running JinVa:</p>
      <ul>
        <li>
          <strong>To provide the service you signed up for:</strong> running your account, matching clients and
          artisans, bookings, payments, payouts, messages, reviews and disputes. This is necessary for our
          agreement with you.
        </li>
        <li>
          <strong>To keep JinVa safe:</strong> verifying artisans’ identity, preventing fraud and abuse,
          moderating portfolios and reviews, and securing accounts. This is in our legitimate interest and
          yours.
        </li>
        <li>
          <strong>To meet legal obligations:</strong> keeping financial records and responding to lawful
          requests from authorities.
        </li>
        <li>
          <strong>With your consent:</strong> for optional things such as marketing messages and push
          notifications. You can withdraw consent at any time.
        </li>
      </ul>

      <LegalHeading id="sharing">5. Who we share it with</LegalHeading>
      <p>We don’t sell your personal information. We share it only as follows:</p>
      <ul>
        <li>
          <strong>Other JinVa users, as needed for the job.</strong> Clients see an artisan’s public profile.
          An artisan sees the client’s name, profile photo, and the details and location of jobs they are
          offered or accept. Your Ghana Card number and identity documents are never shown to other users.
        </li>
        <li>
          <strong>Service providers who work on our behalf</strong>, under contracts that require them to keep
          your information confidential and secure:
          <ul className="mt-2 list-[circle] space-y-1 pl-6">
            <li>Paystack, to process payments, refunds and payouts;</li>
            <li>our hosting, database and file-storage providers, which store the platform and your uploads;</li>
            <li>our email provider, to send account and job emails;</li>
            <li>Google, if you sign in with Google, and Google Firebase, to deliver push notifications;</li>
            <li>a map search service, which receives the address text or approximate location you look up.</li>
          </ul>
        </li>
        <li>
          <strong>Authorities</strong>, when the law requires it or to protect someone’s safety.
        </li>
        <li>
          <strong>A new owner</strong>, if JinVa’s business is ever sold or reorganised. They would have to
          protect your information as this policy describes.
        </li>
      </ul>

      <LegalHeading id="outside-ghana">6. Storage outside Ghana</LegalHeading>
      <p>
        Some of our service providers store data in data centres outside Ghana, for example in the European
        Union. Where a provider is based outside Ghana, we make sure it is bound to protect your information to
        the standard Ghanaian law requires, as section 30 of the Data Protection Act directs.
      </p>

      <LegalHeading id="retention">7. How long we keep it</LegalHeading>
      <ul>
        <li>We keep your account information while your account is open.</li>
        <li>
          If you delete your account, you can restore it within 30 days. After that we permanently remove or
          anonymise your personal details. This includes your profile, contact details, Ghana Card number and
          identity documents.
        </li>
        <li>
          We keep records of payments, refunds and disputes for as long as the law requires, without your
          personal details attached once your account has been removed.
        </li>
        <li>System logs record a scrambled form of your email address, never the address itself.</li>
      </ul>

      <LegalHeading id="security">8. How we protect it</LegalHeading>
      <ul>
        <li>
          All connections to JinVa are encrypted (HTTPS). Passwords are stored only in a one-way scrambled
          form.
        </li>
        <li>
          Identity documents and the photos you send in messages are kept in private storage. They can be
          opened only by the people entitled to see them, such as the sender and receiver of a message, or the
          JinVa staff who review verifications.
        </li>
        <li>
          Only staff who need access for their work can see personal information, and the actions they take on
          accounts and payments are logged.
        </li>
        <li>
          If your personal information is ever accessed without authorisation, we will tell you and the Data
          Protection Commission as soon as reasonably possible, with advice on how to protect yourself.
        </li>
      </ul>

      <LegalHeading id="rights">9. Your rights</LegalHeading>
      <p>The Data Protection Act, 2012 gives you the right to:</p>
      <ul>
        <li>
          <strong>Access</strong> the personal information we hold about you. You can ask what it is, why we
          use it, where it came from and who we share it with. We will answer within 40 days.
        </li>
        <li>
          <strong>Correct or delete</strong> information that is inaccurate, out of date, incomplete,
          misleading or no longer needed. Much of it you can change yourself in your settings.
        </li>
        <li>
          <strong>Object</strong> to our use of your information, and ask us to stop.
        </li>
        <li>
          <strong>Stop direct marketing</strong> at any time.
        </li>
        <li>
          <strong>Not be subject to decisions made purely by automatic means</strong> that significantly affect
          you. One step on JinVa is automatic: a payment is released 48 hours after the artisan marks a job
          done if the client doesn’t respond. This step is part of our agreement with you, and you can still
          raise a dispute afterwards.
        </li>
        <li>
          <strong>Compensation</strong> if you suffer damage or distress because we break the Act.
        </li>
      </ul>
      <p>
        To use any of these rights, email {privacyEmail} from the email address on your account. We may ask
        you to confirm your identity before we act.
      </p>
      <p>
        If you’re unhappy with how we handle your information, you can complain to the Data Protection
        Commission at{" "}
        <a href="https://dpc.gov.gh" rel="noopener noreferrer">
          dpc.gov.gh
        </a>
        . We’d appreciate the chance to put things right first.
      </p>

      <LegalHeading id="marketing">10. Marketing and notifications</LegalHeading>
      <ul>
        <li>
          We send promotional messages only if you have switched them on. They are off unless you choose
          otherwise, and you can switch them off again at any time in your notification settings.
        </li>
        <li>
          We send service messages about your account, jobs, payments and disputes, because the service depends
          on them. You choose which ones also reach you by email or push notification in your settings.
        </li>
        <li>We never let other users or third parties send you marketing using your JinVa details.</li>
      </ul>

      <LegalHeading id="cookies">11. Cookies and similar technologies</LegalHeading>
      <p>JinVa uses only the cookies it needs to work. We don’t use advertising or tracking cookies.</p>
      <ul>
        <li>
          <strong>jinva_session</strong> and <strong>refresh_token</strong>: keep you signed in securely.
        </li>
        <li>
          <strong>jinva_session_only</strong>: remembers that you chose not to stay signed in, so you are
          signed out when you close the browser.
        </li>
        <li>
          <strong>jinva_pending_signup</strong>: holds your place briefly while you finish signing up with
          Google.
        </li>
      </ul>
      <p>
        Your browser also remembers your light or dark theme choice on your own device. If we use a website
        statistics tool, it counts visits in aggregate without cookies and without identifying you.
      </p>

      <LegalHeading id="children">12. Children</LegalHeading>
      <p>
        JinVa is for adults. You must be 18 or older to create an account, and we don’t knowingly collect
        information about children. If you think a child has created an account, contact us and we will
        delete it.
      </p>

      <LegalHeading id="changes">13. Changes to this policy</LegalHeading>
      <p>
        We will update this policy when our practices or the law change, for example when Ghana’s new data
        protection law takes effect. If a change significantly affects how we use your information, we will
        tell you by email or in the app before it applies.
      </p>
    </LegalDocument>
  )
}
