"use client"

import { notify } from "@/lib/notify"
import { useAuth } from "@/contexts/auth-context"
import { SponsorDashboard } from "@/components/dashboardSponsor"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function SponsorPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(true)

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    // Check if user is a teacher (userType = 'None')
    // This is a simple client-side check, server-side verification happens in APIs
    const checkTeacherStatus = async () => {
      try {
        // You could add an API call here to verify teacher status
        // For now, we'll just check if they have any sponsored clubs
        const response = await fetch(`/api/sponsor/clubs?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          // If they have sponsored clubs or are verified teacher, allow access
          setIsVerifying(false)
        } else {
          // Not a sponsor, redirect
          notify.error("You must be a verified teacher to access the sponsor dashboard")
          router.push("/")
        }
      } catch (error) {
        console.error("Error verifying sponsor status:", error)
        router.push("/")
      }
    }

    checkTeacherStatus()
  }, [user, router])

  if (!user || isVerifying) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying access...</p>
        </div>
      </div>
    )
  }

  return <SponsorDashboard userId={user.id} />
}
