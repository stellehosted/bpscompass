"use client"

import { notify } from "@/lib/notify"
import { useAuth } from "@/contexts/auth-context"
import { AdminDashboard } from "@/components/dashboardAdmin"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

export default function AdminPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [isVerifying, setIsVerifying] = useState(true)
  const [isCoordinator, setIsCoordinator] = useState(false)

  useEffect(() => {
    if (!user) {
      router.push("/")
      return
    }

    const checkCoordinatorStatus = async () => {
      try {
        const response = await fetch(`/api/users/stats?userId=${user.id}`)
        if (response.ok) {
          const data = await response.json()
          if (data.data?.isCoordinator) {
            setIsCoordinator(true)
            setIsVerifying(false)
          } else {
            notify.error("You must be a coordinator to access the admin dashboard")
            router.push("/")
          }
        } else {
          router.push("/")
        }
      } catch (error) {
        console.error("Error verifying coordinator status:", error)
        router.push("/")
      }
    }

    checkCoordinatorStatus()
  }, [user, router])

  if (!user || isVerifying) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Verifying admin access...</p>
        </div>
      </div>
    )
  }

  if (!isCoordinator) {
    return null
  }

  return <AdminDashboard userId={user.id} />
}
