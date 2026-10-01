# Azure AD Authentication
## NEXT_PUBLIC_AZURE_CLIENT_ID: Application (client) ID
## NEXT_PUBLIC_AZURE_TENANT_ID: Directory (tenant) ID
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-azure-tenant-id

# Database Configuration
DATABASE_URL="postgresql://postgres:password@localhost:5432/school_social_app"

# File Upload Configuration
UPLOAD_DIR="./public/uploads"
MAX_FILE_SIZE=5242880

# Vercel Blob Storage (alternative)
BLOB_READ_WRITE_TOKEN="your-blob-token"

# Application Configuration
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret-key"

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=900000

# Web Push Notifications (VAPID keys)
# Generate with: npx web-push generate-vapid-keys
NEXT_PUBLIC_VAPID_PUBLIC_KEY="your-vapid-public-key"
VAPID_PRIVATE_KEY="your-vapid-private-key"

# Image storage (Supabase) - optional locally
# If unset, uploads return 503 and deleting a post skips image cleanup.
# Use a separate DEV Supabase project with a public "club-images" bucket,
# never the production keys: uploads and deletes act on the real bucket.
# NEXT_PUBLIC_SUPABASE_URL="https://your-dev-project.supabase.co"
# NEXT_PUBLIC_SUPABASE_ANON_KEY="your-dev-anon-key"

# Demo Mode
# coordinator | sponsor | president | vp | officer | member
# or any seeded user's email
NEXT_PUBLIC_DEMO_PERSONA=coordinator
NEXT_PUBLIC_DEMO_MODE=true
TEACHER_EMAILS=test.sponsor@berkeleyprep.org