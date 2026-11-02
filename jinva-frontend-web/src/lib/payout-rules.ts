/**
 * The rules for saving a payout method (Settings → Payments), in one place
 * and free of React, so `scripts/test-payout.mjs` can run them directly.
 *
 * Save is allowed only when every rule below holds (`payoutSaveState`):
 *  1. A network (mobile money) or a bank is chosen.
 *  2. The number is valid (`checkAccountNumber`): mobile money is 10 digits
 *     starting with 0 (after `+233`/`233`/`00233`, spaces and dashes are
 *     normalised) with a Ghana mobile prefix (`MOMO_PREFIXES`, any network:
 *     numbers can be ported); a bank account is 6–20 digits.
 *  3. The name belongs to that number: the lookup's name for exactly the
 *     current type + network/bank + number, and "This is my account" ticked.
 *     While the lookup is waiting for typing to pause or is in flight, or the
 *     account isn't found, Save stays off.
 *  4. Only when the lookup is unavailable (503, 429, network error) a typed
 *     name is accepted instead, if it passes `checkTypedName`. The server
 *     looks the name up again on save and stores it as unverified when it
 *     still can't.
 *
 * The server keeps its own rules (it re-resolves the number on every save);
 * these exist so the form never offers a save that can't be right.
 */

export type PayoutType = "mobile_money" | "bank"

/** The networks, by the value the form's network picker uses. */
export type MomoNetworkKey = "MTN" | "TELECEL" | "AT"

/**
 * Ghana mobile money prefixes per network (the first three digits of the
 * national number), from the NCA numbering plan:
 *  - MTN:        024, 025, 053, 054, 055, 059
 *  - Telecel:    020, 050
 *  - AirtelTigo: 026, 027, 056, 057
 * Ghana has number portability, so a ported number keeps its original
 * network's prefix. A number is therefore accepted with ANY network's
 * prefix; the Paystack name lookup is what tells whether the wallet really
 * is on the chosen network. Only numbers that aren't mobile numbers at all
 * (e.g. 030 landlines) are refused here.
 */
export const MOMO_PREFIXES: Record<MomoNetworkKey, readonly string[]> = {
  MTN: ["024", "025", "053", "054", "055", "059"],
  TELECEL: ["020", "050"],
  AT: ["026", "027", "056", "057"],
}

/** The network as it reads in a sentence ("Enter a valid MTN number"). */
export const MOMO_NETWORK_NAME: Record<MomoNetworkKey, string> = {
  MTN: "MTN",
  TELECEL: "Telecel",
  AT: "AirtelTigo",
}

export const isMomoNetworkKey = (v: string): v is MomoNetworkKey =>
  Object.prototype.hasOwnProperty.call(MOMO_PREFIXES, v)

/**
 * The number as the API wants it: spaces and dashes removed and, for mobile
 * money, `+233`/`233`/`00233` turned into the leading `0`
 * (`+233 24 123 4567` → `0241234567`, `233-024-123-4567` → `0241234567`).
 */
export function normaliseAccountNumber(type: PayoutType, raw: string): string {
  const compact = raw.trim().replace(/[\s-]+/g, "")
  if (type !== "mobile_money") return compact
  const intl = /^(?:\+|00)?233(\d{9,10})$/.exec(compact)
  if (!intl) return compact
  const national = intl[1]
  if (national.length === 10) return national.startsWith("0") ? national : compact
  return `0${national}`
}

/** Why a number can't be used yet: missing, the wrong shape, or not a Ghana mobile number. */
export type NumberIssue = "empty" | "format" | "prefix"

/** `null` when the (normalised) number is valid for the type and network. */
export function checkAccountNumber(type: PayoutType, network: string, number: string): NumberIssue | null {
  if (!number) return "empty"
  if (type === "bank") return /^\d{6,20}$/.test(number) ? null : "format"
  if (!/^0\d{9}$/.test(number)) return "format"
  return ALL_MOMO_PREFIXES.has(number.slice(0, 3)) ? null : "prefix"
}

const ALL_MOMO_PREFIXES = new Set(Object.values(MOMO_PREFIXES).flat())

/** The message under the number field for an issue (shown after blur). */
export function numberIssueMessage(type: PayoutType, network: string, issue: NumberIssue): string {
  if (type === "bank") {
    return issue === "empty" ? "Enter your account number." : "Enter your account number: 6 to 20 digits."
  }
  const known = isMomoNetworkKey(network)
  const name = known ? MOMO_NETWORK_NAME[network] : "mobile money"
  if (issue === "empty") return `Enter your ${name} number.`
  if (issue === "prefix") {
    return `This isn't a Ghana mobile number. Mobile money numbers start with 02 or 05, like 0240000000.`
  }
  return `Enter your 10-digit ${name} number, like ${known ? MOMO_PREFIXES[network][0] : "024"}0000000.`
}

/** Why a typed account name isn't accepted. */
export type NameIssue = "empty" | "chars" | "length" | "one_word"

/** Letters (any script, with accents), spaces, hyphens, apostrophes and dots. */
const NAME_CHARS = /^[\p{L}\p{M}\s'’.-]+$/u

/** The typed name tidied for saving: trimmed, inner spaces collapsed. */
export const tidyName = (name: string): string => name.trim().replace(/\s+/g, " ")

/** `null` when a typed name is acceptable as the name on the account. */
export function checkTypedName(raw: string): NameIssue | null {
  const name = tidyName(raw)
  if (!name) return "empty"
  if (!NAME_CHARS.test(name)) return "chars"
  if (name.length < 3 || name.length > 100) return "length"
  const words = name.split(" ").filter((w) => /\p{L}/u.test(w))
  return words.length >= 2 ? null : "one_word"
}

export function nameIssueMessage(issue: NameIssue): string {
  switch (issue) {
    case "empty":
      return "Enter the full name on the account."
    case "chars":
      return "Use letters, spaces, hyphens, apostrophes and dots only."
    case "length":
      return "Enter between 3 and 100 characters."
    case "one_word":
      return "Enter at least a first and a last name, as they appear on the account."
  }
}

/** The account name lookup. `key` says which type/code/number a result belongs to. */
export type Lookup =
  | { state: "idle" }
  | { state: "loading"; key: string }
  | { state: "found"; key: string; name: string }
  | { state: "not_found"; key: string; message: string }
  | { state: "unavailable"; key: string; message: string }

/** The key of the lookup for this exact type, network/bank code and number. */
export const lookupKeyFor = (type: PayoutType, code: string, number: string): string =>
  `${type}|${code}|${number}`

/** The lookup only when it belongs to `key`; a result for another number counts as none. */
export function lookupFor(lookup: Lookup, key: string): Lookup {
  return key && lookup.state !== "idle" && lookup.key === key ? lookup : { state: "idle" }
}

export type SaveBlock =
  | "saving"
  | "network"
  | "bank"
  | "number"
  | "lookup_pending"
  | "not_found"
  | "confirm"
  | "name"

export interface PayoutSaveInput {
  type: PayoutType
  /** The mobile money network's picker value ("MTN", "TELECEL", "AT"). */
  network: string
  /** The bank's code. */
  bankCode: string
  /** The number as typed. */
  accountNumber: string
  /** The latest lookup, whichever number it was for. */
  lookup: Lookup
  /** The key the lookup must have to count: `lookupKeyFor(type, code, normalised number)`. */
  lookupKey: string
  confirmed: boolean
  /** The typed name (used only when the lookup is unavailable). */
  typedName: string
  isSaving?: boolean
}

export interface PayoutSaveState {
  canSave: boolean
  /** The first rule that isn't met, or null. */
  block: SaveBlock | null
  /** Why Save is off, as a short line under it; null when it can save (or is saving). */
  reason: string | null
  /** The name that will be sent: the looked-up one, or the tidied typed one. */
  name: string | null
  /** Whether the name was looked up (true) or typed because the lookup is unavailable (false). */
  verifiedName: boolean
}

/** The one place that decides whether Save is on, and why not. */
export function payoutSaveState(input: PayoutSaveInput): PayoutSaveState {
  const off = (block: SaveBlock, reason: string | null): PayoutSaveState => ({
    canSave: false,
    block,
    reason,
    name: null,
    verifiedName: false,
  })
  const { type, network } = input
  const momo = type === "mobile_money"
  const netName = momo && isMomoNetworkKey(network) ? MOMO_NETWORK_NAME[network] : null

  if (input.isSaving) return off("saving", null)
  if (momo && !netName) return off("network", "Choose your mobile money network to continue.")
  if (!momo && !input.bankCode.trim()) return off("bank", "Choose your bank to continue.")

  const number = normaliseAccountNumber(type, input.accountNumber)
  const issue = checkAccountNumber(type, network, number)
  if (issue) {
    const what = momo ? `${netName} number` : "account number"
    return off("number", issue === "empty" ? `Enter your ${what} to continue.` : `Enter a valid ${what} to continue.`)
  }

  const lookup = lookupFor(input.lookup, input.lookupKey)
  switch (lookup.state) {
    case "idle":
    case "loading":
      return off("lookup_pending", "Checking the name on this account…")
    case "not_found":
      return off("not_found", "Check the number: we couldn’t find this account.")
    case "found":
      if (!input.confirmed) return off("confirm", "Confirm this is your account to continue.")
      return { canSave: true, block: null, reason: null, name: lookup.name, verifiedName: true }
    case "unavailable": {
      if (checkTypedName(input.typedName)) return off("name", "Type the full name on the account to continue.")
      return { canSave: true, block: null, reason: null, name: tidyName(input.typedName), verifiedName: false }
    }
  }
}
