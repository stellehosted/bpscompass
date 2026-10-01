import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { isPresidentOfClub } from '@/lib/auth/roles'
import { syncPrimaryPresident } from '@/lib/club-president'

// POST /api/clubs/[id]/leave-presidency - A president steps down.
//
// Any of the club's presidents may use this (all presidents are equal).
//   - With newPresidentId: hand the presidency to that member and become a regular member.
//   - Without one, if other presidents remain: just leave the club; it stays claimed.
//   - Without one, if this is the only president: unclaim the club and leave.
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
    const newPresidentId = body.newPresidentId

    const clubCheck = await pool.query('SELECT id FROM clubs WHERE id = $1', [clubId])

    if (clubCheck.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Club not found' },
        { status: 404 }
      )
    }

    if (!(await isPresidentOfClub(userId, clubId))) {
      return NextResponse.json(
        { success: false, error: 'Only a president of this club can leave the presidency' },
        { status: 403 }
      )
    }

    if (newPresidentId && newPresidentId === userId) {
      return NextResponse.json(
        { success: false, error: 'Cannot hand the presidency to yourself' },
        { status: 400 }
      )
    }

    // Start transaction
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      if (newPresidentId) {
        // Transfer presidency to another member

        // Verify new president is a member
        const memberCheck = await client.query(
          'SELECT id, role FROM club_members WHERE club_id = $1 AND user_id = $2',
          [clubId, newPresidentId]
        )

        if (memberCheck.rows.length === 0) {
          throw new Error('New president must be a club member')
        }

        // Update old president to regular member
        await client.query(
          'UPDATE club_members SET role = $1 WHERE club_id = $2 AND user_id = $3',
          ['member', clubId, userId]
        )

        // Update new president role
        await client.query(
          'UPDATE club_members SET role = $1 WHERE club_id = $2 AND user_id = $3',
          ['president', clubId, newPresidentId]
        )

        // If the person stepping down was the primary president, their successor takes over as primary
        await client.query(
          'UPDATE clubs SET president_id = $1 WHERE id = $2 AND president_id = $3',
          [newPresidentId, clubId, userId]
        )
        await syncPrimaryPresident(clubId, client)

        await client.query('COMMIT')

        return NextResponse.json({
          success: true,
          message: 'Presidency transferred successfully'
        })
      }

      const otherPresidents = await client.query(
        `SELECT COUNT(*)::int AS count FROM club_members
         WHERE club_id = $1 AND role = 'president' AND user_id <> $2`,
        [clubId, userId]
      )

      // Remove user from club
      await client.query(
        'DELETE FROM club_members WHERE club_id = $1 AND user_id = $2',
        [clubId, userId]
      )

      if (otherPresidents.rows[0].count > 0) {
        // Other presidents remain: the club stays claimed and one of them is primary
        await syncPrimaryPresident(clubId, client)

        await client.query('COMMIT')

        return NextResponse.json({
          success: true,
          message: 'You have left the club'
        })
      }

      // No successor and no other presidents - unclaim the club
      await client.query(
        'UPDATE clubs SET is_claimed = false, president_id = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [clubId]
      )

      await client.query('COMMIT')

      return NextResponse.json({
        success: true,
        message: 'Club unclaimed and you have left the club'
      })
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    } finally {
      client.release()
    }
  } catch (error: any) {
    console.error('Error leaving presidency:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to leave presidency' },
      { status: 500 }
    )
  }
}
