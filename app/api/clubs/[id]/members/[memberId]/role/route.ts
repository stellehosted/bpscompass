import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'
import { requireClubPermission } from '@/lib/auth/club-permissions'
import { syncPrimaryPresident } from '@/lib/club-president'

// PUT /api/clubs/[id]/members/[memberId]/role - Update member role
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> }
) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const { id: clubId, memberId } = await params
    const body = await request.json()
    const { role } = body

    if (!role) {
      return NextResponse.json(
        { success: false, error: 'Role is required' },
        { status: 400 }
      )
    }

    // Validate role
    const validRoles = ['member', 'officer', 'vice_president', 'president']
    if (!validRoles.includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Invalid role' },
        { status: 400 }
      )
    }

    const denied = await requireClubPermission(auth.userId, clubId, 'manageMembers')
    if (denied) return denied

    // Update member role (supports multiple presidents - co-presidency)
    await pool.query(
      'UPDATE club_members SET role = $1 WHERE club_id = $2 AND user_id = $3',
      [role, clubId, memberId]
    )

    // Promoting or demoting can change who the presidents are
    await syncPrimaryPresident(clubId)

    return NextResponse.json({
      success: true,
      message: 'Member role updated successfully',
    })
  } catch (error) {
    console.error('Error updating member role:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update member role' },
      { status: 500 }
    )
  }
}