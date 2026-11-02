/**
 * Sign-up form v2: which name to show where.
 *
 * - Short display (headers, cards, lists, messages): first + last only — the
 *   `name` built in auth-context, unchanged, because space is tight.
 * - Legal name (ID verification): first, middle and last, since that is what
 *   an ID document carries.
 */
export function legalName(person: {
  firstname?: string | null
  middlename?: string | null
  lastname?: string | null
}): string {
  return [person.firstname, person.middlename, person.lastname]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ")
}
