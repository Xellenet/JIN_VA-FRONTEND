"use client"

import { useCallback, useEffect, useImperativeHandle, useRef, type Ref } from "react"
import { cn } from "@/lib/utils"

/**
 * Auth v2: Cloudflare Turnstile, the bot check on sign-up, every code request,
 * forgot password and (after repeated failures) password login.
 *
 * - The script is requested only when a page that needs it mounts this
 *   component (auth pages only), and only once per page load.
 * - Explicit render, so nothing runs until we ask. In the default `invisible`
 *   mode the widget is rendered with `execution: "execute"` and
 *   `appearance: "interaction-only"`: people see nothing unless Cloudflare
 *   decides a check needs a click (a managed widget). `mode="visible"` is for
 *   login after TURNSTILE_REQUIRED, where showing the check is the point.
 * - `NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset (local dev, preview builds): renders
 *   nothing, loads nothing, and `getToken()` resolves `undefined`, so no token
 *   is sent. The backend skips its check when its own secret is unset.
 * - Tokens are single use and expire after 300 s, so each `getToken()` hands
 *   out a fresh one and resets the widget for the next submit; an expired or
 *   errored token is thrown away and the check runs again.
 *
 * The CSP allows `https://challenges.cloudflare.com` in `script-src` and
 * `frame-src` (src/lib/csp.ts).
 */

export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? ""
const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
const TOKEN_TIMEOUT_MS = 45_000

export type TurnstileAction = "register" | "code_request" | "forgot" | "login"

interface TurnstileRenderOptions {
  sitekey: string
  action?: string
  theme?: "auto" | "light" | "dark"
  size?: "normal" | "flexible" | "compact"
  execution?: "render" | "execute"
  appearance?: "always" | "execute" | "interaction-only"
  "refresh-expired"?: "auto" | "manual" | "never"
  "response-field"?: boolean
  callback?: (token: string) => void
  "error-callback"?: (code?: string) => boolean | void
  "expired-callback"?: () => void
  "timeout-callback"?: () => void
}

interface TurnstileApi {
  render: (container: HTMLElement, options: TurnstileRenderOptions) => string | undefined
  execute: (widget: string) => void
  reset: (widget: string) => void
  remove: (widget: string) => void
}

declare global {
  interface Window {
    turnstile?: TurnstileApi
  }
}

let scriptPromise: Promise<TurnstileApi> | null = null

function loadTurnstile(): Promise<TurnstileApi> {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"))
  if (window.turnstile) return Promise.resolve(window.turnstile)
  if (scriptPromise) return scriptPromise
  scriptPromise = new Promise<TurnstileApi>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SCRIPT_SRC
    script.async = true
    script.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("turnstile missing")))
    script.onerror = () => {
      scriptPromise = null
      script.remove()
      reject(new Error("turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

export interface TurnstileHandle {
  /** A fresh token, or `undefined` when Turnstile is switched off. Rejects if the check can't run. */
  getToken: () => Promise<string | undefined>
  /** Throws away any token and readies the widget again. */
  reset: () => void
}

interface Waiter {
  resolve: (token: string) => void
  reject: (error: Error) => void
  timer: ReturnType<typeof setTimeout>
}

export function Turnstile({
  ref,
  action,
  mode = "invisible",
  className,
}: {
  ref?: Ref<TurnstileHandle>
  action: TurnstileAction
  /** `visible`: shown and run straight away (login after TURNSTILE_REQUIRED). */
  mode?: "invisible" | "visible"
  className?: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const widgetRef = useRef<string | null>(null)
  const apiRef = useRef<TurnstileApi | null>(null)
  const tokenRef = useRef<string | null>(null)
  const executingRef = useRef(false)
  const waiters = useRef<Waiter[]>([])
  const readyRef = useRef<Promise<void> | null>(null)

  const settle = useCallback((result: { token: string } | { error: Error }) => {
    const pending = waiters.current
    waiters.current = []
    for (const w of pending) {
      clearTimeout(w.timer)
      if ("token" in result) w.resolve(result.token)
      else w.reject(result.error)
    }
  }, [])

  const resetWidget = useCallback(() => {
    tokenRef.current = null
    executingRef.current = false
    if (apiRef.current && widgetRef.current) {
      try {
        apiRef.current.reset(widgetRef.current)
      } catch {
        // A widget removed under us: the next getToken renders a new one.
      }
    }
  }, [])

  const ensureWidget = useCallback((): Promise<void> => {
    if (!TURNSTILE_SITE_KEY) return Promise.resolve()
    if (readyRef.current) return readyRef.current
    readyRef.current = loadTurnstile()
      .then((api) => {
        apiRef.current = api
        const container = containerRef.current
        if (!container || widgetRef.current) return
        const id = api.render(container, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "auto",
          size: "flexible",
          execution: mode === "visible" ? "render" : "execute",
          appearance: mode === "visible" ? "always" : "interaction-only",
          // We reset after every use ourselves; auto-refresh would race that.
          "refresh-expired": "manual",
          "response-field": false,
          callback: (token) => {
            executingRef.current = false
            tokenRef.current = token
            settle({ token })
          },
          "error-callback": () => {
            executingRef.current = false
            tokenRef.current = null
            settle({ error: new Error("turnstile error") })
            return true
          },
          "expired-callback": () => {
            tokenRef.current = null
            resetWidget()
          },
          "timeout-callback": () => {
            executingRef.current = false
            tokenRef.current = null
          },
        })
        widgetRef.current = id ?? null
        // A visible widget runs on render; the invisible one waits for execute().
        executingRef.current = mode === "visible"
      })
      .catch((error: unknown) => {
        readyRef.current = null
        throw error instanceof Error ? error : new Error("turnstile failed")
      })
    return readyRef.current
  }, [action, mode, resetWidget, settle])

  // Load and render as soon as the form shows, so the first submit is quick.
  useEffect(() => {
    if (!TURNSTILE_SITE_KEY) return
    ensureWidget().catch(() => {
      // Reported on submit, where the person can act on it.
    })
    return () => {
      settle({ error: new Error("unmounted") })
      if (apiRef.current && widgetRef.current) {
        try {
          apiRef.current.remove(widgetRef.current)
        } catch {
          // Already gone.
        }
      }
      widgetRef.current = null
      readyRef.current = null
      tokenRef.current = null
    }
  }, [ensureWidget, settle])

  useImperativeHandle(
    ref,
    () => ({
      reset: resetWidget,
      getToken: async () => {
        if (!TURNSTILE_SITE_KEY) return undefined
        await ensureWidget()
        const api = apiRef.current
        const widget = widgetRef.current
        if (!api || !widget) throw new Error("turnstile not ready")

        const ready = tokenRef.current
        if (ready) {
          // Single use: hand it out and ready the widget for the next submit.
          tokenRef.current = null
          setTimeout(resetWidget, 0)
          return ready
        }

        const token = await new Promise<string>((resolve, reject) => {
          const timer = setTimeout(() => {
            waiters.current = waiters.current.filter((w) => w.timer !== timer)
            executingRef.current = false
            reject(new Error("turnstile timeout"))
          }, TOKEN_TIMEOUT_MS)
          waiters.current.push({ resolve, reject, timer })
          if (!executingRef.current) {
            executingRef.current = true
            try {
              if (mode === "visible") api.reset(widget)
              else api.execute(widget)
            } catch {
              // execute() on a widget that already ran: reset and try once more.
              try {
                api.reset(widget)
                api.execute(widget)
              } catch (error) {
                clearTimeout(timer)
                executingRef.current = false
                waiters.current = waiters.current.filter((w) => w.timer !== timer)
                reject(error instanceof Error ? error : new Error("turnstile failed"))
              }
            }
          }
        })
        tokenRef.current = null
        setTimeout(resetWidget, 0)
        return token
      },
    }),
    [ensureWidget, mode, resetWidget],
  )

  if (!TURNSTILE_SITE_KEY) return null

  // Holds the challenge iframe if Cloudflare needs a click; empty otherwise.
  return (
    <div
      ref={containerRef}
      data-turnstile={mode}
      className={cn("empty:hidden [&_iframe]:max-w-full", mode === "visible" && "min-h-[65px]", className)}
    />
  )
}
