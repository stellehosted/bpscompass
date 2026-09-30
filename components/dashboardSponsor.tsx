"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Shield, Users, AlertCircle, CheckCircle, XCircle, Clock } from "lucide-react"
import Link from "next/link"

interface SponsoredClub {
  id: string
  name: string
  image_url: string | null
  member_count: number
  pending_requests: number
  sponsor_since: string
}

interface LeadershipRequest {
  id: string
  club_id: string
  club_name: string
  club_image: string | null
  action_type: string
  target_name: string
  target_email: string
  requester_name: string
  created_at: string
}

export function SponsorDashboard({ userId }: { userId: string }) {
  const [clubs, setClubs] = useState<SponsoredClub[]>([])
  const [requests, setRequests] = useState<LeadershipRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [processingRequest, setProcessingRequest] = useState<string | null>(null)

  const loadData = async () => {
    try {
      setLoading(true)
      
      // Load sponsored clubs
      const clubsResponse = await fetch(`/api/sponsor/clubs?userId=${userId}`)
      if (clubsResponse.ok) {
        const clubsData = await clubsResponse.json()
        setClubs(clubsData.data || [])
      }

      // Load pending requests
      const requestsResponse = await fetch(`/api/sponsor/requests?userId=${userId}`)
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json()
        setRequests(requestsData.data || [])
      }
    } catch (error) {
      console.error("Error loading sponsor data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [userId])

  const handleRequest = async (requestId: string, action: "approve" | "reject") => {
    setProcessingRequest(requestId)

    try {
      const response = await fetch(`/api/sponsor/requests/${requestId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, action }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message)
        await loadData() // Reload data
      } else {
        const data = await response.json()
        alert(data.error || "Failed to process request")
      }
    } catch (error) {
      console.error("Error processing request:", error)
      alert("Failed to process request. Please try again.")
    } finally {
      setProcessingRequest(null)
    }
  }

  const getActionLabel = (actionType: string) => {
    switch (actionType) {
      case "add_president": return "Add Co-President"
      case "remove_president": return "Remove President"
      case "add_officer": return "Add Officer"
      case "remove_officer": return "Remove Officer"
      default: return actionType
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sponsor dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Shield className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Sponsor Dashboard</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Manage your sponsored clubs and approve leadership changes
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{clubs.length}</p>
              <p className="text-sm text-muted-foreground">Sponsored Clubs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{requests.length}</p>
              <p className="text-sm text-muted-foreground">Pending Requests</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Pending Leadership Requests */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending Leadership Requests
          </CardTitle>
        </CardHeader>
        <CardContent>
          {requests.length > 0 ? (
            <div className="space-y-4">
              {requests.map((request) => (
                <div key={request.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{request.target_name}</p>
                        <p className="text-sm text-muted-foreground truncate">{request.target_email}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="flex-shrink-0">
                      {getActionLabel(request.action_type)}
                    </Badge>
                  </div>

                  <div className="bg-muted rounded-lg p-3 text-sm">
                    <p>
                      <span className="font-medium">{request.requester_name}</span> requested to{" "}
                      <span className="font-medium">{getActionLabel(request.action_type).toLowerCase()}</span> for{" "}
                      <span className="font-medium">{request.club_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {new Date(request.created_at).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => handleRequest(request.id, "approve")}
                      disabled={processingRequest === request.id}
                      className="flex-1"
                      size="sm"
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      Approve
                    </Button>
                    <Button
                      onClick={() => handleRequest(request.id, "reject")}
                      disabled={processingRequest === request.id}
                      variant="outline"
                      className="flex-1"
                      size="sm"
                    >
                      <XCircle className="h-4 w-4 mr-2" />
                      Reject
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">No pending requests</p>
          )}
        </CardContent>
      </Card>

      {/* Sponsored Clubs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Your Sponsored Clubs
          </CardTitle>
        </CardHeader>
        <CardContent>
          {clubs.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clubs.map((club) => (
                <Link key={club.id} href={`/clubs/${club.id}`}>
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-3">
                        {club.image_url && <img src={club.image_url} alt={club.name} className="h-16 w-16 rounded-lg object-cover flex-shrink-0" />}
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold truncate">{club.name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {club.member_count} members
                          </p>
                          <div className="flex gap-2 mt-2">
                            {club.pending_requests > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <AlertCircle className="h-3 w-3 mr-1" />
                                {club.pending_requests} requests
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              You are not sponsoring any clubs yet
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
