// Verifies the Microsoft sign-in proof the browser sends to POST /api/auth/session.
//
// The ID token is a JWT issued to this app (audience = our client ID) and signed by Microsoft,
// so we can check it offline against Microsoft's public keys. The optional Graph access token
// is only used to look up the same email the app has always used (mail, falling back to the
// UPN); Graph itself validates that token, and we require it to belong to the same person.

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
}

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const GRAPH_ME = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName"

let keySet: ReturnType<typeof createRemoteJWKSet> | null = null

function getKeySet(tenantId: string) {
  keySet ??= createRemoteJWKSet(new URL(`https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`))
  return keySet
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

  if (accessToken) {
    try {
      const response = await fetch(GRAPH_ME, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(4000),
      })
      if (response.ok) {
        const me = await response.json()
        // Only trust Graph's answer if the token belongs to the person the ID token names
        if (me.id === claims.oid) {
          email = me.mail || me.userPrincipalName || email
          name = me.displayName || name
        }
      }
    } catch {
      // Graph is a nicety; the verified ID token already identifies the user
    }
  }

  if (!email) {
    throw new AzureAuthError("no_email", "Microsoft sign-in did not include an email address")
  }
  return { email, name }
}
