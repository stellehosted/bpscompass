// Imperative replacement for window.confirm(): `await confirmDialog({...})` resolves true/false.
// Same shape as hooks/use-toast — a module-level store plus a single host component
// (<ConfirmHost /> in the root layout) that renders whatever is pending.

export type ConfirmOptions = {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  destructive?: boolean
}

export type ConfirmRequest = ConfirmOptions & { resolve: (confirmed: boolean) => void }

let pending: ConfirmRequest | null = null
const listeners = new Set<(request: ConfirmRequest | null) => void>()

function publish(request: ConfirmRequest | null) {
  pending = request
  listeners.forEach((listener) => listener(request))
}

export function subscribeToConfirm(listener: (request: ConfirmRequest | null) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  // Only one dialog at a time; a newer request cancels the one still waiting.
  pending?.resolve(false)
  return new Promise<boolean>((resolve) => {
    publish({ ...options, resolve })
  })
}

export function settleConfirm(confirmed: boolean) {
  pending?.resolve(confirmed)
  publish(null)
}
