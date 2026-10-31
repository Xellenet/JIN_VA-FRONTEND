"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Link from "next/link"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { AlertTriangle, CheckCircle2, Landmark, Loader2, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { FieldError } from "@/components/ui/field"
import { FormField, fieldErrorId } from "@/components/forms/form-field"
import { apiFetch } from "@/lib/api"
import { failureReasonText } from "@/lib/earnings"
import { getBanks, getEarningsStatement, type Bank, type PayoutDestination } from "@/lib/earnings-api"
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

/** The anchor "Add payout method" links land on: `/dashboard/artisan/settings?tab=payouts#payout-method`. */
export const PAYOUT_METHOD_ANCHOR = "payout-method"

type PayoutType = "mobile_money" | "bank"

interface SavedPayout {
  type: PayoutType
  accountName: string
  /** The network or bank name ("MTN MoMo", "GCB Bank Limited"). */
  label: string
  /** Last 4 digits only; the full number is never sent back by the API. */
  last4: string
  bankCode: string
}

interface ProfilePayoutFields {
  payoutType?: PayoutType | null
  payoutAccountName?: string | null
  payoutAccountNumber?: string | null
  payoutBankCode?: string | null
  /** B2: the masked destination, null when no payout method is set. */
  payoutDestination?: PayoutDestination | null
}

type FieldKey = "accountName" | "accountNumber" | "network" | "bankCode"

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
  }
}

function validate(
  type: PayoutType,
  values: { accountName: string; accountNumber: string; network: string; bankCode: string },
): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {}
  if (values.accountName.trim().length < 2) errors.accountName = "Enter the full name on the account."
  const digits = values.accountNumber.trim()
  if (type === "mobile_money") {
    if (!values.network) errors.network = "Choose your mobile money network."
    if (!/^0\d{9}$/.test(digits) && !/^\+?233\d{9}$/.test(digits))
      errors.accountNumber = "Enter your 10-digit mobile money number, like 0241234567."
  } else {
    if (!/^\d{8,20}$/.test(digits)) errors.accountNumber = "Enter your account number, digits only."
    if (!values.bankCode.trim()) errors.bankCode = "Choose your bank."
  }
  return errors
}

const FIELD_ORDER: FieldKey[] = ["accountName", "network", "accountNumber", "bankCode"]
const FIELD_ID: Record<FieldKey, string> = {
  accountName: "payout-account-name",
  network: "payout-network",
  accountNumber: "payout-account-number",
  bankCode: "payout-bank-code",
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

  // Land on the card when the URL carries the anchor (links from Earnings and
  // job pages). Runs once the card has content to scroll to.
  useEffect(() => {
    if (loadState !== "ready" || typeof window === "undefined") return
    if (window.location.hash !== `#${PAYOUT_METHOD_ANCHOR}`) return
    cardRef.current?.scrollIntoView({ block: "start", behavior: "smooth" })
    const first = document.getElementById(saved && !editing ? "payout-change" : FIELD_ID.accountName)
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
    const next = validate(type, { accountName, accountNumber, network, bankCode })
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
    const code =
      type === "mobile_money" ? (MOMO_NETWORKS.find((n) => n.value === network)?.payoutCode ?? "") : bankCode.trim()
    setIsSaving(true)
    setSaveError(null)
    try {
      await apiFetch("/payments/payout-method", {
        method: "POST",
        body: JSON.stringify({
          type,
          accountName: accountName.trim(),
          accountNumber: accountNumber.trim(),
          bankCode: code,
        }),
      })
      setSaved({
        type,
        accountName: accountName.trim(),
        label:
          type === "mobile_money"
            ? (MOMO_NETWORKS.find((n) => n.value === network)?.label ?? "Mobile money")
            : (banks.find((b) => b.code === code)?.name ?? "Bank account"),
        last4: accountNumber.trim().replace(/\D/g, "").slice(-4),
        bankCode: code,
      })
      setEditing(false)
      toast.success("Payout method saved")
    } catch (err) {
      setSaveError(err instanceof Error && err.message ? err.message : "Couldn’t save your payout method. Try again.")
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
              <FormField id={FIELD_ID.accountName} label="Name on the account" error={errors.accountName}>
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
              <FormField
                id={FIELD_ID.accountNumber}
                label={type === "mobile_money" ? "Mobile money number" : "Account number"}
                error={errors.accountNumber}
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
                    }}
                  />
                )}
              </FormField>
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
                      }}
                    />
                  )}
                </FormField>
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
              <Button type="submit" className="max-sm:h-11" disabled={isSaving}>
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
