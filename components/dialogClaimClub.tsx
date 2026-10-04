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
import { Crown, AlertTriangle } from "lucide-react"

interface ClaimClubDialogProps {
  clubId: string
  clubName: string
  userId: string
  userName: string
  userEmail: string
  userRole?: string
  userGrade?: string
  userDepartment?: string
  onClaimSuccess: () => void
  // Replaces the default "Claim Club" button, e.g. the club card's primary button.
  trigger?: React.ReactNode
}

export function ClaimClubDialog({ 
  clubId, 
  clubName, 
  userId, 
  userName, 
  userEmail, 
  userRole, 
  userGrade, 
  userDepartment, 
  trigger,
  onClaimSuccess 
}: ClaimClubDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleClaim = async () => {
    if (!isConfirmed) {
      notify.error("Please confirm that you are the president of this club")
      return
    }

    setIsLoading(true)

    try {
      const response = await fetch(`/api/clubs/${clubId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          confirmed: true,
          userEmail,
          userName,
          userRole,
          userGrade,
          userDepartment,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        notify.success(data.message || "Club claimed as president!")
        setIsOpen(false)
        setIsConfirmed(false)
        onClaimSuccess()
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to claim club")
      }
    } catch (error) {
      console.error("Error claiming club:", error)
      notify.error("Failed to claim club. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button className="w-full" variant="default">
            <Crown className="h-4 w-4 mr-2" />
            Claim Club
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-md w-[calc(100vw-2rem)] sm:w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Crown className="h-4 w-4 sm:h-5 sm:w-5" />
            Claim {clubName}
          </DialogTitle>
          <DialogDescription>
            You will become club president and be able to edit info and members.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-3">
          <div className="bg-sky-50 border border-red-200 rounded-sm p-2.5 sm:p-3 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-red-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-red-800">
              <p className="font-medium">You can only claim the club if you are the president</p>
            </div>
          </div>

          <div className="flex items-end space-x-2">
            <Checkbox
              id="confirm-president"
              checked={isConfirmed}
              onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              className="mt-0.5 h-4 w-4 data-[state=checked]:border-primary"            />
            <div className="grid gap-1 leading-none flex-1">
              <label
                htmlFor="confirm-president"
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I confirm that I am the president of this club
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
              disabled={!isConfirmed || isLoading}
            >
              {isLoading ? "Claiming..." : "Claim!"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}