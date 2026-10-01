# Microsoft Azure Authentication Guide
You need to register your app in the Azure Portal and get these values

# How to Setup
1. Go to https://portal.azure.com
2. Navigate to "Azure Active Directory" > "App Registrations"
3. Click "New registration"
    - Name: "BPS Compass"
    - Supported account types: `Single tenant only - Berkeley Preparatory School`
    - Redirect URI: `Single-page Application (SPA)` > https://bpscompass.club
7. Copy `Application (client) ID` and `Directory (tenant) ID` from the Overview page
8. Set `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID` in Vercel's env vars

# How sign-in works
1. The browser signs in with Microsoft (MSAL) and gets an ID token.
2. It sends that token to `POST /api/auth/session`. The server checks Microsoft's signature, that the token was issued to this app (`NEXT_PUBLIC_AZURE_CLIENT_ID`) by our tenant (`NEXT_PUBLIC_AZURE_TENANT_ID`), and that the email is `@berkeleyprep.org`.
3. The server creates the user if needed and sets a signed, httpOnly session cookie.
4. Every other `/api` route learns who you are from that cookie only (`requireUser()` in `lib/auth/session.ts`). A `userId` in a request body or query string is ignored. `proxy.ts` rejects `/api` requests without a valid cookie before any route runs.

## Environment variables the server needs in production
- `NEXT_PUBLIC_AZURE_CLIENT_ID` and `NEXT_PUBLIC_AZURE_TENANT_ID`. The tenant must be the GUID, not `common`; without it every sign-in is rejected.
- `SESSION_SECRET`: 32+ random characters (`openssl rand -base64 48`). Without it, sessions can't be created.
- `DATABASE_CA_CERT`: your database's CA certificate, so the TLS connection is verified (see `env-template.md`).
- Do not set `NEXT_PUBLIC_DEMO_MODE` in production. Demo login is also refused by the server whenever `NODE_ENV=production`.
