"use client"

import { useState } from "react"
import Link from "next/link"
import { Heart, ThumbsUp, ThumbsDown, Forward, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { renderTextWithLinks } from "@/lib/render-text-with-links"

export interface ClubPost {
  id: string
  club_id: string
  club_name?: string
  club_avatar?: string
  title?: string | null
  author_id?: string
  author_name: string
  author_avatar: string | null
  author_email: string
  content: string
  image_url: string | null
  likes_count: number
  comments_count: number
  created_at: string
  isLiked?: boolean
}

function formatTimestamp(timestamp: string) {
  const date = new Date(timestamp)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return "Just now"
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

// Attending/not-attending has no backend yet (no column, no API route) — this
// is local-only UI state that resets on reload, and the counter next to each
// button only reflects this browser's own toggle, not a real aggregate across
// members. Wire both up to a real endpoint once one exists.
type Rsvp = "attending" | "not-attending" | null

async function sharePost(post: ClubPost) {
  const url = `${window.location.origin}/clubs/${post.club_id}`
  if (navigator.share) {
    try {
      await navigator.share({ title: post.title || post.club_name || "Club post", url })
    } catch {
      // user cancelled the share sheet — not an error
    }
  } else {
    await navigator.clipboard.writeText(url)
  }
}

export function PostCard({
  post,
  onLike,
  onDelete,
}: {
  post: ClubPost
  onLike: (postId: string, isLiked: boolean) => void
  // Only passed where the viewer may moderate (club leadership on the club page).
  onDelete?: (postId: string) => void
}) {
  const [rsvp, setRsvp] = useState<Rsvp>(null)

  return (
    <div className="overflow-hidden rounded-[16px] bg-white shadow-[0_2px_0_rgba(0,34,49,0.16)] animate-pop-in">
      <div className="relative overflow-hidden" style={{ background: "#EAF3FC" }}>
        {post.club_avatar && (
          <div
            className="absolute inset-y-0 right-0 w-[55%] bg-cover bg-center"
            style={{
              backgroundImage: `url(${post.club_avatar})`,
              maskImage: "linear-gradient(to left, black, transparent)",
              WebkitMaskImage: "linear-gradient(to left, black, transparent)",
            }}
          />
        )}
        <div className="relative px-7 py-5 space-y-0.5">
          <h3 className="font-black text-xl text-card-foreground leading-tight truncate">
            {post.title || post.club_name || "Club"}
          </h3>
          <p className="text-xs font-medium truncate">
            <Link href={`/clubs/${post.club_id}`} className="text-black hover:underline underline-offset-2">
              {post.club_name || "Club"}
            </Link>
            <span className="text-black/50"> • {post.author_name} • {formatTimestamp(post.created_at)}</span>
          </p>
        </div>
      </div>

      <div className="px-7 py-6 space-y-4">
        <p className="text-sm text-card-foreground leading-relaxed whitespace-pre-wrap">
          {renderTextWithLinks(post.content)}
        </p>

        {post.image_url && (
          <div className="rounded-lg overflow-hidden">
            <img
              src={post.image_url}
              alt="Post content"
              className="w-full h-48 sm:h-64 object-cover"
            />
          </div>
        )}

        <div className="flex items-center justify-between pt-3">
          <div className="flex items-center gap-6">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onLike(post.id, post.isLiked || false)}
              className={`gap-2 h-9 px-2 ${
                post.isLiked ? "text-destructive hover:bg-destructive/10" : "hover:bg-secondary/20"
              }`}
            >
              <Heart className={`h-4 w-4 ${post.isLiked ? "fill-current" : ""}`} />
              <span className="font-bold">{post.likes_count || 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRsvp(rsvp === "attending" ? null : "attending")}
              title="Attending"
              className={`gap-2 h-9 px-2 ${
                rsvp === "attending" ? "text-primary hover:bg-primary/10" : "hover:bg-secondary/20"
              }`}
            >
              <ThumbsUp className={`h-4 w-4 ${rsvp === "attending" ? "fill-current" : ""}`} />
              <span className="font-bold">{rsvp === "attending" ? 1 : 0}</span>
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => setRsvp(rsvp === "not-attending" ? null : "not-attending")}
              title="Not attending"
              className={`gap-2 h-9 px-2 ${
                rsvp === "not-attending" ? "text-destructive hover:bg-destructive/10" : "hover:bg-secondary/20"
              }`}
            >
              <ThumbsDown className={`h-4 w-4 ${rsvp === "not-attending" ? "fill-current" : ""}`} />
              <span className="font-bold">{rsvp === "not-attending" ? 1 : 0}</span>
            </Button>
          </div>

          <div className="flex items-center gap-2">
            {onDelete && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onDelete(post.id)}
                title="Delete post"
                className="h-9 px-2 text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sharePost(post)}
              title="Share"
              className="h-9 px-2 hover:bg-secondary/20"
            >
              <Forward className="h-4 w-4" strokeWidth={2.5} />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
