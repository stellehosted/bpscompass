const isDev = process.env.NODE_ENV !== 'production'

// Content Security Policy: the browser refuses to load or run anything not listed here, which
// turns a would-be XSS bug into a blocked request. What each part is for:
//  - script-src 'unsafe-inline': Next.js emits inline bootstrap scripts (no nonce support here)
//  - login.microsoftonline.com: MSAL sign-in (token requests, and a hidden frame for silent renewal).
//    The profile lookup against Microsoft Graph happens on the server, so Graph isn't listed.
//  - img-src https:: club and post images are URLs that leaders set, from storage or elsewhere
//  - dev only: 'unsafe-eval' and ws: for hot reload, Vercel's debug analytics script
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval' https://va.vercel-scripts.com" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self' https://login.microsoftonline.com${isDev ? ' ws: wss: https://va.vercel-scripts.com' : ''}`,
  "frame-src https://login.microsoftonline.com",
  "worker-src 'self'",
  "manifest-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isDev ? [] : ['upgrade-insecure-requests']),
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: contentSecurityPolicy },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
  // Only over HTTPS, and not in dev where http://localhost must keep working
  ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=63072000' }]),
]

/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  images: {
    unoptimized: true,
  },
  allowedDevOrigins: ['*'],
  // Ensure proper bundling for serverless functions
  serverExternalPackages: ['pg', 'pg-native'],
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}

export default nextConfig
