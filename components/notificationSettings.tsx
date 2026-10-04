"use client"

import { useEffect, useState } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Users, Globe } from "lucide-react"
import {
  disablePush,
  enablePush,
  getExistingSubscription,
  getPushErrorMessage,
  isPushSupported,
} from "@/lib/push-client"

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

    if (isPushSupported()) {
      setPushSupported(true)
      setPermission(Notification.permission)
      checkPushSubscription()
    }

    loadPreferences()
  }, [user])

  const checkPushSubscription = async () => {
    try {
      setPushSubscribed(!!(await getExistingSubscription()))
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

  const subscribeToPush = async () => {
    if (!user || !pushSupported || pushBusy) return

    setPushError(null)
    setPushBusy(true)
    try {
      const result = await enablePush()
      setPermission(Notification.permission)

      if (result.ok) {
        setPushSubscribed(true)
      } else {
        setPushError(getPushErrorMessage(result.reason, result.error))
      }
    } finally {
      setPushBusy(false)
    }
  }

  const unsubscribeFromPush = async () => {
    if (!user || pushBusy) return

    setPushError(null)
    setPushBusy(true)
    try {
      await disablePush()
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
