// Verifies the Microsoft sign-in proof the browser sends to POST /api/auth/session.
//
// The ID token is a JWT issued to this app (audience = our client ID) and signed by Microsoft,
// so we can check it offline against Microsoft's public keys. The optional Graph access token
// is only used to look up the same email the app has always used (mail, falling back to the
// UPN) and the "Class of 20XX" group they belong to; Graph itself validates that token, and we
// require it to belong to the same person.

import { createRemoteJWKSet, errors as joseErrors, jwtVerify } from "jose"

export class AzureAuthError extends Error {
  code: "not_configured" | "invalid_token" | "no_email"

  constructor(code: "not_configured" | "invalid_token" | "no_email", message: string) {
    super(message)
    this.code = code
  }
}

export interface AzureIdentity {
  email: string
  name: string
  // Graduation year from the user's "Class of 20XX" group. null when the lookup failed or the
  // user has no (or more than one) such group, so callers must not treat null as "clear it".
  classYear: number | null
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GRAPH_ME = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName"
const GRAPH_GROUPS = "https://graph.microsoft.com/v1.0/me/memberOf/microsoft.graph.group?$select=displayName&$top=999"
const CLASS_GROUP = /^Class of (\d{4})$/i
const MAX_GROUP_PAGES = 5

let keySet: ReturnType<typeof createRemoteJWKSet> | null = null

function getKeySet(tenantId: string) {
  keySet ??= createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  return keySet
}

// Reads the signed-in user's "Class of 20XX" group. Returns null for every kind of non-answer
// (Graph down, no such group, several such groups) so a bad lookup can never overwrite data.
async function fetchClassYear(accessToken: string): Promise<number | null> {
  try {
    const years = new Set<number>()
    let url: string | undefined = GRAPH_GROUPS
    for (let page = 0; url && page < MAX_GROUP_PAGES; page++) {
      const response: Response = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(4000),
      })
      if (!response.ok) {
        // Otherwise a missing permission (403) looks exactly like "user has no class group"
        console.warn(`Class year lookup failed: Graph returned ${response.status}`)
        return null
      }
      const body = await response.json()
      for (const group of body.value ?? []) {
        const match = CLASS_GROUP.exec(group.displayName ?? "")
        if (match) years.add(Number(match[1]))
      }
      url = body["@odata.nextLink"]
    }
    return years.size === 1 ? [...years][0] : null
  } catch {
    return null
  }
}

export async function verifyAzureLogin(idToken: string, accessToken?: string): Promise<AzureIdentity> {
  const clientId = process.env.NEXT_PUBLIC_AZURE_CLIENT_ID
  const tenantId = process.env.NEXT_PUBLIC_AZURE_TENANT_ID

  // The tenant must be pinned. With "common", a token from anyone's Microsoft tenant would pass
  // the signature check, and its email claim is not something we could trust.
  if (!clientId || !tenantId || !GUID.test(tenantId)) {
    throw new AzureAuthError(
      "not_configured",
      "NEXT_PUBLIC_AZURE_CLIENT_ID and NEXT_PUBLIC_AZURE_TENANT_ID (a tenant GUID) must be set"
    )
  }

  let claims
  try {
    const result = await jwtVerify(idToken, getKeySet(tenantId), {
      issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
      audience: clientId,
      algorithms: ["RS256"],
    })
    claims = result.payload
  } catch (error) {
    if (!(error instanceof joseErrors.JOSEError)) throw error
    throw new AzureAuthError("invalid_token", `Microsoft sign-in could not be verified (${error.code})`)
  }

  if (claims.tid !== tenantId || typeof claims.oid !== "string") {
    throw new AzureAuthError("invalid_token", "Microsoft sign-in is for the wrong tenant")
  }

  let email = (claims.email as string | undefined) || (claims.preferred_username as string | undefined)
  let name = (claims.name as string | undefined) || ""
  let classYear: number | null = null

  if (accessToken) {
    try {
      // Fetched side by side to keep sign-in fast; the groups are only used if /me checks out
      const [response, year] = await Promise.all([
        fetch(GRAPH_ME, {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(4000),
        }),
        fetchClassYear(accessToken),
      ])
      if (response.ok) {
        const me = await response.json()
        // Only trust Graph's answer if the token belongs to the person the ID token names
        if (me.id === claims.oid) {
          email = me.mail || me.userPrincipalName || email
          name = me.displayName || name
          classYear = year
        }
      }
    } catch {
      // Graph is a nicety; the verified ID token already identifies the user
    }
  }

  if (!email) {
    throw new AzureAuthError("no_email", "Microsoft sign-in did not include an email address")
  }
  return { email, name, classYear }
}
