import { NextRequest, NextResponse } from 'next/server'
import pool from '@/lib/db'
import { requireUser } from '@/lib/auth/session'

// POST /api/notifications/subscribe - Save push subscription
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const body = await request.json()
    const { subscription } = body

    if (!subscription || typeof subscription.endpoint !== 'string' || !subscription.endpoint.startsWith('https://') || subscription.endpoint.length > 2048 || !subscription.keys) {
      return NextResponse.json(
        { success: false, error: 'Valid push subscription required' },
        { status: 400 }
      )
    }

    // Save or update subscription
    await pool.query(
      `INSERT INTO push_subscriptions (user_id, endpoint, p256dh_key, auth_key)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, endpoint)
       DO UPDATE SET
         p256dh_key = $3,
         auth_key = $4,
         created_at = CURRENT_TIMESTAMP`,
      [userId, subscription.endpoint, subscription.keys.p256dh, subscription.keys.auth]
    )

    // Ensure user has notification preferences
    await pool.query(
      `INSERT INTO notification_preferences (user_id, push_enabled, filter_mode)
       VALUES ($1, TRUE, 'all')
       ON CONFLICT (user_id) DO NOTHING`,
      [userId]
    )

    return NextResponse.json({
      success: true,
      message: 'Push subscription saved',
    })
  } catch (error) {
    console.error('Error saving push subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to save subscription' },
      { status: 500 }
    )
  }
}

// DELETE /api/notifications/subscribe - Remove push subscription
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response
    const userId = auth.userId
    const { searchParams } = new URL(request.url)
    const endpoint = searchParams.get('endpoint')

    if (endpoint) {
      // Remove specific subscription
      await pool.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
        [userId, endpoint]
      )
    } else {
      // Remove all subscriptions for user
      await pool.query(
        'DELETE FROM push_subscriptions WHERE user_id = $1',
        [userId]
      )
    }

    return NextResponse.json({
      success: true,
      message: 'Push subscription removed',
    })
  } catch (error) {
    console.error('Error removing push subscription:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to remove subscription' },
      { status: 500 }
    )
  }
}
