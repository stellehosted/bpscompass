import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSessionUserId } from '@/lib/auth/session'

// Runs before every /api request. It is the safety net, not the only check: each route still
// calls requireUser() to learn *who* is asking, and requireClubPermission() and friends decide
// what they may do. This just guarantees a route that forgets can't be reached anonymously.
export async function proxy(request: NextRequest) {
  // Cross-site request forgery: a browser always sends Origin on cross-origin writes, so a
  // write coming from any other site is refused even though the session cookie would be sent.
  if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    const origin = request.headers.get('origin')
    if (origin) {
      let sameOrigin = false
      try {
        sameOrigin = new URL(origin).host === request.headers.get('host')
      } catch {}
      if (!sameOrigin) {
        return NextResponse.json({ success: false, error: 'Cross-site request blocked' }, { status: 403 })
      }
    }
  }

  // Signing in and out is how you get a session, so it can't require one
  if (request.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next()
  }

  if (!(await getSessionUserId(request))) {
    return NextResponse.json({ success: false, error: 'Not signed in' }, { status: 401 })
  }
  return NextResponse.next()
}

export const config = {
  matcher: '/api/:path*',
}
