"use client"

import { useState, useEffect } from "react"
import { Card, CardContent } from "@/components/ui/card"
import { Users, Loader2, Newspaper } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useAuth } from "@/contexts/auth-context"
import { PostCard, type ClubPost } from "@/components/postCard"

// `canDeleteAny` shows a delete button on every post, for coordinators (the API
// re-checks the deleteAnyPost permission).
export function HomeContent({ canDeleteAny = false }: { canDeleteAny?: boolean }) {
  const { user } = useAuth()
  const [posts, setPosts] = useState<ClubPost[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)

  // Load posts with pagination
  const loadPosts = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) {
        setLoading(true)
      } else {
        setLoadingMore(true)
      }

      const url = user?.id
        ? `/api/feed?page=${pageNum}&limit=20&userId=${user.id}`
        : `/api/feed?page=${pageNum}&limit=20`

      const response = await fetch(url)
      if (!response.ok) return

      const result = await response.json()

      if (append) {
        setPosts((prev) => [...prev, ...result.data])
      } else {
        setPosts(result.data)
      }

      setHasMore(result.pagination.hasMore)
      setPage(pageNum)
    } catch (error) {
      console.error("Error loading posts:", error)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }

  // Load more posts
  const loadMore = () => {
    if (!loadingMore && hasMore) {
      loadPosts(page + 1, true)
    }
  }

  useEffect(() => {
    loadPosts(1, false)
  }, [user?.id])

  const handleLike = async (postId: string, isLiked: boolean) => {
    if (!user?.id) {
      alert("Please log in to like posts")
      return
    }

    try {
      let response

      if (isLiked) {
        // Unlike: send DELETE request with userId in query params
        response = await fetch(`/api/posts/${postId}/like?userId=${encodeURIComponent(user.id)}`, {
          method: "DELETE",
        })
      } else {
        // Like: send POST request with userId in body
        response = await fetch(`/api/posts/${postId}/like`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: user.id }),
        })
      }

      if (response.ok) {
        const data = await response.json()
        setPosts((prevPosts) =>
          prevPosts.map((post) =>
            post.id === postId
              ? {
                  ...post,
                  isLiked: data.liked,
                  likes_count: data.likeCount,
                }
              : post
          )
        )
      } else {
        const error = await response.json()
        console.error("Error toggling like:", error)
      }
    } catch (error) {
      console.error("Error toggling like:", error)
    }
  }

  const handleDelete = async (postId: string) => {
    if (!user?.id) return
    if (!confirm("Are you sure you want to delete this post?")) return

    try {
      const response = await fetch(`/api/posts/${postId}?userId=${encodeURIComponent(user.id)}`, {
        method: "DELETE",
      })
      if (response.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== postId))
      } else {
        const data = await response.json()
        alert(data.error || "Failed to delete post")
      }
    } catch (error) {
      console.error("Error deleting post:", error)
      alert("Failed to delete post. Please try again.")
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 flex items-center justify-center min-h-[60vh]">
        <div className="text-center">
          <div className="inline-block p-4 rounded-full bg-secondary mb-4 animate-bounce-brutal">
            <Loader2 className="h-10 w-10 animate-spin text-secondary-foreground" />
          </div>
          <p className="text-muted-foreground font-bold tracking-wide">Loading club posts...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-3 sm:px-4 py-6 sm:py-10 space-y-6 sm:space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-secondary text-secondary-foreground transform -rotate-1">
          <Newspaper className="h-5 w-5" />
          <span className="font-bold tracking-wide text-sm">Latest Updates</span>
        </div>
        <h1 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
          Club Feed
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground font-medium">
          Posts from all school clubs
        </p>
        <div className="w-24 h-1 bg-primary mx-auto" />
      </div>

      {/* Posts Feed */}
      <div className="space-y-4 sm:space-y-6">
        {posts.length === 0 && !loading ? (
          <Card className="transition-all">
            <CardContent className="py-12 sm:py-16 text-center">
              <div className="inline-block p-4 rounded-full bg-muted mb-4">
                <Users className="h-10 w-10 sm:h-12 sm:w-12 text-muted-foreground" />
              </div>
              <p className="text-lg sm:text-xl text-foreground font-bold">No club posts yet</p>
              <p className="text-sm text-muted-foreground mt-2 font-medium">
                Join a club to see posts from your clubs!
              </p>
            </CardContent>
          </Card>
        ) : (
          <>
            {posts.map((post) => (
              <PostCard key={post.id} post={post} onLike={handleLike} onDelete={canDeleteAny ? handleDelete : undefined} />
            ))}

            {/* Load More Button */}
            {hasMore && (
              <div className="flex justify-center pt-4">
                <Button
                  onClick={loadMore}
                  disabled={loadingMore}
                  variant="secondary"
                  className="w-full sm:w-auto min-w-[200px]"
                >
                  {loadingMore ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : (
                    'Load More Posts'
                  )}
                </Button>
              </div>
            )}

            {!hasMore && posts.length > 0 && (
              <div className="text-center py-6">
                <div className="inline-block px-4 py-2 rounded-full bg-muted text-sm text-muted-foreground font-bold">
                  You've reached the end
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
