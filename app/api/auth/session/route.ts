import { NextRequest, NextResponse } from 'next/server'
import { randomUUID } from 'crypto'
import pool from '@/lib/db'
import { isBerkeleyPrepEmail } from '@/lib/auth-config'
import { DEMO_MODE, DEMO_EMAIL } from '@/lib/demo-mode'
import { AzureAuthError, verifyAzureLogin } from '@/lib/auth/azure-token'
import { clearSessionCookie, createSessionToken, setSessionCookie } from '@/lib/auth/session'
import { checkRateLimit } from '@/lib/security/input-validator'
import { getClientIdentifier } from '@/lib/security/api-middleware'
import { isTeacherEmail } from '@/lib/teacher-verification'
import { formatDisplayName } from '@/lib/utils'

const USER_COLUMNS = 'id, email, name, role, grade, department, created_at, updated_at'

// Demo login skips Microsoft entirely, so it can only ever work on a development server
const demoLoginAllowed = DEMO_MODE && process.env.NODE_ENV !== 'production'

// POST /api/auth/session - Trade a Microsoft sign-in for a session cookie.
// Body: { idToken, accessToken?, remember? }, or { demo: true } in local demo mode.
export async function POST(request: NextRequest) {
  try {
    const limit = checkRateLimit(`login:${getClientIdentifier(request)}`, 20, 60_000)
    if (!limit.allowed) {
      return NextResponse.json(
        { success: false, error: 'Too many sign-in attempts. Please wait a minute.' },
        { status: 429 }
      )
    }

    const body = await request.json().catch(() => null)
    if (!body || typeof body !== 'object') {
      return NextResponse.json({ success: false, error: 'Invalid request' }, { status: 400 })
    }

    let user
    if (body.demo === true) {
      if (!demoLoginAllowed) {
        return NextResponse.json({ success: false, error: 'Demo login is not available' }, { status: 403 })
      }
      const result = await pool.query(`SELECT ${USER_COLUMNS} FROM users WHERE lower(email) = lower($1)`, [DEMO_EMAIL])
      user = result.rows[0]
      if (!user) {
        return NextResponse.json(
          { success: false, error: `Demo user ${DEMO_EMAIL} not found. Load the test data with scripts/reset-db.sh.` },
          { status: 404 }
        )
      }
    } else {
      if (typeof body.idToken !== 'string' || !body.idToken) {
        return NextResponse.json({ success: false, error: 'Microsoft sign-in is required' }, { status: 400 })
      }

      const identity = await verifyAzureLogin(
        body.idToken,
        typeof body.accessToken === 'string' ? body.accessToken : undefined
      )

      if (!isBerkeleyPrepEmail(identity.email)) {
        return NextResponse.json(
          { success: false, code: 'domain_not_allowed', error: 'Only BPS School email addresses are allowed to access this application.' },
          { status: 403 }
        )
      }

      // Signing in is also registration: match the existing account case-insensitively so a
      // differently-cased email can't create a duplicate, and refresh the name from Microsoft.
      // The class year (stored in `grade`) comes from the "Class of 20XX" group; COALESCE keeps
      // the stored value when Microsoft gave us none, since a failed lookup isn't "no group".
      const name = formatDisplayName(identity.name) || identity.email.split('@')[0]
      const result = await pool.query(
        `WITH updated AS (
           UPDATE users SET name = $2::text, grade = COALESCE($4::integer, grade), updated_at = CURRENT_TIMESTAMP
           WHERE lower(email) = lower($1::text)
           RETURNING ${USER_COLUMNS}
         ), inserted AS (
           INSERT INTO users (id, email, name, role, grade, created_at, updated_at)
           SELECT $3::uuid, lower($1::text), $2::text, 'student', $4::integer, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
           WHERE NOT EXISTS (SELECT 1 FROM updated)
           ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name, grade = COALESCE(EXCLUDED.grade, users.grade), updated_at = CURRENT_TIMESTAMP
           RETURNING ${USER_COLUMNS}
         )
         SELECT * FROM updated UNION ALL SELECT * FROM inserted`,
        [identity.email, name, randomUUID(), identity.classYear]
      )
      user = result.rows[0]
    }

    const response = NextResponse.json({
      success: true,
      user,
      isTeacher: isTeacherEmail(user.email),
    })
    setSessionCookie(response, await createSessionToken(user.id), body.remember !== false)
    return response
  } catch (error) {
    if (error instanceof AzureAuthError) {
      console.error('Sign-in rejected:', error.message)
      const status = error.code === 'not_configured' ? 500 : 401
      return NextResponse.json({ success: false, code: error.code, error: 'Sign-in failed. Please try again.' }, { status })
    }
    console.error('Error creating session:', error)
    return NextResponse.json({ success: false, error: 'Failed to sign in' }, { status: 500 })
  }
}

// DELETE /api/auth/session - Sign out
export async function DELETE() {
  const response = NextResponse.json({ success: true })
  clearSessionCookie(response)
  return response
}
