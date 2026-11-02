/**
 * The facts JinVa's legal pages (/legal, /terms, /privacy) state about the
 * business behind it. Ghana's Electronic Transactions Act, 2008 (Act 772)
 * s.47 requires an online supplier to publish most of these, and the Data
 * Protection Act, 2012 (Act 843) s.27(2) requires the privacy notice to name
 * who is responsible for the data.
 *
 * FILL IN EVERY `null` BEFORE LAUNCH. A `null` renders on the page as a
 * highlighted "[to be confirmed: …]" note, so a missing fact is visible
 * rather than silently omitted. Nothing here is guessed.
 *
 * `reviewedByCounsel` stays false until a lawyer qualified in Ghana has
 * reviewed the three documents. While it is false every legal page carries a
 * "pending legal review" banner.
 */
export interface LegalEntity {
  /** The registered company name, exactly as on the certificate of incorporation. */
  legalName: string | null
  /** E.g. "a private company limited by shares". */
  legalStatus: string | null
  /** Registrar-General / Office of the Registrar of Companies number. */
  registrationNumber: string | null
  placeOfRegistration: string | null
  /** Directors / office bearers (Act 772 s.47(1)(f)). */
  officeBearers: string[] | null
  /** A physical address (not a P.O. Box alone) — s.47(1)(b). */
  physicalAddress: string | null
  /** Ghana Post GPS digital address, if any. */
  digitalAddress: string | null
  telephone: string | null
  supportEmail: string | null
  /** Address for privacy requests; may be the same as support. */
  privacyEmail: string | null
  website: string | null
  /** Data Protection Commission registration number (Act 843 ss.27, 46–53). */
  dpcRegistrationNumber: string | null
  /** A self-regulatory body or code of conduct the business belongs to, if any (s.47(1)(d)–(e)). */
  selfRegulatoryMembership: string | null
}

export const LEGAL_ENTITY: LegalEntity = {
  legalName: null,
  legalStatus: null,
  registrationNumber: null,
  placeOfRegistration: null,
  officeBearers: null,
  physicalAddress: null,
  digitalAddress: null,
  telephone: null,
  supportEmail: null,
  privacyEmail: null,
  website: null,
  dpcRegistrationNumber: null,
  selfRegulatoryMembership: null,
}

/** Shown as "Last updated" on all three documents. Update it whenever any of them changes. */
export const LEGAL_LAST_UPDATED = "30 October 2026"

/** Set to true only after a Ghanaian lawyer has reviewed /legal, /terms and /privacy. */
export const LEGAL_REVIEWED_BY_COUNSEL = false
