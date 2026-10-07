import { Configuration, PopupRequest } from "@azure/msal-browser"

// Check if we're in a secure context (HTTPS or localhost)
const isSecureContext = typeof window !== "undefined" && 
  (window.location.protocol === "https:" || 
   window.location.hostname === "localhost" ||
   window.location.hostname === "127.0.0.1")

// MSAL configuration
export const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || "", // You'll need to get this from Azure Portal
    // Single-tenant app registrations (the default since 10/15/2018) can't use "/common".
    // Use the tenant ID (or "organizations" for any work/school account) instead.
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || "common"}`,
    redirectUri: typeof window !== "undefined" ? window.location.origin : "",
  },
  cache: {
    // "localStorage" persists the token cache across tabs and browser restarts,
    // so acquireTokenSilent() (see auth-context.tsx) can log users back in
    // automatically instead of sessionStorage's cache-per-tab, gone-on-close behavior.
    cacheLocation: "localStorage",
    storeAuthStateInCookie: true, // Enable for better compatibility with mobile browsers
  },
  system: {
    loggerOptions: {
      logLevel: isSecureContext ? 3 : 1, // Less verbose in non-secure contexts
    },
  },
}

// Add scopes here for ID token to be used at Microsoft identity platform endpoints.
export const loginRequest: PopupRequest = {
  scopes: ["User.Read", "User.ReadBasic.All", "email", "profile", "openid"],
}

// "Remember me" (login screen checkbox): the MSAL cache always lives in
// localStorage so acquireTokenSilent() *can* persist a session across browser
// restarts, but when the user opts out we drop that cache the moment they
// leave the tab (see the "pagehide" listener in auth-context.tsx) so it never
// actually survives to the next visit. Defaults to true (stay signed in) so
// first-time visitors get the persistent behavior without having to opt in.
const REMEMBER_ME_KEY = "bps-remember-me"

export const getRememberMe = (): boolean => {
  if (typeof window === "undefined") return true
  try {
    return localStorage.getItem(REMEMBER_ME_KEY) !== "false"
  } catch {
    return true
  }
}

export const setRememberMe = (value: boolean): void => {
  if (typeof window === "undefined") return
  try {
    localStorage.setItem(REMEMBER_ME_KEY, String(value))
  } catch {
    // Ignore write failures (e.g. Safari private browsing) - defaults to remembered.
  }
}

// BPS School domain validation
export const ALLOWED_DOMAINS = [
  "berkeleyprep.org",
]

export const isBerkeleyPrepEmail = (email: string | undefined | null): boolean => {
  if (!email || typeof email !== 'string') {
    return false
  }
  const domain = email.split("@")[1]?.toLowerCase()
  return ALLOWED_DOMAINS.includes(domain || "")
}

// Profile creation requirements
export interface UserProfile {
  id: string
  email: string
  name: string
  role: "student" | "sponsor" | "admin"
  grade?: number | null // Graduation year (2027 = Class of 2027), from the Entra group
  department?: string // For sponsors
  interests?: string[]
  userType?: string // From Azure AD - 'None' for teachers/staff
  createdAt: Date
  updatedAt: Date
}
