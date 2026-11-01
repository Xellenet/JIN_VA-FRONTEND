"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { AlertTriangle, BadgeCheck, CheckCircle2, Landmark, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError } from "@/components/ui/field"
import { FormField, fieldErrorId } from "@/components/forms/form-field"
import { ApiError, apiFetch } from "@/lib/api"
import { failureReasonText } from "@/lib/earnings"
import {
  getBanks,
  getEarningsStatement,
  resolvePayoutAccount,
  savePayoutMethod,
  type Bank,
  type PayoutDestination,
  type PayoutType,
} from "@/lib/earnings-api"
import { cn, formatCurrency } from "@/lib/utils"
import { BankPicker } from "./bank-picker"
import {
  MOMO_NETWORKS,
  NetworkMark,
  RADIO_TILE_CLASS,
  RadioMark,
  SETTINGS_FOCUS_RING,
  SettingsRow,
  type MomoNetworkOption,
} from "./settings-row"

/** The anchor "Add payout method" links land on: `/dashboard/artisan/settings?tab=payments#payout-method`. */
export const PAYOUT_METHOD_ANCHOR = "payout-method"

interface SavedPayout {
  type: PayoutType
  accountName: string
  /** The network or bank name ("MTN MoMo", "GCB Bank Limited"). */
  label: string
  /** Last 4 digits only; the full number is never sent back by the API. */
  last4: string
  bankCode: string
  /** True when the name came from the account lookup. */
  accountNameVerified: boolean
}

interface ProfilePayoutFields {
  payoutType?: PayoutType | null
  payoutAccountName?: string | null
  payoutAccountNumber?: string | null
  payoutBankCode?: string | null
  /** B2: the masked destination, null when no payout method is set. */
  payoutDestination?: PayoutDestination | null
}

type FieldKey = "accountName" | "accountNumber" | "network" | "bankCode" | "confirm"

/**
 * The account name lookup for the number being typed. `key` is the
 * type/code/number it belongs to, so a result never shows for another number.
 */
type Lookup =
  | { state: "idle" }
  | { state: "loading"; key: string }
  | { state: "found"; key: string; name: string }
  | { state: "not_found"; key: string; message: string }
  | { state: "unavailable"; key: string; message: string }

/** How long typing must pause before the name is looked up. */
const LOOKUP_DEBOUNCE_MS = 500

const NOT_FOUND_MESSAGE = "We couldn’t find the name on this account. Check the number and the network or bank."
const UNAVAILABLE_MESSAGE = "We can’t look up the account name right now. Type the name on the account instead."
const RATE_LIMITED_MESSAGE =
  "You’ve looked up several numbers in a short time, so we can’t check this one now. Type the name on the account instead."

const TYPES: { value: PayoutType; title: string; body: string; icon: typeof Smartphone }[] = [
  { value: "mobile_money", title: "Mobile money", body: "MTN MoMo, Telecel Cash or AirtelTigo Money.", icon: Smartphone },
  { value: "bank", title: "Bank account", body: "A Ghanaian bank account in your name.", icon: Landmark },
]

const networkByCode = (code: string): MomoNetworkOption | undefined =>
  MOMO_NETWORKS.find((n) => n.payoutCode === code.toUpperCase())

/** The network of a saved mobile money method, by code or by its label. */
const networkFor = (saved: SavedPayout): MomoNetworkOption | undefined =>
  networkByCode(saved.bankCode) ?? MOMO_NETWORKS.find((n) => n.label === saved.label)

/** "MTN MoMo ••1234" / "GCB Bank Limited ••1234". */
function destinationLabel(saved: SavedPayout): string {
  const name = saved.label || (saved.type === "mobile_money" ? "Mobile money" : "Bank account")
  return saved.last4 ? `${name} ••${saved.last4}` : name
}

/** The saved method from the profile: `payoutDestination` first, the older fields as a fallback. */
function savedFromProfile(p: ProfilePayoutFields): SavedPayout | null {
  const d = p.payoutDestination
  if (d) {
    return {
      type: d.type,
      accountName: d.accountName ?? p.payoutAccountName ?? "",
      label: d.label,
      last4: (d.last4 ?? "").slice(-4),
      bankCode: p.payoutBankCode ?? "",
      accountNameVerified: d.accountNameVerified === true,
    }
  }
  if (!p.payoutType) return null
  const code = p.payoutBankCode ?? ""
  return {
    type: p.payoutType,
    accountName: p.payoutAccountName ?? "",
    label: p.payoutType === "mobile_money" ? (networkByCode(code)?.label ?? "Mobile money") : "Bank account",
    last4: (p.payoutAccountNumber ?? "").replace(/\D/g, "").slice(-4),
    bankCode: code,
    accountNameVerified: false,
  }
}

/**
 * The number as the API wants it: separators removed and, for mobile money,
 * `+233`/`233` turned into the leading `0` (`+233 24 123 4567` → `0241234567`).
 */
function normaliseNumber(type: PayoutType, raw: string): string {
  const compact = raw.trim().replace(/[\s-]+/g, "")
  if (type !== "mobile_money") return compact
  const intl = /^(?:\+|00)?233(\d{9,10})$/.exec(compact)
  if (!intl) return compact
  const national = intl[1]
  if (national.length === 10) return national.startsWith("0") ? national : compact
  return `0${national}`
}

/** Whether the number is complete enough to look up. */
function lookupReady(type: PayoutType, number: string, code: string): boolean {
  if (!code) return false
  return type === "mobile_money" ? /^0\d{9}$/.test(number) : /^\d{6,20}$/.test(number)
}

function validate(
  type: PayoutType,
  values: { accountName: string; accountNumber: string; network: string; bankCode: string },
  lookup: Lookup,
  confirmed: boolean,
): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  const number = normaliseNumber(type, values.accountNumber)
  if (type === "mobile_money") {
    if (!values.network) errors.network = "Choose your mobile money network."
    if (!/^0\d{9}$/.test(number)) errors.accountNumber = "Enter your 10-digit mobile money number, like 0241234567."
  } else {
    if (!values.bankCode.trim()) errors.bankCode = "Choose your bank."
    if (!/^\d{6,20}$/.test(number)) errors.accountNumber = "Enter your account number, digits only (at least 6)."
  }
  if (errors.accountNumber || errors.network || errors.bankCode) return errors
  if (lookup.state === "not_found") errors.accountNumber = lookup.message
  else if (lookup.state === "found" && !confirmed) errors.confirm = "Confirm this is your account."
  else if (lookup.state === "unavailable" && values.accountName.trim().length < 2)
    errors.accountName = "Enter the full name on the account."
  return errors
}

const FIELD_ORDER: FieldKey[] = ["network", "bankCode", "accountNumber", "confirm", "accountName"]
const FIELD_ID: Record<FieldKey, string> = {
  accountName: "payout-account-name",
  network: "payout-network",
  accountNumber: "payout-account-number",
  bankCode: "payout-bank-code",
  confirm: "payout-confirm",
}

/**
 * Settings → Payouts: where an artisan's earnings are sent. One card, one save
 * model: the saved destination with a "Change" action, or the form. Errors sit
 * under the field they belong to (not only in a toast), and the card carries
 * the stable `#payout-method` anchor that "Add payout method" links target.
 */
export function PayoutMethodCard() {
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading")
  const [saved, setSaved] = useState<SavedPayout | null>(null)
  const [editing, setEditing] = useState(false)

  const [type, setType] = useState<PayoutType>("mobile_money")
  const [accountName, setAccountName] = useState("")
  const [accountNumber, setAccountNumber] = useState("")
  const [network, setNetwork] = useState("")
  const [bankCode, setBankCode] = useState("")
  const [errors, setErrors] = useState<Partial<Record<FieldKey, string>>>({})
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" })
  const [confirmed, setConfirmed] = useState(false)
  /** Bumped by "Try again" to re-run a lookup for the same number. */
  const [lookupAttempt, setLookupAttempt] = useState(0)

  // Earnings that are waiting on this method (statement stage "needs_action"):
  // never sent because there was no method, or a transfer that failed.
  const [waiting, setWaiting] = useState<{ amount: string; count: number; reason: string | null; failed: boolean } | null>(
    null,
  )

  // B6: the bank list, fetched the first time "Bank account" is shown.
  const [banks, setBanks] = useState<Bank[]>([])
  const [banksState, setBanksState] = useState<"idle" | "loading" | "error" | "ready">("idle")
  const loadBanks = useCallback(() => {
    setBanksState("loading")
    getBanks()
      .then((list) => {
        setBanks(Array.isArray(list) ? list : [])
        setBanksState("ready")
      })
      .catch(() => setBanksState("error"))
  }, [])

  const cardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoadState("loading")
    try {
      const profile = await apiFetch<ProfilePayoutFields>("/users/me/artisan-profile", { cache: "no-store" })
      const fromProfile = savedFromProfile(profile)
      if (fromProfile) {
        setSaved(fromProfile)
        setEditing(false)
      } else {
        setSaved(null)
        setEditing(true)
      }
      setLoadState("ready")
    } catch {
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    void load()
    getEarningsStatement({ period: "all", stage: "needs_action", page: 1, limit: 100 })
      .then(({ data }) => {
        const count = data.balances.needsActionCount
        if (!count) return
        const failed = data.items.some((i) => i.failureReason === "transfer_failed")
        setWaiting({
          amount: data.balances.needsAction,
          count,
          failed,
          reason: failureReasonText(failed ? "transfer_failed" : "no_payout_method"),
        })
      })
      .catch(() => {})
  }, [load])

  useEffect(() => {
    if (editing && type === "bank" && banksState === "idle") loadBanks()
  }, [editing, type, banksState, loadBanks])

  // The code and number the lookup runs on, and the key a result belongs to.
  const lookupCode =
    type === "mobile_money" ? (MOMO_NETWORKS.find((n) => n.value === network)?.payoutCode ?? "") : bankCode.trim()
  const lookupNumber = normaliseNumber(type, accountNumber)
  const lookupKey = lookupReady(type, lookupNumber, lookupCode) ? `${type}|${lookupCode}|${lookupNumber}` : ""

  // Look the account name up once the number is complete and typing pauses.
  // A change of number, network or bank cancels the request in flight, so
  // only the latest number's result is ever shown.
  useEffect(() => {
    setConfirmed(false)
    if (!editing || !lookupKey) {
      setLookup({ state: "idle" })
      return
    }
    setLookup({ state: "idle" })
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLookup({ state: "loading", key: lookupKey })
      resolvePayoutAccount({ type, accountNumber: lookupNumber, bankCode: lookupCode }, controller.signal)
        .then(({ accountName: name }) => {
          if (controller.signal.aborted) return
          setLookup(
            name?.trim()
              ? { state: "found", key: lookupKey, name: name.trim() }
              : { state: "unavailable", key: lookupKey, message: UNAVAILABLE_MESSAGE },
          )
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const status = err instanceof ApiError ? err.status : 0
          if (status === 422 || status === 400) {
            setLookup({
              state: "not_found",
              key: lookupKey,
              message: status === 422 || !(err instanceof Error) || !err.message ? NOT_FOUND_MESSAGE : err.message,
            })
          } else {
            setLookup({
              state: "unavailable",
              key: lookupKey,
              message: status === 429 ? RATE_LIMITED_MESSAGE : UNAVAILABLE_MESSAGE,
            })
          }
        })
    }, LOOKUP_DEBOUNCE_MS)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
    // `type`, `lookupNumber` and `lookupCode` are all inside `lookupKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing, lookupKey, lookupAttempt])

  // A result for another number is never shown.
  const current: Lookup = lookup.state !== "idle" && lookup.key === lookupKey ? lookup : { state: "idle" }

  // Land on the card when the URL carries the anchor (links from Earnings and
  // job pages). Runs once the card has content to scroll to.
  useEffect(() => {
    if (loadState !== "ready" || typeof window === "undefined") return
    if (window.location.hash !== `#${PAYOUT_METHOD_ANCHOR}`) return
    cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
    const first = document.getElementById(saved && !editing ? "payout-change" : FIELD_ID.accountNumber)
    first?.focus({ preventScroll: true })
  }, [loadState, saved, editing])

  const startEditing = () => {
    if (saved) {
      setType(saved.type)
      setAccountName(saved.accountName)
      setNetwork(saved.type === "mobile_money" ? (networkFor(saved)?.value ?? "") : "")
      setBankCode(saved.type === "bank" ? saved.bankCode : "")
    }
    // The full number is never sent back by the API, so it is always retyped.
    setAccountNumber("")
    setErrors({})
    setSaveError(null)
    setConfirmed(false)
    setEditing(true)
  }

  const cancel = () => {
    setErrors({})
    setSaveError(null)
    setEditing(false)
  }

  const clearError = (key: FieldKey) => {
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e))
    setSaveError(null)
  }

  const save = async () => {
    const next = validate(type, { accountName, accountNumber, network, bankCode }, current, confirmed)
    setErrors(next)
    const firstInvalid = FIELD_ORDER.find((k) => next[k])
    if (firstInvalid) {
      const el =
        firstInvalid === "network"
          ? document.querySelector<HTMLElement>(`#${FIELD_ID.network} [role=radio]`)
          : document.getElementById(FIELD_ID[firstInvalid])
      el?.focus()
      return
    }
    // The looked-up name, or the typed one when the lookup is unavailable.
    // The server looks the name up again and stores its own result.
    const name = current.state === "found" ? current.name : accountName.trim()
    setIsSaving(true)
    setSaveError(null)
    try {
      const result = await savePayoutMethod({
        type,
        accountNumber: lookupNumber,
        bankCode: lookupCode,
        ...(name ? { accountName: name } : {}),
      })
      setSaved({
        type,
        accountName: result?.accountName?.trim() || name,
        label:
          type === "mobile_money"
            ? (MOMO_NETWORKS.find((n) => n.value === network)?.label ?? "Mobile money")
            : (banks.find((b) => b.code === lookupCode)?.name ?? "Bank account"),
        last4: lookupNumber.slice(-4),
        bankCode: lookupCode,
        accountNameVerified: result?.accountNameVerified === true,
      })
      setEditing(false)
      toast.success("Payout method saved")
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 422) {
        // The server's own lookup found no account: show it on the number.
        setLookup({ state: "not_found", key: lookupKey, message: NOT_FOUND_MESSAGE })
        setErrors({ accountNumber: NOT_FOUND_MESSAGE })
        document.getElementById(FIELD_ID.accountNumber)?.focus()
      } else if (status === 400 && current.state === "found") {
        // The server's lookup was unavailable and needs a typed name.
        setLookup({ state: "unavailable", key: lookupKey, message: UNAVAILABLE_MESSAGE })
        setAccountName(name)
        setSaveError("We couldn’t confirm the name just now. Check the name below, then save again.")
      } else {
        setSaveError(err instanceof Error && err.message ? err.message : "Couldn’t save your payout method. Try again.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  const waitingNote = waiting && (
    <p
      className={cn(
        "flex items-start gap-2 rounded-lg px-3.5 py-3 text-[13px] leading-relaxed",
        waiting.failed ? "bg-destructive/[0.06] text-foreground" : "bg-warning/10 text-foreground",
      )}
    >
      <AlertTriangle
        className={cn("mt-0.5 h-4 w-4 shrink-0", waiting.failed ? "text-destructive" : "text-warning")}
        aria-hidden="true"
      />
      <span className="min-w-0">
        <span className="block font-medium">
          {formatCurrency(waiting.amount)} is waiting to be sent to you
          {waiting.count > 1 ? ` from ${waiting.count} jobs` : ""}.
        </span>
        {saved ? <span className="block">{waiting.reason}</span> : null}
        {saved && !editing ? (
          <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
            {waiting.failed ? (
              <button
                type="button"
                onClick={startEditing}
                className={cn("min-h-11 font-medium underline decoration-foreground/30 underline-offset-4 sm:min-h-0", SETTINGS_FOCUS_RING)}
              >
                Update payout details
              </button>
            ) : null}
            <Link
              href="/dashboard/artisan/earnings?stage=needs_action"
              className={cn("inline-flex min-h-11 items-center font-medium underline decoration-foreground/30 underline-offset-4 sm:min-h-0", SETTINGS_FOCUS_RING)}
            >
              Retry from Earnings
            </Link>
          </span>
        ) : (
          <span className="block">
            {saved ? "Save your updated details below, then retry from Earnings." : "Add a payout method below so we can send it."}
          </span>
        )}
      </span>
    </p>
  )

  return (
    <div
      id={PAYOUT_METHOD_ANCHOR}
      ref={cardRef}
      className="@container scroll-mt-24 overflow-hidden rounded-xl border bg-card"
    >
      <SettingsRow
        first
        title="Payout method"
        description="Where we send your earnings for completed jobs."
        titleId="payout-method-title"
      >
        {loadState === "loading" ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading payout method">
            <Skeleton className="h-[72px] w-full rounded-xl" />
            <Skeleton className="h-9 w-40" />
          </div>
        ) : loadState === "error" ? (
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              Couldn&apos;t load your payout method.
            </p>
            <Button variant="outline" className="max-sm:h-11" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : saved && !editing ? (
          <div className="space-y-4">
            <div className="flex flex-col gap-4 rounded-xl border p-4 @[34rem]/controls:flex-row @[34rem]/controls:items-center @[34rem]/controls:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                {saved.type === "mobile_money" && networkFor(saved) ? (
                  <NetworkMark network={networkFor(saved)!} className="h-10 w-10" />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted" aria-hidden="true">
                    <Landmark className="h-[18px] w-[18px]" />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground">{destinationLabel(saved)}</p>
                  <p dir="auto" className="text-sm text-muted-foreground [overflow-wrap:anywhere]">
                    {saved.accountName}
                  </p>
                  {saved.accountNameVerified ? (
                    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-medium text-foreground">
                      <BadgeCheck className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                      Verified name
                    </p>
                  ) : null}
                </div>
              </div>
              <Button id="payout-change" variant="outline" className="shrink-0 max-sm:h-11" onClick={startEditing}>
                Change payout method
              </Button>
            </div>
            {waitingNote ?? (
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                Ready to receive payouts.
              </p>
            )}
          </div>
        ) : (
          <form
            noValidate
            aria-label="Payout method"
            className="space-y-5"
            onSubmit={(e) => {
              e.preventDefault()
              void save()
            }}
          >
            {!saved && (
              <p className="text-sm text-foreground">
                You haven&apos;t added a payout method yet. Add one so we can send you your earnings.
              </p>
            )}
            {waitingNote}

            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm text-muted-foreground">Paid to</legend>
              <RadioGroupPrimitive.Root
                value={type}
                onValueChange={(v) => {
                  setType(v as PayoutType)
                  setErrors({})
                  setSaveError(null)
                }}
                disabled={isSaving}
                aria-label="Paid to"
                className="grid gap-3 @[34rem]/controls:grid-cols-2"
              >
                {TYPES.map((t) => {
                  const Icon = t.icon
                  return (
                    <RadioGroupPrimitive.Item
                      key={t.value}
                      value={t.value}
                      aria-labelledby={`payout-type-${t.value}-title`}
                      aria-describedby={`payout-type-${t.value}-body`}
                      className={cn(RADIO_TILE_CLASS, "items-start p-4")}
                    >
                      <span className="mt-2.5">
                        <RadioMark />
                      </span>
                      <span
                        aria-hidden="true"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted text-foreground group-data-[state=checked]:bg-primary group-data-[state=checked]:text-primary-foreground"
                      >
                        <Icon className="h-[18px] w-[18px]" />
                      </span>
                      <span className="min-w-0">
                        <span id={`payout-type-${t.value}-title`} className="block text-sm font-semibold text-foreground">
                          {t.title}
                        </span>
                        <span id={`payout-type-${t.value}-body`} className="mt-0.5 block text-[13px] leading-snug text-muted-foreground">
                          {t.body}
                        </span>
                      </span>
                    </RadioGroupPrimitive.Item>
                  )
                })}
              </RadioGroupPrimitive.Root>
            </fieldset>

            {type === "mobile_money" && (
              <fieldset className="space-y-2">
                <legend className={cn("mb-2 text-sm text-muted-foreground", errors.network && "text-destructive")}>
                  Network
                </legend>
                <RadioGroupPrimitive.Root
                  id={FIELD_ID.network}
                  value={network}
                  onValueChange={(v) => {
                    setNetwork(v)
                    clearError("network")
                  }}
                  disabled={isSaving}
                  aria-label="Network"
                  aria-invalid={errors.network ? true : undefined}
                  aria-describedby={errors.network ? fieldErrorId(FIELD_ID.network) : undefined}
                  className="grid gap-3 @[34rem]/controls:grid-cols-3"
                >
                  {MOMO_NETWORKS.map((n) => (
                    <RadioGroupPrimitive.Item key={n.value} value={n.value} className={RADIO_TILE_CLASS}>
                      <RadioMark />
                      <NetworkMark network={n} />
                      <span className="min-w-0 text-sm font-medium text-foreground">{n.label}</span>
                    </RadioGroupPrimitive.Item>
                  ))}
                </RadioGroupPrimitive.Root>
                {errors.network && <FieldError id={fieldErrorId(FIELD_ID.network)}>{errors.network}</FieldError>}
              </fieldset>
            )}

            <div className="grid gap-5 @[34rem]/controls:grid-cols-2">
              {type === "bank" && (
                <FormField id={FIELD_ID.bankCode} label="Bank" error={errors.bankCode}>
                  {(control) => (
                    <BankPicker
                      id={control.id}
                      invalid={control["aria-invalid"]}
                      describedBy={control["aria-describedby"]}
                      banks={banks}
                      status={banksState === "idle" ? "loading" : banksState}
                      onRetry={loadBanks}
                      value={bankCode}
                      disabled={isSaving}
                      onChange={(code) => {
                        setBankCode(code)
                        clearError("bankCode")
                        clearError("accountNumber")
                      }}
                    />
                  )}
                </FormField>
              )}
              <FormField
                id={FIELD_ID.accountNumber}
                label={type === "mobile_money" ? "Mobile money number" : "Account number"}
                error={errors.accountNumber ?? (current.state === "not_found" ? current.message : undefined)}
                hint={saved ? "Type the full number again to change it." : undefined}
              >
                {(control) => (
                  <Input
                    {...control}
                    className="max-sm:h-11"
                    inputMode="numeric"
                    autoComplete="off"
                    placeholder={type === "mobile_money" ? "0241234567" : undefined}
                    value={accountNumber}
                    disabled={isSaving}
                    onChange={(e) => {
                      setAccountNumber(e.target.value.replace(/\s+/g, ""))
                      clearError("accountNumber")
                      clearError("confirm")
                    }}
                  />
                )}
              </FormField>
            </div>

            {/* The lookup's progress and result, announced politely. */}
            <div aria-live="polite" className="space-y-3">
              {current.state === "loading" && (
                <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
                  Looking up the account name…
                </p>
              )}
              {current.state === "found" && (
                <div className="space-y-3 rounded-xl border p-4">
                  <p className="flex items-start gap-2 text-sm text-foreground">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                    <span className="min-w-0">
                      <span className="text-muted-foreground">Name on this account: </span>
                      <span dir="auto" className="font-semibold [overflow-wrap:anywhere]">
                        {current.name}
                      </span>
                    </span>
                  </p>
                  <div className="space-y-1.5">
                    <label
                      htmlFor={FIELD_ID.confirm}
                      className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground sm:min-h-0"
                    >
                      <Checkbox
                        id={FIELD_ID.confirm}
                        checked={confirmed}
                        disabled={isSaving}
                        aria-invalid={errors.confirm ? true : undefined}
                        aria-describedby={errors.confirm ? fieldErrorId(FIELD_ID.confirm) : undefined}
                        onCheckedChange={(v) => {
                          setConfirmed(v === true)
                          clearError("confirm")
                        }}
                      />
                      This is my account
                    </label>
                    {errors.confirm && <FieldError id={fieldErrorId(FIELD_ID.confirm)}>{errors.confirm}</FieldError>}
                  </div>
                </div>
              )}
              {current.state === "unavailable" && (
                <div className="space-y-4">
                  <p className="flex items-start gap-2 text-[13px] text-foreground">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                    <span className="min-w-0">
                      {current.message}{" "}
                      <button
                        type="button"
                        onClick={() => setLookupAttempt((n) => n + 1)}
                        disabled={isSaving}
                        className={cn(
                          "inline-flex min-h-11 items-center font-medium underline decoration-foreground/30 underline-offset-4 sm:min-h-0",
                          SETTINGS_FOCUS_RING,
                        )}
                      >
                        Try the lookup again
                      </button>
                    </span>
                  </p>
                  <FormField
                    id={FIELD_ID.accountName}
                    label="Name on the account"
                    error={errors.accountName}
                    className="@[34rem]/controls:max-w-[calc(50%-0.625rem)]"
                  >
                    {(control) => (
                      <Input
                        {...control}
                        className="max-sm:h-11"
                        autoComplete="name"
                        value={accountName}
                        disabled={isSaving}
                        onChange={(e) => {
                          setAccountName(e.target.value)
                          clearError("accountName")
                        }}
                      />
                    )}
                  </FormField>
                </div>
              )}
            </div>

            {saveError && (
              <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{saveError}</span>
              </p>
            )}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              {saved && (
                <Button type="button" variant="ghost" className="max-sm:h-11" onClick={cancel} disabled={isSaving}>
                  Cancel
                </Button>
              )}
              <Button
                type="submit"
                className="max-sm:h-11"
                disabled={isSaving || current.state === "loading" || current.state === "not_found"}
              >
                {isSaving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                Save payout method
              </Button>
            </div>
          </form>
        )}
      </SettingsRow>
    </div>
  )
}
