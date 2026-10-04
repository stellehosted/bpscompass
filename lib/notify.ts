import { toast } from "@/hooks/use-toast"

// One-liner wrappers around the toast component, for the places that used to call alert().
// Safe to call from non-component code (lib helpers, event handlers) since `toast` is a
// standalone dispatcher; <Toaster /> in the root layout renders whatever it queues.
export const notify = {
  success: (message: string) => toast({ title: message }),
  error: (message: string) => toast({ variant: "destructive", title: message }),
}
