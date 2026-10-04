"use client"

import { notify } from "@/lib/notify"
import { useEffect, useState, type CSSProperties } from "react"
import localFont from "next/font/local"
import { RefreshCw } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { CompassHero } from "@/components/loginCompass"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { getRememberMe, setRememberMe } from "@/lib/auth-config"

const berkeley = localFont({
  src: "../fonts/BerkeleyStd-Black.otf",
  weight: "900",
  display: "swap",
})

// "Avenir" in the Sketch document. Defined once as --font-avenir in
// globals.css (also used by the Button component); ships with macOS/iOS,
// falls back through the closest available humanist sans elsewhere.
const AVENIR = "var(--font-avenir)"

const BG = "#011321"

// Every position, size and type spec below is taken from the "Landing" frame
// in BPS Compass.sketch, which is designed on a 1920x1080 canvas. Converting
// to cqw locks the whole layout to the design's proportions at any width.
const STAGE_W = 1920
const pct = (v: number) => `${(v / STAGE_W) * 100}cqw`

// The stage always covers the viewport, pinned bottom-right, so BPS Compass
// bleeds off the real window edges instead of being clipped at an inset
// boundary, and the content column is never cropped.
const stageStyle: CSSProperties = {
  containerType: "inline-size",
  width: "max(100vw, calc(100dvh * 16 / 9))",
  height: "max(100dvh, calc(100vw * 9 / 16))",
}

const compassStyle: CSSProperties = {
  position: "absolute",
  left: pct(-1190),
  top: pct(-787),
  width: pct(2380),
  height: pct(2380),
  pointerEvents: "none",
}

// Where the dial sits inside the artwork's own 2380x2380 box. The dial is not
// centred in it — the mounting loop hangs above — so placement has to work off
// the dial's centre and radius rather than the image's bounds.
const DIAL_CENTER_RATIO = 1427.09355 / 2380
const RIM_RADIUS_RATIO = 801.297656 / 2380
const FACE_RADIUS_RATIO = 610.107422 / 2380

// The dial's centre sits on the top edge, so the circle is at its widest
// exactly there. Sizing the light face to 55vw of radius — comfortably past
// the 50vw half-width of the screen — pushes the blue rim off the viewport
// along that top edge.
const FACE_R_VW = 55
const COMPASS_VW = FACE_R_VW / FACE_RADIUS_RATIO

// The visible arc is the rim's radius: below the top edge the circle narrows,
// so the rim curves back into view and closes off the bottom of the arc.
const BAND_VW = RIM_RADIUS_RATIO * COMPASS_VW

// Pull the image up so the dial's centre — not the image's centre — lands on
// the top edge, then crop to the band depth above.
const portraitCompassStyle: CSSProperties = {
  position: "absolute",
  left: "50%",
  top: `${-DIAL_CENTER_RATIO * COMPASS_VW}vw`,
  width: `${COMPASS_VW}vw`,
  height: `${COMPASS_VW}vw`,
  transform: "translateX(-50%)",
  pointerEvents: "none",
}

const portraitBandStyle: CSSProperties = {
  height: `${BAND_VW}vw`,
}

// Title: 144, centred, tracking -6. Its box centre (1370.5) lines up with the
// button's (1370), so the two stay optically stacked.
const titleStyle: CSSProperties = {
  position: "absolute",
  left: pct(973),
  top: pct(461),
  width: pct(795),
  height: pct(144),
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: pct(144),
  letterSpacing: `${-6 / 144}em`,
  lineHeight: 1,
  color: "#ffffff",
  whiteSpace: "nowrap",
}

// Position/size only — color, radius, font and weight now come from the
// shared Button component (variant="secondary" already matches this design's
// carolina-blue-on-black exactly; see components/ui/button.tsx).
const buttonStyle: CSSProperties = {
  position: "absolute",
  left: pct(1170),
  top: pct(653),
  width: pct(400),
  height: pct(120),
  fontSize: pct(50),
}

const rememberMeStyle: CSSProperties = {
  position: "absolute",
  left: pct(1170),
  top: pct(790),
  width: pct(400),
  fontFamily: AVENIR,
  fontSize: pct(24),
}

// "Made with love": Avenir Book, 30, right aligned.
const footerStyle: CSSProperties = {
  position: "absolute",
  right: pct(1920 - 1495 - 361),
  bottom: pct(1080 - 967 - 82),
  whiteSpace: "nowrap",
  fontFamily: AVENIR,
  fontWeight: 400,
  fontSize: pct(30),
  lineHeight: 82 / 2 / 30,
  color: "#ffffff",
  textAlign: "right",
}

const portraitTitleStyle: CSSProperties = {
  fontSize: "clamp(3rem, 12vw, 6rem)",
  letterSpacing: `${-6 / 144}em`,
  lineHeight: 1,
  color: "#ffffff",
}

// Position/size only — see buttonStyle above.
const portraitButtonStyle: CSSProperties = {
  fontSize: "clamp(1.25rem, 5vw, 2rem)",
  width: "clamp(200px, 52vw, 380px)",
  height: "clamp(3.5rem, 14vw, 5rem)",
}

const portraitFooterStyle: CSSProperties = {
  whiteSpace: "nowrap",
  fontFamily: AVENIR,
  fontWeight: 400,
  fontSize: "clamp(0.875rem, 3.2vw, 1.25rem)",
  color: "#ffffff",
  bottom: "calc(2rem + env(safe-area-inset-bottom))",
}

export function LoginScreen() {
  const { login, isLoading } = useAuth()
  const [showReset, setShowReset] = useState(false)
  const [rememberMe, setRememberMeState] = useState(() => getRememberMe())
  const { toast } = useToast()

  const handleRememberMeChange = (checked: boolean) => {
    setRememberMeState(checked)
    setRememberMe(checked)
  }

  // iOS Safari tints its chrome from the document background and theme-colour,
  // not from this screen's own container, so a full-bleed splash otherwise
  // shows white bars above and below. Both are restored on unmount so the rest
  // of the app keeps its normal light theme.
  useEffect(() => {
    const body = document.body
    const previousBackground = body.style.backgroundColor
    body.style.backgroundColor = BG

    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    const createdMeta = !meta
    const previousContent = meta?.content

    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "theme-color"
      document.head.appendChild(meta)
    }
    meta.content = BG

    return () => {
      body.style.backgroundColor = previousBackground
      if (createdMeta) {
        meta?.remove()
      } else if (meta && previousContent !== undefined) {
        meta.content = previousContent
      }
    }
  }, [])

  const handleMicrosoftLogin = async () => {
    try {
      await login()
    } catch (error: any) {
      console.error("Login failed:", error)

      // Show reset button if interaction_in_progress error
      if (error?.message?.includes('interaction_in_progress') ||
          error?.errorCode === 'interaction_in_progress') {
        setShowReset(true)
      } else {
        toast({
          variant: "destructive",
          title: "Login failed",
          description: "Please try again.",
        })
      }
    }
  }

  const handleReset = () => {
    try {
      // Clear all MSAL cache
      sessionStorage.clear()
      localStorage.clear()
      console.log('✅ Cache cleared')

      // Reload page
      window.location.reload()
    } catch (error) {
      console.error('Failed to reset:', error)
      notify.error('Please close and reopen your browser')
    }
  }

  return (
    <div className="fixed inset-0 overflow-hidden overscroll-none touch-none" style={{ background: BG }}>
      {/* Landscape gets the Sketch composition at any size; portrait — phone or
          tablet — gets the stacked one. Branching on orientation rather than
          width keeps a landscape phone off the portrait layout, whose vw-based
          compass would otherwise swallow the short viewport. */}
      <div className="hidden landscape:block absolute right-0 bottom-0 overflow-hidden" style={stageStyle}>
        <div style={compassStyle}>
          <CompassHero className="w-full h-full" followPointer />
        </div>

        <h1 className={berkeley.className} style={titleStyle}>
          BPS Compass
        </h1>

        <Button
          type="button"
          onClick={handleMicrosoftLogin}
          disabled={isLoading}
          variant="secondary"
          style={buttonStyle}
          className="font-black"
        >
          {isLoading ? "Signing in..." : "Log In"}
        </Button>

        <label
          htmlFor="remember-me-desktop"
          className="flex cursor-pointer select-none items-center justify-center gap-[0.6cqw] text-white/80"
          style={rememberMeStyle}
        >
          <Checkbox
            id="remember-me-desktop"
            checked={rememberMe}
            onCheckedChange={(checked) => handleRememberMeChange(checked === true)}
            className="h-[1.4cqw] w-[1.4cqw] rounded-[0.3cqw] bg-white/10 ring-1 ring-white/40 data-[state=checked]:bg-[#56a0d3] data-[state=checked]:ring-[#56a0d3] data-[state=checked]:text-black"
          />
          Remember me
        </label>

        {showReset && (
          <div
            className="absolute flex flex-col items-center gap-[1cqw] text-center text-white"
            style={{ left: pct(1170), top: pct(860), width: pct(400), fontFamily: AVENIR, fontSize: pct(22) }}
          >
            <p className="opacity-70">Login stuck? Try resetting the authentication state.</p>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-[0.5cqw] rounded-full bg-white/10 px-[1.5cqw] py-[0.6cqw] hover:bg-white/20"
            >
              <RefreshCw className="h-[1.2cqw] w-[1.2cqw]" />
              Reset &amp; Try Again
            </button>
          </div>
        )}

        <p style={footerStyle}>
          Built by Computer Science Club
        </p>
      </div>

      {/* Portrait: the dial is centred on the top centre of the viewport, the
          same way the landscape layout centres it on the frame's left edge. */}
      <div className="landscape:hidden absolute inset-0 flex flex-col">
        <div className="relative shrink-0" style={portraitBandStyle}>
          <div style={portraitCompassStyle}>
            <CompassHero className="h-full w-full" followPointer />
          </div>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 pb-28 text-center">
          <h1 className={berkeley.className} style={portraitTitleStyle}>
            BPS Compass
          </h1>

          <Button
            type="button"
            onClick={handleMicrosoftLogin}
            disabled={isLoading}
            variant="secondary"
            style={portraitButtonStyle}
            className="font-black"
          >
            {isLoading ? "Signing in..." : "Log In"}
          </Button>

          <label
            htmlFor="remember-me-mobile"
            className="flex cursor-pointer select-none items-center gap-2 text-sm text-white/80"
            style={{ fontFamily: AVENIR }}
          >
            <Checkbox
              id="remember-me-mobile"
              checked={rememberMe}
              onCheckedChange={(checked) => handleRememberMeChange(checked === true)}
              className="h-4 w-4 bg-white/10 ring-1 ring-white/40 data-[state=checked]:bg-[#56a0d3] data-[state=checked]:ring-[#56a0d3] data-[state=checked]:text-black"
            />
            Remember me
          </label>

          {showReset && (
            <div
              className="flex flex-col items-center gap-2 text-sm text-white"
              style={{ fontFamily: AVENIR }}
            >
              <p className="opacity-70">Login stuck? Try resetting the authentication state.</p>
              <button
                type="button"
                onClick={handleReset}
                className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 hover:bg-white/20"
              >
                <RefreshCw className="h-4 w-4" />
                Reset &amp; Try Again
              </button>
            </div>
          )}
        </div>

        <p style={portraitFooterStyle} className="absolute inset-x-0 text-center">
          Built by Computer Science Club
        </p>
      </div>
    </div>
  )
}
