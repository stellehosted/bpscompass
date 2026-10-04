"use client"

import { notify } from "@/lib/notify"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Shield, AlertTriangle, CheckCircle } from "lucide-react"

interface ClaimSponsorDialogProps {
  clubId: string
  clubName: string
  userId: string
  userName: string
  userEmail: string
  // Passed from the parent so we don't fire one API call per club card.
  // Parent fetches isVerifiedTeacher once and derives isAlreadySponsor
  // from the club's memberRole field returned by /api/clubs.
  isVerifiedTeacher: boolean
  isAlreadySponsor: boolean
  onClaimSuccess: () => void
  // Replaces the default "Claim as Sponsor" button, e.g. the club card's primary button.
  trigger?: React.ReactNode
}

export function ClaimSponsorDialog({
  clubId,
  clubName,
  userId,
  userName,
  userEmail,
  isVerifiedTeacher,
  isAlreadySponsor,
  onClaimSuccess,
  trigger,
}: ClaimSponsorDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleClaim = async () => {
    if (!isConfirmed) {
      notify.error("Please confirm that you are a sponsor/teacher of this club")
      return
    }

    if (!isVerifiedTeacher) {
      notify.error("Only verified teachers can claim clubs as sponsors. Please contact an administrator.")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/clubs/${clubId}/claim-sponsor`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          confirmed: true,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        notify.success(data.message || "You are now a sponsor of this club!")
        setIsOpen(false)
        setIsConfirmed(false)
        onClaimSuccess()
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to claim club as sponsor")
      }
    } catch (error) {
      console.error("Error claiming club as sponsor:", error)
      notify.error("Failed to claim club as sponsor. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  // Don't show button if already a sponsor or not a teacher
  if (isAlreadySponsor) return null
  if (!isVerifiedTeacher) return null

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full" variant="outline">
            <Shield className="h-4 w-4 mr-2" />
            Claim as Sponsor
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Shield className="h-4 w-4 sm:h-5 sm:w-5" />
            Sponsor {clubName}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            You will oversee the club, moderate the club, and approve leadership changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          {isVerifiedTeacher ? (
            <div className="bg-green-50 border border-green-200 rounded-sm p-2.5 sm:p-3 flex items-start gap-2">
              <CheckCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-green-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm text-green-800">
                <p className="font-medium">Verified Teacher Account</p>
                <p>Your account is verified as a teacher. You can claim clubs as a sponsor.</p>
              </div>
            </div>
          ) : (
            <div className="bg-red-50 border border-red-200 rounded-sm p-2.5 sm:p-3 flex items-start gap-2">
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs sm:text-sm text-red-800">
                <p className="font-medium">Not Verified</p>
                <p>Only verified teacher accounts can claim clubs as sponsors. Please contact an administrator.</p>
              </div>
            </div>
          )}

          <div className="flex items-end space-x-2">
            <Checkbox
              id="confirm-sponsor"
              checked={isConfirmed}
              onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              disabled={!isVerifiedTeacher}
              className="mt-0.5 h-4 w-4 data-[state=checked]:border-primary"
            />
            <div className="grid gap-1 leading-none flex-1">
              <label
                htmlFor="confirm-sponsor"
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I confirm that I am the faculty sponsor of this club
              </label>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClaim}
              className="flex-1"
              disabled={!isConfirmed || isLoading || !isVerifiedTeacher}
            >
              {isLoading ? "Claiming..." : "Sponsor!"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
