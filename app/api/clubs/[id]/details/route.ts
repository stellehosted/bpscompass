import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { isCoordinator } from '@/lib/auth/roles'
import { permissionsForRoles, rolesFor } from '@/lib/auth/permissions'

// GET /api/clubs/[id]/details - Get complete club details including members and posts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: clubId } = await params
    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')

    // Get club details with primary president info (for backward compatibility)
    let clubQuery = `
      SELECT 
        c.*,
        u.name as president_name,
        u.email as president_email
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      WHERE c.id = $1
    `
    
    const clubResult = await pool.query(clubQuery, [clubId])
    
    if (clubResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    const club = clubResult.rows[0]

    // Get all presidents (supports multiple presidents)
    const presidentsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
        cm.joined_at
      FROM club_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.club_id = $1 AND cm.role = 'president'
      ORDER BY cm.joined_at ASC
    `
    const presidentsResult = await pool.query(presidentsQuery, [clubId])
    club.presidents = presidentsResult.rows

    // Get all sponsors
    const sponsorsQuery = `
      SELECT 
        u.id,
        u.name,
        u.email,
      FROM club_sponsors cs
      JOIN users u ON cs.user_id = u.id
      WHERE cs.club_id = $1 AND cs.status = 'active'
      ORDER BY cs.assigned_at ASC
    `
    const sponsorsResult = await pool.query(sponsorsQuery, [clubId])
    club.sponsors = sponsorsResult.rows
    
    // Try to get tags, fallback to empty array if table doesn't exist
    let tags = []
    try {
      const tagsResult = await pool.query(
        'SELECT tag FROM club_tags WHERE club_id = $1',
        [clubId]
      )
      tags = tagsResult.rows.map(row => row.tag)
    } catch (error) {
      console.log('club_tags table not found, using empty tags array')
    }
    
    club.tags = tags

    // Get member count and list (including sponsors)
    const membersQuery = `
      SELECT * FROM (
        SELECT 
          cm.id,
          cm.user_id,
          cm.role,
          cm.joined_at,
          u.name,
          u.email,
        FROM club_members cm
        JOIN users u ON cm.user_id = u.id
        WHERE cm.club_id = $1
        UNION ALL
        SELECT 
          cs.id,
          cs.user_id,
          'sponsor'::text as role,
          cs.assigned_at as joined_at,
          u.name,
          u.email,
        FROM club_sponsors cs
        JOIN users u ON cs.user_id = u.id
        WHERE cs.club_id = $1 AND cs.status = 'active'
      ) combined
      ORDER BY 
        CASE combined.role 
          WHEN 'sponsor' THEN 0
          WHEN 'president' THEN 1
          WHEN 'vice_president' THEN 2
          WHEN 'officer' THEN 3
          ELSE 4
        END,
        combined.joined_at ASC
    `
    const membersResult = await pool.query(membersQuery, [clubId])

    // Get recent posts (limit to 20 for performance), shaped like the feed's
    // posts so the club page can render them with PostCard.
    // Handle case where posts table might not exist yet
    let postsResult
    try {
      const postsQuery = `
        SELECT
          p.id,
          p.club_id,
          p.title,
          p.content,
          p.image_url,
          COUNT(DISTINCT pl.id)::int as likes_count,
          0 as comments_count,
          p.created_at,
          p.user_id as author_id,
          u.name as author_name,
          u.email as author_email,
          c.name as club_name,
          c.image_url as club_avatar
        FROM posts p
        JOIN users u ON p.user_id = u.id
        JOIN clubs c ON p.club_id = c.id
        LEFT JOIN post_likes pl ON p.id = pl.post_id
        WHERE p.club_id = $1
        GROUP BY p.id, u.id, u.name, u.email, c.name, c.image_url
        ORDER BY p.created_at DESC
        LIMIT 20
      `
      postsResult = await pool.query(postsQuery, [clubId])
    } catch (error) {
      console.log('Posts table not found or error fetching posts, returning empty array')
      postsResult = { rows: [] }
    }

    // Mark which posts the current user has liked
    let likedPostIds = new Set<string>()
    if (userId && postsResult.rows.length > 0) {
      const likesResult = await pool.query(
        `SELECT post_id FROM post_likes WHERE user_id = $1 AND post_id = ANY($2::uuid[])`,
        [userId, postsResult.rows.map((p: any) => p.id)]
      )
      likedPostIds = new Set(likesResult.rows.map((r: any) => r.post_id))
    }
    const posts = postsResult.rows.map((post: any) => ({
      ...post,
      isLiked: likedPostIds.has(post.id),
    }))

    // Check if current user is a member and their role, and if they are a sponsor
    let userMembership = null
    let userIsSponsor = false
    let userIsCoordinator = false
    if (userId) {
      const [membershipResult, sponsorResult, coordinator] = await Promise.all([
        pool.query(`SELECT role FROM club_members WHERE club_id = $1 AND user_id = $2`, [clubId, userId]),
        pool.query(`SELECT id FROM club_sponsors WHERE club_id = $1 AND user_id = $2 AND status = 'active'`, [clubId, userId]),
        isCoordinator(userId),
      ])
      if (membershipResult.rows.length > 0) {
        userMembership = membershipResult.rows[0].role
      }
      userIsSponsor = sponsorResult.rows.length > 0
      userIsCoordinator = coordinator
    }

    return NextResponse.json({
      success: true,
      data: {
        club: {
          ...club,
          member_count: membersResult.rows.length,
          is_joined: userMembership !== null,
          memberRole: userMembership,
          is_sponsor: userIsSponsor,
          is_coordinator: userIsCoordinator,
          // What this viewer may do here; the page shows buttons from this list
          permissions: permissionsForRoles(
            rolesFor({ memberRole: userMembership, isSponsor: userIsSponsor, isCoordinator: userIsCoordinator })
          ),
        },
        members: membersResult.rows,
        posts,
      },
    })
  } catch (error) {
    console.error('Error fetching club details:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club details' },
      { status: 500 }
    )
  }
}
