"use client"

import { useEffect, useRef, useState } from "react"
import { Bell, ChevronDown, ChevronLeft, ChevronRight, Download, Share, SquarePlus, type LucideIcon } from "lucide-react"
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
const SHOW_DELAY_MS = 1000

// The shared DialogContent stretches to full height on phones; keep these prompts a
// compact card centered on screen instead.
const DIALOG_CARD_CLASS =
  "max-sm:bottom-auto max-sm:top-1/2 max-sm:-translate-y-1/2 max-sm:max-h-[calc(100dvh-2rem)] sm:max-w-md"

// Screenshots live in public/install/. Order matches the real Safari flow.
const IOS_INSTALL_STEPS: { image: string; text: React.ReactNode }[] = [
  { image: "/install/ios-1.jpg", text: <>Tap the <strong>=</strong> menu <br />on the address bar&apos;s left edge</> },
  { image: "/install/ios-2.jpg", text: <>Tap <Label icon={Share}>Share</Label></> },
  { image: "/install/ios-3.jpg", text: <>Tap <Label icon={ChevronDown}>View More</Label></> },
  { image: "/install/ios-4.jpg", text: <>Tap <Label icon={SquarePlus}>Add to Home Screen</Label><br></br><small>(You may need to scroll down)</small></> },
  { image: "/install/ios-5.jpg", text: <>Tap <strong>Add</strong> in the top right corner<br /><small>(Keep <strong>Open as Web App</strong> on)</small></> },
]

// A bold label with its icon inline, matching what the user sees in Safari.
function Label({ icon: Icon, children }: { icon: LucideIcon; children: React.ReactNode }) {
  return (
    <strong className="inline-flex items-center gap-1 align-middle">
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      {children}
    </strong>
  )
}

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
    /* -- Install App Prompt ------------------------ */
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className={DIALOG_CARD_CLASS}>
        <DialogHeader>
          <DialogTitle>Install BPS Compass</DialogTitle>
          <DialogDescription>
            Add BPS Compass to your Home Screen and get club notifications!
          </DialogDescription>
        </DialogHeader>

        <div>
          {platform === "ios" ? (
            <div className="space-y-3">
              <IosInstallCarousel />
            </div>
          ) : (
            <ol className="space-y-3 text-sm">
              <li className="flex items-start gap-3">
                <span className="pt-1"><strong>1.</strong> Open your browser menu and choose <strong>Install app</strong> or <strong>Add to Home screen</strong></span>
              </li>
              <li className="flex items-start gap-3">
                <span className="pt-1"><strong>2.</strong> Open <strong>BPS Compass</strong> from your Home Screen</span>
              </li>
            </ol>
          )}
        </div>

          {installEvent && (
            <Button onClick={handleInstall}>
              <Download className="mr-2 h-4 w-4" />
              Install
            </Button>
          )}
      </DialogContent>
    </Dialog>
  )
}

/** iOS Add to Home Screen steps (not on Android) **/
function IosInstallCarousel() {
  const [index, setIndex] = useState(0)
  const touchStartX = useRef<number | null>(null)
  const last = IOS_INSTALL_STEPS.length - 1

  const go = (to: number) => setIndex(Math.min(last, Math.max(0, to)))

  return (
    <div
      onTouchStart={(e) => {
        touchStartX.current = e.touches[0].clientX
      }}
      onTouchEnd={(e) => {
        if (touchStartX.current === null) return
        const dx = e.changedTouches[0].clientX - touchStartX.current
        touchStartX.current = null
        if (Math.abs(dx) > 40) go(index + (dx < 0 ? 1 : -1))
      }}
    >
      {/* -mx-3 pulls the arrows into the dialog's side padding; w-7 px-0 slims them down */}
      <div className="-mx-3 flex items-center">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="w-7 shrink-0 px-0"
          onClick={() => go(index - 1)}
          disabled={index === 0}
          aria-label="Previous step"
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>

        {/* Every slide sits in the same grid cell, so the cell is as big as the largest one and
            the dialog never changes size between steps. Only the current slide is visible;
            keeping the rest mounted also preloads their images. */}
        <div className="grid min-w-0 flex-1 justify-items-center" aria-live="polite">
          {IOS_INSTALL_STEPS.map((step, i) => (
            <div
              key={step.image}
              aria-hidden={i !== index}
              className={`col-start-1 row-start-1 flex flex-col items-center gap-2 ${i === index ? "" : "invisible"}`}
            >
              {/* The picture centers in whatever room is left; the caption stays pinned to the bottom. */}
              <div className="flex flex-1 items-center justify-center">
                <img
                  src={step.image}
                  alt={`Step ${i + 1} screenshot`}
                  // Tallest the picture can be before the dialog (max 100dvh - 2rem on phones) would have to scroll
                  className="h-auto max-h-[clamp(8rem,calc(100dvh_-_18rem),30rem)] w-auto max-w-full rounded-[16px] shadow-hard"
                />
              </div>
              <p className="text-center text-base">
                {step.text}
              </p>
            </div>
          ))}
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="w-7 shrink-0 px-0"
          onClick={() => go(index + 1)}
          disabled={index === last}
          aria-label="Next step"
        >
          <ChevronRight className="h-5 w-5" />
        </Button>
      </div>

      <div className="flex justify-center">
        {IOS_INSTALL_STEPS.map((_, i) => (
          // globals.css gives every button min-height: 36px on phones, which would stretch a
          // bare dot into a tall pill. So the button is the tap target and the span is the dot.
          <button
            key={i}
            type="button"
            onClick={() => go(i)}
            aria-label={`Go to step ${i + 1}`}
            aria-current={i === index}
            className="flex items-center px-1"
          >
            <span
              className={`block h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-primary" : "w-1.5 bg-muted-foreground/30"}`}
            />
          </button>
        ))}
      </div>
    </div>
  )
}

/* -- Notifications Prompt ------------------------ */
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
