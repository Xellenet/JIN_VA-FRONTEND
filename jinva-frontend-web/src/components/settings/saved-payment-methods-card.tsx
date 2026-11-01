"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import * as RadioGroupPrimitive from "@radix-ui/react-radio-group"
import { AlertTriangle, CheckCircle2, CreditCard, Loader2, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Checkbox } from "@/components/ui/checkbox"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { FormField } from "@/components/forms/form-field"
import { PaymentMethodMark } from "@/components/payments/payment-method-mark"
import { ApiError } from "@/lib/api"
import {
  addMobileMoney,
  getPaymentMethods,
  makeDefaultPaymentMethod,
  removePaymentMethod,
  resolveMomoName,
} from "@/lib/payment-methods-api"
import {
  checkAccountNumber,
  lookupFor,
  lookupKeyFor,
  normaliseAccountNumber,
  numberIssueMessage,
  type Lookup,
} from "@/lib/payout-rules"
import {
  NETWORK_KEY_TO_CODE,
  customerMomoSaveState,
  isUsable,
  methodDetail,
  methodSummary,
  methodTitle,
  sortMethods,
  type PaymentMethodList,
  type SavedPaymentMethod,
} from "@/lib/saved-payment-methods"
import { cn } from "@/lib/utils"
import { MOMO_NETWORKS, NetworkMark, RADIO_TILE_CLASS, RadioMark, SETTINGS_FOCUS_RING, SettingsRow } from "./settings-row"

/** How long typing must pause before the name is looked up (same as the payout form). */
const LOOKUP_DEBOUNCE_MS = 500

const NOT_FOUND_MESSAGE = "We couldn’t find a wallet with this number on this network. Check both and try again."
const UNAVAILABLE_MESSAGE = "We can’t check the name on this number right now. Try again in a few minutes."
const RATE_LIMITED_MESSAGE = "You’ve looked up several numbers in a short time. Wait a few minutes, then try again."

const FIELD_ID = {
  network: "saved-momo-network",
  number: "saved-momo-number",
  confirm: "saved-momo-confirm",
  saveHint: "saved-momo-save-hint",
} as const

type MomoKey = keyof typeof NETWORK_KEY_TO_CODE

/**
 * Settings → Payments: the customer's saved payment methods. Mobile money
 * numbers are added here with the name on the wallet (looked up, never
 * typed). Cards are only ever saved after a card payment, when the customer
 * ticks "Save this card for next time". No PIN, card number or CVV is asked
 * for anywhere.
 */
export function SavedPaymentMethodsCard({ editable }: Readonly<{ editable: boolean }>) {
  const [loadState, setLoadState] = useState<"loading" | "error" | "ready">("loading")
  const [list, setList] = useState<PaymentMethodList | null>(null)
  const [adding, setAdding] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [rowError, setRowError] = useState<string | null>(null)
  const [toRemove, setToRemove] = useState<SavedPaymentMethod | null>(null)
  const addButtonRef = useRef<HTMLButtonElement>(null)

  const load = useCallback(async (signal?: AbortSignal) => {
    setLoadState("loading")
    try {
      const next = await getPaymentMethods(signal)
      setList(next)
      setLoadState("ready")
    } catch (err) {
      if (signal?.aborted || (err instanceof DOMException && err.name === "AbortError")) return
      setLoadState("error")
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    void load(controller.signal)
    return () => controller.abort()
  }, [load])

  const methods = list ? sortMethods(list.methods) : []
  const full = !!list && methods.length >= list.maxMethods
  const canAdd = editable && !!list?.canSave && !full

  const makeDefault = async (m: SavedPaymentMethod) => {
    setBusyId(m.id)
    setRowError(null)
    try {
      setList(await makeDefaultPaymentMethod(m.id))
      toast.success(`${methodTitle(m)} is now your default`)
    } catch (err) {
      setRowError(err instanceof Error && err.message ? err.message : "Couldn’t change your default. Try again.")
    } finally {
      setBusyId(null)
    }
  }

  const confirmRemove = async () => {
    const m = toRemove
    if (!m) return
    setToRemove(null)
    setBusyId(m.id)
    setRowError(null)
    try {
      setList(await removePaymentMethod(m.id))
      toast.success(`${methodTitle(m)} removed`)
      addButtonRef.current?.focus()
    } catch (err) {
      setRowError(err instanceof Error && err.message ? err.message : "Couldn’t remove this payment method. Try again.")
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="@container overflow-hidden rounded-xl border bg-card">
      <SettingsRow
        first
        title="Saved payment methods"
        description="Pay for a job without typing your details again."
        titleId="saved-methods-title"
      >
        {loadState === "loading" ? (
          <div className="space-y-3" aria-busy="true" aria-label="Loading saved payment methods">
            <Skeleton className="h-[72px] w-full rounded-xl" />
            <Skeleton className="h-9 w-56" />
          </div>
        ) : loadState === "error" || !list ? (
          <div className="flex flex-col items-start gap-3">
            <p className="flex items-start gap-2 text-sm text-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
              Couldn&apos;t load your saved payment methods. You can still pay as usual.
            </p>
            <Button variant="outline" className="max-sm:h-11" onClick={() => void load()}>
              Try again
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {methods.length === 0 ? (
              <p className="text-sm text-foreground">
                You haven&apos;t saved a payment method yet.
              </p>
            ) : (
              <ul className="divide-y rounded-xl border" aria-label="Your saved payment methods">
                {methods.map((m) => {
                  const busy = busyId === m.id
                  return (
                    <li
                      key={m.id}
                      aria-label={methodSummary(m)}
                      className="flex flex-col gap-3 p-4 @[34rem]/controls:flex-row @[34rem]/controls:items-center @[34rem]/controls:justify-between"
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <PaymentMethodMark method={m} className="h-10 w-10" />
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm font-semibold text-foreground">
                            <span className="tabular-nums">{methodTitle(m)}</span>
                            {m.isDefault && (
                              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/[0.06] px-2 py-0.5 text-xs font-medium text-foreground">
                                <CheckCircle2 className="h-3 w-3 text-primary" aria-hidden="true" />
                                Default
                              </span>
                            )}
                          </p>
                          <p
                            dir="auto"
                            className={cn(
                              "text-sm [overflow-wrap:anywhere]",
                              m.card?.expired ? "font-medium text-destructive" : "text-muted-foreground",
                            )}
                          >
                            {m.card?.expired ? (
                              <AlertTriangle className="mr-1 inline h-3.5 w-3.5 align-[-2px]" aria-hidden="true" />
                            ) : null}
                            {methodDetail(m)}
                            {m.card?.bank ? <span className="text-muted-foreground"> · {m.card.bank}</span> : null}
                          </p>
                        </div>
                      </div>
                      {editable && (
                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                          {!m.isDefault && isUsable(m) && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="max-sm:h-11"
                              disabled={busy}
                              onClick={() => void makeDefault(m)}
                              aria-label={`Make ${methodTitle(m)} your default`}
                            >
                              {busy && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
                              Make default
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive max-sm:h-11"
                            disabled={busy}
                            onClick={() => setToRemove(m)}
                            aria-label={`Remove ${methodTitle(m)}`}
                          >
                            Remove
                          </Button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}

            {rowError && (
              <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>{rowError}</span>
              </p>
            )}

            {!list.canSave ? (
              <p className="flex items-start gap-2 text-[13px] text-muted-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
                Saving payment methods isn&apos;t available right now. You can still pay as usual.
              </p>
            ) : adding ? (
              <AddMobileMoneyForm
                full={full}
                onCancel={() => {
                  setAdding(false)
                  requestAnimationFrame(() => addButtonRef.current?.focus())
                }}
                onSaved={(saved) => {
                  setList((l) => (l ? { ...l, methods: [...l.methods.map((x) => (saved.isDefault ? { ...x, isDefault: false } : x)), saved] } : l))
                  setAdding(false)
                  toast.success(`${methodTitle(saved)} saved`)
                  requestAnimationFrame(() => addButtonRef.current?.focus())
                }}
              />
            ) : editable ? (
              <div className="flex flex-col items-start gap-1">
                <Button ref={addButtonRef} variant="outline" className="max-sm:h-11" disabled={!canAdd} onClick={() => setAdding(true)}>
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  Add mobile money number
                </Button>
                {full && (
                  <p className="text-[13px] text-muted-foreground">
                    You can save up to {list.maxMethods} payment methods. Remove one to add another.
                  </p>
                )}
              </div>
            ) : null}

            <div className="space-y-2 rounded-lg bg-muted/60 px-3.5 py-3 text-[13px] leading-relaxed text-foreground">
              <p className="flex items-start gap-2">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
                <span>We never ask for your PIN. You&apos;ll approve each payment on your phone.</span>
              </p>
              <p className="flex items-start gap-2 text-muted-foreground">
                <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  Cards are saved only after you pay by card and tick &ldquo;Save this card for next time&rdquo;. We keep a
                  secure token from Paystack, never your card number or CVV.
                </span>
              </p>
            </div>
          </div>
        )}
      </SettingsRow>

      <AlertDialog open={!!toRemove} onOpenChange={(open) => !open && setToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this payment method?</AlertDialogTitle>
            <AlertDialogDescription>
              {toRemove ? `${methodTitle(toRemove)} will no longer be offered when you pay. ` : ""}
              You can add it again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="max-sm:h-11">Keep it</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90 max-sm:h-11"
              onClick={() => void confirmRemove()}
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

/**
 * Network, number, the looked-up name (read only) and "This is my account".
 * Uses the payout form's number rules (`payout-rules.ts`): a 10-digit Ghana
 * mobile number with any network's prefix, since numbers can be ported.
 */
function AddMobileMoneyForm({
  full,
  onCancel,
  onSaved,
}: Readonly<{ full: boolean; onCancel: () => void; onSaved: (m: SavedPaymentMethod) => void }>) {
  const [network, setNetwork] = useState<MomoKey | "">("")
  const [accountNumber, setAccountNumber] = useState("")
  const [touched, setTouched] = useState(false)
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" })
  const [lookupAttempt, setLookupAttempt] = useState(0)
  const [confirmed, setConfirmed] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const code = network ? NETWORK_KEY_TO_CODE[network] : ""
  const number = normaliseAccountNumber("mobile_money", accountNumber)
  const numberIssue = checkAccountNumber("mobile_money", network, number)
  const lookupKey = code && !numberIssue ? lookupKeyFor("mobile_money", code, number) : ""

  useEffect(() => {
    setConfirmed(false)
    setLookup({ state: "idle" })
    if (!lookupKey || !code) return
    const controller = new AbortController()
    const timer = window.setTimeout(() => {
      setLookup({ state: "loading", key: lookupKey })
      resolveMomoName({ network: code, accountNumber: number }, controller.signal)
        .then(({ accountName }) => {
          if (controller.signal.aborted) return
          setLookup(
            accountName?.trim()
              ? { state: "found", key: lookupKey, name: accountName.trim() }
              : { state: "unavailable", key: lookupKey, message: UNAVAILABLE_MESSAGE },
          )
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          const status = err instanceof ApiError ? err.status : 0
          if (status === 422 || status === 400) {
            setLookup({ state: "not_found", key: lookupKey, message: NOT_FOUND_MESSAGE })
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
    // `code` and `number` are inside `lookupKey`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lookupKey, lookupAttempt])

  const current = lookupFor(lookup, lookupKey)
  const saveState = customerMomoSaveState({
    hasNetwork: !!code,
    numberIssue,
    lookup: current,
    confirmed,
    isSaving,
    full,
  })

  const numberError =
    (current.state === "not_found" ? current.message : null) ??
    (numberIssue && (touched || numberIssue === "prefix") ? numberIssueMessage("mobile_money", network, numberIssue) : null)

  const save = async () => {
    if (!saveState.canSave || !code) return
    setIsSaving(true)
    setSaveError(null)
    try {
      onSaved(await addMobileMoney({ network: code, accountNumber: number }))
    } catch (err) {
      const status = err instanceof ApiError ? err.status : 0
      if (status === 422) {
        setLookup({ state: "not_found", key: lookupKey, message: NOT_FOUND_MESSAGE })
        document.getElementById(FIELD_ID.number)?.focus()
      } else if (status === 503) {
        setSaveError(err instanceof Error && err.message ? err.message : UNAVAILABLE_MESSAGE)
      } else {
        setSaveError(err instanceof Error && err.message ? err.message : "Couldn’t save this number. Try again.")
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form
      noValidate
      aria-label="Add mobile money number"
      className="space-y-5 rounded-xl border p-4"
      onSubmit={(e) => {
        e.preventDefault()
        void save()
      }}
    >
      <fieldset className="space-y-2">
        <legend className="mb-2 text-sm text-muted-foreground">Network</legend>
        <RadioGroupPrimitive.Root
          id={FIELD_ID.network}
          value={network}
          onValueChange={(v) => {
            setNetwork(v as MomoKey)
            setSaveError(null)
          }}
          disabled={isSaving}
          aria-label="Network"
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
      </fieldset>

      <FormField id={FIELD_ID.number} label="Mobile money number" error={numberError ?? undefined} className="@[34rem]/controls:max-w-[calc(50%-0.625rem)]">
        {(control) => (
          <Input
            {...control}
            className="max-sm:h-11"
            inputMode="numeric"
            autoComplete="tel-national"
            placeholder="0240000000"
            value={accountNumber}
            disabled={isSaving}
            onChange={(e) => {
              setAccountNumber(e.target.value.replace(/\s+/g, ""))
              setSaveError(null)
            }}
            onBlur={() => setTouched((t) => t || !!accountNumber)}
          />
        )}
      </FormField>

      <div aria-live="polite" className="space-y-3">
        {current.state === "loading" && (
          <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
            <Loader2 className="h-4 w-4 shrink-0 animate-spin motion-reduce:animate-none" aria-hidden="true" />
            Looking up the name on this number…
          </p>
        )}
        {current.state === "found" && (
          <div className="space-y-3 rounded-xl border p-4">
            <div className="space-y-1">
              <p className="text-[13px] text-muted-foreground" id="saved-momo-name-label">
                Name on this wallet
              </p>
              <p
                dir="auto"
                aria-labelledby="saved-momo-name-label"
                className="flex items-start gap-2 text-sm font-semibold text-foreground [overflow-wrap:anywhere]"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" aria-hidden="true" />
                {current.name}
              </p>
            </div>
            <label htmlFor={FIELD_ID.confirm} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm text-foreground sm:min-h-0">
              <Checkbox
                id={FIELD_ID.confirm}
                checked={confirmed}
                disabled={isSaving}
                onCheckedChange={(v) => {
                  setConfirmed(v === true)
                  setSaveError(null)
                }}
              />
              This is my account
            </label>
          </div>
        )}
        {current.state === "unavailable" && (
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
        )}
      </div>

      {saveError && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-destructive">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{saveError}</span>
        </p>
      )}

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="ghost" className="max-sm:h-11" onClick={onCancel} disabled={isSaving}>
          Cancel
        </Button>
        <Button
          type="submit"
          className="max-sm:h-11"
          disabled={!saveState.canSave}
          aria-describedby={saveState.reason ? FIELD_ID.saveHint : undefined}
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin motion-reduce:animate-none" aria-hidden="true" />}
          Save number
        </Button>
      </div>
      {saveState.reason && (
        <p id={FIELD_ID.saveHint} className="text-[13px] text-muted-foreground sm:text-right">
          {saveState.reason}
        </p>
      )}
    </form>
  )
}
