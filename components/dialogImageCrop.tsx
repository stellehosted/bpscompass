"use client"

import { notify } from "@/lib/notify"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Slider } from "@/components/ui/slider"
import { getCroppedImg, blobToFile } from "@/lib/crop-image"
import { Loader2 } from "lucide-react"

interface ImageCropDialogProps {
  open: boolean
  imageSrc: string
  onCropComplete: (croppedFile: File) => void
  onCancel: () => void
  aspectRatio?: number
  cropShape?: "rect" | "round"
}

export function ImageCropDialog({
  open,
  imageSrc,
  onCropComplete,
  onCancel,
  aspectRatio = 1,
  cropShape = "rect",
}: ImageCropDialogProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  const onCropChange = useCallback((crop: { x: number; y: number }) => {
    setCrop(crop)
  }, [])

  const onZoomChange = useCallback((zoom: number) => {
    setZoom(zoom)
  }, [])

  const onCropCompleteCallback = useCallback(
    (croppedArea: any, croppedAreaPixels: any) => {
      setCroppedAreaPixels(croppedAreaPixels)
    },
    []
  )

  const handleCropConfirm = async () => {
    try {
      setLoading(true)
      const croppedImageBlob = await getCroppedImg(imageSrc, croppedAreaPixels)
      const croppedFile = blobToFile(croppedImageBlob, `cropped-${Date.now()}.jpg`)
      onCropComplete(croppedFile)
    } catch (error) {
      console.error('Error cropping image:', error)
      notify.error('Failed to crop image. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="sm:max-w-[600px] h-[600px] flex flex-col">
        <DialogHeader>
          <DialogTitle>Crop Image</DialogTitle>
          <DialogDescription>
            Adjust the image to your liking. Drag to reposition and use the slider to zoom.
          </DialogDescription>
        </DialogHeader>

        <div className="relative flex-1 bg-gray-100 rounded-[16px] overflow-hidden">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspectRatio}
            cropShape={cropShape}
            onCropChange={onCropChange}
            onZoomChange={onZoomChange}
            onCropComplete={onCropCompleteCallback}
          />
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Zoom</label>
          <Slider
            value={[zoom]}
            onValueChange={(value) => setZoom(value[0])}
            min={1}
            max={3}
            step={0.1}
            className="w-full"
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleCropConfirm} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Cropping...
              </>
            ) : (
              'Apply Crop'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
