"use client"

import { useAuth } from "@/contexts/auth-context"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { useTheme } from "next-themes"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import {
  User,
  Shield,
  Crown,
  Users,
  FileText,
  Heart,
  Settings as SettingsIcon,
  Mail,
  Calendar,
  Award,
  Building,
  ArrowLeft,
  Bell,
  Moon,
  Sun,
  Palette,
  HelpCircle,
} from "lucide-react"
import Link from "next/link"

interface UserStats {
  clubsJoined: number
  clubsPresidentOf: number
  clubsOfficerOf: number
  clubsSponsoring: number
  postsCreated: number
  postsLiked: number
  isCoordinator: boolean
  isSponsor: boolean
  isPresident: boolean
  isOfficer: boolean
}

export default function SettingsPage() {
  const { user } = useAuth()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  const [stats, setStats] = useState<UserStats | null>(null)
  const [loading, setLoading] = useState(true)

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    loadUserStats()
  }, [user, router])

  const loadUserStats = async () => {
    if (!user) return

    try {
      setLoading(true)
      const response = await fetch(`/api/users/stats?userId=${user.id}`)
      if (response.ok) {
        const data = await response.json()
        setStats(data.data)
      }
    } catch (error) {
      console.error("Error loading user stats:", error)
    } finally {
      setLoading(false)
    }
  }

  if (!user) {
    return null
  }

  const getUserRoleLabel = () => {
    if (stats?.isCoordinator) return "School Coordinator"
    if (stats?.isSponsor) return "Club Sponsor (Teacher)"
    if (stats?.isPresident) return "Club President"
    if (stats?.isOfficer) return "Club Officer"
    return "Member"
  }

  const getUserRoleColor = () => {
    if (stats?.isCoordinator) return "bg-purple-100 text-purple-800"
    if (stats?.isSponsor) return "bg-blue-100 text-blue-800"
    if (stats?.isPresident) return "bg-sky-100 text-sky-800"
    if (stats?.isOfficer) return "bg-green-100 text-green-800"
    return "bg-gray-100 text-gray-800"
  }

  const getUserRoleIcon = () => {
    if (stats?.isCoordinator) return Shield
    if (stats?.isSponsor) return Award
    if (stats?.isPresident) return Crown
    if (stats?.isOfficer) return Users
    return User
  }

  const RoleIcon = getUserRoleIcon()

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:py-8 space-y-4 sm:space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-2 sm:mb-4" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <SettingsIcon className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Settings & Profile</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            View your account information and statistics
          </p>
        </div>
      </div>

      {/* Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Profile Information</CardTitle>
          <CardDescription>Your account details and role</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="flex items-start gap-4">
            <div className="flex-1 space-y-2">
              <h2 className="text-2xl font-bold">{user.name}</h2>
              <div className="flex flex-wrap gap-2">
                <Badge className={getUserRoleColor()}>
                  <RoleIcon className="h-3 w-3 mr-1" />
                  {getUserRoleLabel()}
                </Badge>
                {user.userType === "None" && (
                  <Badge variant="outline" className="bg-blue-50 text-blue-700">
                    <Award className="h-3 w-3 mr-1" />
                    Verified Teacher
                  </Badge>
                )}
              </div>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Email</p>
                <p className="font-medium">{user.email}</p>
              </div>
            </div>

            {user.grade && (
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Grade</p>
                  <p className="font-medium">{user.grade}</p>
                </div>
              </div>
            )}

            {user.department && (
              <div className="flex items-center gap-3">
                <Building className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Department</p>
                  <p className="font-medium">{user.department}</p>
                </div>
              </div>
            )}

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Member Since</p>
                <p className="font-medium">
                  {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>

        </CardContent>
      </Card>

      {/* Dark Mode (Temporarily Disabled) */}
      {/* <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" />
            Appearance
          </CardTitle>
        </CardHeader>
        <CardContent>
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
                  {mounted && theme === 'dark'
                    ? 'Dark'
                    : 'Light'}
                </p>
              </div>
            </div>
            <Switch
              id="dark-mode"
              checked={mounted && theme === 'dark'}
              onCheckedChange={(checked) => setTheme(checked ? 'dark' : 'light')}
            />
          </div>
        </CardContent>
      </Card>
      \*}

      {/* Statistics */}
      {loading ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading statistics...</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle>Statistics</CardTitle>
              <CardDescription>Your participation & engagement</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-muted rounded-[16px]">
                  <Users className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stats?.clubsJoined || 0}</p>
                  <p className="text-xs text-muted-foreground">Clubs Joined</p>
                </div>

                <div className="text-center p-4 bg-muted rounded-[16px]">
                  <Crown className="h-6 w-6 mx-auto mb-2 text-sky-600" />
                  <p className="text-2xl font-bold">{stats?.clubsPresidentOf || 0}</p>
                  <p className="text-xs text-muted-foreground">President Of</p>
                </div>

                <div className="text-center p-4 bg-muted rounded-[16px]">
                  <Award className="h-6 w-6 mx-auto mb-2 text-green-600" />
                  <p className="text-2xl font-bold">{stats?.clubsOfficerOf || 0}</p>
                  <p className="text-xs text-muted-foreground">Officer Of</p>
                </div>

                {stats?.isSponsor && (
                  <div className="text-center p-4 bg-muted rounded-[16px]">
                    <Shield className="h-6 w-6 mx-auto mb-2 text-blue-600" />
                    <p className="text-2xl font-bold">{stats?.clubsSponsoring || 0}</p>
                    <p className="text-xs text-muted-foreground">Sponsoring</p>
                  </div>
                )}
              </div>
            </CardContent>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-4 bg-muted rounded-[16px]">
                  <FileText className="h-6 w-6 mx-auto mb-2 text-primary" />
                  <p className="text-2xl font-bold">{stats?.postsCreated || 0}</p>
                  <p className="text-xs text-muted-foreground">Posts Created</p>
                </div>

                <div className="text-center p-4 bg-muted rounded-[16px]">
                  <Heart className="h-6 w-6 mx-auto mb-2 text-red-600" />
                  <p className="text-2xl font-bold">{stats?.postsLiked || 0}</p>
                  <p className="text-xs text-muted-foreground">Posts Liked</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
