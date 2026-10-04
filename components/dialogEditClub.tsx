"use client"

import { notify } from "@/lib/notify"
import { useState, useEffect, useCallback, memo } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Settings, Upload, X } from "lucide-react"
import { ImageCropDialog } from "./dialogImageCrop"
import { useAuth } from "@/contexts/auth-context"

interface EditClubDialogProps {
  clubId: string
  clubName: string
  currentDescription: string
  currentMeetingTime: string | null
  currentLocation: string | null
  currentImageUrl: string | null
  onUpdateSuccess: () => void
  // Replaces the default "Edit Club Info" button, e.g. the club page's "Edit".
  trigger?: React.ReactNode
  // Extra management actions (Manage Members / Manage Tags) shown above the form.
  children?: React.ReactNode
}

export const EditClubDialog = memo(function EditClubDialog({
  clubId,
  clubName,
  currentDescription,
  currentMeetingTime,
  currentLocation,
  currentImageUrl,
  onUpdateSuccess,
  trigger,
  children,
}: EditClubDialogProps) {
  const { user } = useAuth()
  const [open, setOpen] = useState(false)
  const [description, setDescription] = useState("")
  const [meetingTime, setMeetingTime] = useState("")
  const [location, setLocation] = useState("")
  const [imageUrl, setImageUrl] = useState("")
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showCropDialog, setShowCropDialog] = useState(false)
  const [tempImageSrc, setTempImageSrc] = useState<string | null>(null)

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setDescription(currentDescription)
      setMeetingTime(currentMeetingTime || "")
      setLocation(currentLocation || "")
      setImageUrl(currentImageUrl || "")
      setImagePreview(currentImageUrl)
      setSelectedImage(null)
    }
  }, [open, currentDescription, currentMeetingTime, currentLocation, currentImageUrl])

  const handleImageSelect = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif']
      if (!validTypes.includes(file.type.toLowerCase())) {
        notify.error("Please select a valid image file (JPG, JPEG, PNG, WEBP, or GIF)")
        return
      }
      
      // Validate file size
      if (file.size > 5 * 1024 * 1024) {
        notify.error("Image size must be less than 5MB. Please choose a smaller image.")
        return
      }
      
      // Read file and show crop dialog
      const reader = new FileReader()
      reader.onload = (e) => {
        setTempImageSrc(e.target?.result as string)
        setShowCropDialog(true)
      }
      reader.onerror = () => {
        notify.error("Failed to read image file. Please try again.")
      }
      reader.readAsDataURL(file)
    }
    // Reset input so same file can be selected again
    event.target.value = ''
  }, [])

  const handleCropComplete = useCallback((croppedFile: File) => {
    setSelectedImage(croppedFile)
    const reader = new FileReader()
    reader.onload = (e) => {
      setImagePreview(e.target?.result as string)
    }
    reader.readAsDataURL(croppedFile)
    setShowCropDialog(false)
    setTempImageSrc(null)
  }, [])

  const handleCropCancel = useCallback(() => {
    setShowCropDialog(false)
    setTempImageSrc(null)
  }, [])

  const removeImage = useCallback(() => {
    setSelectedImage(null)
    setImagePreview(null)
    setImageUrl("")
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!description.trim()) {
      notify.error("Description is required")
      return
    }

    setLoading(true)

    try {
      let finalImageUrl = imageUrl

      // Upload new image if selected
      if (selectedImage) {
        const formData = new FormData()
        formData.append("file", selectedImage)

        const uploadResponse = await fetch("/api/upload", {
          method: "POST",
          body: formData,
        })

        if (uploadResponse.ok) {
          const uploadData = await uploadResponse.json()
          finalImageUrl = uploadData.data.url
        } else {
          const errorData = await uploadResponse.json().catch(() => ({}))
          const errorMessage = errorData.error || "Failed to upload image. Please try again."
          notify.error(errorMessage)
          setLoading(false)
          return
        }
      }

      // Update club
      const response = await fetch(`/api/clubs/${clubId}/update`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          description,
          meetingTime: meetingTime || null,
          location: location || null,
          imageUrl: finalImageUrl || null,
          userId: user?.id,
        }),
      })

      if (response.ok) {
        setOpen(false)
        onUpdateSuccess()
      } else {
        const data = await response.json()
        notify.error(data.error || "Failed to update club")
      }
    } catch (error) {
      console.error("Error updating club:", error)
      notify.error("Failed to update club. Please try again.")
    } finally {
      setLoading(false)
    }
  }, [clubId, description, meetingTime, location, imageUrl, selectedImage, onUpdateSuccess, user?.id])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" className="w-full">
            <Settings className="h-4 w-4 mr-2" />
            Edit Club Info
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[calc(100vw-2rem)] sm:w-full">
        <DialogHeader>
          <DialogTitle className="text-base sm:text-lg">Edit {clubName}</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">Update club information and details</DialogDescription>
        </DialogHeader>

        {children && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{children}</div>}

        <div className="space-y-3 sm:space-y-4">
          {/* Description */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="description" className="text-sm">Description *</Label>
            <Textarea
              id="description"
              placeholder="Describe your club..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="min-h-[100px] sm:min-h-[120px] text-sm"
            />
          </div>

          {/* Meeting Time */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="meeting-time" className="text-sm">Meeting Time</Label>
            <Input
              id="meeting-time"
              placeholder="e.g., Tuesdays 3:30 PM"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="location" className="text-sm">Location</Label>
            <Input
              id="location"
              placeholder="e.g., Room 204"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="h-9 sm:h-10 text-sm"
            />
          </div>

          {/* Image Upload */}
          <div className="space-y-1.5 sm:space-y-2">
            <Label htmlFor="club-image" className="text-sm">Club Image (Landscape)</Label>
            {!imagePreview ? (
              <div className="border-2 border-dashed border-muted-foreground/25 rounded-[16px] p-4 sm:p-6 text-center">
                <input
                  type="file"
                  id="club-image"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <label htmlFor="club-image" className="cursor-pointer">
                  <div className="flex flex-col items-center gap-1.5 sm:gap-2">
                    <Upload className="h-6 w-6 sm:h-8 sm:w-8 text-muted-foreground" />
                    <span className="text-xs sm:text-sm text-muted-foreground">Click to upload club image</span>
                    <span className="text-xs text-muted-foreground">JPG, JPEG, PNG, WEBP, or GIF • Max 5MB</span>
                  </div>
                </label>
              </div>
            ) : (
              <div className="relative">
                <div className="aspect-video rounded-[16px] overflow-hidden border">
                  <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                </div>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 h-7 w-7 sm:h-8 sm:w-8 p-0"
                  onClick={removeImage}
                >
                  <X className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                </Button>
              </div>
            )}
          </div>

          {/* Image Crop Dialog */}
          {tempImageSrc && (
            <ImageCropDialog
              open={showCropDialog}
              imageSrc={tempImageSrc}
              onCropComplete={handleCropComplete}
              onCancel={handleCropCancel}
              aspectRatio={16 / 9}
              cropShape="rect"
            />
          )}

          {/* Action Buttons */}
          <div className="flex gap-2 pt-2 sm:pt-4">
            <Button onClick={handleSubmit} disabled={loading} className="flex-1 h-9 sm:h-10 text-sm">
              {loading ? "Updating..." : "Update Club"}
            </Button>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading} className="h-9 sm:h-10 text-sm">
              Cancel
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
})
