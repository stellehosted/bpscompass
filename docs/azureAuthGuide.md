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