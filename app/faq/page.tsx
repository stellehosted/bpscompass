"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  ArrowLeft,
  HelpCircle,
  Mail,
  ChevronDown,
  ChevronUp,
  Bell,
  Smartphone,
  Crown,
  Search,
  LogIn,
  Flag,
} from "lucide-react"
import Link from "next/link"

interface FaqItemProps {
  question: string
  answer: string
  icon: React.ReactNode
}

function FaqItem({ question, answer, icon }: FaqItemProps) {
  const [open, setOpen] = useState(false)

  return (
    <Card
      className="cursor-pointer transition-all hover:shadow-md"
      onClick={() => setOpen(!open)}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="shrink-0 mt-0.5 text-primary">{icon}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-sm sm:text-base">{question}</h3>
              {open ? (
                <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              )}
            </div>
            {open && (
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                {answer}
              </p>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FaqPage() {
  const router = useRouter()

  return (
    <div className="max-w-3xl mx-auto px-3 sm:px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top))] sm:py-8 space-y-4 sm:space-y-6">
      {/* Back Button */}
      <Button variant="ghost" onClick={() => router.back()} className="mb-2 sm:mb-4" size="sm">
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back
      </Button>

      {/* Header */}
      <div className="flex items-center gap-3">
        <HelpCircle className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">FAQ & Support</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Answers to common questions about BPS Compass
          </p>
        </div>
      </div>

      {/* FAQ Items */}
      <div className="space-y-3">
        <FaqItem
          icon={<Bell className="h-5 w-5" />}
          question="How do I enable notifications?"
          answer="When you first visit the app, you'll be prompted to allow notifications. If you dismissed the prompt, go to your browser settings, find this site under 'Notifications', and set it to 'Allow'. On iOS, you must first add the app to your home screen (see below), then enable notifications from Settings > Notifications > BPS Compass."
        />

        <FaqItem
          icon={<Smartphone className="h-5 w-5" />}
          question="How do I add this app to my home screen on iPhone or iPad?"
          answer="Open BPS Compass in Safari, tap the Share button (the square with an arrow pointing up) at the bottom of the screen, scroll down and tap 'Add to Home Screen', then tap 'Add'. The app will appear on your home screen like a regular app and open in full screen."
        />

        <FaqItem
          icon={<Crown className="h-5 w-5" />}
          question="How do I claim a club as its president?"
          answer="Navigate to the club's page by browsing or searching for it, then tap the 'Claim this Club' button. Once claimed, you'll be able to manage the club's posts, update its description, and manage members."
        />

        <FaqItem
          icon={<Search className="h-5 w-5" />}
          question="I can't find my club on this app. How do I add it?"
          answer="Only administrators can create new clubs on BPS Compass. Please email sunste@berkeleyprep.org with your club's name, a short description, and meeting details. An admin will add it for you."
        />

        <FaqItem
          icon={<Flag className="h-5 w-5" />}
          question="How do I report inappropriate content?"
          answer="If you see a post or comment that violates community guidelines, email sunste@berkeleyprep.org with a description of the content and where you found it. Administrators can review and remove posts as needed."
        />

        <FaqItem
          icon={<LogIn className="h-5 w-5" />}
          question="I'm having trouble logging in. What should I do?"
          answer="Make sure you're using your BPS email address to sign in. If issues persist, try clearing your browser cache and reloading the page. Still stuck? Email sunste@berkeleyprep.org for help."
        />
      </div>

      {/* Contact / Support Card */}
      <Card className="border-2 border-purple-300 bg-purple-50 dark:bg-purple-950/20 dark:border-purple-800">
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-start gap-4">
            <div className="rounded-full bg-purple-100 dark:bg-purple-900 p-3 shrink-0">
              <Mail className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div className="space-y-1">
              <h3 className="font-semibold text-base">Still need help?</h3>
              <p className="text-sm text-muted-foreground">
                For questions, bug reports, or anything not covered above, reach out to the admin team.
              </p>
              <a
                href="mailto:sunste@berkeleyprep.org"
                className="inline-flex items-center gap-2 mt-2 text-sm font-medium text-purple-600 dark:text-purple-400 hover:underline"
              >
                <Mail className="h-4 w-4" />
                sunste@berkeleyprep.org
              </a>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
