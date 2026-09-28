"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Calendar, MapPin, Mail, MessageSquare, Pencil } from "lucide-react"
import { useAuth } from "@/contexts/auth-context"
import { openEmailAll } from "@/lib/email-all"
import type { Permission } from "@/lib/auth/permissions"
import { ClaimClubDialog } from "./dialogClaimClub"
import { ClaimSponsorDialog } from "./dialogClaimSponsor"
import { TransferPresidencyDialog } from "./dialogTransferPresidency"
import { EditClubDialog } from "./dialogEditClub"
import { ManageLeadershipDialog } from "./dialogManageLeadership"
import { ManageTagsDialog } from "./dialogManageTags"
import { CreatePostDialog } from "./dialogCreatePost"

// Layout follows the "Club Card" symbol in The Compass.sketch (700x120, drawn
// at 1x, so its values map straight onto Tailwind): 28px padding, a 24px
// Avenir Black title, 12px meta/description rows, and the header image on the
// right 55% of the card, fading in from transparent over its first ~60%.
//
// ≤640px: the buttons drop onto their own row under the text, and the primary
// button stretches to fill it.

const PRIMARY_BUTTON = "min-w-0 max-sm:flex-1 sm:w-[150px]"

// Shrinks its text from the Sketch title size (24px) down to a floor so a long
// name fits on one row; past the floor it is cut off with an ellipsis instead.
const TITLE_MAX_PX = 24
const TITLE_MIN_PX = 14

function FitTitle({ children }: { children: string }) {
  const ref = useRef<HTMLHeadingElement>(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const fit = () => {
      let size = TITLE_MAX_PX
      el.style.fontSize = `${size}px`
      while (el.scrollWidth > el.clientWidth && size > TITLE_MIN_PX) {
        size -= 1
        el.style.fontSize = `${size}px`
      }
    }
    fit()
    // Refit when the card is resized (window resize, phone rotation)
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [children])

  return (
    <h3 ref={ref} className="truncate font-black leading-tight" style={{ fontSize: TITLE_MAX_PX }} title={children}>
      {children}
    </h3>
  )
}

export interface Club {
  id: string
  name: string
  description: string
  member_count: number
  meeting_time: string | null
  location: string | null
  image_url: string | null
  is_joined?: boolean
  is_sponsor?: boolean
  is_claimed: boolean
  tags: string[]
  memberRole?: string | null
  is_coordinator?: boolean
  // What the viewer may do in this club (from /api/clubs, see lib/auth/permissions.ts)
  permissions?: Permission[]
}

interface ClubCardProps {
  club: Club
  onJoinLeave: (clubId: string, isJoined: boolean) => void
  onLeaveSponsor: (clubId: string) => void
  // Called after anything on the card changes the club (claim, sponsor, post)
  onChanged: () => void
  // Adds an Edit icon (for anyone with the editClub permission), used by the admin dashboard
  showEdit?: boolean
  index?: number
}

export function ClubCard({ club, onJoinLeave, onLeaveSponsor, onChanged, showEdit = false, index = 0 }: ClubCardProps) {
  const router = useRouter()
  const { user, isTeacher } = useAuth()
  // Coordinator tools live in the admin dashboard (showEdit): elsewhere, a coordinator
  // with no role of their own in the club gets no buttons from that permission
  const viewOnly = !!club.is_coordinator && !club.is_joined && !showEdit
  const can = (permission: Permission) => !viewOnly && !!club.permissions?.includes(permission)

  // The transfer dialog needs the member list, which the clubs list doesn't
  // carry, so presidents (the only ones who get that dialog) load it up front
  const isPresident = club.memberRole === "president"
  const [members, setMembers] = useState<{ id: string; user_id: string; name: string; email: string; role: string }[]>([])
  useEffect(() => {
    if (!isPresident) return
    let cancelled = false
    fetch(`/api/clubs/${club.id}/details`)
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result) setMembers(result.data.members)
      })
      .catch((error) => console.error("Error loading club members:", error))
    return () => {
      cancelled = true
    }
  }, [isPresident, club.id])

  const handleEmailAll = useCallback(async () => {
    // The clubs list doesn't carry member emails, so fetch them on demand
    try {
      const response = await fetch(`/api/clubs/${club.id}/details`)
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = await response.json()
      openEmailAll(
        result.data.members.map((m: { email: string }) => m.email),
        club.name,
        user?.email
      )
    } catch (error) {
      console.error("Error loading club members:", error)
      alert("Failed to load club members. Please try again.")
    }
  }, [club.id, club.name, user?.email])

  const handleCardClick = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement
    // Dialogs render in a portal, but React still bubbles their clicks up to
    // the card, so ignore anything that isn't actually inside it.
    if (!e.currentTarget.contains(target)) return
    // Only navigate if not clicking on a button or interactive element
    if (target.closest("button") || target.closest("a[href]")) return
    router.push(`/clubs/${club.id}`)
  }

  // The big button on the right. Teachers only ever sponsor (or stop
  // sponsoring), even on unclaimed clubs. Students claim unclaimed clubs and
  // otherwise only join (or leave). Leaving is destructive-styled.
  let primaryButton: React.ReactNode = null
  if (user?.id) {
    if (club.is_sponsor) {
      primaryButton = (
        <Button variant="destructive" className={PRIMARY_BUTTON} onClick={() => onLeaveSponsor(club.id)}>
          Leave
        </Button>
      )
    } else if (isTeacher) {
      primaryButton = (
        <ClaimSponsorDialog
          clubId={club.id}
          clubName={club.name}
          userId={user.id}
          userName={user.name || "User"}
          userEmail={user.email}
          isVerifiedTeacher={isTeacher}
          isAlreadySponsor={false}
          onClaimSuccess={onChanged}
          trigger={<Button className={PRIMARY_BUTTON}>Sponsor!</Button>}
        />
      )
    } else if (!club.is_claimed) {
      primaryButton = (
        <ClaimClubDialog
          clubId={club.id}
          clubName={club.name}
          userId={user.id}
          userName={user.name || "User"}
          userEmail={user.email}
          userRole={user.role}
          userGrade={user.grade}
          userDepartment={user.department}
          userBio={user.bio}
          userAvatar={user.profilePicture}
          onClaimSuccess={onChanged}
          trigger={<Button className={PRIMARY_BUTTON}>Claim!</Button>}
        />
      )
    } else if (isPresident) {
      // Presidents can't just leave: they hand off or unclaim the club
      primaryButton = (
        <TransferPresidencyDialog
          clubId={club.id}
          clubName={club.name}
          members={members}
          currentUserId={user.id}
          onSuccess={onChanged}
          trigger={<Button variant="destructive" className={PRIMARY_BUTTON}>Leave</Button>}
        />
      )
    } else {
      primaryButton = (
        <Button
          variant={club.is_joined ? "destructive" : "default"}
          className={PRIMARY_BUTTON}
          onClick={() => onJoinLeave(club.id, club.is_joined || false)}
        >
          {club.is_joined ? "Leave" : "Join!"}
        </Button>
      )
    }
  }

  return (
    <article
      className="relative flex min-h-[120px] cursor-pointer flex-col gap-4 overflow-hidden rounded-2xl bg-[#eaf3fc] p-7 shadow-[0_2px_0_rgba(0,34,49,0.16)] animate-pop-in sm:flex-row sm:items-center"
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={handleCardClick}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault()
          router.push(`/clubs/${club.id}`)
        }
      }}
    >
      {club.image_url && (
        <img
          src={club.image_url}
          alt=""
          className="pointer-events-none absolute inset-y-0 right-0 h-full w-[55%] object-cover"
          style={{
            maskImage: "linear-gradient(to right, transparent, black 61.5%)",
            WebkitMaskImage: "linear-gradient(to right, transparent, black 61.5%)",
          }}
        />
      )}

      <div className="relative min-w-0 flex-1">
        <FitTitle>{club.name}</FitTitle>
        {(club.meeting_time || club.location) && (
          <div className="mt-1 flex items-center gap-4 text-xs">
            {club.meeting_time && (
              <span className="flex min-w-0 items-center gap-1.5">
                <Calendar className="size-3 shrink-0" />
                <span className="truncate">{club.meeting_time}</span>
              </span>
            )}
            {club.location && (
              <span className="flex min-w-0 items-center gap-1.5">
                <MapPin className="size-3 shrink-0" />
                <span className="truncate">{club.location}</span>
              </span>
            )}
          </div>
        )}
        <p className="mt-1 truncate text-xs text-black/50" title={club.description}>
          {club.description}
        </p>
      </div>

      <div className="relative flex items-center gap-3 max-sm:justify-end">
        {user?.id && club.is_claimed && can("emailAll") && (
          <Button variant="outline" size="icon" aria-label="Email All" title="Email All" onClick={handleEmailAll}>
            <Mail className="size-5" />
          </Button>
        )}
        {user?.id && club.is_claimed && can("post") && (
          <CreatePostDialog
            clubId={club.id}
            clubName={club.name}
            userId={user.id}
            onPostCreated={onChanged}
            trigger={
              <Button variant="outline" size="icon" aria-label="Post" title="Post">
                <MessageSquare className="size-5" />
              </Button>
            }
          />
        )}
        {showEdit && user?.id && can("editClub") && (
          <EditClubDialog
            clubId={club.id}
            clubName={club.name}
            currentDescription={club.description}
            currentMeetingTime={club.meeting_time}
            currentLocation={club.location}
            currentImageUrl={club.image_url}
            onUpdateSuccess={onChanged}
            trigger={
              <Button variant="outline" size="icon" aria-label="Edit" title="Edit">
                <Pencil className="size-5" />
              </Button>
            }
          >
            {can("manageMembers") && (
              <ManageLeadershipDialog
                clubId={club.id}
                clubName={club.name}
                currentUserId={user.id}
                onUpdateSuccess={onChanged}
              />
            )}
            {can("manageTags") && (
              <ManageTagsDialog
                clubId={club.id}
                clubName={club.name}
                currentTags={club.tags || []}
                onUpdateSuccess={onChanged}
              />
            )}
          </EditClubDialog>
        )}
        {primaryButton}
      </div>
    </article>
  )
}
