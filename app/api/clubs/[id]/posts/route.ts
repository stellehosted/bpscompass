import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { checkPostRateLimit } from '@/lib/security/input-validator'
import { getClientIdentifier } from '@/lib/security/api-middleware'
import { createNotificationsForClubMembers } from '@/lib/services/notifications'
import { requireClubPermission } from '@/lib/auth/club-permissions'

// GET /api/clubs/[id]/posts - Get all posts for a club
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Changed type
) {
  try {
    const { id: clubId } = await params // Await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const query = `
      SELECT 
        p.*,
        u.name as author_name,
        u.email as author_email,
        COUNT(DISTINCT pl.id)::int as likes_count
      FROM posts p
      JOIN users u ON p.user_id = u.id
      LEFT JOIN post_likes pl ON p.id = pl.post_id
      WHERE p.club_id = $1
      GROUP BY p.id, u.id, u.name, u.email
      ORDER BY p.created_at DESC
    `

    const result = await pool.query(query, [clubId])

    // Check which posts user has liked
    let posts = result.rows
    if (userId && posts.length > 0) {
      const postIds = posts.map((p: any) => p.id)
      const likesQuery = `
        SELECT post_id FROM post_likes 
        WHERE user_id = $1 AND post_id = ANY($2::uuid[])
      `
      const likesResult = await pool.query(likesQuery, [userId, postIds])
      const likedPostIds = new Set(likesResult.rows.map((r: any) => r.post_id))

      posts = posts.map((post: any) => ({
        ...post,
        isLiked: likedPostIds.has(post.id),
      }))
    } else {
      posts = posts.map((post: any) => ({
        ...post,
        isLiked: false,
      }))
    }

    return NextResponse.json({
      success: true,
      data: posts,
      count: posts.length,
    })
  } catch (error) {
    console.error('Error fetching club posts:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch posts' },
      { status: 500 }
    )
  }
}

// POST /api/clubs/[id]/posts - Create a new post for a club (members only)
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clubId } = await params // Await params
    const body = await request.json()
    const userId = body.userId
    const content = body.content
    const imageUrl = body.imageUrl
    const title = typeof body.title === 'string' ? body.title.trim() : ''

    if (!userId) {
      return NextResponse.json(
        { success: false, error: 'User ID required' },
        { status: 400 }
      )
    }

    // Apply post-specific rate limiting
    const identifier = `${getClientIdentifier(request)}-${userId}`
    const rateLimit = checkPostRateLimit(identifier)

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimit.error,
          retryAfter: Math.ceil((rateLimit.resetTime - Date.now()) / 1000),
          remaining: rateLimit.remaining,
        },
        {
          status: 429,
          headers: {
            'X-RateLimit-Remaining-Minute': rateLimit.remaining.minute.toString(),
            'X-RateLimit-Remaining-Hour': rateLimit.remaining.hour.toString(),
            'X-RateLimit-Remaining-Day': rateLimit.remaining.day.toString(),
            'Retry-After': Math.ceil((rateLimit.resetTime - Date.now()) / 1000).toString(),
          },
        }
      )
    }

    if (!content || !content.trim()) {
      return NextResponse.json(
        { success: false, error: 'Post content is required' },
        { status: 400 }
      )
    }

    if (!title) {
      return NextResponse.json(
        { success: false, error: 'Post title is required' },
        { status: 400 }
      )
    }

    const denied = await requireClubPermission(userId, clubId, 'post')
    if (denied) return denied

    // Create post
    const insertQuery = `
      INSERT INTO posts (club_id, user_id, content, image_url, title)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `

    const result = await pool.query(insertQuery, [
      clubId,
      userId,
      content.trim(),
      imageUrl || null,
      title,
    ])

    // Get author info
    const authorQuery = 'SELECT name, email FROM users WHERE id = $1'
    const authorResult = await pool.query(authorQuery, [userId])
    const author = authorResult.rows[0]

    const post = {
      ...result.rows[0],
      author_name: author.name,
      author_email: author.email,
      isLiked: false,
    }

    // Get club name for notification
    const clubResult = await pool.query('SELECT name FROM clubs WHERE id = $1', [clubId])
    const clubName = clubResult.rows[0]?.name || 'A club'

    // Create notifications for club members (except the poster)
    try {
      await createNotificationsForClubMembers(
        clubId,
        post.id,
        'new_post',
        `New post in ${clubName}`,
        content.trim().substring(0, 100) + (content.trim().length > 100 ? '...' : ''),
        userId // Exclude the poster from notifications
      )
    } catch (notifError) {
      // Don't fail the post creation if notifications fail
      console.error('Error creating notifications:', notifError)
    }

    return NextResponse.json({
      success: true,
      data: post,
    }, { status: 201 })
  } catch (error) {
    console.error('Error creating post:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create post' },
      { status: 500 }
    )
  }
}

