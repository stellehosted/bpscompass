import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// GET /api/notifications/count - Get unread notification count
export async function GET(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId

    // Get user's filter preference
    const prefsResult = await pool.query(
      'SELECT filter_mode FROM notification_preferences WHERE user_id = $1',
      [userId]
    )
    const filterMode = prefsResult.rows[0]?.filter_mode || 'all'

    let countQuery = `
      SELECT COUNT(*) as count
      FROM notifications
      WHERE user_id = $1 AND is_read = FALSE
    `

    if (filterMode === 'my_clubs') {
      countQuery += ` AND (club_id IS NULL OR club_id IN (SELECT club_id FROM club_members WHERE user_id = $1))`
    }

    const result = await pool.query(countQuery, [userId])

    return NextResponse.json({
      success: true,
      count: parseInt(result.rows[0].count),
    })
  } catch (error) {
    console.error('Error fetching notification count:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch count' },
      { status: 500 }
    )
  }
}
