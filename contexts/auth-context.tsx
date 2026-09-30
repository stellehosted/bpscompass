"use client"

import React, { createContext, useContext, useEffect, useState } from "react"
import { PublicClientApplication, AccountInfo, AuthenticationResult } from "@azure/msal-browser"
import { msalConfig, loginRequest, isBerkeleyPrepEmail, getRememberMe, UserProfile } from "@/lib/auth-config"
import { DEMO_MODE, DEMO_EMAIL } from "@/lib/demo-mode"
import { debugMSAL } from "@/lib/debug-msal"
import { setupCryptoPolyfill, isSecureContext, getSecurityWarning } from "@/lib/crypto-polyfill"
import { autoFixStuckInteraction, clearMSALCache } from "@/lib/clear-msal-cache"
import { formatDisplayName } from "@/lib/utils"
// Removed server-side imports to prevent bundling issues

interface AuthContextType {
  user: UserProfile | null
  isAuthenticated: boolean
  isLoading: boolean
  hasProfile: boolean
  isTeacher: boolean
  login: () => Promise<void>
  logout: () => void
  createProfile: (profileData: Partial<UserProfile>) => Promise<void>
  getUserFromDatabase: (email: string) => Promise<UserProfile | null>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Setup crypto polyfill BEFORE initializing MSAL
if (typeof window !== 'undefined') {
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

// Initialize MSAL (after polyfill is set up)
const msalInstance = new PublicClientApplication(msalConfig)

// Use API calls instead of direct service imports

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

  const handleAuthSuccess = async (account: AccountInfo) => {
    try {
      // Check if interaction is already in progress
      if (isInteractionInProgress) {
        console.warn("Skipping auth - interaction already in progress")
        return
      }

      // Get user info from Microsoft Graph
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

      if (response) {
        try {
          // Debug: Log account info
          debugMSAL.logAccountInfo(account)
          
          const userInfo = await getUserInfo(response.accessToken)
          
          // Check if userInfo has required properties
          if (!userInfo || !userInfo.email) {
            console.error("Failed to get user info from Microsoft Graph")
            setIsLoading(false)
            return
          }
          
          // Check if email is from BPS
          if (!isBerkeleyPrepEmail(userInfo.email)) {
            alert("Only BPS School email addresses are allowed to access this application.")
            logout()
            return
          }

          // Atomic authentication and registration: immediately upsert user to database
          await upsertUserToDatabase(userInfo.email, formatDisplayName(userInfo.displayName || userInfo.name || ""))

          // Retrieve user profile and teacher status in parallel — zero extra latency.
          const [databaseUser, teacherData] = await Promise.all([
            getUserFromDatabase(userInfo.email),
            fetch(`/api/users/check-teacher?email=${encodeURIComponent(userInfo.email)}`)
              .then((r) => r.json())
              .catch(() => ({ isTeacher: false })),
          ])
          if (databaseUser) {
            setUser(databaseUser)
            setIsTeacher(teacherData.isTeacher ?? false)
            setIsAuthenticated(true)
            // User always has a profile after authentication since we create it in the database
            setHasProfile(true)
          } else {
            throw new Error("Failed to retrieve user from database after creation")
          }
        } catch (graphError) {
          console.error("Microsoft Graph API error:", graphError)
          
          // Fallback: try to get basic info from the account
          if (account.username) {
            console.log("Using fallback account info:", account)
            
            // Check if email is from BPS
            if (!isBerkeleyPrepEmail(account.username)) {
              alert("Only BPS School email addresses are allowed to access this application.")
              logout()
              return
            }

            try {
              // Atomic authentication and registration with fallback data
              await upsertUserToDatabase(account.username, formatDisplayName(account.name || ""))

              // Retrieve user profile and teacher status in parallel.
              const [databaseUser, teacherData] = await Promise.all([
                getUserFromDatabase(account.username),
                fetch(`/api/users/check-teacher?email=${encodeURIComponent(account.username)}`)
                  .then((r) => r.json())
                  .catch(() => ({ isTeacher: false })),
              ])
              if (databaseUser) {
                setUser(databaseUser)
                setIsTeacher(teacherData.isTeacher ?? false)
                setIsAuthenticated(true)
                // User always has a profile after authentication since we create it in the database
                setHasProfile(true)
              } else {
                throw new Error("Failed to retrieve user from database after creation")
              }
            } catch (dbError) {
              console.error("Database error during fallback authentication:", dbError)
              
              // More specific error message
              if (dbError instanceof Error && dbError.message.includes('Failed to sync user')) {
                alert("Failed to register user in database. Please check your connection and try again.")
              } else {
                alert("Failed to register user. Please try again or contact support.")
              }
              setIsLoading(false)
              return
            }
          } else {
            console.error("No fallback email available")
            setIsLoading(false)
          }
        }
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

  const getUserInfo = async (accessToken: string) => {
    try {
      // Try to get user info with email field explicitly requested
      const response = await fetch("https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName,email", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      })
      
      if (!response.ok) {
        throw new Error(`Microsoft Graph API error: ${response.status} ${response.statusText}`)
      }
      
      const userInfo = await response.json()
      console.log("Microsoft Graph API response:", userInfo) // Debug log
      
      // Check for email in various possible fields
      const email = userInfo.mail || userInfo.email || userInfo.userPrincipalName
      
      if (!userInfo || !email) {
        console.error("User info received:", userInfo)
        throw new Error("Microsoft Graph API returned incomplete user information. Email field not found.")
      }
      
      // Return userInfo with email field normalized
      return {
        ...userInfo,
        email: email
      }
    } catch (error) {
      console.error("Error fetching user info:", error)
      throw error
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
          alert(`Couldn't find the demo user (${DEMO_EMAIL}) in the database. Load the test data with scripts/reset-db.sh, then try again.`)
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
    
    msalInstance.logout()
    setUser(null)
    setIsAuthenticated(false)
    setHasProfile(false)
    setIsInteractionInProgress(false)
  }

  const getUserFromDatabase = async (email: string): Promise<UserProfile | null> => {
    try {
      const response = await fetch('/api/users/by-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })
      
      if (!response.ok) {
        return null
      }
      
      const data = await response.json()
      if (!data.success || !data.user) {
        return null
      }

      const user = data.user
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        grade: user.grade,
        department: user.department,
        interests: [], // Not stored in database yet
        createdAt: new Date(user.created_at),
        updatedAt: new Date(user.updated_at),
      }
    } catch (error) {
      console.error("Error retrieving user from database:", error)
      return null
    }
  }

  // Demo mode: sign in as the seeded database user for NEXT_PUBLIC_DEMO_PERSONA
  const signInAsDemoUser = async (): Promise<boolean> => {
    const demoUser = await getUserFromDatabase(DEMO_EMAIL)
    if (!demoUser) {
      console.error(`Demo mode: no user with email ${DEMO_EMAIL} in the database. Load the test data with scripts/reset-db.sh.`)
      return false
    }
    setUser(demoUser)
    setIsTeacher(demoUser.role === "sponsor")
    setIsAuthenticated(true)
    setHasProfile(true)
    return true
  }

  const upsertUserToDatabase = async (email: string, name: string): Promise<void> => {
    try {
      const response = await fetch('/api/users/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          role: 'student'
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        console.error('Sync API error:', errorData)
        throw new Error(errorData.error || 'Failed to sync user')
      }
      
      const result = await response.json()
      console.log('User sync successful:', result)
    } catch (error) {
      console.error("Error upserting user to database:", error)
      throw new Error(`Database registration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
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
          id: user.id,
          name: profileData.name || user.name,
          role: profileData.role || user.role,
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
    getUserFromDatabase,
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
