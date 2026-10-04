import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'
import { Analytics } from '@vercel/analytics/next'
import './globals.css'
import { AuthProvider } from '@/contexts/auth-context'
import { ThemeProvider } from '@/components/themeProvider'
import { ServiceWorkerRegister } from '@/components/serviceWorkerRegister'
import { PwaPrompts } from '@/components/pwaPrompts'
import { Toaster } from '@/components/ui/toaster'
import { ConfirmHost } from '@/components/ui/confirm-host'

export const metadata: Metadata = {
  title: 'BPS Compass',
  description:
    'Connect with your school community. Share updates, join clubs, and stay informed about campus life.',
  generator: 'v0.app',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    // Edge-to-edge: page content draws under the status bar / Dynamic Island.
    // iOS blurs that region, so interactive UI must sit below
    // env(safe-area-inset-top) — see the top-inset padding on each page.
    statusBarStyle: 'black-translucent',
    title: 'BPS Compass',
  },
  icons: {
    icon: '/icon-192.png',
    shortcut: '/icon-192.png',
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  // Let full-bleed screens paint into the notch/home-indicator areas instead
  // of leaving Safari's chrome showing the default page background.
  viewportFit: 'cover',
}

// Self-hosted Avenir, split from fonts/Avenir.ttc into per-weight .ttf files
// (next/font/local doesn't support .ttc directly) — see fonts/avenir/.
const avenir = localFont({
  src: [
    { path: '../fonts/avenir/Avenir-Light.ttf', weight: '300', style: 'normal' },
    { path: '../fonts/avenir/Avenir-Regular.ttf', weight: '400', style: 'normal' },
    { path: '../fonts/avenir/Avenir-Medium.ttf', weight: '500', style: 'normal' },
    { path: '../fonts/avenir/Avenir-Bold.ttf', weight: '700', style: 'normal' },
    { path: '../fonts/avenir/Avenir-Black.ttf', weight: '900', style: 'normal' },
  ],
  variable: '--font-avenir-local',
  display: 'swap',
})

const fontVars = `${avenir.variable}`

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    // Font variable classes live on <html>, not <body>: theme tokens like
    // --font-avenir are declared at :root, and a CSS custom property's var()
    // fallback resolves against the element where it's DECLARED, not where
    // it's consumed — so --font-avenir-local must already be in scope there.
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <body className="font-sans" suppressHydrationWarning>
        <ServiceWorkerRegister />
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false} // 🔧 make deterministic theme
          disableTransitionOnChange
        >
          <AuthProvider>
            {children}
            <PwaPrompts />
          </AuthProvider>
          <Toaster />
          <ConfirmHost />
        </ThemeProvider>
        <Analytics />
      </body>
    </html>
  )
}
