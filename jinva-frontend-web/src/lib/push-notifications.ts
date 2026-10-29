"use client"

import { initializeApp, getApp, getApps, type FirebaseApp } from "firebase/app"
import {
  deleteToken,
  getMessaging,
  getToken,
  isSupported,
  onMessage,
  type Messaging,
} from "firebase/messaging"
import { toast } from "sonner"
import { apiFetch } from "@/lib/api"

/**
 * PN1 — browser push registration.
 *
 * The backend has always exposed `POST /push/register` and
 * `POST /push/unregister`; nothing in the frontend called either, so no device
 * token ever reached FCM and push was unreachable in production regardless of
 * how the backend was configured. This module is the missing caller.
 *
 * Everything here is best-effort by design (requirements.md PN3): if the
 * browser can't do push, the user denies permission, or the Firebase project
 * isn't configured, every function resolves quietly and the app carries on
 * with in-app and email delivery untouched. Nothing retry-loops.
 *
 * ── Required environment variables ──────────────────────────────────────────
 * All are standard, public Firebase web-app config values (they ship in the
 * client bundle by design — they are not secrets):
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *   NEXT_PUBLIC_FIREBASE_VAPID_KEY  (Web Push certificate key pair, from
 *                                    Firebase console -> Cloud Messaging)
 * With any of these missing, `isPushConfigured()` is false and push stays off.
 *
 * The backend side additionally needs PUSH_PROVIDER=fcm plus its own
 * FIREBASE_* service-account values, pointing at the SAME Firebase project as
 * the config above — otherwise tokens registered here are never delivered to
 * (requirements.md PN2, a deploy-time confirmation, not a code change).
 */

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY

const SW_PATH = "/firebase-messaging-sw.js"

/** Last token we successfully registered, so logout knows what to unregister. */
const TOKEN_CACHE_KEY = "jinva:push-token"

export type PushRegistrationResult =
  | { status: "registered"; token: string }
  | { status: "denied" }
  | { status: "unsupported" }
  | { status: "unconfigured" }
  | { status: "failed" }

export function isPushConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey &&
      firebaseConfig.projectId &&
      firebaseConfig.messagingSenderId &&
      firebaseConfig.appId &&
      VAPID_KEY,
  )
}

export function isPushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "Notification" in window &&
    "serviceWorker" in navigator &&
    "PushManager" in window
  )
}

/** `"granted" | "denied" | "default"`, or null where the API doesn't exist. */
export function getPermissionState(): NotificationPermission | null {
  if (!isPushSupported()) return null
  return Notification.permission
}

function readCachedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_CACHE_KEY)
  } catch {
    return null
  }
}

function writeCachedToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_CACHE_KEY, token)
    else localStorage.removeItem(TOKEN_CACHE_KEY)
  } catch {
    // Private-mode / storage-disabled browsers still get push for this session;
    // they just can't unregister precisely on logout.
  }
}

function getFirebaseApp(): FirebaseApp {
  return getApps().length ? getApp() : initializeApp(firebaseConfig)
}

let messagingInstance: Messaging | null = null

async function getMessagingInstance(): Promise<Messaging | null> {
  if (messagingInstance) return messagingInstance
  if (!(await isSupported().catch(() => false))) return null
  messagingInstance = getMessaging(getFirebaseApp())
  return messagingInstance
}

/**
 * Registers the FCM service worker, passing the Firebase web config on the URL
 * because a /public file can't read build-time env vars. See the header
 * comment in public/firebase-messaging-sw.js.
 */
async function registerMessagingServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (!isPushSupported()) return null
  const query = new URLSearchParams({
    apiKey: firebaseConfig.apiKey ?? "",
    authDomain: firebaseConfig.authDomain ?? "",
    projectId: firebaseConfig.projectId ?? "",
    storageBucket: firebaseConfig.storageBucket ?? "",
    messagingSenderId: firebaseConfig.messagingSenderId ?? "",
    appId: firebaseConfig.appId ?? "",
  })
  try {
    return await navigator.serviceWorker.register(`${SW_PATH}?${query.toString()}`, { scope: "/" })
  } catch {
    return null
  }
}

/**
 * Obtains an FCM token and hands it to `POST /push/register`.
 *
 * @param promptIfNeeded when false, an undecided permission state is left
 *   alone rather than prompting — used by the silent on-load path so the app
 *   never throws a permission dialog at someone who just opened a dashboard.
 */
export async function registerPushToken(promptIfNeeded = true): Promise<PushRegistrationResult> {
  if (!isPushSupported()) return { status: "unsupported" }
  if (!isPushConfigured()) return { status: "unconfigured" }

  let permission = Notification.permission
  if (permission === "default") {
    if (!promptIfNeeded) return { status: "denied" }
    try {
      permission = await Notification.requestPermission()
    } catch {
      return { status: "failed" }
    }
  }
  // A denied permission is a terminal, respected answer — never re-prompted in
  // a loop. The browser itself only lets the user undo this from site settings.
  if (permission !== "granted") return { status: "denied" }

  try {
    const messaging = await getMessagingInstance()
    if (!messaging) return { status: "unsupported" }

    const registration = await registerMessagingServiceWorker()
    if (!registration) return { status: "failed" }

    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    })
    if (!token) return { status: "failed" }

    await apiFetch("/push/register", {
      method: "POST",
      body: JSON.stringify({ token, platform: "web" }),
    })
    writeCachedToken(token)
    return { status: "registered", token }
  } catch {
    return { status: "failed" }
  }
}

/**
 * Tells the backend to forget this device's token, then deletes it locally.
 *
 * Called on logout so a shared or public browser doesn't keep receiving the
 * previous account's pushes (requirements.md PN1, and the "stale/shared device
 * tokens" edge case). Deliberately swallows every failure — a logout must
 * never be blocked by push cleanup.
 */
export async function unregisterPushToken(): Promise<void> {
  const cached = readCachedToken()
  writeCachedToken(null)

  if (cached) {
    try {
      await apiFetch("/push/unregister", {
        method: "POST",
        body: JSON.stringify({ token: cached }),
      })
    } catch {
      // Backend already prunes tokens FCM reports as dead, so a missed
      // unregister degrades rather than breaks.
    }
  }

  try {
    const messaging = await getMessagingInstance()
    if (messaging) await deleteToken(messaging)
  } catch {
    // Nothing to delete, or the SDK isn't usable here.
  }
}

/**
 * Reacts to the user flipping the "Push Notifications" channel toggle in
 * Settings — the one place in the app where asking for browser permission is
 * something the user actually requested.
 *
 * Turning it on prompts for permission and registers the token; turning it off
 * unregisters this device. The preference itself is still saved either way by
 * the Settings page's own Save handler, so a blocked browser doesn't trap the
 * user's choice — once they unblock the site, PushSync picks the token up on
 * the next load.
 */
export async function applyPushPreference(enabled: boolean): Promise<void> {
  if (!enabled) {
    await unregisterPushToken()
    return
  }

  const result = await registerPushToken(true)
  switch (result.status) {
    case "registered":
      toast.success("Push notifications enabled on this device.")
      break
    case "denied":
      toast.error(
        "Push notifications are blocked for this site. Allow them in your browser's site settings to receive alerts.",
      )
      break
    case "unsupported":
      toast.error("This browser doesn't support push notifications.")
      break
    case "unconfigured":
    case "failed":
      toast.error("Couldn't enable push notifications on this device.")
      break
  }
}

/**
 * Foreground messages: FCM does not display a system notification while the
 * tab is focused, so surface it through the app's existing toast idiom.
 * Returns an unsubscribe function, or null when push isn't available.
 */
export async function listenForForegroundPush(
  onPush: (title: string, body: string) => void,
): Promise<(() => void) | null> {
  if (!isPushSupported() || !isPushConfigured()) return null
  if (Notification.permission !== "granted") return null
  try {
    const messaging = await getMessagingInstance()
    if (!messaging) return null
    return onMessage(messaging, (payload) => {
      const title = payload.notification?.title ?? payload.data?.title
      const body = payload.notification?.body ?? payload.data?.body ?? ""
      if (title) onPush(title, body)
    })
  } catch {
    return null
  }
}
