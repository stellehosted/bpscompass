import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'

// PUT /api/clubs/[id]/tags - Update club tags (needs the manageTags permission)
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
    const { tags } = body

    const denied = await requireClubPermission(userId, clubId, 'manageTags')
    if (denied) return denied

    if (!Array.isArray(tags)) {
      return NextResponse.json(
        { success: false, error: 'Tags must be an array' },
        { status: 400 }
      )
    }

    if (tags.length > 10) {
      return NextResponse.json(
        { success: false, error: 'Maximum 10 tags allowed' },
        { status: 400 }
      )
    }

    // Validate each tag
    for (const tag of tags) {
      if (typeof tag !== 'string' || tag.length > 30) {
        return NextResponse.json(
          { success: false, error: 'Each tag must be a string with max 30 characters' },
          { status: 400 }
        )
      }
    }

    // Check if club exists
    const clubCheck = await pool.query('SELECT id FROM clubs WHERE id = $1', [clubId])
    if (clubCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    // Begin transaction
    await pool.query('BEGIN')

    try {
      // Delete existing tags
      await pool.query('DELETE FROM club_tags WHERE club_id = $1', [clubId])

      // Insert new tags
      if (tags.length > 0) {
        const insertPromises = tags.map((tag: string) =>
          pool.query(
            'INSERT INTO club_tags (club_id, tag) VALUES ($1, $2)',
            [clubId, tag.toLowerCase().trim()]
          )
        )
        await Promise.all(insertPromises)
      }

      await pool.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Tags updated successfully',
        data: { tags },
      })
    } catch (error) {
      await pool.query('ROLLBACK')
      throw error
    }
  } catch (error) {
    console.error('Error updating tags:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update tags' },
      { status: 500 }
    )
  }
}
