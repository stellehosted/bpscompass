import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'
import { validateUrl } from '@/lib/security/input-validator'

// GET /api/clubs/[id] - Get a specific club with details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Changed type
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params // Await params

    const query = `
      SELECT 
        c.*,
        u.name as president_name,
        COUNT(DISTINCT cm.id) as member_count,
        COALESCE(
          (SELECT json_agg(tag) FROM club_tags WHERE club_id = c.id),
          '[]'::json
        ) as tags
      FROM clubs c
      LEFT JOIN users u ON c.president_id = u.id
      LEFT JOIN club_members cm ON c.id = cm.club_id
      WHERE c.id = $1
      GROUP BY c.id, u.id
    `

    const result = await pool.query(query, [clubId])

    if (result.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    const club = result.rows[0]

    // Check if user is a member if userId provided
    if (userId) {
      const membershipQuery = `
        SELECT role FROM club_members WHERE club_id = $1 AND user_id = $2
      `
      const membership = await pool.query(membershipQuery, [clubId, userId])
      club.isJoined = membership.rows.length > 0
      club.memberRole = membership.rows[0]?.role || null
    }

    return NextResponse.json({
      success: true,
      data: club,
    })
  } catch (error) {
    console.error('Error fetching club:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club' },
      { status: 500 }
    )
  }
}

// PUT /api/clubs/[id] - Update club details (president only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> } // Changed type
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params // Await params
    const body = await request.json()

    const clubCheck = await pool.query('SELECT id FROM clubs WHERE id = $1', [clubId])

    if (clubCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    const denied = await requireClubPermission(userId, clubId, 'editClub')
    if (denied) return denied

    if (
      (body.description !== undefined && (typeof body.description !== 'string' || body.description.length > 2000)) ||
      (body.meetingTime && (typeof body.meetingTime !== 'string' || body.meetingTime.length > 200)) ||
      (body.location && (typeof body.location !== 'string' || body.location.length > 200)) ||
      (body.imageUrl && (typeof body.imageUrl !== 'string' || !validateUrl(body.imageUrl).valid))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid club details' },
        { status: 400 }
      )
    }

    // Build update query dynamically
    const updates: string[] = []
    const queryParams: any[] = []
    let paramCount = 1

    if (body.description !== undefined) {
      updates.push(`description = $${paramCount}`)
      queryParams.push(body.description)
      paramCount++
    }
    if (body.meetingTime !== undefined) {
      updates.push(`meeting_time = $${paramCount}`)
      queryParams.push(body.meetingTime)
      paramCount++
    }
    if (body.location !== undefined) {
      updates.push(`location = $${paramCount}`)
      queryParams.push(body.location)
      paramCount++
    }
    if (body.imageUrl !== undefined) {
      updates.push(`image_url = $${paramCount}`)
      queryParams.push(body.imageUrl)
      paramCount++
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No fields to update' },
        { status: 400 }
      )
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`)
    queryParams.push(clubId)

    const updateQuery = `
      UPDATE clubs 
      SET ${updates.join(', ')}
      WHERE id = $${paramCount}
      RETURNING *
    `

    const result = await pool.query(updateQuery, queryParams)

    return NextResponse.json({
      success: true,
      data: result.rows[0],
    })
  } catch (error) {
    console.error('Error updating club:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update club' },
      { status: 500 }
    )
  }
}