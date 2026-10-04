"use client"

import { useEffect, useState } from "react"
import { Bell, Download, Share, SquarePlus } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { toast } from "@/hooks/use-toast"
import {
  enablePush,
  getExistingSubscription,
  getPushErrorMessage,
  isPushConfigured,
  isPushSupported,
  sendTestNotification,
  type EnablePushResult,
} from "@/lib/push-client"
import { getMobilePlatform, isStandalone, recordDismissal, wasRecentlyDismissed, type MobilePlatform } from "@/lib/pwa"

const INSTALL_DISMISSED_KEY = "compass:install-prompt-dismissed"
const NOTIFICATIONS_DISMISSED_KEY = "compass:notifications-prompt-dismissed"

// Let the page paint (and any login redirect settle) before a dialog opens over it.
const SHOW_DELAY_MS = 1500

// The shared DialogContent stretches to full height on phones; keep these prompts a
// compact card centered on screen instead.
const DIALOG_CARD_CLASS = "max-sm:bottom-auto max-sm:top-1/2 max-sm:-translate-y-1/2 sm:max-w-md"

// Chrome's `beforeinstallprompt` isn't in lib.dom.d.ts.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>
}

/**
 * Two mutually exclusive prompts:
 *  - Phone, in a browser tab: offer to install the app.
 *  - Installed app, or desktop (nothing to install): once signed in, offer to
 *    turn on notifications.
 */
export function PwaPrompts() {
  const { isLoading, isAuthenticated, hasProfile } = useAuth()
  const [mode, setMode] = useState<"install" | "notifications" | null>(null)

  useEffect(() => {
    setMode(isStandalone() || !getMobilePlatform() ? "notifications" : "install")
  }, [])

  if (isLoading || !mode) return null

  if (mode === "install") return <InstallPrompt />
  return isAuthenticated && hasProfile ? <NotificationPrompt /> : null
}

function InstallPrompt() {
  const [platform, setPlatform] = useState<MobilePlatform>(null)
  const [open, setOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const detected = getMobilePlatform()
    setPlatform(detected)
    if (!detected) return

    const onBeforeInstall = (event: Event) => {
      // Stop Chrome's own mini-infobar; we show the prompt on our schedule.
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const onInstalled = () => {
      setOpen(false)
      setInstallEvent(null)
      recordDismissal(INSTALL_DISMISSED_KEY)
    }
    window.addEventListener("beforeinstallprompt", onBeforeInstall)
    window.addEventListener("appinstalled", onInstalled)

    const timer = wasRecentlyDismissed(INSTALL_DISMISSED_KEY)
      ? undefined
      : window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall)
      window.removeEventListener("appinstalled", onInstalled)
      window.clearTimeout(timer)
    }
  }, [])

  if (!platform) return null

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) recordDismissal(INSTALL_DISMISSED_KEY)
  }

  const handleInstall = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    // Either outcome consumes the event; Chrome won't fire it again for this tab.
    setInstallEvent(null)
    setOpen(false)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={DIALOG_CARD_CLASS}>
        <DialogHeader>
          <DialogTitle>Install BPS Compass</DialogTitle>
          <DialogDescription>
            Add Compass to your home screen for quick access and to get notified about club posts.
          </DialogDescription>
        </DialogHeader>

        <div>
          {platform === "ios" ? (
            <ol className="space-y-3 text-sm">
              <Step icon={<Share className="h-4 w-4" />}>
                Tap the <strong>Share</strong> button in Safari (tap <strong>•••</strong> first if you don&apos;t see it)
              </Step>
              <Step icon={<SquarePlus className="h-4 w-4" />}>
                Choose <strong>Add to Home Screen</strong>, then tap <strong>Add</strong>
              </Step>
              <Step icon={<Bell className="h-4 w-4" />}>
                Open Compass from your home screen and sign in again
              </Step>
            </ol>
          ) : installEvent ? (
            <p className="text-sm text-muted-foreground">
              It only takes a second, and you&apos;ll sign in again the first time you open the app.
            </p>
          ) : (
            <ol className="space-y-3 text-sm">
              <Step icon={<Download className="h-4 w-4" />}>
                Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong>
              </Step>
              <Step icon={<Bell className="h-4 w-4" />}>
                Open Compass from your home screen and sign in again
              </Step>
            </ol>
          )}
        </div>

        {/* max-sm:flex-col: DialogFooter reverses on phones, which would put "Not now" above Install. */}
        <DialogFooter className="max-sm:flex-col">
          {installEvent && (
            <Button onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Install
            </Button>
          )}
          <Button variant={installEvent ? "ghost" : "default"} onClick={() => handleOpenChange(false)}>
            {installEvent ? "Not now" : "Got it"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function Step({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">{icon}</span>
      <span className="pt-1">{children}</span>
    </li>
  )
}

function NotificationPrompt() {
  // Shown on every browser. Which ones will display the permission prompt without a
  // tap isn't reliable to detect, so the button always supplies the tap and is the
  // only thing that triggers the browser's own prompt.
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const finishEnable = async (result: EnablePushResult) => {
    if (result.ok) {
      setOpen(false)
      toast({ title: "Notifications on", description: "You'll be notified about new club posts." })
      await sendTestNotification()
    } else {
      setError(getPushErrorMessage(result.reason, result.error))
    }
  }

  useEffect(() => {
    // Only ask when the browser hasn't been asked yet. 'denied' can't be
    // re-prompted, and 'granted' without a subscription means the user turned
    // notifications off in Settings on purpose.
    if (!isPushSupported() || Notification.permission !== "default") return
    if (wasRecentlyDismissed(NOTIFICATIONS_DISMISSED_KEY)) return
    if (!isPushConfigured()) {
      console.warn("NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set; skipping the notification prompt.")
      return
    }

    let cancelled = false
    let timer: number | undefined
    getExistingSubscription()
      .then((subscription) => {
        if (!cancelled && !subscription) {
          timer = window.setTimeout(() => setOpen(true), SHOW_DELAY_MS)
        }
      })
      .catch((err) => console.error("Error checking push subscription:", err))

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [])

  const handleOpenChange = (next: boolean) => {
    setOpen(next)
    if (!next) recordDismissal(NOTIFICATIONS_DISMISSED_KEY)
  }

  const handleEnable = async () => {
    if (busy) return
    setError(null)
    setBusy(true)
    try {
      // enablePush calls Notification.requestPermission() synchronously, so the
      // tap's user activation is still live (required on Android Chrome).
      await finishEnable(await enablePush())
    } finally {
      setBusy(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={DIALOG_CARD_CLASS}>
        <DialogHeader>
          <DialogTitle>Don&apos;t Miss the Next Club Event!</DialogTitle>
          <DialogDescription>
            Know when your clubs post by turning on notifications
          </DialogDescription>
        </DialogHeader>

        {error ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
          ) : (
            <div className="text-xs text-muted-foreground">
              <p>If you don&apos;t see a notification popup...</p>
              <ol className="mt-1 list-decimal space-y-0.5 pl-4">
                <li>Look at your address bar for a bell button</li>
                <li>Click that to show the prompt</li>
                <li>You&apos;re all set!</li>
              </ol>
            </div>
          )}

        <DialogFooter>
          <Button onClick={handleEnable} disabled={busy}>
            <Bell className="mr-2 h-4 w-4" />
            {busy ? "Turning on..." : "Turn On Notifications"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
