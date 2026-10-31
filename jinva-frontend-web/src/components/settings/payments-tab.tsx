"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { AlertTriangle, Banknote, CreditCard, Loader2, Lock, ReceiptText, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  getPaymentSettings,
  isAbortError,
  isRateLimited,
  updatePaymentSettings,
  type MomoNetwork,
  type PaymentSettings,
  type PaymentSettingsPatch,
  type PreferredChannel,
} from "@/lib/customer-api"
import { cn } from "@/lib/utils"
import { HistoryMovedBanner } from "./history-moved-banner"
import { ProtectionPath } from "./protection-path"
import {
  MOMO_NETWORKS,
  NetworkMark,
  RADIO_TILE_CLASS,
  RadioMark,
  SETTINGS_FOCUS_RING as FOCUS_RING,
  SettingsRow as Row,
} from "./settings-row"

// ── Choices and copy (Settings & inbox spec §3.4) ───────────────────────────

type MethodChoice = PreferredChannel | "none"

const METHODS: { value: MethodChoice; title: string; body: string; icon: typeof Smartphone }[] = [
  { value: "mobile_money", title: "Mobile money", body: "MTN MoMo, Telecel Cash or AirtelTigo Money.", icon: Smartphone },
  { value: "card", title: "Card", body: "Visa or Mastercard, typed on Paystack’s page.", icon: CreditCard },
  { value: "none", title: "No preference", body: "Checkout shows every method in its usual order.", icon: Banknote },
]

const METHOD_HELPER: Record<MethodChoice, string> = {
  mobile_money: "We’ll show Mobile Money first when you pay. You can still choose another method at checkout.",
  card: "We’ll show Card first when you pay. You can still choose another method at checkout.",
  none: "Checkout opens as it does today. You choose a method each time you pay.",
}

/** Q-P2: the shared network tiles (see settings-row.tsx). */
const NETWORKS: { value: MomoNetwork; label: string; network: (typeof MOMO_NETWORKS)[number] }[] = MOMO_NETWORKS.map(
  (n) => ({ value: n.value, label: n.label, network: n }),
)

const RATE_LIMITED_MESSAGE = "Too many changes in a short time. Wait a minute, then save again."
const SAVE_FAILED_MESSAGE = "Couldn’t save your payment preferences. Try again."

interface Draft {
  preferredChannel: PreferredChannel | null
  momoNetwork: MomoNetwork | null
}

function toDraft(s: PaymentSettings): Draft {
  return { preferredChannel: s.preferredChannel, momoNetwork: s.momoNetwork }
}

/** BR-5.3: only the fields that changed are sent. */
function diff(saved: Draft, draft: Draft): PaymentSettingsPatch {
  const patch: PaymentSettingsPatch = {}
  if (saved.preferredChannel !== draft.preferredChannel) patch.preferredChannel = draft.preferredChannel
  if (saved.momoNetwork !== draft.momoNetwork) patch.momoNetwork = draft.momoNetwork
  return patch
}

/** "30 Oct 2026, 8:15 am" in Africa/Accra. */
function formatSavedAt(iso: string | null): string {
  if (!iso) return ""
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ""
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Africa/Accra",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).formatToParts(d)
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? ""
  return `${get("day")} ${get("month")} ${get("year")}, ${get("hour")}:${get("minute")} ${get("dayPeriod").toLowerCase()}`
}

// ── The tab ──────────────────────────────────────────────────────────────────

/**
 * Settings → Payments (item 5). Sections in FR-5.1 order: the "history has
 * moved" banner, the editable preferences form (preferred method, mobile
 * money network, explicit Save), then the read-only Receipts and Payment
 * protection card. There is no payment list here any more.
 *
 * Nothing here is a card, expiry or CVV input and nothing suggests saved
 * cards (SEC-11, AC-5.7). No mobile money number is collected (Q6).
 */
export function PaymentsTab({
  accountEmail,
  onDirtyChange,
  onReceiptSettings,
}: Readonly<{
  accountEmail: string
  onDirtyChange: (dirty: boolean) => void
  onReceiptSettings: () => void
}>) {
  const [saved, setSaved] = useState<PaymentSettings | null>(null)
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading")
  const [draft, setDraft] = useState<Draft>({ preferredChannel: null, momoNetwork: null })
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const load = useCallback(async () => {
    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller
    setLoadState("loading")
    try {
      const s = await getPaymentSettings(controller.signal)
      setSaved(s)
      setDraft(toDraft(s))
      setLoadState("ready")
    } catch (err) {
      if (isAbortError(err)) return
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    load()
    return () => abortRef.current?.abort()
  }, [load])

  const savedDraft = saved ? toDraft(saved) : null
  const patch = savedDraft ? diff(savedDraft, draft) : {}
  const dirty = Object.keys(patch).length > 0
  const editable = saved?.editable ?? false
  const locked = !editable || isSaving

  useEffect(() => {
    onDirtyChange(dirty)
  }, [dirty, onDirtyChange])
  useEffect(() => () => onDirtyChange(false), [onDirtyChange])

  const update = (next: Partial<Draft>) => {
    setDraft((d) => ({ ...d, ...next }))
    setSaveError(null)
  }

  const cancel = () => {
    if (savedDraft) setDraft(savedDraft)
    setSaveError(null)
  }

  const save = async () => {
    if (!dirty || locked) return
    setIsSaving(true)
    setSaveError(null)
    try {
      const next = await updatePaymentSettings(patch)
      setSaved(next)
      setDraft(toDraft(next))
      toast.success("Payment preferences saved")
    } catch (err) {
      // The customer's choices stay (FR-5.8).
      if (isRateLimited(err)) setSaveError(RATE_LIMITED_MESSAGE)
      else setSaveError(err instanceof Error && err.message ? err.message : SAVE_FAILED_MESSAGE)
    } finally {
      setIsSaving(false)
    }
  }

  const method: MethodChoice = draft.preferredChannel ?? "none"
  const order =
    draft.preferredChannel === "card"
      ? ["Card", "Mobile money"]
      : draft.preferredChannel === "mobile_money"
        ? ["Mobile money", "Card"]
        : null

  // ── Footer content (shared by the card footer and the phone sticky bar).
  const status = isSaving ? (
    <p className="text-xs text-muted-foreground">Saving your preferences…</p>
  ) : saveError ? (
    <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{saveError}</span>
    </p>
  ) : !editable ? (
    <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
      <Lock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>
        Your account is suspended, so you can&apos;t change payment settings.{" "}
        <Link
          href="/dashboard/user/support"
          className={cn("font-medium text-foreground underline decoration-foreground/30 underline-offset-4", FOCUS_RING)}
        >
          Contact Support
        </Link>
      </span>
    </p>
  ) : dirty ? (
    <p className="flex items-center gap-2 text-[13px] font-medium text-foreground">
      <span className="h-2 w-2 shrink-0 rounded-full bg-warning" aria-hidden="true" />
      You have unsaved changes
    </p>
  ) : saved?.updatedAt ? (
    <p className="text-xs text-muted-foreground">Last saved {formatSavedAt(saved.updatedAt)}</p>
  ) : (
    <span />
  )

  const saveButton = (extra?: string) => (
    <Button
      type="submit"
      disabled={!dirty || locked}
      aria-disabled={!dirty || locked}
      className={cn("disabled:bg-primary/40 disabled:text-primary-foreground/90 disabled:opacity-100 dark:disabled:bg-primary/25 dark:disabled:text-primary-foreground/55", extra)}
    >
      {isSaving ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />
          Saving…
        </>
      ) : (
        "Save changes"
      )}
    </Button>
  )

  const cancelButton = (extra?: string) =>
    (dirty || saveError) && editable && !isSaving ? (
      <Button type="button" variant="ghost" onClick={cancel} className={extra}>
        Cancel
      </Button>
    ) : null

  return (
    <div className="space-y-6">
      <HistoryMovedBanner />

      {/* ── The editable form ── */}
      {loadState === "loading" ? (
        <div className="@container overflow-hidden rounded-xl border bg-card" aria-busy="true" aria-label="Loading payment settings">
          {[0, 1].map((row) => (
            <div
              key={row}
              className={cn(
                "grid gap-4 p-4 sm:p-6 @[56rem]:grid-cols-[minmax(0,260px)_minmax(0,1fr)] @[56rem]:gap-10 @[56rem]:px-8 @[56rem]:py-7",
                row > 0 && "border-t",
              )}
            >
              <div className="space-y-2">
                <Skeleton className="h-3.5 w-40" />
                <Skeleton className="h-3 w-56 max-w-full" />
              </div>
              <div className="@container/controls min-w-0 space-y-3">
                <div className="grid gap-3 @[34rem]/controls:grid-cols-3">
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} className={cn("rounded-xl", row === 0 ? "h-[88px] @[34rem]/controls:h-[140px]" : "h-[60px]")} />
                  ))}
                </div>
                {row === 0 && <Skeleton className="h-12 w-full rounded-lg" />}
              </div>
            </div>
          ))}
          <div className="flex justify-end border-t bg-muted/40 px-4 py-4 sm:px-6 @[56rem]:px-8">
            <Skeleton className="h-9 w-32" />
          </div>
        </div>
      ) : loadState === "error" ? (
        <div className="flex flex-col items-center rounded-xl border bg-card px-6 py-12 text-center">
          <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-4 w-4 text-destructive" aria-hidden="true" />
          </span>
          <p className="text-sm font-semibold text-foreground">Couldn&apos;t load your payment settings</p>
          <p className="mt-1 text-sm text-muted-foreground">Your payments still work as usual.</p>
          <Button variant="outline" className="mt-4 max-sm:h-11" onClick={load}>
            Try again
          </Button>
        </div>
      ) : (
        <form
          aria-label="Payment preferences"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
          className="@container overflow-hidden rounded-xl border bg-card"
        >
          <Row first title="Preferred payment method" description="Choose which method checkout shows first." titleId="pref-method-title">
            <RadioGroupPrimitive.Root
              aria-labelledby="pref-method-title"
              value={method}
              onValueChange={(v) => update({ preferredChannel: v === "none" ? null : (v as PreferredChannel) })}
              disabled={locked}
              className={cn("grid gap-3 @[34rem]/controls:grid-cols-3", !editable && "opacity-60")}
            >
              {METHODS.map((m) => {
                const Icon = m.icon
                return (
                  <RadioGroupPrimitive.Item
                    key={m.value}
                    value={m.value}
                    aria-labelledby={`method-${m.value}-title`}
                    aria-describedby={`method-${m.value}-body`}
                    className={cn(
                      "group grid min-h-11 cursor-pointer grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-3 rounded-xl border bg-card p-4 text-left",
                      "@[34rem]/controls:grid-cols-[minmax(0,1fr)_auto] @[34rem]/controls:items-start",
                      "transition-colors motion-reduce:transition-none hover:border-foreground/25",
                      "data-[state=checked]:border-primary data-[state=checked]:bg-primary/[0.04] data-[state=checked]:ring-1 data-[state=checked]:ring-primary",
                      "disabled:cursor-not-allowed",
                      FOCUS_RING,
                    )}
                  >
                    <span className="@[34rem]/controls:col-start-2 @[34rem]/controls:row-start-1 @[34rem]/controls:mt-2.5">
                      <RadioMark />
                    </span>
                    <span
                      aria-hidden="true"
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-lg bg-muted text-foreground",
                        "group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground",
                        "@[34rem]/controls:col-start-1 @[34rem]/controls:row-start-1",
                      )}
                    >
                      <Icon className="h-[18px] w-[18px]" />
                    </span>
                    <span className="min-w-0 @[34rem]/controls:col-span-2 @[34rem]/controls:row-start-2">
                      <span id={`method-${m.value}-title`} className="block text-sm font-semibold text-foreground">
                        {m.title}
                      </span>
                      <span id={`method-${m.value}-body`} className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                        {m.body}
                      </span>
                    </span>
                  </RadioGroupPrimitive.Item>
                )
              })}
            </RadioGroupPrimitive.Root>

            <div className={cn("mt-4 flex flex-col gap-2 rounded-lg bg-muted/60 px-3.5 py-3 @[34rem]/controls:flex-row @[34rem]/controls:items-center @[34rem]/controls:gap-3", !editable && "opacity-60")}>
              <span className="text-xs font-medium text-muted-foreground">Checkout order</span>
              {order ? (
                <ol className="flex flex-wrap items-center gap-1.5">
                  {order.map((label, i) => (
                    <li
                      key={label}
                      className={cn(
                        "inline-flex h-7 items-center gap-1.5 rounded-full border pl-1 pr-2.5 text-xs font-medium",
                        i === 0 ? "border-primary/30 bg-primary/[0.06] text-foreground" : "bg-background text-muted-foreground",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 items-center justify-center rounded-full text-[11px] tabular-nums",
                          i === 0 ? "bg-primary text-primary-foreground" : "bg-muted",
                        )}
                      >
                        {i + 1}
                      </span>
                      {label}
                    </li>
                  ))}
                </ol>
              ) : (
                <span className="text-xs font-medium text-foreground">Paystack’s usual order</span>
              )}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">{METHOD_HELPER[method]}</p>
          </Row>

          <Row title="Mobile money network" description="Optional. The network you usually pay from." titleId="momo-network-title">
            <RadioGroupPrimitive.Root
              aria-labelledby="momo-network-title"
              value={draft.momoNetwork ?? ""}
              onValueChange={(v) => update({ momoNetwork: v as MomoNetwork })}
              disabled={locked}
              className={cn("grid gap-3 @[34rem]/controls:grid-cols-3", !editable && "opacity-60")}
            >
              {NETWORKS.map((n) => (
                <RadioGroupPrimitive.Item
                  key={n.value}
                  value={n.value}
                  className={RADIO_TILE_CLASS}
                >
                  <RadioMark />
                  <NetworkMark network={n.network} />
                  <span className="min-w-0 text-sm font-medium text-foreground">{n.label}</span>
                </RadioGroupPrimitive.Item>
              ))}
            </RadioGroupPrimitive.Root>
            <div className="mt-3 flex flex-col items-start gap-2 @[34rem]/controls:flex-row @[34rem]/controls:justify-between @[34rem]/controls:gap-6">
              <p className="text-[13px] leading-relaxed text-muted-foreground">
                We use this to show your network on the pay page. Paystack still asks for your mobile money number each
                time you pay.
              </p>
              {editable && draft.momoNetwork !== null && (
                <button
                  type="button"
                  onClick={() => update({ momoNetwork: null })}
                  disabled={isSaving}
                  className={cn(
                    "-ml-2 h-11 shrink-0 rounded-md px-2 text-sm font-medium text-foreground underline decoration-foreground/30 underline-offset-4 hover:decoration-foreground disabled:opacity-50 @[34rem]/controls:ml-0 @[34rem]/controls:h-9",
                    FOCUS_RING,
                  )}
                >
                  Clear network
                </button>
              )}
            </div>
          </Row>

          {/* In-card footer. On phones the sticky bar replaces it while there are unsaved changes. */}
          <div
            className={cn(
              "flex flex-col gap-3 border-t bg-muted/40 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-6 @[56rem]:px-8",
              dirty && editable && "max-sm:hidden",
            )}
          >
            <div className="min-w-0">{status}</div>
            <div className="flex shrink-0 items-center gap-2">
              {cancelButton()}
              {saveButton("max-sm:h-11 max-sm:w-full")}
            </div>
          </div>

          {/* Phone: sticky save bar while dirty (payments-390-unsaved). */}
          {dirty && editable && (
            <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-3 shadow-[0_-8px_24px_-12px_rgb(0_0_0/0.18)] backdrop-blur sm:hidden">
              <div className="mb-3">{status}</div>
              <div className="grid grid-cols-[1fr_2fr] gap-3">
                <Button type="button" variant="outline" className="h-11" onClick={cancel} disabled={isSaving}>
                  Cancel
                </Button>
                {saveButton("h-11 w-full")}
              </div>
            </div>
          )}
        </form>
      )}
      {/* Room for the sticky bar so it never covers the last card on phones. */}
      {dirty && editable && <div aria-hidden="true" className="h-32 sm:hidden" />}

      {/* ── Read-only information (renders without settings data) ── */}
      <div className="@container overflow-hidden rounded-xl border bg-card">
        <Row first title="Receipts" description="Where we send a receipt after each payment." titleId="receipts-title">
          <div className="flex flex-col items-start gap-3 @[34rem]/controls:flex-row @[34rem]/controls:items-center @[34rem]/controls:justify-between @[34rem]/controls:gap-6">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                <ReceiptText className="h-[18px] w-[18px]" aria-hidden="true" />
              </span>
              <p className="min-w-0 text-sm text-foreground">
                Receipts are sent to{" "}
                <span dir="auto" className="font-medium [overflow-wrap:anywhere] [unicode-bidi:isolate]">
                  {saved?.receiptEmail || accountEmail}
                </span>
              </p>
            </div>
            <Button type="button" variant="outline" className="shrink-0 max-sm:h-11" onClick={onReceiptSettings}>
              Receipt email settings
            </Button>
          </div>
          <p className="mt-3 text-[13px] leading-relaxed text-muted-foreground">
            Receipts always go to your account email. Turn receipt emails on or off in the Notifications tab.
          </p>
        </Row>
        <Row title="Payment protection" description="How your payment is handled until the job is done." titleId="protection-title">
          <ProtectionPath />
        </Row>
      </div>
    </div>
  )
}
