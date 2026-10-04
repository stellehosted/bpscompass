"use client"

import { notify } from "@/lib/notify"
import { confirmDialog } from "@/lib/confirm"
import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Settings,
  Users,
  FileText,
  Plus,
  Trash2,
  Crown,
  UserMinus,
  Building,
  Search,
  RefreshCw,
  AlertCircle,
  ArrowLeft,
  Mail,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import Link from "next/link"
import { ClubsContent } from "@/components/clubsPage"
import { HomeContent } from "@/components/homePage"

interface Club {
  id: string
  name: string
  description: string
  image_url: string | null
  is_claimed: boolean
  president_id: string | null
  president_name: string | null
  member_count: number
}

interface ClubMember {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  joined_at: string
}

export function AdminDashboard({ userId }: { userId: string }) {
  const [activeTab, setActiveTab] = useState("clubs")
  const [clubs, setClubs] = useState<Club[]>([])
  const [posts, setPosts] = useState<unknown[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  // ClubsContent keeps its own club list, so bumping this key remounts it to reload
  const [clubsVersion, setClubsVersion] = useState(0)

  // Create club dialog
  const [showCreateClub, setShowCreateClub] = useState(false)
  const [newClub, setNewClub] = useState({
    name: "",
    description: "",
    meetingTime: "",
    location: "",
  })
  const [creatingClub, setCreatingClub] = useState(false)

  // Membership management
  const [selectedClub, setSelectedClub] = useState<Club | null>(null)
  const [clubMembers, setClubMembers] = useState<ClubMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [memberToRemove, setMemberToRemove] = useState<ClubMember | null>(null)
  const [removingMember, setRemovingMember] = useState(false)

  const loadClubs = async () => {
    try {
      const response = await fetch("/api/clubs")
      if (response.ok) {
        const data = await response.json()
        setClubs(data.data || [])
      }
    } catch (error) {
      console.error("Error loading clubs:", error)
    }
  }

  const loadPosts = async () => {
    try {
      const response = await fetch("/api/feed?limit=50")
      if (response.ok) {
        const data = await response.json()
        setPosts(data.data || [])
      }
    } catch (error) {
      console.error("Error loading posts:", error)
    }
  }

  const loadData = async () => {
    setLoading(true)
    await Promise.all([loadClubs(), loadPosts()])
    setClubsVersion((v) => v + 1)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const loadClubMembers = async (clubId: string) => {
    setLoadingMembers(true)
    try {
      const response = await fetch(`/api/clubs/${clubId}/members`)
      if (response.ok) {
        const data = await response.json()
        setClubMembers(data.data || [])
      }
    } catch (error) {
      console.error("Error loading members:", error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleCreateClub = async () => {
    if (!newClub.name || !newClub.description) {
      notify.error("Please fill in all required fields")
      return
    }

    setCreatingClub(true)
    try {
      const response = await fetch("/api/clubs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newClub),
      })

      if (response.ok) {
        notify.success("Club created successfully!")
        setShowCreateClub(false)
        setNewClub({
          name: "",
          description: "",
          meetingTime: "",
          location: "",
        })
        await loadClubs()
        setClubsVersion((v) => v + 1)
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to create club")
      }
    } catch (error) {
      console.error("Error creating club:", error)
      notify.error("Failed to create club")
    } finally {
      setCreatingClub(false)
    }
  }

  const handleRemovePresident = async () => {
    if (!memberToRemove || !selectedClub) return

    setRemovingMember(true)
    try {
      // Remove from club_members and update club
      const response = await fetch(
        `/api/admin/clubs/${selectedClub.id}/remove-president`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            targetUserId: memberToRemove.user_id,
          }),
        }
      )

      if (response.ok) {
        notify.success("President removed and club is now unclaimed!")
        setMemberToRemove(null)
        await loadClubs()
        await loadClubMembers(selectedClub.id)
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to remove president")
      }
    } catch (error) {
      console.error("Error removing president:", error)
      notify.error("Failed to remove president")
    } finally {
      setRemovingMember(false)
    }
  }

  const handleKickMember = async (member: ClubMember) => {
    if (!selectedClub) return

    const confirmed = await confirmDialog({
      title: "Remove member?",
      description: `Are you sure you want to remove ${member.name} from ${selectedClub.name}?`,
      confirmLabel: "Remove",
      destructive: true,
    })
    if (!confirmed) return

    try {
      const response = await fetch(
        `/api/admin/clubs/${selectedClub.id}/kick-member`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            userId,
            targetUserId: member.user_id,
          }),
        }
      )

      if (response.ok) {
        notify.success("Member removed successfully!")
        await loadClubMembers(selectedClub.id)
        await loadClubs()
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to remove member")
      }
    } catch (error) {
      console.error("Error kicking member:", error)
      notify.error("Failed to remove member")
    }
  }

  const filteredClubs = clubs.filter(
    (club) =>
      club.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 pb-8 pt-[calc(2rem+env(safe-area-inset-top))]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading admin dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:py-8 space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="icon" className="shrink-0">
              <ArrowLeft className="h-5 w-5" />
            </Button>
          </Link>
          <Settings className="h-8 w-8 text-purple-600 hidden sm:block" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Admin Dashboard</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              Manage clubs, posts, and memberships
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button size="sm" onClick={() => setShowCreateClub(true)} aria-label="Create Club">
            <Plus className="h-4 w-4" />
            <span className="max-sm:hidden">Create Club</span>
          </Button>
          <Button variant="outline" size="sm" onClick={loadData} aria-label="Refresh">
            <RefreshCw className="h-4 w-4" />
            <span className="max-sm:hidden">Refresh</span>
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{clubs.length}</p>
              <p className="text-sm text-muted-foreground">Total Clubs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">
                {clubs.filter((c) => c.is_claimed).length}
              </p>
              <p className="text-sm text-muted-foreground">Claimed Clubs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">
                {clubs.filter((c) => !c.is_claimed).length}
              </p>
              <p className="text-sm text-muted-foreground">Unclaimed Clubs</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center">
              <p className="text-3xl font-bold">{posts.length}</p>
              <p className="text-sm text-muted-foreground">Recent Posts</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="clubs" className="flex items-center gap-2">
            <Building className="h-4 w-4" />
            <span className="hidden sm:inline">Clubs</span>
          </TabsTrigger>
          <TabsTrigger value="posts" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">Posts</span>
          </TabsTrigger>
          <TabsTrigger value="memberships" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">Members</span>
          </TabsTrigger>
        </TabsList>

        {/* Clubs Tab: the same page members see, plus admin-only club creation */}
        <TabsContent value="clubs" className="space-y-4">
          <ClubsContent key={clubsVersion} embedded showEdit />
        </TabsContent>

        {/* Posts Tab: the same feed as the home page, with delete on every post */}
        <TabsContent value="posts">
          <HomeContent canDeleteAny />
        </TabsContent>

        {/* Memberships Tab */}
        <TabsContent value="memberships" className="space-y-4">
          <h2 className="text-lg font-semibold">Club Membership Management</h2>
          <p className="text-sm text-muted-foreground">
            Select a club to view and manage its members. You can remove presidents to make a club unclaimed.
          </p>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clubs..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            {/* Club Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Select Club</CardTitle>
              </CardHeader>
              <CardContent className="max-h-96 overflow-y-auto space-y-2">
                {filteredClubs.map((club) => (
                  <button
                    key={club.id}
                    onClick={() => {
                      setSelectedClub(club)
                      loadClubMembers(club.id)
                    }}
                    className={`w-full text-left p-3 rounded-[16px] border transition-colors ${
                      selectedClub?.id === club.id
                        ? "border-primary bg-primary/5"
                        : "border-transparent hover:bg-muted"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {club.image_url && <img src={club.image_url} alt={club.name} className="h-10 w-10 rounded-[16px] object-cover" />}
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{club.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {club.member_count} members •{" "}
                          {club.is_claimed ? "Claimed" : "Unclaimed"}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </CardContent>
            </Card>

            {/* Members List */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  {selectedClub ? `${selectedClub.name} Members` : "Members"}
                </CardTitle>
                {selectedClub && (
                  <CardDescription>
                    {selectedClub.is_claimed
                      ? "Remove the president to make this club unclaimed"
                      : "This club is currently unclaimed"}
                  </CardDescription>
                )}
              </CardHeader>
              <CardContent>
                {!selectedClub ? (
                  <p className="text-center text-muted-foreground py-8">
                    Select a club to view members
                  </p>
                ) : loadingMembers ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                  </div>
                ) : clubMembers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-8">
                    No members in this club
                  </p>
                ) : (
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {clubMembers.map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between p-3 rounded-[16px] border"
                      >
                        <div className="flex items-center gap-3">
                          <div>
                            <p className="font-medium text-sm">{member.name}</p>
                            <div className="flex items-center gap-2">
                              <Badge
                                variant={member.role === "president" ? "default" : "outline"}
                                className="text-xs"
                              >
                                {member.role === "president" && (
                                  <Crown className="h-3 w-3 mr-1" />
                                )}
                                {member.role}
                              </Badge>
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-1">
                          {member.role === "president" ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setMemberToRemove(member)}
                            >
                              <UserMinus className="h-4 w-4" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => handleKickMember(member)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Create Club Dialog */}
      <Dialog open={showCreateClub} onOpenChange={setShowCreateClub}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Club</DialogTitle>
            <DialogDescription>
              Add a new club to the platform. It will be unclaimed until a student claims it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Club Name *</label>
              <Input
                value={newClub.name}
                onChange={(e) => setNewClub({ ...newClub, name: e.target.value })}
                placeholder="e.g., Chess Club"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Description *</label>
              <Textarea
                value={newClub.description}
                onChange={(e) => setNewClub({ ...newClub, description: e.target.value })}
                placeholder="Describe what this club is about..."
                rows={3}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Meeting Time</label>
              <Input
                value={newClub.meetingTime}
                onChange={(e) => setNewClub({ ...newClub, meetingTime: e.target.value })}
                placeholder="e.g., Tuesdays at 3:30 PM"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Location</label>
              <Input
                value={newClub.location}
                onChange={(e) => setNewClub({ ...newClub, location: e.target.value })}
                placeholder="e.g., Room 201"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateClub(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateClub} disabled={creatingClub}>
              {creatingClub ? "Creating..." : "Create Club"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove President Dialog */}
      <AlertDialog open={!!memberToRemove} onOpenChange={() => setMemberToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Remove President
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {memberToRemove?.name} as president of {selectedClub?.name}?
              <br /><br />
              <strong>This will:</strong>
              <ul className="list-disc ml-4 mt-2">
                <li>Remove them from the club entirely</li>
                <li>Make the club unclaimed (no president)</li>
                <li>Allow another student to claim the club</li>
              </ul>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemovePresident}
              disabled={removingMember}
              className="bg-destructive hover:bg-destructive/90"
            >
              {removingMember ? "Removing..." : "Remove President"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
