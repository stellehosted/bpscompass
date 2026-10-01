import { notFound } from "next/navigation"

import { DEMO_MODE } from "@/lib/demo-mode"

// The component showcase is a dev tool: it 404s unless NEXT_PUBLIC_DEMO_MODE=true.
export default function DevGalleryLayout({ children }: { children: React.ReactNode }) {
  if (!DEMO_MODE) notFound()
  return children
}
