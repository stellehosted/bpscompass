"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Globe } from "lucide-react"

interface NotificationPreferences {
  push_enabled: boolean
  filter_mode: 'all' | 'my_clubs'
}

export function NotificationSettings() {
  const { user } = useAuth()
  const [preferences, setPreferences] = useState<NotificationPreferences>({
    push_enabled: true,
    filter_mode: 'all',
  })
  const [savingPrefs, setSavingPrefs] = useState(false)
  const [pushSupported, setPushSupported] = useState(false)
  const [pushSubscribed, setPushSubscribed] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)
  const [pushError, setPushError] = useState<string | null>(null)
  const [permission, setPermission] = useState<NotificationPermission>('default')

  useEffect(() => {
    if (!user) return

    // Check if push notifications are supported. Android WebViews expose
    // serviceWorker but not always Notification, so check all three.
    if (
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window
    ) {
      setPushSupported(true)
      setPermission(Notification.permission)
      checkPushSubscription()
    }

    loadPreferences()
  }, [user])

  const checkPushSubscription = async () => {
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()
      setPushSubscribed(!!subscription)
    } catch (error) {
      console.error('Error checking push subscription:', error)
    }
  }

  const loadPreferences = async () => {
    if (!user) return

    try {
      const response = await fetch(`/api/notifications/preferences?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setPreferences(data.data)
      }
    } catch (error) {
      console.error("Error loading preferences:", error)
    }
  }

  const updatePreferences = async (updates: Partial<NotificationPreferences>) => {
    if (!user) return

    try {
      setSavingPrefs(true)
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          pushEnabled: updates.push_enabled,
          filterMode: updates.filter_mode,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setPreferences(data.data)
      }
    } catch (error) {
      console.error("Error updating preferences:", error)
    } finally {
      setSavingPrefs(false)
    }
  }

  const saveSubscription = async (subscription: PushSubscription) => {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: user!.id,
        subscription: subscription.toJSON(),
      }),
    })

    if (!response.ok) {
      throw new Error(`Server rejected the subscription (HTTP ${response.status})`)
    }
  }

  const subscribeToPush = async () => {
    if (!user || !pushSupported || pushBusy) return

    setPushError(null)

    const vapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    if (!vapidKey) {
      setPushError(getPushErrorMessage('unconfigured'))
      return
    }

    // Ask for permission FIRST, before any `await` that could outlive the tap.
    // Chrome and Firefox on Android require transient user activation for
    // requestPermission(); awaiting service worker registration beforehand
    // burns that activation and the prompt silently never appears. Safari on
    // iOS is lenient here, which is why this path only ever failed on Android.
    let result: NotificationPermission
    try {
      result = await Notification.requestPermission()
    } catch (error) {
      console.error('Error requesting notification permission:', error)
      setPushError(getPushErrorMessage('failed', error))
      return
    }

    setPermission(result)
    if (result !== 'granted') {
      setPushError(getPushErrorMessage(result === 'denied' ? 'denied' : 'dismissed'))
      return
    }

    setPushBusy(true)
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
          setPushSubscribed(true)
          return
        }
        console.log('[Push] Replacing subscription made with a stale VAPID key')
        await existing.unsubscribe()
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      })

      await saveSubscription(subscription)
      setPushSubscribed(true)
    } catch (error) {
      console.error('Error subscribing to push:', error)
      setPushError(getPushErrorMessage('failed', error))
    } finally {
      setPushBusy(false)
    }
  }

  const unsubscribeFromPush = async () => {
    if (!user || pushBusy) return

    setPushError(null)
    setPushBusy(true)
    try {
      const registration = await navigator.serviceWorker.ready
      const subscription = await registration.pushManager.getSubscription()

      if (subscription) {
        await subscription.unsubscribe()
        await fetch(`/api/notifications/subscribe?userId=${user.id}&endpoint=${encodeURIComponent(subscription.endpoint)}`, {
          method: 'DELETE',
        })
      }

      setPushSubscribed(false)
    } catch (error) {
      console.error('Error unsubscribing from push:', error)
      setPushError(getPushErrorMessage('failed', error))
    } finally {
      setPushBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="space-y-4">
      <Card className="gap-0">
        <CardHeader>
          <CardTitle>Notifications</CardTitle>
          <CardDescription>
            If installed, you can receive on-device notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
        {!pushSupported ? (
          <p className="text-sm text-muted-foreground">
            Push notifications are not supported on this device/browser.
            Install the app on your phone to receive push notifications.
          </p>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div className="space-y-0.5">
              <Label htmlFor="push-toggle">Push Notifications</Label>
              <p className="text-sm text-muted-foreground">
                {pushSubscribed
                  ? 'You will receive push notifications'
                  : 'Click to enable push notifications'}
              </p>
            </div>
            <Switch
              id="push-toggle"
              checked={pushSubscribed}
              disabled={pushBusy}
              onCheckedChange={(checked) => {
                if (checked) {
                  subscribeToPush()
                } else {
                  unsubscribeFromPush()
                }
              }}
            />
          </div>
        )}

        {pushError && (
          <p className="text-sm text-destructive" role="alert">
            {pushError}
          </p>
        )}

        {pushSupported && permission === 'default' && !pushSubscribed && !pushError && (
          <p className="text-xs text-muted-foreground">
            Your browser will ask for permission when you turn this on.
          </p>
        )}

        <div className="flex items-center justify-between gap-4">
          <div className="space-y-0.5">
            <Label htmlFor="notifications-enabled">In-App Notifications</Label>
            <p className="text-sm text-muted-foreground">
              Store notifications in "Alerts" tab
            </p>
          </div>
          <Switch
            id="notifications-enabled"
            checked={preferences.push_enabled}
            disabled={savingPrefs}
            onCheckedChange={(checked) => {
              updatePreferences({ push_enabled: checked })
            }}
          />
        </div>
        </CardContent>
      </Card>

      <Card className="gap-0">
        <CardHeader>
          <CardTitle>Notification Filter</CardTitle>
          <CardDescription>
            Choose which notifications you want to receive
          </CardDescription>
        </CardHeader>
        <CardContent>
        <RadioGroup
          value={preferences.filter_mode}
          onValueChange={(value: 'all' | 'my_clubs') => {
            updatePreferences({ filter_mode: value })
          }}
          disabled={savingPrefs}
          className="space-y-3"
        >
          <div className="flex items-start space-x-3 p-3 rounded-[16px] bg-muted">
            <RadioGroupItem value="my_clubs" id="my_clubs" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="my_clubs" className="flex items-center gap-2 cursor-pointer">
                <Users className="h-4 w-4" />
                My Clubs
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Only alerts from your joined clubs
              </p>
            </div>
          </div>

          <div className="flex items-start space-x-3 p-3 rounded-[16px] bg-muted">
            <RadioGroupItem value="all" id="all" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="all" className="flex items-center gap-2 cursor-pointer">
                <Globe className="h-4 w-4" />
                All Clubs
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Alerts from all clubs (currently unavaliable)
              </p>
            </div>
          </div>
        </RadioGroup>
        </CardContent>
      </Card>
    </div>
  )
}

// Helper function to convert VAPID key
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

type PushFailureReason = 'denied' | 'dismissed' | 'unconfigured' | 'failed'

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
function getPushErrorMessage(reason: PushFailureReason, error?: unknown): string {
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
