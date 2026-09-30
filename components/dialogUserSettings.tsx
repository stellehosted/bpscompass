"use client"

import { useState, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { User, Mail, GraduationCap, Users, Crown, Shield, Calendar, Award, FileText, Heart } from "lucide-react"
import { NotificationSettings } from "@/components/notificationSettings"
import { UserProfile } from "@/lib/auth-config"

interface UserSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  user: UserProfile
  isTeacher: boolean
}

interface UserStats {
  clubsJoined: number
  clubsPresidentOf: number
  clubsOfficerOf: number
  clubsSponsoring: number
  postsCreated: number
  postsLiked: number
}

function StatTile({ icon: Icon, color, value, label }: { icon: React.ElementType; color: string; value?: number; label: string }) {
  return (
    <div className="min-w-0 text-center p-2 sm:p-3 bg-muted rounded-[16px]">
      <Icon className={`h-4 w-4 sm:h-5 sm:w-5 mx-auto mb-1 ${color}`} />
      <p className="text-lg sm:text-xl font-bold">{value || 0}</p>
      <p className="text-[10px] sm:text-xs leading-tight text-muted-foreground">{label}</p>
    </div>
  )
}

export function UserSettingsDialog({ open, onOpenChange, user, isTeacher }: UserSettingsDialogProps) {
  const [isCoordinator, setIsCoordinator] = useState(false)
  const [isSponsor, setIsSponsor] = useState(false)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (open && user) {
      loadUserData()
    }
  }, [open, user])

  const loadUserData = async () => {
    try {
      setLoading(true)

      // isTeacher comes from auth context via prop, no fetch needed here.
      const statsResponse = await fetch(`/api/users/stats?userId=${user.id}`)

      if (statsResponse.ok) {
        const statsData = await statsResponse.json()
        if (statsData.data) {
          setIsCoordinator(statsData.data.isCoordinator)
          setIsSponsor(statsData.data.isSponsor)
          setStats(statsData.data)
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Profile & Settings</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Profile */}
          <Card className="gap-0">
            <CardHeader className="flex-row flex-wrap items-center gap-x-3 gap-y-2">
              <CardTitle>{user.name}</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                {isCoordinator ? (
                  <Badge className="bg-purple-100 text-purple-800">
                    <Shield className="h-3 w-3 mr-1" />
                    Admin
                  </Badge>
                ) : isTeacher ? (
                  <Badge className="bg-blue-100 text-blue-800">
                    <GraduationCap className="h-3 w-3 mr-1" />
                    Teacher
                  </Badge>
                ) : (
                  <Badge variant="outline">
                    <User className="h-3 w-3 mr-1" />
                    Student
                  </Badge>
                )}
                {user.grade && (
                  <Badge variant="outline" className="text-xs">
                    Grade {user.grade}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2 sm:gap-3">
                <Mail className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Email</p>
                  <p className="text-[clamp(9px,3vw,16px)] sm:text-base font-medium whitespace-nowrap leading-tight">{user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:gap-3">
                <Calendar className="h-4 w-4 sm:h-5 sm:w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="text-[10px] sm:text-sm text-muted-foreground">Member Since</p>
                  <p className="text-[11px] sm:text-base font-medium leading-tight">{new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Notifications */}
          <NotificationSettings />

          {/* Dark Mode (Temporarily Disabled) — add a <Separator /> above it when re-enabled.
              To re-enable: import { useTheme } from "next-themes", Switch, Label, and Moon/Sun/Palette
              from lucide-react; add `const { theme, setTheme } = useTheme()` and a `mounted` state
              (set in a useEffect) to avoid a hydration mismatch.
          <div className="space-y-3">
            <h4 className="text-sm font-semibold flex items-center gap-2">
              <Palette className="h-4 w-4" />
              Appearance
            </h4>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {mounted && theme === 'dark' ? (
                  <Moon className="h-5 w-5 text-muted-foreground" />
                ) : (
                  <Sun className="h-5 w-5 text-muted-foreground" />
                )}
                <div>
                  <Label htmlFor="dark-mode" className="text-base font-medium">
                    Dark Mode
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {mounted && theme === 'dark' ? 'Dark' : 'Light'}
                  </p>
                </div>
              </div>
              <Switch
                id="dark-mode"
                checked={mounted && theme === 'dark'}
                onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
              />
            </div>
          </div>
          */}
        </div>

        {/* Statistics */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Statistics</h4>
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading statistics...</p>
            ) : (
              <div className="space-y-3">
                <div className={`grid gap-2 sm:gap-3 ${isSponsor ? "grid-cols-4" : "grid-cols-3"}`}>
                  {[
                    { icon: Users, color: "text-primary", value: stats?.clubsJoined, label: "Clubs Joined" },
                    { icon: Crown, color: "text-sky-600", value: stats?.clubsPresidentOf, label: "President Of" },
                    { icon: Award, color: "text-green-600", value: stats?.clubsOfficerOf, label: "Officer Of" },
                    ...(isSponsor
                      ? [{ icon: Shield, color: "text-blue-600", value: stats?.clubsSponsoring, label: "Sponsoring" }]
                      : []),
                  ].map(({ icon: Icon, color, value, label }) => (
                    <StatTile key={label} icon={Icon} color={color} value={value} label={label} />
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3">
                  <StatTile icon={FileText} color="text-primary" value={stats?.postsCreated} label="Posts Created" />
                  <StatTile icon={Heart} color="text-red-600" value={stats?.postsLiked} label="Posts Liked" />
                </div>
              </div>
            )}
          </div>
      </DialogContent>
    </Dialog>
  )
}
