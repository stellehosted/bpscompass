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

# Extra verified teachers (comma-separated), on top of lib/teacher-emails.json.
# For local testing: lets the demo sponsor claim clubs as a sponsor.
TEACHER_EMAILS=test.sponsor@berkeleyprep.org

# Azure AD (Entra ID) app registration for staff/student login.
# NEXT_PUBLIC_AZURE_CLIENT_ID: Application (client) ID from the Azure Portal.
# NEXT_PUBLIC_AZURE_TENANT_ID: Directory (tenant) ID from the Azure Portal.
#   Required for single-tenant app registrations (the default for apps created
#   after 10/15/2018) — these reject the shared "/common" login endpoint.
NEXT_PUBLIC_AZURE_CLIENT_ID=your-azure-client-id
NEXT_PUBLIC_AZURE_TENANT_ID=your-azure-tenant-id
