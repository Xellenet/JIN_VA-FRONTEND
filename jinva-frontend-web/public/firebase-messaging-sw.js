/**
 * Firebase Cloud Messaging service worker — PN1.
 *
 * Handles pushes that arrive while no JinVa tab is focused. Foreground
 * messages are handled in-app by src/lib/push-notifications.ts instead.
 *
 * WHY THE CONFIG COMES FROM THE QUERY STRING: files in /public are served
 * verbatim and are never processed by the Next.js bundler, so `process.env`
 * does not exist in here and NEXT_PUBLIC_* values cannot be inlined. Rather
 * than hardcode a Firebase config into a committed file, the client passes it
 * on the registration URL (see registerMessagingServiceWorker()) and this
 * worker reads it back off its own location. Nothing secret is involved — a
 * Firebase web config is public by design and is already shipped in the client
 * bundle — this just keeps the values in one place: the environment.
 *
 * The SDK is loaded from gstatic rather than bundled because a /public file has
 * no build step. Keep this version aligned with the `firebase` dependency in
 * package.json.
 */
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js")

const params = new URL(self.location.href).searchParams

const firebaseConfig = {
  apiKey: params.get("apiKey") || "",
  authDomain: params.get("authDomain") || "",
  projectId: params.get("projectId") || "",
  storageBucket: params.get("storageBucket") || "",
  messagingSenderId: params.get("messagingSenderId") || "",
  appId: params.get("appId") || "",
}

// A deployment with no Firebase project configured must not throw on install —
// push simply stays unavailable, exactly as when a user denies permission.
if (firebaseConfig.projectId && firebaseConfig.messagingSenderId) {
  firebase.initializeApp(firebaseConfig)
  const messaging = firebase.messaging()

  messaging.onBackgroundMessage((payload) => {
    // Messages that carry a `notification` block are displayed by the FCM SDK
    // itself; showing them again here would double up. Only data-only messages
    // need a manual notification.
    if (payload.notification) return

    const data = payload.data || {}
    self.registration.showNotification(data.title || "JinVa", {
      body: data.body || "",
      icon: "/icon.svg",
      badge: "/icon.svg",
      tag: data.notificationId || undefined,
      data: { url: data.url || "/dashboard" },
    })
  })
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/dashboard"

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) {
          if ("navigate" in client) client.navigate(target)
          return client.focus()
        }
      }
      return self.clients.openWindow(target)
    }),
  )
})
