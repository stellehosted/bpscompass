"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { PublicClientApplication, AccountInfo, AuthenticationResult } from "@azure/msal-browser"
import { msalConfig, loginRequest, getRememberMe, UserProfile } from "@/lib/auth-config"
import { DEMO_MODE } from "@/lib/demo-mode"
import { setupCryptoPolyfill, isSecureContext, getSecurityWarning } from "@/lib/crypto-polyfill"
import { autoFixStuckInteraction, clearMSALCache } from "@/lib/clear-msal-cache"

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  hasProfile: boolean
  isTeacher: boolean
  login: () => Promise<void>
  logout: () => void
  createProfile: (profileData: Partial<UserProfile>) => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

if (typeof window !== 'undefined') {
  // Plain-HTTP mobile testing (npm run mobile) has no Web Crypto, which MSAL needs, so dev
  // builds install a stand-in. This must never reach production: the stand-in fakes hashing
  // and signature checks. Next replaces NODE_ENV at build time, so this branch is dropped
  // from production bundles entirely.
  if (process.env.NODE_ENV !== 'production') {
    setupCryptoPolyfill()
    const warning = getSecurityWarning()
    if (warning) {
      console.warn(warning)
    }

    // AGGRESSIVE: Always clear MSAL cache on mobile HTTP to prevent stuck states
    if (!isSecureContext()) {
      console.log('🔧 Non-secure context detected - clearing MSAL cache to prevent stuck states')
      try {
        sessionStorage.clear()
        localStorage.removeItem('msal.interaction.status')
      } catch (e) {
        console.warn('Could not clear storage:', e)
      }
    }
  }

  // Auto-fix any stuck interaction state from previous sessions
  autoFixStuckInteraction()

  // "Remember me" opt-out: the MSAL cache lives in localStorage so it can
  // survive a restart, but if the user unchecked "remember me" we wipe it
  // the moment they actually leave (tab/window close, or navigating away),
  // rather than persisting it as localStorage otherwise would.
  window.addEventListener('pagehide', () => {
    if (!getRememberMe()) {
      clearMSALCache()
    }
  })
}

// Initialize MSAL (after polyfill is set up, in dev)
const msalInstance = new PublicClientApplication(msalConfig)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [hasProfile, setHasProfile] = useState(false)
  const [isTeacher, setIsTeacher] = useState(false)
  const [isInteractionInProgress, setIsInteractionInProgress] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  useEffect(() => {
    // Prevent multiple initialization attempts
    if (isInitialized) {
      return
    }

    // Demo mode - skip Azure authentication
    if (DEMO_MODE) {
      signInAsDemoUser().finally(() => {
        setIsLoading(false)
        setIsInitialized(true)
      })
      return
    }

    // Check if Azure client ID is configured
    if (!process.env.NEXT_PUBLIC_AZURE_CLIENT_ID) {
      console.error("Azure Client ID not configured. Please set NEXT_PUBLIC_AZURE_CLIENT_ID in your .env.local file")
      setIsLoading(false)
      setIsInitialized(true)
      return
    }

    // Initialize MSAL and check authentication status
    const initializeAuth = async () => {
      try {
        // Initialize MSAL first
        await msalInstance.initialize()
        
        // Handle any redirect responses first (from OAuth callback)
        try {
          const response = await msalInstance.handleRedirectPromise()
          if (response) {
            console.log("Handled redirect response")
            setIsInteractionInProgress(true)
            await handleAuthSuccess(response.account)
            setIsInteractionInProgress(false)
            setIsInitialized(true)
            return
          }
        } catch (redirectError) {
          console.error("Error handling redirect:", redirectError)
        }
        
        // Check if user is already signed in (only if no interaction in progress)
        const accounts = msalInstance.getAllAccounts()
        if (accounts.length > 0 && !isInteractionInProgress) {
          console.log("Found existing account, attempting silent authentication")
          setIsInteractionInProgress(true)
          try {
            await handleAuthSuccess(accounts[0])
          } catch (error: any) {
            // Only log non-expected errors
            if (error?.errorCode !== 'no_tokens_found' && 
                !error?.message?.includes('no token request found in cache')) {
              console.error("Silent auth failed:", error)
            } else {
              console.log("No cached token - user will need to login")
            }
          } finally {
            setIsInteractionInProgress(false)
          }
        } else {
          setIsLoading(false)
        }
        setIsInitialized(true)
      } catch (error) {
        console.error("Failed to initialize MSAL:", error)
        setIsLoading(false)
        setIsInteractionInProgress(false)
        setIsInitialized(true)
      }
    }

    initializeAuth()
  }, [isInitialized])

  // Turns the user row the server sends back into the profile the app uses
  const toProfile = (row: any): UserProfile => ({
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    grade: row.grade,
    department: row.department,
    interests: [], // Not stored in database yet
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  })

  // Trades the Microsoft sign-in for our own session cookie. The server verifies the ID token
  // and decides who the user is; nothing the browser claims about itself is trusted.
  const createServerSession = async (tokens: AuthenticationResult) => {
    const response = await fetch('/api/auth/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idToken: tokens.idToken,
        accessToken: tokens.accessToken,
        remember: getRememberMe(),
      }),
    })
    const data = await response.json().catch(() => ({}))
    return { ok: response.ok && data.success, status: response.status, data }
  }

  const applySession = (data: { user: any; isTeacher?: boolean }) => {
    setUser(toProfile(data.user))
    setIsTeacher(data.isTeacher ?? false)
    setIsAuthenticated(true)
    // User always has a profile after authentication since the server creates it
    setHasProfile(true)
  }

  // Ends both sessions: ours (the cookie) and Microsoft's (the MSAL cache)
  const signOut = async () => {
    await fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {})
    if (!DEMO_MODE) {
      msalInstance.logout()
    }
    setUser(null)
    setIsAuthenticated(false)
    setHasProfile(false)
    setIsTeacher(false)
    setIsInteractionInProgress(false)
  }

  const handleAuthSuccess = async (account: AccountInfo) => {
    try {
      // Check if interaction is already in progress
      if (isInteractionInProgress) {
        console.warn("Skipping auth - interaction already in progress")
        return
      }

      // Get fresh Microsoft tokens for this account
      let response: AuthenticationResult | null = null

      try {
        response = await msalInstance.acquireTokenSilent({
          ...loginRequest,
          account: account,
        })
      } catch (silentError: any) {
        console.warn("Silent token acquisition failed:", silentError?.errorCode)

        // Handle specific errors
        if (silentError?.errorCode === 'no_tokens_found' ||
            silentError?.errorCode === 'no_account_error' ||
            silentError?.errorMessage?.includes('no token request found in cache')) {
          console.log("No cached token found - user needs to login interactively")
          setIsLoading(false)
          return
        }

        // For other errors, try interactive login
        console.log("Attempting interactive token acquisition...")
        try {
          response = await msalInstance.acquireTokenPopup(loginRequest)
        } catch (interactiveError) {
          console.error("Interactive token acquisition failed:", interactiveError)
          setIsLoading(false)
          return
        }
      }

      if (!response) {
        return
      }

      let session = await createServerSession(response)

      // A cached ID token can be stale; get a fresh one and try once more
      if (!session.ok && session.status === 401) {
        const fresh = await msalInstance
          .acquireTokenSilent({ ...loginRequest, account, forceRefresh: true })
          .catch(() => null)
        if (fresh) {
          session = await createServerSession(fresh)
        }
      }

      if (session.ok) {
        applySession(session.data)
      } else if (session.data?.code === 'domain_not_allowed') {
        alert(session.data.error)
        await signOut()
      } else {
        console.error("Server sign-in failed:", session.status, session.data)
        alert("Failed to sign in. Please try again or contact support.")
      }
    } catch (error) {
      console.error("Error handling auth success:", error)

      // Handle specific MSAL errors
      if (error instanceof Error) {
        if (error.message.includes('interaction_in_progress')) {
          console.warn("⚠️ Interaction already in progress - this is normal during initialization")
          // Don't show alert for this error, just log it
          // This happens when MSAL is still processing a previous auth attempt
        } else if (error.message.includes('user_cancelled')) {
          console.log("User cancelled authentication")
          // Don't show alert for user cancellation
        } else {
          console.error("Authentication error:", error.message)
          alert("Authentication failed. Please try again or contact support.")
        }
      }
    } finally {
      setIsLoading(false)
      setIsInteractionInProgress(false)
    }
  }

  const login = async () => {
    try {
      // Prevent multiple simultaneous login attempts
      if (isInteractionInProgress) {
        console.warn("Login interaction already in progress, please wait...")
        return
      }

      // Check if MSAL is initialized
      if (!isInitialized) {
        console.warn("MSAL not initialized yet, please wait...")
        return
      }

      setIsLoading(true)
      setIsInteractionInProgress(true)

      // Demo mode - simulate login
      if (DEMO_MODE) {
        if (!(await signInAsDemoUser())) {
          alert("Couldn't sign in as the demo user. Load the test data with scripts/reset-db.sh, then try again.")
        }
        setIsLoading(false)
        setIsInteractionInProgress(false)
        return
      }

      // Check if user is already signed in
      const accounts = msalInstance.getAllAccounts()
      if (accounts.length > 0) {
        console.log("User already signed in, using existing account")
        await handleAuthSuccess(accounts[0])
        setIsInteractionInProgress(false)
        return
      }

      // Ensure MSAL is initialized
      await msalInstance.initialize()

      const response: AuthenticationResult = await msalInstance.loginPopup(loginRequest)
      if (response.account) {
        await handleAuthSuccess(response.account)
      }
    } catch (error) {
      console.error("Login error:", error)
      setIsLoading(false)
    } finally {
      setIsInteractionInProgress(false)
    }
  }

  const logout = () => {
    if (isInteractionInProgress) {
      console.log("Interaction in progress, cannot logout now")
      return
    }

    void signOut()
  }

  // Demo mode: the server signs us in as the seeded database user for NEXT_PUBLIC_DEMO_PERSONA.
  // It only works against a development server (see /api/auth/session).
  const signInAsDemoUser = async (): Promise<boolean> => {
    try {
      const response = await fetch('/api/auth/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ demo: true }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok || !data.success) {
        console.error("Demo mode sign-in failed:", data.error)
        return false
      }
      applySession(data)
      return true
    } catch (error) {
      console.error("Demo mode sign-in failed:", error)
      return false
    }
  }

  const createProfile = async (profileData: Partial<UserProfile>) => {
    try {
      if (!user) {
        throw new Error("No authenticated user found")
      }

      // Update existing user profile via API
      const response = await fetch('/api/users/update', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: profileData.name || user.name,
          grade: profileData.grade,
          department: profileData.department,
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update profile')
      }

      const data = await response.json()
      const updatedUser = data.user
      
      // Convert to UserProfile format
      const updatedProfile: UserProfile = {
        id: updatedUser.id,
        email: updatedUser.email,
        name: updatedUser.name,
        role: updatedUser.role,
        grade: updatedUser.grade,
        department: updatedUser.department,
        interests: profileData.interests || user.interests || [],
        createdAt: new Date(updatedUser.created_at),
        updatedAt: new Date(updatedUser.updated_at),
      }
      
      setUser(updatedProfile)
      setHasProfile(true)
    } catch (error) {
      console.error("Error updating profile:", error)
      throw error
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated,
    isLoading,
    hasProfile,
    isTeacher,
    login,
    logout,
    createProfile,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
