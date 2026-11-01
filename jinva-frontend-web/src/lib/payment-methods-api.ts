import { apiFetch } from "@/lib/api"
import type { ChargeResult, MomoCode, PaymentMethodList, SavedPaymentMethod } from "@/lib/saved-payment-methods"

/**
 * The customer's saved payment methods and paying with one. Every call is
 * `no-store`. No request here ever carries a PIN: mobile money payments are
 * approved on the customer's phone, and the only code sent is Telecel's
 * one-time code (`submitChargeOtp`).
 */
const NO_STORE = { cache: "no-store" as const }

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

/** `POST /payments/:jobId/charge`: pay with a saved method. A repeat while one is pending returns the same reference. */
export function chargeWithSavedMethod(jobId: number, paymentMethodId: number): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/${encodeURIComponent(String(jobId))}/charge`, {
    ...NO_STORE,
    method: "POST",
    body: JSON.stringify({ paymentMethodId }),
  })
}

/** `POST /payments/charges/:reference/otp`: Telecel's one-time code (never a PIN). */
export function submitChargeOtp(reference: string, otp: string): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/charges/${encodeURIComponent(reference)}/otp`, {
    ...NO_STORE,
    method: "POST",
    body: JSON.stringify({ otp }),
  })
}

export function getChargeStatus(reference: string, signal?: AbortSignal): Promise<ChargeResult> {
  return apiFetch<ChargeResult>(`/payments/charges/${encodeURIComponent(reference)}/status`, { ...NO_STORE, signal })
}
