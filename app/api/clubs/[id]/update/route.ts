import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'
import { validateImageUrl } from '@/lib/security/input-validator'

// PUT /api/clubs/[id]/update - Update club information (needs the editClub permission)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params
    const body = await request.json()
    const { description, meetingTime, location, imageUrl } = body

    const denied = await requireClubPermission(userId, clubId, 'editClub')
    if (denied) return denied

    // Validate required fields
    if (!description) {
      return NextResponse.json(
        { success: false, error: 'Description is required' },
        { status: 400 }
      )
    }

    if (
      typeof description !== 'string' || description.length > 2000 ||
      (meetingTime && (typeof meetingTime !== 'string' || meetingTime.length > 200)) ||
      (location && (typeof location !== 'string' || location.length > 200)) ||
      (imageUrl && (typeof imageUrl !== 'string' || !validateImageUrl(imageUrl).valid))
    ) {
      return NextResponse.json(
        { success: false, error: 'Invalid club details' },
        { status: 400 }
      )
    }

    // Check if club exists
    const clubCheck = await pool.query('SELECT id FROM clubs WHERE id = $1', [clubId])
    if (clubCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    // Update club
    const updateQuery = `
      UPDATE clubs 
      SET 
        description = $1,
        meeting_time = $2,
        location = $3,
        image_url = $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $5
      RETURNING *
    `

    const result = await pool.query(updateQuery, [
      description,
      meetingTime,
      location,
      imageUrl,
      clubId,
    ])

    return NextResponse.json({
      success: true,
      message: 'Club updated successfully',
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
