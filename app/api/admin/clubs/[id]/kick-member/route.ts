import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { isCoordinator } from '@/lib/auth/roles'

// POST /api/admin/clubs/[id]/kick-member - Remove any member from a club
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { id: clubId } = await params
    const body = await request.json()
    const { targetUserId } = body

    if (!targetUserId) {
      return NextResponse.json(
        { success: false, error: 'targetUserId is required' },
        { status: 400 }
      )
    }

    // Verify the user is a coordinator
    const isCoord = await isCoordinator(userId)
    if (!isCoord) {
      return NextResponse.json(
        { success: false, error: 'Only coordinators can kick members' },
        { status: 403 }
      )
    }

    // Check if target is a member of the club
    const memberCheck = await pool.query(
      `SELECT id, role FROM club_members WHERE club_id = $1 AND user_id = $2`,
      [clubId, targetUserId]
    )

    if (memberCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User is not a member of this club' },
        { status: 400 }
      )
    }

    const memberRole = memberCheck.rows[0].role

    // If removing a president, use the remove-president endpoint instead
    if (memberRole === 'president') {
      return NextResponse.json(
        { success: false, error: 'Use remove-president endpoint to remove presidents' },
        { status: 400 }
      )
    }

    // Remove the member
    await pool.query(
      `DELETE FROM club_members WHERE club_id = $1 AND user_id = $2`,
      [clubId, targetUserId]
    )

    // Log the action in audit_log if table exists
    try {
      await pool.query(
        `INSERT INTO audit_log (id, user_id, action, target_type, target_id, details, created_at)
         VALUES (gen_random_uuid(), $1, 'kick_member', 'club', $2, $3, CURRENT_TIMESTAMP)`,
        [userId, clubId, JSON.stringify({ removedUserId: targetUserId, previousRole: memberRole })]
      )
    } catch (auditError) {
      // Audit log table might not exist, continue anyway
      console.warn('Could not log to audit_log:', auditError)
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed from club',
    })
  } catch (error) {
    console.error('Error kicking member:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to kick member' },
      { status: 500 }
    )
  }
}
