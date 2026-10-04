"use client"

import { useEffect, useState } from "react"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { cn } from "@/lib/utils"
import { settleConfirm, subscribeToConfirm, type ConfirmRequest } from "@/lib/confirm"

export function ConfirmHost() {
  // `request` is kept after closing so the text doesn't blank out during the exit animation.
  const [request, setRequest] = useState<ConfirmRequest | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(
    () =>
      subscribeToConfirm((next) => {
        if (next) setRequest(next)
        setOpen(next !== null)
      }),
    []
  )

  return (
    <AlertDialog open={open} onOpenChange={(nextOpen) => !nextOpen && settleConfirm(false)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{request?.title}</AlertDialogTitle>
          {request?.description && (
            <AlertDialogDescription>{request.description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{request?.cancelLabel ?? "Cancel"}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => settleConfirm(true)}
            className={cn(request?.destructive && "bg-destructive hover:bg-destructive/90")}
          >
            {request?.confirmLabel ?? "Confirm"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
