# Database Migrations

## Admin System Migration

This migration adds the necessary tables for the multi-role admin system.

### Tables Added:
1. `user_roles` - Global coordinator roles
2. `club_sponsors` - Teacher/sponsor assignments to clubs
3. `leadership_requests` - Pending leadership changes requiring sponsor approval
4. `audit_log` - Audit trail for admin actions

### Running the Migration

#### Option 1: Via API Endpoint (Recommended)
1. Add `MIGRATION_KEY` to your `.env.local` file:
   ```
   MIGRATION_KEY=your-secure-migration-key
   ```

2. Make a POST request to the migration endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/admin/migrate \
     -H "Authorization: Bearer your-secure-migration-key"
   ```

#### Option 2: Direct SQL Execution
1. Connect to your Vercel Postgres database
2. Run the SQL file directly:
   ```bash
   psql $DATABASE_URL -f migrations/add_admin_system_tables.sql
   ```

### Post-Migration Steps

1. **Set Coordinator Emails** in `.env.local`:
   ```
   COORDINATOR_EMAILS=admin1@school.edu,admin2@school.edu
   ```

2. **Verify Migration**:
   - Check that all tables were created
   - Verify indexes are in place
   - Test role checking functions

### Rollback (if needed)

To rollback this migration:
```sql
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS leadership_requests;
DROP TABLE IF EXISTS club_sponsors;
DROP TABLE IF EXISTS user_roles;
ALTER TABLE users DROP COLUMN IF EXISTS user_type;
```

### Notes
- Migration is idempotent (safe to run multiple times)
- Existing data is not affected
- Foreign keys use CASCADE for cleanup

## Drop Club Category (`drop_club_category.sql`)

Clubs no longer have a category. This removes the `clubs.category` column and its index.

Run it **before** deploying the code that stops sending a category. The column is `NOT NULL`, so creating a club without it fails until the column is gone.

```bash
psql "$DATABASE_URL" -f migrations/drop_club_category.sql
```

It is safe to re-run, and it permanently deletes the stored category values.
