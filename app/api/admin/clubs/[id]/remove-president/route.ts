import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { isCoordinator } from '@/lib/auth/roles'

// POST /api/admin/clubs/[id]/remove-president - Remove a president and unclaim the club
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
        { success: false, error: 'Only coordinators can remove presidents' },
        { status: 403 }
      )
    }

    // Verify the target user is a president of the club
    const presidentCheck = await pool.query(
      `SELECT id FROM club_members WHERE club_id = $1 AND user_id = $2 AND role = 'president'`,
      [clubId, targetUserId]
    )

    if (presidentCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Target user is not a president of this club' },
        { status: 400 }
      )
    }

    // Start transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Remove all presidents from club_members
      await client.query(
        `DELETE FROM club_members WHERE club_id = $1 AND role = 'president'`,
        [clubId]
      )

      // Update club to be unclaimed
      await client.query(
        `UPDATE clubs SET is_claimed = false, president_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [clubId]
      )

      // Log the action in audit_log if table exists
      try {
        await client.query(
          `INSERT INTO audit_log (id, user_id, action, target_type, target_id, details, created_at)
           VALUES (gen_random_uuid(), $1, 'remove_president', 'club', $2, $3, CURRENT_TIMESTAMP)`,
          [userId, clubId, JSON.stringify({ removedUserId: targetUserId })]
        )
      } catch (auditError) {
        // Audit log table might not exist, continue anyway
        console.warn('Could not log to audit_log:', auditError)
      }

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'President removed and club is now unclaimed',
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error) {
    console.error('Error removing president:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove president' },
      { status: 500 }
    )
  }
}
