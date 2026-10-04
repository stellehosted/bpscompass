// Environment checks for the install / notification prompts.

export type MobilePlatform = 'ios' | 'android' | null

/** True when running as an installed home-screen app rather than in a browser tab. */
export function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari predates the display-mode media query and exposes this instead.
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export function getMobilePlatform(): MobilePlatform {
  if (typeof navigator === 'undefined') return null

  const ua = navigator.userAgent
  // iPadOS 13+ reports itself as a Mac; touch support is what gives it away.
  if (/iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
    return 'ios'
  }
  if (/Android/i.test(ua)) return 'android'
  return null
}

// How long a closed prompt stays away. Only matters for someone who closed it without
// choosing: a browser-level "Block" is permanent and never reaches the prompt at all.
const DISMISS_COOLDOWN_MS = 24 * 60 * 60 * 1000

// localStorage throws in some private-browsing modes; treat that as "never dismissed".
export function wasRecentlyDismissed(key: string) {
  try {
    const at = Number(localStorage.getItem(key))
    return at > 0 && Date.now() - at < DISMISS_COOLDOWN_MS
  } catch {
    return false
  }
}

export function recordDismissal(key: string) {
  try {
    localStorage.setItem(key, String(Date.now()))
  } catch {
    // Not persisting just means the prompt may come back sooner.
  }
}
