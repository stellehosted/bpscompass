import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'

// DELETE /api/clubs/[id]/members/[memberId] - Remove a regular member from the club
// memberId is the member's user id, same as the role route next to it.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const { id: clubId, memberId } = await params

    const denied = await requireClubPermission(auth.userId, clubId, 'manageMembers')
    if (denied) return denied

    // Only plain members can be removed here. Leaders have to be demoted first, so this
    // can never remove a president or leave the club without one.
    const result = await pool.query(
      `DELETE FROM club_members WHERE club_id = $1 AND user_id = $2 AND role = 'member'`,
      [clubId, memberId]
    )

    if (result.rowCount === 0) {
      return NextResponse.json(
        { success: false, error: 'Member not found, or is a leader. Demote them first.' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Member removed successfully',
    })
  } catch (error) {
    console.error('Error removing member:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove member' },
      { status: 500 }
    )
  }
}
