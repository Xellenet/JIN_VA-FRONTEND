import { apiFetch } from "@/lib/api"
import type { ChargeResult, MomoCode, PaymentMethodList, SavedPaymentMethod } from "@/lib/saved-payment-methods"
import { IDEMPOTENCY_HEADER, type JobPaymentState } from "@/lib/payment-intent"

/**
 * The customer's saved payment methods and paying with one. Every call is
 * `no-store`. No request here ever carries a PIN: mobile money payments are
 * approved on the customer's phone, and the only code sent is Telecel's
 * one-time code (`submitChargeOtp`).
 */
const NO_STORE = { cache: "no-store" as const }

/** The press's Idempotency-Key, when there is one (old callers send none). */
const keyHeader = (key?: string): Record<string, string> => (key ? { [IDEMPOTENCY_HEADER]: key } : {})

/** `GET /users/me/payment-methods`: masked details only. */
export function getPaymentMethods(signal?: AbortSignal): Promise<PaymentMethodList> {
  return apiFetch<PaymentMethodList>("/users/me/payment-methods", { ...NO_STORE, signal })
}

/** `POST /users/me/payment-methods/resolve`: the name on a wallet. 422 not found, 503 try later. */
export function resolveMomoName(
  input: { network: MomoCode; accountNumber: string },
  signal?: AbortSignal,
): Promise<{ accountName: string }> {
  return apiFetch<{ accountName: string }>("/users/me/payment-methods/resolve", {
    ...NO_STORE,
    method: "POST",
    body: JSON.stringify({ network: input.network, accountNumber: input.accountNumber }),
    signal,
  })
}

/** `POST /users/me/payment-methods/mobile-money`: the server looks the name up again and saves it. */
export function addMobileMoney(input: { network: MomoCode; accountNumber: string }): Promise<SavedPaymentMethod> {
  return apiFetch<SavedPaymentMethod>("/users/me/payment-methods/mobile-money", {
    ...NO_STORE,
    method: "POST",
    body: JSON.stringify({ network: input.network, accountNumber: input.accountNumber }),
  })
}

export function makeDefaultPaymentMethod(id: number): Promise<PaymentMethodList> {
  return apiFetch<PaymentMethodList>(`/users/me/payment-methods/${encodeURIComponent(String(id))}/default`, {
    ...NO_STORE,
    method: "PATCH",
  })
}

export function removePaymentMethod(id: number): Promise<PaymentMethodList> {
  return apiFetch<PaymentMethodList>(`/users/me/payment-methods/${encodeURIComponent(String(id))}`, {
    ...NO_STORE,
    method: "DELETE",
  })
}

/**
 * `POST /payments/:jobId/charge`: pay with a saved method. A repeat while one
 * is pending returns the same reference; the same `idempotencyKey` replays
 * the first answer. 409 PAYMENT_ATTEMPT_ACTIVE / ALREADY_PAID carry `data`.
 */
export function chargeWithSavedMethod(
  jobId: number,
  paymentMethodId: number,
  idempotencyKey?: string,
): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/${encodeURIComponent(String(jobId))}/charge`, {
    ...NO_STORE,
    method: "POST",
    headers: keyHeader(idempotencyKey),
    body: JSON.stringify({ paymentMethodId }),
  })
}

/** `POST /payments/charges/:reference/otp`: Telecel's one-time code (never a PIN). */
export function submitChargeOtp(reference: string, otp: string, idempotencyKey?: string): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/charges/${encodeURIComponent(reference)}/otp`, {
    ...NO_STORE,
    method: "POST",
    headers: keyHeader(idempotencyKey),
    body: JSON.stringify({ otp }),
  })
}

export interface InitializeResult {
  reference: string
  authorizationUrl: string
  accessCode: string
  amount: number
  currency: string
}

/** `POST /payments/initialize`: Paystack's page. While one is open, the same page comes back. */
export function initializeHostedPayment(
  input: { jobId: number; saveCard?: boolean },
  idempotencyKey?: string,
): Promise<InitializeResult> {
  return apiFetch<InitializeResult>("/payments/initialize", {
    ...NO_STORE,
    method: "POST",
    headers: keyHeader(idempotencyKey),
    body: JSON.stringify({ jobId: input.jobId, ...(input.saveCard ? { saveCard: true } : {}) }),
  })
}

/** `GET /payments/jobs/:jobId/attempt`: paid or not, any active attempt, refunded duplicates. */
export function getJobPaymentState(jobId: number, signal?: AbortSignal): Promise<JobPaymentState> {
  return apiFetch<JobPaymentState>(`/payments/jobs/${encodeURIComponent(String(jobId))}/attempt`, {
    ...NO_STORE,
    signal,
  })
}

export function getChargeStatus(reference: string, signal?: AbortSignal): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/charges/${encodeURIComponent(reference)}/status`, { ...NO_STORE, signal })
}
