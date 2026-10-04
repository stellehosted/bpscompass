"use client"

import { notify } from "@/lib/notify"
import { confirmDialog } from "@/lib/confirm"
import { useState, useEffect, useLayoutEffect, useCallback, useMemo } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Users, Search, Loader2 } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { ClubCard, type Club } from "./clubCard"

// Clubs are one column of "Club Card"s (components/clubCard.tsx), 16px apart,
// under a search bar with a My Clubs / All Clubs toggle beside it.

// Which tab is open and how far down the list is scrolled are remembered for the
// browser tab session, so opening a club and coming back lands you where you left.
const VIEW_KEY = "clubs-view"
const scrollKey = (view: string) => `clubs-scroll-${view}`

function readSession(key: string): string | null {
  try {
    return sessionStorage.getItem(key)
  } catch {
    return null
  }
}

function writeSession(key: string, value: string) {
  try {
    sessionStorage.setItem(key, value)
  } catch {
    // Storage can be unavailable (private windows); remembering is best-effort
  }
}

// `embedded` is for pages that already provide their own spacing and have no
// bottom tab bar (the admin dashboard): no outer padding, no My Clubs / All Clubs
// toggle (it just lists every club), and on phones the search bar stays at the
// top instead of docking above the tab bar.
// `showEdit` adds an Edit button to each card for people allowed to edit the club.
export function ClubsContent({ embedded = false, showEdit = false }: { embedded?: boolean; showEdit?: boolean }) {
  const { user } = useAuth()
  const [clubs, setClubs] = useState<Club[]>([])
  const [searchTerm, setSearchTerm] = useState("")
  // Lives here (not in Tabs) so a reload after joining doesn't jump back to My Clubs
  const [view, setView] = useState(() => {
    if (embedded) return "all"
    const saved = readSession(VIEW_KEY)
    return saved === "all" || saved === "my-clubs" ? saved : "my-clubs"
  })
  const [loading, setLoading] = useState(true)

  // Load clubs from API
  const loadClubs = useCallback(async () => {
    try {
      setLoading(true)
      const url = user?.id ? `/api/clubs?userId=${user.id}` : "/api/clubs"
      const response = await fetch(url)

      if (response.ok) {
        const result = await response.json()
        setClubs(result.data || [])
      }
    } catch (error) {
      console.error("Error loading clubs:", error)
    } finally {
      setLoading(false)
    }
  }, [user?.id])

  useEffect(() => {
    loadClubs()
  }, [loadClubs])


  const handleViewChange = (next: string) => {
    setView(next)
    if (!embedded) writeSession(VIEW_KEY, next)
  }

  // Put the page back where it was once the list has rendered (it can't scroll
  // that far while the loading spinner is showing), then start tracking again.
  const ready = !(loading && clubs.length === 0)
  useLayoutEffect(() => {
    if (embedded || !ready) return
    const saved = Number(readSession(scrollKey(view)))
    window.scrollTo(0, Number.isFinite(saved) ? saved : 0)
    const onScroll = () => writeSession(scrollKey(view), String(window.scrollY))
    window.addEventListener("scroll", onScroll, { passive: true })
    return () => window.removeEventListener("scroll", onScroll)
  }, [embedded, ready, view])

  const handleJoinLeave = useCallback(async (clubId: string, isJoined: boolean) => {
    if (!user?.id) return

    try {
      if (isJoined) {
        // Leave club
        const response = await fetch(`/api/clubs/${clubId}/join?userId=${user.id}`, {
          method: "DELETE",
        })
        if (response.ok) {
          await loadClubs()
        }
      } else {
        // Join club
        const response = await fetch(`/api/clubs/${clubId}/join`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
        if (response.ok) {
          await loadClubs()
        }
      }
    } catch (error) {
      console.error("Error joining/leaving club:", error)
      notify.error("Failed to update membership. Please try again.")
    }
  }, [user?.id, loadClubs])

  const handleClaimSuccess = useCallback(() => {
    loadClubs()
  }, [loadClubs])

  const handleLeaveSponsor = useCallback(async (clubId: string) => {
    if (!user?.id) return
    const confirmed = await confirmDialog({
      title: "Leave sponsorship?",
      description: "Are you sure you want to leave your sponsorship of this club?",
      confirmLabel: "Leave",
      destructive: true,
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/clubs/${clubId}/leave-sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: user.id }),
      })
      if (response.ok) {
        await loadClubs()
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to leave sponsorship")
      }
    } catch (error) {
      console.error("Error leaving sponsorship:", error)
      notify.error("Failed to leave sponsorship. Please try again.")
    }
  }, [user?.id, loadClubs])

  const filteredClubs = useMemo(() => {
    const term = searchTerm.toLowerCase()
    return clubs
      .filter(
        (club) =>
          club.name.toLowerCase().includes(term) ||
          club.description.toLowerCase().includes(term) ||
          club.tags.some((tag) => tag.toLowerCase().includes(term))
      )
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [clubs, searchTerm])

  const joinedClubs = useMemo(() => filteredClubs.filter((club) => club.is_joined), [filteredClubs])

  const renderClubList = (list: Club[]) => (
    <div className="flex flex-col gap-4">
      {list.map((club, index) => (
        <ClubCard
          key={club.id}
          club={club}
          index={index}
          onJoinLeave={handleJoinLeave}
          onLeaveSponsor={handleLeaveSponsor}
          onChanged={handleClaimSuccess}
          showEdit={showEdit}
        />
      ))}
    </div>
  )

  // Only block the whole page on the first load; later refreshes (after a
  // join, claim, etc.) keep the list mounted.
  if (loading && clubs.length === 0) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block p-4 rounded-full bg-secondary mb-4 animate-bounce-brutal">
            <Loader2 className="h-10 w-10 animate-spin text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground font-bold tracking-wide">Loading clubs...</p>
        </div>
      </div>
    )
  }

  return (
    <div className={embedded ? "max-w-[700px] mx-auto" : "max-w-[700px] mx-auto px-3 sm:px-4 pt-6 max-md:pb-24 md:py-10"}>
      <Tabs value={view} onValueChange={handleViewChange} className="w-full">
        {/* On phones the search bar and toggle dock just above the bottom tab bar (3.5rem tall) */}
        <div
          className={
            embedded
              ? "flex items-center gap-3"
              : "flex items-center gap-3 max-md:fixed max-md:inset-x-0 max-md:bottom-[calc(3.5rem+env(safe-area-inset-bottom))] max-md:z-40 max-md:border-t max-md:border-border max-md:bg-background max-md:px-3 max-md:py-2"
          }
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search clubs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 text-base"
            />
          </div>
          {!embedded && (
            <TabsList className="shrink-0">
              <TabsTrigger value="my-clubs">
                My Clubs
              </TabsTrigger>
              <TabsTrigger value="all">
                All Clubs
              </TabsTrigger>
            </TabsList>
          )}
        </div>

        <TabsContent value="my-clubs" className="mt-6">
          {renderClubList(joinedClubs)}
          {joinedClubs.length === 0 && (
            <Card className="transition-all">
              <CardContent className="py-12 sm:py-16 text-center">
                <div className="inline-block p-4 rounded-full bg-muted mb-4">
                  <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
                <p className="text-lg sm:text-xl text-foreground font-bold">
                  {searchTerm ? "No clubs found" : "No clubs joined yet"}
                </p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">
                  {searchTerm ? "Try adjusting your search" : "Browse all clubs and join one!"}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="all" className="mt-6">
          {renderClubList(filteredClubs)}
          {filteredClubs.length === 0 && (
            <Card className="transition-all">
              <CardContent className="py-12 sm:py-16 text-center">
                <div className="inline-block p-4 rounded-full bg-muted mb-4">
                  <Search className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
                </div>
                <p className="text-lg sm:text-xl text-foreground font-bold">No clubs found</p>
                <p className="text-sm text-muted-foreground mt-2 font-medium">
                  Try adjusting your search
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}
