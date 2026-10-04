// Browser-side Web Push helpers shared by the Settings toggle and the
// post-install notification prompt.

export type PushFailureReason = 'denied' | 'dismissed' | 'unconfigured' | 'failed'

export type EnablePushResult =
  | { ok: true }
  | { ok: false; reason: PushFailureReason; error?: unknown }

export function isPushSupported() {
  // Android WebViews expose serviceWorker but not always Notification, so
  // check all three.
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export async function getExistingSubscription() {
  // Not `serviceWorker.ready`: that never resolves when no worker is
  // registered (e.g. registration failed), which would silently stall the
  // notification prompt. getRegistration() resolves to undefined instead.
  const registration = await navigator.serviceWorker.getRegistration('/')
  return registration ? registration.pushManager.getSubscription() : null
}

async function saveSubscription(subscription: PushSubscription) {
  const response = await fetch('/api/notifications/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })

  if (!response.ok) {
    throw new Error(`Server rejected the subscription (HTTP ${response.status})`)
  }
}

export function isPushConfigured() {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
}

/**
 * Ask for notification permission, subscribe this device to push and register
 * the subscription with the server. Must be called directly from a user
 * gesture (tap handler).
 */
export async function enablePush(): Promise<EnablePushResult> {
  if (!isPushConfigured()) return { ok: false, reason: 'unconfigured' }

  // Ask for permission FIRST, before any `await` that could outlive the tap.
  // Chrome and Firefox on Android require transient user activation for
  // requestPermission(); awaiting service worker registration beforehand
  // burns that activation and the prompt silently never appears. Safari on
  // iOS is lenient here, which is why this path only ever failed on Android.
  let permission: NotificationPermission
  try {
    permission = await Notification.requestPermission()
  } catch (error) {
    console.error('Error requesting notification permission:', error)
    return { ok: false, reason: 'failed', error }
  }

  if (permission !== 'granted') {
    return { ok: false, reason: permission === 'denied' ? 'denied' : 'dismissed' }
  }

  return subscribeDevice()
}

/**
 * Subscribe this device to push and register it with the server. Assumes
 * notification permission is already 'granted'.
 */
export async function subscribeDevice(): Promise<EnablePushResult> {
  const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  if (!vapidKey) return { ok: false, reason: 'unconfigured' }

  try {
    // Reuse an existing registration when there is one. register() resolves
    // before the worker activates, so `ready` is what we actually need.
    const registration =
      (await navigator.serviceWorker.getRegistration('/')) ||
      (await navigator.serviceWorker.register('/sw.js'))
    await navigator.serviceWorker.ready

    const applicationServerKey = urlBase64ToUint8Array(vapidKey)

    // Android Chrome keeps a push subscription alive across app restarts and
    // across VAPID key rotations. subscribe() throws InvalidStateError when a
    // live subscription was created with a different applicationServerKey, so
    // drop any stale one rather than letting the whole flow fail.
    const existing = await registration.pushManager.getSubscription()
    if (existing) {
      if (subscriptionUsesKey(existing, applicationServerKey)) {
        await saveSubscription(existing)
        return { ok: true }
      }
      console.log('[Push] Replacing subscription made with a stale VAPID key')
      await existing.unsubscribe()
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })

    await saveSubscription(subscription)
    return { ok: true }
  } catch (error) {
    console.error('Error subscribing to push:', error)
    return { ok: false, reason: 'failed', error }
  }
}

/** Ask the server to push a "you're all set" notification to this user's devices. */
export async function sendTestNotification() {
  try {
    await fetch('/api/notifications/test', { method: 'POST' })
  } catch (error) {
    // Purely a confirmation; the opt-in already succeeded without it.
    console.error('Error sending test notification:', error)
  }
}

export async function disablePush() {
  const subscription = await getExistingSubscription()
  if (!subscription) return

  await subscription.unsubscribe()
  await fetch(`/api/notifications/subscribe?endpoint=${encodeURIComponent(subscription.endpoint)}`, {
    method: 'DELETE',
  })
}

/**
 * Compare the key an existing subscription was created with against the key we
 * are about to subscribe with. `options.applicationServerKey` comes back as an
 * ArrayBuffer (the raw 65-byte uncompressed P-256 point), not the base64url
 * string we sent in, so this compares bytes.
 */
function subscriptionUsesKey(subscription: PushSubscription, key: Uint8Array) {
  const existingKey = subscription.options?.applicationServerKey
  if (!existingKey) return false

  const existingBytes = new Uint8Array(existingKey as ArrayBuffer)
  if (existingBytes.length !== key.length) return false

  return existingBytes.every((byte, i) => byte === key[i])
}

/**
 * Turn a push-setup failure into a message we can actually show the user.
 *
 * `reason` is one of:
 *   'denied'       - the browser returned permission 'denied'. On Android this
 *                    is sticky: Chrome will not re-prompt, the user has to
 *                    clear it in Site settings > Notifications. On iOS they
 *                    have to change it in Settings > Notifications.
 *   'dismissed'    - permission came back 'default' (prompt closed / ignored).
 *                    Retrying is fine here.
 *   'unconfigured' - NEXT_PUBLIC_VAPID_PUBLIC_KEY is missing from the build.
 *                    That is a deploy problem, not something the user can fix.
 *   'failed'       - something threw. `error` is that throwable; useful
 *                    DOMException names include 'NotAllowedError',
 *                    'InvalidStateError' and 'AbortError' (Android Chrome
 *                    raises AbortError when Google Play Services cannot reach
 *                    FCM, e.g. on a de-Googled or offline device).
 */
export function getPushErrorMessage(reason: PushFailureReason, error?: unknown): string {
  const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent)

  switch (reason) {
    case 'unconfigured':
      // Nothing the user can do about a missing build-time key, so don't
      // explain VAPID to them. The console log is where we go to debug it.
      return "Push notifications aren't available right now. Please try again later."

    case 'dismissed':
      return 'Notification permission was dismissed. Tap the switch again to retry.'

    case 'denied':
      // Terminal state: the browser will not prompt again, so the message has
      // to be a set of instructions rather than an invitation to retry.
      return isAndroid
        ? 'Notifications are blocked for this site. Open your browser menu, then Site settings > Notifications, and allow them for BPS Compass.'
        : 'Notifications are blocked for this site. Allow them in your browser or device settings, then try again.'

    case 'failed': {
      const name = (error as Error)?.name

      if (name === 'NotAllowedError') {
        return 'Your browser blocked the notification request. Check that notifications are allowed for this site.'
      }

      if (name === 'AbortError') {
        // Android Chrome raises this when it can't reach FCM through Google
        // Play Services, which is a device problem rather than an app problem.
        return "Your device couldn't reach the notification service. Check your connection and try again."
      }

      if (name === 'InvalidStateError') {
        return 'An old notification setup is still active. Close and reopen the app, then try again.'
      }

      // Unknown failure: include the underlying message so a student can read
      // it back to us, but keep the sentence readable on its own.
      const detail = (error as Error)?.message
      return detail
        ? `Couldn't turn on notifications: ${detail}`
        : "Couldn't turn on notifications. Please try again."
    }
  }
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}
