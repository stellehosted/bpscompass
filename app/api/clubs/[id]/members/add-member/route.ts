import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'
import { syncPrimaryPresident } from '@/lib/club-president'

// POST /api/clubs/[id]/members/add-member - Add a regular member by email.
// If they're already in the club as a leader, this makes them a regular member instead.
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
    const { email } = body

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Email is required' },
        { status: 400 }
      )
    }

    const clubCheck = await pool.query('SELECT id FROM clubs WHERE id = $1', [clubId])
    if (clubCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    const denied = await requireClubPermission(userId, clubId, 'manageMembers')
    if (denied) return denied

    const userResult = await pool.query('SELECT id FROM users WHERE lower(email) = lower($1)', [email.trim()])

    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User with this email not found. They need to log in first.' },
        { status: 404 }
      )
    }

    const targetUserId = userResult.rows[0].id

    const memberResult = await pool.query(
      'SELECT role FROM club_members WHERE club_id = $1 AND user_id = $2',
      [clubId, targetUserId]
    )

    if (memberResult.rows.length > 0) {
      if (memberResult.rows[0].role === 'member') {
        return NextResponse.json(
          { success: false, error: 'This user is already a member of this club' },
          { status: 409 }
        )
      }

      // Same rule as the Demote button: leaders can't demote themselves from here
      if (targetUserId === userId) {
        return NextResponse.json(
          { success: false, error: 'You cannot demote yourself. Use the transfer presidency feature instead.' },
          { status: 400 }
        )
      }

      await pool.query(
        `UPDATE club_members SET role = 'member' WHERE club_id = $1 AND user_id = $2`,
        [clubId, targetUserId]
      )
      await syncPrimaryPresident(clubId)

      return NextResponse.json({
        success: true,
        updated: true,
        message: 'Member role updated successfully',
      })
    }

    await pool.query(
      'INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
      [clubId, targetUserId, 'member']
    )

    return NextResponse.json({
      success: true,
      message: 'Member added successfully',
    })
  } catch (error) {
    console.error('Error adding member:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add member' },
      { status: 500 }
    )
  }
}
