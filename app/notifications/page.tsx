import { redirect } from "next/navigation"

// Notifications live inside the main layout so the navbar stays put; this keeps old links and push URLs working.
export default function NotificationsPage() {
  redirect("/?section=notifications")
}
