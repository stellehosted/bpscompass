"use client"

import { notify } from "@/lib/notify"
import { confirmDialog } from "@/lib/confirm"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Badge } from "@/components/ui/badge"
import { UserCog } from "lucide-react"

interface ClubMember {
  id: string
  user_id: string
  name: string
  email: string
  role: string
  joined_at: string
}

interface ManageLeadershipDialogProps {
  clubId: string
  clubName: string
  currentUserId: string
  // Called after any change so the page behind the dialog can refresh its leadership list
  onUpdateSuccess?: () => void
}

const LEADERSHIP_ROLES = [
  { value: 'president', label: 'Co-President' },
  { value: 'vice_president', label: 'Vice President' },
  { value: 'officer', label: 'Officer' },
]

// Names are stored as "First Last"; sort on the last word, then the full name as a tiebreaker
const lastName = (name: string) => name.trim().split(/\s+/).pop() ?? ""

// Display order in the Leadership list, independent of the order of LEADERSHIP_ROLES
const ROLE_RANK = ['president', 'vice_president', 'officer']

const compareLeaders = (a: ClubMember, b: ClubMember) => {
  const rankDiff = ROLE_RANK.indexOf(a.role) - ROLE_RANK.indexOf(b.role)
  if (rankDiff !== 0) return rankDiff
  return (
    lastName(a.name).localeCompare(lastName(b.name), undefined, { sensitivity: 'base' }) ||
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  )
}

// Callers decide who may see this (the manageMembers permission, see lib/auth/permissions.ts).
export function ManageLeadershipDialog({ clubId, clubName, currentUserId, onUpdateSuccess }: ManageLeadershipDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [members, setMembers] = useState<ClubMember[]>([])
  const [leaders, setLeaders] = useState<ClubMember[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [newLeaderEmail, setNewLeaderEmail] = useState("")
  const [newLeaderRole, setNewLeaderRole] = useState("member")

  const loadMembers = async () => {
    try {
      setIsLoading(true)
      const response = await fetch(`/api/clubs/${clubId}/members`)
      if (response.ok) {
        const data = await response.json()
        const allMembers = data.data || []
        
        // Separate leaders from regular members
        const leaderRoles = ['president', 'vice_president', 'officer']
        const leadersList = allMembers.filter((member: ClubMember) => leaderRoles.includes(member.role))
        const membersList = allMembers.filter((member: ClubMember) => !leaderRoles.includes(member.role))
        
        setLeaders(leadersList.sort(compareLeaders))
        setMembers(membersList)
      }
    } catch (error) {
      console.error("Error loading members:", error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      loadMembers()
    }
  }, [isOpen, clubId])

  const handlePromoteMember = async (memberId: string, role: string) => {
    try {
      const response = await fetch(`/api/clubs/${clubId}/members/${memberId}/role`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role, updatedBy: currentUserId }),
      })

      if (response.ok) {
        await loadMembers()
        onUpdateSuccess?.()
        notify.success(`Member promoted to ${LEADERSHIP_ROLES.find(r => r.value === role)?.label} successfully!`)
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to promote member")
      }
    } catch (error) {
      console.error("Error promoting member:", error)
      notify.error("Failed to promote member. Please try again.")
    }
  }

  const handleDemoteLeader = async (leaderId: string, leaderRole: string) => {
    if (leaderId === currentUserId) {
      notify.error("You cannot demote yourself. Use the transfer presidency feature instead.")
      return
    }

    const confirmMessage = leaderRole === 'president' 
      ? "Are you sure you want to demote this co-president? They will become a regular member."
      : "Are you sure you want to demote this leader to a regular member?"

    const confirmed = await confirmDialog({
      title: leaderRole === 'president' ? "Demote co-president?" : "Demote leader?",
      description: confirmMessage,
      confirmLabel: "Demote",
      destructive: true,
    })

    if (confirmed) {
      try {
        const response = await fetch(`/api/clubs/${clubId}/members/${leaderId}/role`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "member", updatedBy: currentUserId }),
        })

        if (response.ok) {
          await loadMembers()
          onUpdateSuccess?.()
          notify.success("Leader demoted successfully!")
        } else {
          const data = await response.json()
          notify.error(data.error || "Failed to demote leader")
        }
      } catch (error) {
        console.error("Error demoting leader:", error)
        notify.error("Failed to demote leader. Please try again.")
      }
    }
  }

  const handleRemoveMember = async (member: ClubMember) => {
    const confirmed = await confirmDialog({
      title: "Remove member?",
      description: `Are you sure you want to remove ${member.name} from ${clubName}?`,
      confirmLabel: "Remove",
      destructive: true,
    })
    if (!confirmed) return

    try {
      const response = await fetch(`/api/clubs/${clubId}/members/${member.user_id}`, { method: "DELETE" })

      if (response.ok) {
        await loadMembers()
        onUpdateSuccess?.()
        notify.success("Member removed successfully!")
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to remove member")
      }
    } catch (error) {
      console.error("Error removing member:", error)
      notify.error("Failed to remove member. Please try again.")
    }
  }

  const handleAddByEmail = async () => {
    if (!newLeaderEmail.trim()) {
      notify.error("Please enter an email address")
      return
    }

    try {
      const addingMember = newLeaderRole === "member"
      const response = await fetch(`/api/clubs/${clubId}/members/${addingMember ? "add-member" : "add-leader"}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newLeaderEmail,
          role: newLeaderRole,
          addedBy: currentUserId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        await loadMembers()
        onUpdateSuccess?.()
        setNewLeaderEmail("")
        setNewLeaderRole("member")
        notify.success(
          data.updated
            ? "Role updated successfully!"
            : addingMember ? "Member added successfully!" : "Leader added successfully!"
        )
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to add")
      }
    } catch (error) {
      console.error("Error adding by email:", error)
      notify.error("Failed to add. Please try again.")
    }
  }

  const getRoleLabel = (role: string) => {
    const roleConfig = LEADERSHIP_ROLES.find(r => r.value === role)
    return roleConfig?.label || role
  }

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'president': return 'bg-[#7c66bf20] text-[#7c66bf]'
      case 'vice_president': return 'bg-[#ee799720] text-[#ee7997]'
      case 'officer': return 'bg-[#0078d720] text-[#0078d7]'
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="w-full">
          <UserCog className="h-4 w-4 mr-2" />
          Manage Members
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <UserCog className="h-4 w-4 sm:h-5 sm:w-5" />
            Manage Members
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Leadership */}
          <div className="space-y-2 sm:space-y-2">
            <h3 className="text-base sm:text-lg font-semibold">Leadership</h3>
            {leaders.length > 0 ? (
              <div className="space-y-2">
                {leaders.map((leader) => {
                  return (
                    <div key={leader.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-[16px] shadow-hard">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{leader.name}</p>
                          <p className="text-xs sm:text-sm text-muted-foreground truncate">{leader.email}</p>
                        </div>
                        <Badge className={`${getRoleBadgeColor(leader.role)} text-xs flex-shrink-0`}>
                          {getRoleLabel(leader.role)}
                        </Badge>
                      </div>
                      {leader.user_id !== currentUserId && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDemoteLeader(leader.user_id, leader.role)}
                          className="h-8 text-xs sm:text-sm w-full sm:w-auto"
                        >
                          Demote
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No other leaders assigned yet.</p>
            )}
          </div>

          {/* Promote Members */}
          <div className="space-y-2 sm:space-y-2">
            <h3 className="text-base sm:text-lg font-semibold">Promote Members</h3>
            {members.length > 0 ? (
              <div className="space-y-2">
                {members.map((member) => (
                  <div key={member.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-[16px] shadow-hard">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm sm:text-base truncate">{member.name}</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Select value="" onValueChange={(role) => handlePromoteMember(member.user_id, role)}>
                        <SelectTrigger className="h-8 text-xs sm:text-sm w-full sm:w-36">
                          <SelectValue placeholder="Position" />
                        </SelectTrigger>
                        <SelectContent>
                          {LEADERSHIP_ROLES.map((role) => (
                            <SelectItem key={role.value} value={role.value}>
                              {role.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRemoveMember(member)}
                        className="h-8 text-xs sm:text-sm w-full sm:w-auto"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No regular members to promote.</p>
            )}
          </div>
        </div>
        <p></p>
        {/* Add Member or Leader by Email */}
          <div className="space-y-1">
            <h3 className="text-base sm:text-lg font-semibold">Add by Email</h3>
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="flex-1">
                <Input
                  id="leader-email"
                  type="email"
                  placeholder="@berkeleyprep.org"
                  value={newLeaderEmail}
                  onChange={(e) => setNewLeaderEmail(e.target.value)}
                  className="h-9 sm:h-8 text-sm"
                />
              </div>
              <div className="w-full sm:w-40">
                <Select value={newLeaderRole} onValueChange={setNewLeaderRole}>
                  <SelectTrigger className="h-9 sm:h-8 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="member">Member</SelectItem>
                    {LEADERSHIP_ROLES.map((role) => (
                      <SelectItem key={role.value} value={role.value}>
                        {role.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
                <Button onClick={handleAddByEmail} disabled={!newLeaderEmail.trim()} className="w-full sm:w-auto h-8 text-sm">
                  Add
                </Button>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  )
}