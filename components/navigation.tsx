"use client"

import { useState, useEffect, useCallback } from "react"
import { useAuth } from "@/contexts/auth-context"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Home, Users, Bell, Settings, LogOut, Menu, HelpCircle, User, Shield, LayoutDashboard } from "lucide-react"
import { UserProfile } from "@/lib/auth-config"
import { UserSettingsDialog } from "./dialogUserSettings"
import { Logo } from "./logo"
import Link from "next/link"

type ActiveSection = "home" | "clubs" | "notifications"

interface NavigationProps {
  activeSection: ActiveSection
  onSectionChange: (section: ActiveSection) => void
  user: UserProfile | null
  onLogout: () => void
}

export function Navigation({ activeSection, onSectionChange, user, onLogout }: NavigationProps) {
  const { isTeacher } = useAuth()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [mobileDropdownOpen, setMobileDropdownOpen] = useState(false)
  const [notificationCount, setNotificationCount] = useState(0)
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [isSponsor, setIsSponsor] = useState(false)

  // Dashboard links depend on roles, which only the stats endpoint reports. Fetched once, not polled.
  useEffect(() => {
    if (!user?.id) return
    fetch(`/api/users/stats?userId=${user.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setIsCoordinator(!!data?.data?.isCoordinator)
        setIsSponsor(!!data?.data?.isSponsor)
      })
      .catch((error) => console.error("Error fetching user roles:", error))
  }, [user?.id])

  const fetchNotificationCount = useCallback(async () => {
    if (!user?.id || document.hidden) return
    try {
      const response = await fetch(`/api/notifications/count?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setNotificationCount(data.count || 0)
      }
    } catch (error) {
      console.error('Error fetching notification count:', error)
    }
  }, [user?.id])

  useEffect(() => {
    fetchNotificationCount()
    // Poll every 3 minutes — reduces Vercel function invocations significantly
    const interval = setInterval(fetchNotificationCount, 3 * 60 * 1000)

    // Pause polling while tab is hidden; fetch immediately when tab becomes visible
    const handleVisibilityChange = () => {
      if (!document.hidden) fetchNotificationCount()
    }
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [fetchNotificationCount])

  const handleOpenSettings = () => {
    // Close dropdown first
    setDropdownOpen(false)
    setMobileDropdownOpen(false)
    // Blur any active element to remove focus
    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur()
    }
    // Open settings dialog after a brief delay
    setTimeout(() => setSettingsOpen(true), 100)
  }

  const dashboardItems = (
    <>
      {isCoordinator && (
        <Link href="/admin">
          <DropdownMenuItem className="font-bold text-xs tracking-wide cursor-pointer">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            <span>Admin Dashboard</span>
          </DropdownMenuItem>
        </Link>
      )}
      {isSponsor && (
        <Link href="/sponsor">
          <DropdownMenuItem className="font-bold text-xs tracking-wide cursor-pointer">
            <Shield className="mr-2 h-4 w-4" />
            <span>Sponsor Dashboard</span>
          </DropdownMenuItem>
        </Link>
      )}
    </>
  )

  const navItems = [
    { id: "home" as const, label: "Home", icon: Home },
    { id: "clubs" as const, label: "Clubs", icon: Users },
  ]

  return (
    <>
      {/* Desktop top bar */}
      <nav className="hidden md:block fixed top-0 left-0 right-0 z-50 bg-background border-b border-border">
        <div className="max-w-7xl mx-auto px-4 lg:px-8">
          <div className="grid grid-cols-[1fr_auto_1fr] items-center h-16">
            {/* Logo and brand */}
            <div className="flex items-center gap-3 justify-self-start">
              <Logo className="h-9 w-9" />
              <div>
                <span className="text-xl font-black text-foreground tracking-tight">
                  BPS Compass
                </span>
              </div>
            </div>

            {/* Navigation items */}
            <div className="flex items-center gap-2">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = activeSection === item.id

                return (
                  <Button
                    key={item.id}
                    variant={isActive ? "default" : "outline"}
                    className={`gap-2 ${isActive ? "" : "bg-background"}`}
                    onClick={() => onSectionChange(item.id)}
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Button>
                )
              })}

              <Button
                variant={activeSection === "notifications" ? "default" : "outline"}
                className={`relative gap-2 ${activeSection === "notifications" ? "" : "bg-background"}`}
                onClick={() => onSectionChange("notifications")}
              >
                <Bell className="h-4 w-4" />
                Alerts
                {notificationCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-secondary-foreground">
                    {notificationCount > 9 ? '9+' : notificationCount}
                  </span>
                )}
              </Button>
            </div>

            {/* Right side actions */}
            <div className="flex items-center gap-3 justify-self-end">
              {/* User menu */}
              {user ? (
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="relative h-11 w-11 p-0 flex items-center justify-center rounded-full bg-primary text-primary-foreground hover:brightness-110 transition-all">
                      <User className="h-6 w-6" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="w-56" align="end" forceMount>
                    <div className="flex flex-col space-y-1 p-3 bg-secondary/10 -m-1 mb-1">
                      <p className="text-sm font-bold leading-none">{user.name || "User"}</p>
                      <p className="text-xs leading-none text-muted-foreground font-medium">{user.email}</p>
                      <div className="flex items-center gap-2 mt-2">
                        {isTeacher ? (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground font-bold">
                            Teacher
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-bold capitalize">
                            {user.role}
                          </span>
                        )}
                      </div>
                    </div>
                    <DropdownMenuItem
                      className="font-bold text-xs tracking-wide cursor-pointer"
                      onSelect={(e) => {
                        e.preventDefault()
                        handleOpenSettings()
                      }}
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      <span>Settings</span>
                    </DropdownMenuItem>
                    {dashboardItems}
                    <Link href="/faq">
                      <DropdownMenuItem className="font-bold text-xs tracking-wide cursor-pointer">
                        <HelpCircle className="mr-2 h-4 w-4" />
                        <span>FAQ & Support</span>
                      </DropdownMenuItem>
                    </Link>
                    <DropdownMenuSeparator className="bg-foreground/20" />
                    <DropdownMenuItem onClick={onLogout} className="font-bold text-xs tracking-wide cursor-pointer text-destructive focus:text-destructive">
                      <LogOut className="mr-2 h-4 w-4" />
                      <span>Log out</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                // Show placeholder when no user (during loading or not authenticated)
                <div className="h-11 w-11 rounded-full bg-muted animate-pulse" />
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile bottom tab bar — sits above the home indicator / Safari chrome */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-background border-t border-border pb-[env(safe-area-inset-bottom)]">
        <div className="grid grid-cols-4 h-14">
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = activeSection === item.id

            return (
              <button
                key={item.id}
                onClick={() => onSectionChange(item.id)}
                className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide ${
                  isActive ? "text-secondary" : "text-muted-foreground"
                }`}
              >
                <Icon className="h-5 w-5" />
                {item.label}
              </button>
            )
          })}

          <button
            onClick={() => onSectionChange("notifications")}
            className={`flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide ${
              activeSection === "notifications" ? "text-secondary" : "text-muted-foreground"
            }`}
          >
            <span className="relative">
              <Bell className="h-5 w-5" />
              {notificationCount > 0 && (
                <span className="absolute -top-1 -right-2 h-3.5 w-3.5 rounded-full bg-secondary flex items-center justify-center text-[8px] font-bold text-secondary-foreground">
                  {notificationCount > 9 ? '9+' : notificationCount}
                </span>
              )}
            </span>
            Alerts
          </button>

          <DropdownMenu open={mobileDropdownOpen} onOpenChange={setMobileDropdownOpen}>
            <DropdownMenuTrigger asChild>
              <button className="flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold tracking-wide text-muted-foreground">
                <Menu className="h-5 w-5" />
                More
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="end" className="w-56 mb-2">
              {/* User info */}
              {user && (
                <div className="flex items-center gap-3 p-3 bg-secondary/10 -m-1 mb-1">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <User className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold leading-none truncate">{user.name || "User"}</p>
                    <p className="text-xs leading-none text-muted-foreground mt-1 truncate">{user.email}</p>
                  </div>
                </div>
              )}

              <DropdownMenuItem
                className="font-bold text-xs tracking-wide cursor-pointer"
                onSelect={(e) => {
                  e.preventDefault()
                  handleOpenSettings()
                }}
              >
                <Settings className="mr-2 h-4 w-4" />
                <span>Settings</span>
              </DropdownMenuItem>

              {dashboardItems}

              <Link href="/faq">
                <DropdownMenuItem className="font-bold text-xs tracking-wide cursor-pointer">
                  <HelpCircle className="mr-2 h-4 w-4" />
                  <span>FAQ & Support</span>
                </DropdownMenuItem>
              </Link>

              <DropdownMenuSeparator className="bg-foreground/20" />

              <DropdownMenuItem onClick={onLogout} className="font-bold text-xs tracking-wide cursor-pointer text-destructive focus:text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                <span>Log out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </nav>

      {/* Settings Dialog */}
      {user && settingsOpen && (
        <UserSettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          user={user}
          isTeacher={isTeacher}
        />
      )}
    </>
  )
}
