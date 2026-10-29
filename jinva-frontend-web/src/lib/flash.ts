/**
 * A one-shot success message that survives a full page navigation.
 *
 * Several auth flows finish with `globalThis.location.href = …` rather than a
 * client-side `router.push`, because the access token lives in memory only (S1)
 * and a hard navigation is what re-bootstraps `AuthProvider` from the httpOnly
 * session cookie. A `toast.success()` fired just before that navigation is
 * destroyed with the page and is never actually seen — measured on the account
 * restore path in qa-report.md FE-1.
 *
 * So the message is parked in `sessionStorage` (per-tab, survives the
 * navigation, gone when the tab closes) and `<FlashToast />` pops it on the
 * next page. It holds display copy only — never tokens, ids or anything
 * sensitive — and is consumed exactly once, so a refresh does not replay it.
 *
 * Prefer a real on-page banner when the message must stay readable (see the
 * post-deletion banner on the login form); this is for "warm, short, then get
 * out of the way" confirmations only (design-spec.md §6).
 */
const FLASH_KEY = "jinva:flash-toast:v1"

export function setFlashToast(message: string): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.setItem(FLASH_KEY, message)
  } catch {
    // Private-mode / quota failures are not worth failing a redirect over.
  }
}

/** Reads and clears the pending message. Returns null when there is none. */
export function consumeFlashToast(): string | null {
  if (typeof window === "undefined") return null
  try {
    const message = sessionStorage.getItem(FLASH_KEY)
    if (message) sessionStorage.removeItem(FLASH_KEY)
    return message
  } catch {
    return null
  }
}
