"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import localFont from "next/font/local"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Calendar, MapPin, ArrowLeft } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { formatDisplayName } from "@/lib/utils"
import { openEmailAll } from "@/lib/email-all"
import type { Permission } from "@/lib/auth/permissions"
import { ManageLeadershipDialog } from "./dialogManageLeadership"
import { EditClubDialog } from "./dialogEditClub"
import { ManageTagsDialog } from "./dialogManageTags"
import { TransferPresidencyDialog } from "./dialogTransferPresidency"
import { CreatePostDialog } from "./dialogCreatePost"
import { PostCard, type ClubPost } from "./postCard"

const berkeley = localFont({
  src: "../fonts/BerkeleyStd-Black.otf",
  weight: "900",
  display: "swap",
})

// Layout follows the "Club Details (Desktop)" frame in The Compass.sketch.
// That frame is drawn at 1.5x (its buttons are 1.5x instances of the 150x48
// button symbols, which Button's h-12 matches), so every Sketch value below
// was divided by 1.5 and snapped to the nearest Tailwind step.

// Buttons are 150x48 in the Button symbols; the height comes from size="default".
//
// ≤768px: Members panel & "Email All" button moves into a "Members" sheet. Remaining buttons shrink to share one row.
// ≤512px: "Post!" gets its own full-width row above the rest.

const ACTION_BUTTON =
  "min-w-0 flex-1 px-2 text-sm min-[640px]:px-4 min-[640px]:text-base min-[769px]:flex-none min-[769px]:min-w-[150px] min-[769px]:px-6 min-[769px]:text-xl"
// On the split phone layout Leave sits after Members (order-1 sorts it behind the default order-0)
const LEAVE_BUTTON = `${ACTION_BUTTON} max-[513px]:order-1`

interface ClubMember {
  id: string
  user_id: string
  role: string
  joined_at: string
  name: string
  email: string
  avatar_url: string | null
}

interface President {
  id: string
  name: string
  email: string
  avatar_url: string | null
  joined_at: string
}

interface Sponsor {
  id: string
  name: string
  email: string
  avatar_url: string | null
}

interface Club {
  id: string
  name: string
  description: string
  member_count: number
  meeting_time: string | null
  location: string | null
  image_url: string | null
  is_joined: boolean
  is_claimed: boolean
  is_sponsor: boolean
  permissions: Permission[]
  president_name: string | null
  president_avatar: string | null
  president_email: string | null
  presidents: President[]
  sponsors: Sponsor[]
  tags: string[]
  memberRole: string | null
}

const LEADERSHIP_ROLES = ["president", "vice_president", "officer"]

function SidebarSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-2xl font-black">{title}</h2>
      {children}
    </section>
  )
}

function PersonWithEmail({ name, email }: { name: string; email: string }) {
  return (
    <div className="min-w-0">
      <p className="text-base truncate">{formatDisplayName(name)}</p>
      <p className="text-xs italic text-black/50 truncate" title={email}>
        {email}
      </p>
    </div>
  )
}

export function ClubDetailPage({ clubId }: { clubId: string }) {
  const router = useRouter()
  const { user } = useAuth()
  const [club, setClub] = useState<Club | null>(null)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [posts, setPosts] = useState<ClubPost[]>([])
  const [loading, setLoading] = useState(true)

  const loadClubDetails = useCallback(async () => {
    try {
      setLoading(true)
      const url = user?.id
        ? `/api/clubs/${clubId}/details?userId=${user.id}`
        : `/api/clubs/${clubId}/details`

      const response = await fetch(url)

      if (response.ok) {
        const result = await response.json()
        setClub(result.data.club)
        setMembers(result.data.members)
        setPosts(
          result.data.posts.map((post: ClubPost) => ({
            ...post,
            author_name: formatDisplayName(post.author_name),
          }))
        )
      } else {
        const errorData = await response.json().catch(() => ({}))
        console.error("Failed to load club details:", response.status, errorData)
        router.push("/")
      }
    } catch (error) {
      console.error("Error loading club details:", error)
      router.push("/")
    } finally {
      setLoading(false)
    }
  }, [clubId, user?.id, router])

  useEffect(() => {
    loadClubDetails()
  }, [loadClubDetails])

  const handleJoinLeave = useCallback(async () => {
    if (!user?.id || !club) return

    // Prevent presidents from leaving via this button
    if (club.memberRole === "president") {
      alert("As president, please use the 'Leave Presidency' button to transfer leadership or unclaim the club.")
      return
    }

    try {
      if (club.is_joined) {
        // Confirm before leaving
        if (!confirm(`Are you sure you want to leave ${club.name}?`)) {
          return
        }

        const response = await fetch(`/api/clubs/${clubId}/join?userId=${user.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          await loadClubDetails()
        } else {
          alert("Failed to leave club. Please try again.")
        }
      } else {
        const response = await fetch(`/api/clubs/${clubId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        if (response.ok) {
          await loadClubDetails()
        } else {
          alert("Failed to join club. Please try again.")
        }
      }
    } catch (error) {
      console.error("Error joining/leaving club:", error)
      alert("Failed to update membership. Please try again.")
    }
  }, [user?.id, club, clubId, loadClubDetails])

  const handleLeaveSponsor = useCallback(async () => {
    if (!user?.id || !club) return
    if (!confirm(`Are you sure you want to leave your sponsorship of ${club.name}?`)) return

    try {
      const response = await fetch(`/api/clubs/${clubId}/leave-sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      if (response.ok) {
        await loadClubDetails()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to leave sponsorship")
      }
    } catch (error) {
      console.error("Error leaving sponsorship:", error)
      alert("Failed to leave sponsorship. Please try again.")
    }
  }, [user?.id, club, clubId, loadClubDetails])

  const handleDeletePost = useCallback(async (postId: string) => {
    if (!user?.id) return

    if (!confirm("Are you sure you want to delete this post?")) {
      return
    }

    try {
      const response = await fetch(`/api/posts/${postId}?userId=${user.id}`, {
        method: "DELETE",
      })

      if (response.ok) {
        // Remove post from local state
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete post")
      }
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("Failed to delete post. Please try again.")
    }
  }, [user?.id])

  // Same like/unlike flow as the home feed (components/homePage.tsx)
  const handleLike = useCallback(async (postId: string, isLiked: boolean) => {
    if (!user?.id) {
      alert("Please log in to like posts")
      return
    }

    try {
      const response = isLiked
        ? await fetch(`/api/posts/${postId}/like?userId=${encodeURIComponent(user.id)}`, {
            method: "DELETE",
          })
        : await fetch(`/api/posts/${postId}/like`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ userId: user.id }),
          })

      if (response.ok) {
        const data = await response.json()
        setPosts((prev) =>
          prev.map((post) =>
            post.id === postId ? { ...post, isLiked: data.liked, likes_count: data.likeCount } : post
          )
        )
      } else {
        console.error("Error toggling like:", await response.json())
      }
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }, [user?.id])

  const handleEmailAll = useCallback(() => {
    openEmailAll(members.map((m) => m.email), club?.name ?? "", user?.email)
  }, [members, user?.email, club?.name])

  // Only block the whole page on the first load; later refreshes (after an
  // edit, join, etc.) keep it mounted so open dialogs stay open.
  if (loading && !club) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading club details...</p>
        </div>
      </div>
    )
  }

  if (!club) {
    return null
  }

  const role = club.memberRole
  // Which buttons to show comes from the server's list for this viewer (the
  // rules live in lib/auth/permissions.ts, and the API enforces the same ones)
  const can = (permission: Permission) => club.permissions.includes(permission)

  const leaders = members.filter((m) => LEADERSHIP_ROLES.includes(m.role))
  const regularMembers = members.filter((m) => m.role === "member")

  let leaveButton: React.ReactNode = null
  if (user?.id) {
    if (club.is_sponsor) {
      leaveButton = (
        <Button variant="destructive" className={LEAVE_BUTTON} onClick={handleLeaveSponsor}>
          Leave
        </Button>
      )
    } else if (role === "president") {
      // Presidents can't just leave — they hand off or unclaim the club
      leaveButton = (
        <TransferPresidencyDialog
          clubId={club.id}
          clubName={club.name}
          members={members}
          currentUserId={user.id}
          onSuccess={() => router.push("/")}
          trigger={
            <Button variant="destructive" className={LEAVE_BUTTON}>
              Leave
            </Button>
          }
        />
      )
    } else {
      leaveButton = (
        <Button
          variant={club.is_joined ? "destructive" : "default"}
          className={LEAVE_BUTTON}
          onClick={handleJoinLeave}
        >
          {club.is_joined ? "Leave" : "Join"}
        </Button>
      )
    }
  }

  // Leadership, sponsors and members: the side panel above 768px, a sheet behind the Members button below
  const peopleLists = (
    <>
      {leaders.length > 0 && (
        <SidebarSection title="Leadership">
          <div className="flex flex-col gap-3">
            {leaders.map((leader) => (
              <PersonWithEmail key={leader.id} name={leader.name} email={leader.email} />
            ))}
          </div>
        </SidebarSection>
      )}

      {club.sponsors && club.sponsors.length > 0 && (
        <SidebarSection title={club.sponsors.length === 1 ? "Sponsor" : "Sponsors"}>
          {club.sponsors.map((sponsor) => (
            <PersonWithEmail key={sponsor.id} name={sponsor.name} email={sponsor.email} />
          ))}
        </SidebarSection>
      )}

      <SidebarSection title="Members">
        {regularMembers.length > 0 ? (
          <div className="flex flex-col gap-1">
            {regularMembers.map((member) => (
              <p key={member.id} className="text-base truncate">
                {formatDisplayName(member.name)}
              </p>
            ))}
          </div>
        ) : (
          <p className="text-sm text-black/50">No members yet</p>
        )}
      </SidebarSection>
    </>
  )

  return (
    <div className="relative pb-16">
      {/* Header image: full-bleed, fading into the page background */}
      <div className="absolute inset-x-0 top-0 h-[calc(14rem+env(safe-area-inset-top))] sm:h-[300px] overflow-hidden">
        {club.image_url && (
          <img
            src={club.image_url}
            alt=""
            className="w-full h-full object-cover"
            style={{
              maskImage: "linear-gradient(to bottom, black, transparent)",
              WebkitMaskImage: "linear-gradient(to bottom, black, transparent)",
            }}
          />
        )}
      </div>

      <div className="relative max-w-6xl mx-auto px-4 sm:px-8 pt-[calc(9rem+env(safe-area-inset-top))] sm:pt-52">
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push("/?section=clubs")}
          className="absolute top-[calc(1rem+env(safe-area-inset-top))] left-4 sm:left-8 sm:top-4"
        >
          <ArrowLeft />
          Clubs
        </Button>

        <h1
          className={`${berkeley.className} text-5xl sm:text-6xl lg:text-7xl leading-none tracking-[-0.05em] break-words`}
        >
          {club.name}
        </h1>

        <div className="mt-2 flex flex-wrap items-center gap-x-8 gap-y-2">
          <p className="text-lg sm:text-xl">{club.description}</p>
          {club.is_claimed && club.meeting_time && (
            <span className="flex items-center gap-2.5 text-base">
              <Calendar className="size-4 shrink-0" />
              {club.meeting_time}
            </span>
          )}
          {club.is_claimed && club.location && (
            <span className="flex items-center gap-2.5 text-base">
              <MapPin className="size-4 shrink-0" />
              {club.location}
            </span>
          )}
        </div>

        <div className="mt-7 flex flex-wrap items-center gap-2 min-[513px]:flex-nowrap min-[769px]:flex-wrap min-[769px]:gap-5">
          {club.is_claimed ? (
            <>
              {user?.id && can("post") && (
                <CreatePostDialog
                  clubId={club.id}
                  clubName={club.name}
                  userId={user.id}
                  onPostCreated={loadClubDetails}
                  trigger={<Button className={`${ACTION_BUTTON} max-[513px]:w-full max-[513px]:flex-none`}>Post!</Button>}
                />
              )}
              {user?.id && can("editClub") && (
                <EditClubDialog
                  clubId={club.id}
                  clubName={club.name}
                  currentDescription={club.description}
                  currentMeetingTime={club.meeting_time}
                  currentLocation={club.location}
                  currentImageUrl={club.image_url}
                  onUpdateSuccess={loadClubDetails}
                  trigger={
                    <Button variant="outline" className={ACTION_BUTTON}>
                      Edit
                    </Button>
                  }
                >
                  {can("manageMembers") && (
                    <ManageLeadershipDialog
                      clubId={club.id}
                      clubName={club.name}
                      currentUserId={user.id}
                      onUpdateSuccess={loadClubDetails}
                    />
                  )}
                  {can("manageTags") && (
                    <ManageTagsDialog
                      clubId={club.id}
                      clubName={club.name}
                      currentTags={club.tags || []}
                      onUpdateSuccess={loadClubDetails}
                    />
                  )}
                </EditClubDialog>
              )}
              {leaveButton}
              {user?.id && can("emailAll") && (
                <Button variant="outline" className={`${ACTION_BUTTON} max-[769px]:hidden min-[769px]:ml-auto`} onClick={handleEmailAll}>
                  Email All
                </Button>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              This club is unclaimed. Visit the main clubs page to claim it.
            </p>
          )}

          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" className={`${ACTION_BUTTON} min-[769px]:hidden`}>
                Members
              </Button>
            </SheetTrigger>
            <SheetContent className="w-[85%] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="text-2xl font-black">{club.name}</SheetTitle>
                <SheetDescription className="sr-only">Leadership, sponsors and members of {club.name}</SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-8 px-4 pb-8">
                {user?.id && can("emailAll") && (
                  <Button variant="outline" onClick={handleEmailAll}>
                    Email All
                  </Button>
                )}
                {peopleLists}
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="mt-12 grid grid-cols-1 min-[769px]:grid-cols-[minmax(0,1fr)_15rem] gap-x-8 lg:gap-x-20 gap-y-3">
          <h2 className="text-2xl font-black">Posts</h2>

          <div className="space-y-6 min-[769px]:row-start-2">
            {posts.length > 0 ? (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onLike={handleLike}
                  onDelete={can("deleteAnyPost") || post.author_id === user?.id ? handleDeletePost : undefined}
                />
              ))
            ) : (
              <p className="rounded-2xl bg-[#eaeff1] py-12 text-center text-muted-foreground">No posts yet</p>
            )}
          </div>

          <aside className="hidden min-[769px]:flex min-[769px]:col-start-2 min-[769px]:row-start-2 self-start rounded-2xl bg-[#eaeff1] px-6 py-8 flex-col gap-8 text-right">
            {peopleLists}
          </aside>
        </div>
      </div>
    </div>
  )
}
