"use client"

import { useState } from "react"
import { confirmDialog } from "@/lib/confirm"
import { notify } from "@/lib/notify"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Crown } from "lucide-react"

interface Member {
  id: string
  user_id: string
  name: string
  role: string
}

interface TransferPresidencyDialogProps {
  clubId: string
  clubName: string
  members: Member[]
  currentUserId: string
  onSuccess: () => void
  // Replaces the default "Leave Presidency" button, e.g. the club page's "Leave".
  trigger?: React.ReactNode
}

export function TransferPresidencyDialog({
  clubId,
  clubName,
  members,
  currentUserId,
  onSuccess,
  trigger,
}: TransferPresidencyDialogProps) {
  const [open, setOpen] = useState(false)
  const [selectedMember, setSelectedMember] = useState<string>("")
  const [loading, setLoading] = useState(false)

  // Filter out current user and get eligible members. Sponsors are teachers,
  // not students, so they can't become president.
  const eligibleMembers = members.filter(m => m.user_id !== currentUserId && m.role !== "sponsor")

  // Co-presidents can just step down; only the last president unclaims the club
  const otherPresidents = members.filter(m => m.role === "president" && m.user_id !== currentUserId).length
  const isLastPresident = otherPresidents === 0

  const handleTransfer = async () => {
    if (!selectedMember) {
      notify.error("Please select a new president")
      return
    }

    setLoading(true)

    try {
      const response = await fetch(`/api/clubs/${clubId}/leave-presidency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          newPresidentId: selectedMember,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOpen(false)
        onSuccess()
      } else {
        notify.error(data.error || "Failed to transfer presidency")
      }
    } catch (err) {
      notify.error("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  const handleUnclaimAndLeave = async () => {
    const confirmed = await confirmDialog({
      title: isLastPresident ? "Unclaim and leave?" : "Leave presidency?",
      description: isLastPresident
        ? `Are you sure you want to unclaim ${clubName} and leave? The club will become available for others to claim.`
        : `Are you sure you want to leave ${clubName}? The other ${otherPresidents === 1 ? "president stays" : "presidents stay"} in charge.`,
      confirmLabel: isLastPresident ? "Unclaim and leave" : "Leave",
      destructive: true,
    })
    if (!confirmed) return

    setLoading(true)

    try {
      const response = await fetch(`/api/clubs/${clubId}/leave-presidency`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: currentUserId,
          newPresidentId: null,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setOpen(false)
        onSuccess()
      } else {
        notify.error(data.error || "Failed to leave club")
      }
    } catch (err) {
      notify.error("An error occurred. Please try again.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm" className="gap-2">
            <Crown className="h-4 w-4" />
            Leave Presidency
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Leave Presidency</DialogTitle>
          <DialogDescription>
            Choose how you want to leave your role as president of {clubName}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {eligibleMembers.length > 0 ? (
            <>
              <div className="space-y-2">
                <h4 className="font-medium text-sm">Option 1: Transfer Presidency</h4>
                <p className="text-sm text-muted-foreground">
                  Select a new president from current club members. You will become a regular member.
                </p>
                <Select value={selectedMember} onValueChange={setSelectedMember}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select new president" />
                  </SelectTrigger>
                  <SelectContent>
                    {eligibleMembers.map((member) => (
                      <SelectItem key={member.user_id} value={member.user_id}>
                        {member.name} {member.role !== 'member' && `(${member.role})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  onClick={handleTransfer}
                  disabled={loading || !selectedMember}
                  className="w-full"
                >
                  {loading ? "Transferring..." : "Transfer Presidency"}
                </Button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-background px-2 text-muted-foreground">Or</span>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">
              There are no other members to transfer presidency to. You can only unclaim the club.
            </p>
          )}

          <div className="space-y-2">
            <h4 className="font-medium text-sm">
              {eligibleMembers.length > 0 ? "Option 2: " : ""}
              {isLastPresident ? "Unclaim & Leave Club" : "Leave Club"}
            </h4>
            <p className="text-sm text-muted-foreground">
              {isLastPresident
                ? "Unclaim the club and leave. The club will become available for others to claim."
                : `Step down and leave the club. It stays claimed, since ${otherPresidents} other ${otherPresidents === 1 ? "president remains" : "presidents remain"}.`}
            </p>
            <Button
              onClick={handleUnclaimAndLeave}
              disabled={loading}
              variant="destructive"
              className="w-full"
            >
              {loading ? "Leaving..." : isLastPresident ? "Unclaim & Leave Club" : "Leave Club"}
            </Button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
