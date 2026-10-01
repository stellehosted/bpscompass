import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'

// GET /api/clubs/[id]/members - Get all members of a club
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const { id: clubId } = await params

    // This lists every member with their email, so it is for people who manage the club
    const denied = await requireClubPermission(auth.userId, clubId, 'manageMembers')
    if (denied) return denied

    const query = `
      SELECT 
        cm.id,
        cm.user_id,
        cm.role,
        cm.joined_at,
        u.name,
        u.email
      FROM club_members cm
      JOIN users u ON cm.user_id = u.id
      WHERE cm.club_id = $1
      ORDER BY 
        CASE cm.role 
          WHEN 'president' THEN 1
          WHEN 'vice_president' THEN 2
          WHEN 'officer' THEN 3
          ELSE 4
        END,
        cm.joined_at ASC
    `

    const result = await pool.query(query, [clubId])

    return NextResponse.json({
      success: true,
      data: result.rows,
    })
  } catch (error) {
    console.error('Error fetching club members:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch club members' },
      { status: 500 }
    )
  }
}