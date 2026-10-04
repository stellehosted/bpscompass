import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'
import { syncPrimaryPresident } from '@/lib/club-president'

// POST /api/clubs/[id]/members/add-leader - Add a leader by email
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
    const { email, role } = body

    if (!email || typeof email !== 'string' || !role) {
      return NextResponse.json(
        { success: false, error: 'Email and role are required' },
        { status: 400 }
      )
    }

    // Validate role
    const validLeaderRoles = ['officer', 'vice_president', 'president']
    if (!validLeaderRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid leadership role' },
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

    // Find user by email
    const userQuery = 'SELECT id FROM users WHERE lower(email) = lower($1)'
    const userResult = await pool.query(userQuery, [email.trim()])
    
    if (userResult.rows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'User with this email not found. They need to log in first.' },
        { status: 404 }
      )
    }

    const targetUserId = userResult.rows[0].id

    // Check if user is already a member
    const memberQuery = 'SELECT role FROM club_members WHERE club_id = $1 AND user_id = $2'
    const memberResult = await pool.query(memberQuery, [clubId, targetUserId])
    
    if (memberResult.rows.length > 0) {
      if (memberResult.rows[0].role === role) {
        return NextResponse.json(
          { success: false, error: 'This user already has that role in this club' },
          { status: 409 }
        )
      }

      // User is already a member, update their role
      await pool.query(
        'UPDATE club_members SET role = $1 WHERE club_id = $2 AND user_id = $3',
        [role, clubId, targetUserId]
      )
    } else {
      // User is not a member, add them with the leadership role
      await pool.query(
        'INSERT INTO club_members (club_id, user_id, role, joined_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP)',
        [clubId, targetUserId, role]
      )
    }

    // Re-assigning an existing president to officer/VP changes who the presidents are
    await syncPrimaryPresident(clubId)

    return NextResponse.json({
      success: true,
      updated: memberResult.rows.length > 0,
      message: memberResult.rows.length > 0 ? 'Member role updated successfully' : 'Leader added successfully',
    })
  } catch (error) {
    console.error('Error adding leader:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to add leader' },
      { status: 500 }
    )
  }
}