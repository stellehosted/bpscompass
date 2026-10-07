# BPS Compass

A modern, simple club-organizing app for BPS: students can push updates, create club pages, manage leadership, and more

## Stack
- **Frontend**: Next.js 15, React 19, TypeScript
- **Authentication**: Microsoft Azure AD (MSAL)
- **State Management**: React Context API
- **Deployment**: Vercel

---
# Local Development & Testing

## 1. Clone and Install
```bash
git clone https://github.com/stellehosted/bpscompass
npm install
```

## 2. Make .env.local (Demo Mode; No Azure)
Demo mode uses a local postgresql database and makes test users, clubs, posts and roles.

```bash
# Create environment file
cp env-template.txt .env.local

# In .env.local:
NEXT_PUBLIC_DEMO_MODE=true
NEXT_PUBLIC_DEMO_PERSONA="coordinator" | "sponsor" | "president" | "vp" | "officer" | "member"
```

## 3. Make the local database
```bash
# Install and start Postgres 15 (macOS)
brew install postgresql@15
brew services start postgresql@15

# Homebrew doesn't add it to PATH: put this in ~/.zshrc
export PATH="/opt/homebrew/opt/postgresql@15/bin:$PATH"

# Runs script that resets database, applies schema, & loads test-data.sql
bash scripts/reset-db.sh
```

## 4. Point `.env.local` at the database
```
DATABASE_URL="postgresql://<your-mac-username>@localhost:5432/school_social_app"
```

## 5. Run Development Server
```bash
npm run dev
```

## 6. Open [localhost:3000](http://localhost:3000)

Additional guides & info in `docs/`

---
# Azure Authentication Setup (optional)
1. **Go to Azure Portal**: https://portal.azure.com
2. **Navigate to**: Azure Active Directory > App registrations
3. **Create New Registration**:
   - Name: `BPS Compass`
   - Supported account types: `Accounts in this organizational directory only`
   - Redirect URI (dev): Web > `http://localhost:3000`
4. **Get Client ID**: Copy the Application (client) ID
5. **Configure Permissions**: API permissions > Microsoft Graph > User.Read
6. **Create Environment File**:

```bash
# Create .env.local file
NEXT_PUBLIC_AZURE_CLIENT_ID=your-client-id-here
```

---
# User Creation
1. **User visits app** → Shown the sign-in screen (if not logged in)
2. **Microsoft Login** → User authenticates with school Microsoft account
3. **Domain Validation** → Only @berkeleyprep.org emails are accepted
4. **Profile Creation** → The account is created automatically on first sign-in; class year comes from their "Class of 20XX" Microsoft group
5. **Access Granted** → User can now access all app features

---
# Contribute!
1. Fork the repository
2. Make your changes
3. Test thoroughly
4. Submit a pull request

---
# License
This project is licensed under the MIT License - see the LICENSE file for details.
