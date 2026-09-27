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
    cacheLocation: "sessionStorage", // This configures where your cache will be stored
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

// BPS School domain validation
export const ALLOWED_DOMAINS = [
  "berkeleyprep.org",
  "berkeleyprep.com",
  // Add any other official BPS domains here
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
  grade?: string // For students
  department?: string // For sponsors
  profilePicture?: string
  bio?: string
  interests?: string[]
  userType?: string // From Azure AD - 'None' for teachers/staff
  createdAt: Date
  updatedAt: Date
}
