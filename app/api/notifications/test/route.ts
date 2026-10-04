import { NextRequest, NextResponse } from 'next/server'
import { requireUser } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/security/input-validator'
import { sendPushToUser } from '@/lib/services/push'

// POST /api/notifications/test - Push a confirmation notification to the signed-in user's devices
export async function POST(request: NextRequest) {
  try {
    const auth = await requireUser(request)
    if (!auth.ok) return auth.response

    // Only ever reaches the caller's own devices, but keep it from being used to spam them.
    const rateLimit = checkRateLimit(`test-push:${auth.userId}`, 5, 60_000)
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please try again later.' },
        { status: 429 }
      )
    }

    const result = await sendPushToUser(auth.userId, {
      title: 'Notifications are on',
      body: "You're all set. You'll get a heads-up when your clubs post.",
      url: '/?section=notifications',
      tag: 'compass-test',
    })

    return NextResponse.json({ success: result.sent > 0, sent: result.sent, failed: result.failed })
  } catch (error) {
    console.error('Error sending test notification:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to send test notification' },
      { status: 500 }
    )
  }
}
