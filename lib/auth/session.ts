// Server-side session: who is making this request.
//
// The browser signs in with Microsoft, then trades that proof for our own session cookie
// (POST /api/auth/session). Every API route reads the user from this cookie via
// requireUser(); a userId sent in a request body or query string is never trusted.
//
//   const auth = await requireUser(request)
//   if (!auth.ok) return auth.response
//   const userId = auth.userId

import { NextRequest, NextResponse } from "next/server"
import { SignJWT, jwtVerify } from "jose"

const isProduction = process.env.NODE_ENV === "production"

// The __Host- prefix makes browsers refuse the cookie unless it is Secure, has Path=/ and no
// Domain, so it can't be planted from a sibling subdomain. Browsers reject it over plain
// http, so local dev uses an unprefixed name.
export const SESSION_COOKIE = isProduction ? "__Host-bps_session" : "bps_session"
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60

const ISSUER = "bps-compass"
const AUDIENCE = "bps-compass-api"

let warnedAboutDevSecret = false

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET
  if (secret && secret.length >= 32) {
    return new TextEncoder().encode(secret)
  }
  if (isProduction) {
    // Fail closed: signing sessions with a guessable key would let anyone forge a login.
    throw new Error("SESSION_SECRET must be set to a random string of 32+ characters in production")
  }
  if (!warnedAboutDevSecret) {
    warnedAboutDevSecret = true
    console.warn("SESSION_SECRET is not set; using an insecure development secret.")
  }
  return new TextEncoder().encode("development-only-session-secret-do-not-use")
}

export async function createSessionToken(userId: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
    .sign(getSecret())
}

// Remembered sessions get a persistent cookie; otherwise it is a browser-session cookie
// that disappears when the browser closes.
export function setSessionCookie(response: NextResponse, token: string, remember: boolean) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    ...(remember ? { maxAge: SESSION_TTL_SECONDS } : {}),
  })
}

export function clearSessionCookie(response: NextResponse) {
  response.cookies.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    secure: isProduction,
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  })
}

// The signed-in user's id, or null when there is no valid session.
export async function getSessionUserId(request: NextRequest): Promise<string | null> {
  const token = request.cookies.get(SESSION_COOKIE)?.value
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ["HS256"],
    })
    return typeof payload.sub === "string" ? payload.sub : null
  } catch {
    return null
  }
}

export type AuthResult = { ok: true; userId: string } | { ok: false; response: NextResponse }

export async function requireUser(request: NextRequest): Promise<AuthResult> {
  const userId = await getSessionUserId(request)
  if (!userId) {
    return {
      ok: false,
      response: NextResponse.json({ success: false, error: "Not signed in" }, { status: 401 }),
    }
  }
  return { ok: true, userId }
}
