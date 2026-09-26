"use client"

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
  userBio?: string
  userAvatar?: string
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
  userBio, 
  userAvatar, 
  trigger,
  onClaimSuccess 
}: ClaimClubDialogProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [isConfirmed, setIsConfirmed] = useState(false)
  const [isLoading, setIsLoading] = useState(false)

  const handleClaim = async () => {
    if (!isConfirmed) {
      alert("Please confirm that you are the president of this club")
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
          userBio,
          userAvatar,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        alert(data.message || "Club claimed successfully! You are now the president.")
        setIsOpen(false)
        setIsConfirmed(false)
        onClaimSuccess()
      } else {
        const data = await response.json()
        alert(data.error || "Failed to claim club")
      }
    } catch (error) {
      console.error("Error claiming club:", error)
      alert("Failed to claim club. Please try again.")
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
          <DialogDescription className="text-xs sm:text-sm">
            By claiming this club, you will become its president and be responsible for managing it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 sm:space-y-4">
          <div className="bg-sky-50 border border-sky-200 rounded-lg p-2.5 sm:p-3 flex items-start gap-2">
            <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-sky-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs sm:text-sm text-sky-800">
              <p className="font-medium">Important:</p>
              <p>Only claim this club if you are actually the president or have permission to manage it.</p>
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-2.5 sm:p-3">
            <p className="text-xs sm:text-sm text-blue-800">
              <span className="font-medium">Claiming as:</span> {userName}
            </p>
            <p className="text-xs text-blue-600 mt-1">
              You will become the president of this club and be able to manage its members and activities.
            </p>
          </div>

          <div className="flex items-start space-x-2">
            <Checkbox
              id="confirm-president"
              checked={isConfirmed}
              onCheckedChange={(checked) => setIsConfirmed(checked as boolean)}
              className="mt-0.5 h-4 w-4 border-2 border-solid border-slate-900 data-[state=checked]:border-primary"            />
            <div className="grid gap-1 leading-none flex-1">
              <label
                htmlFor="confirm-president"
                className="text-xs sm:text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                I confirm that I am the president of this club
              </label>
              <p className="text-xs text-muted-foreground">
                I acknowledge that I have the authority to manage this club and its activities.
              </p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1 h-9 sm:h-10 text-sm border-2"
              disabled={isLoading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleClaim}
              className="flex-1 h-9 sm:h-10 text-sm border-2"
              disabled={!isConfirmed || isLoading}
            >
              {isLoading ? "Claiming..." : "Claim Club"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}