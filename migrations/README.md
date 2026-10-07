# Database Migrations

## Admin System Migration

This migration adds the necessary tables for the multi-role admin system.

### Tables Added:
1. `user_roles` - Global coordinator roles
2. `club_sponsors` - Teacher/sponsor assignments to clubs
3. `leadership_requests` - Pending leadership changes requiring sponsor approval
4. `audit_log` - Audit trail for admin actions

### Running the Migration

Run the SQL file directly:
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

## Grade → Class Year Migration

`users.grade` now holds the graduation year as an INTEGER (2027 = Class of 2027), taken from the
user's Microsoft "Class of 20XX" group each time they sign in.

```bash
psql $DATABASE_URL -f migrations/convert_grade_to_class_year.sql
```

Existing `'9'`-`'12'` values are converted relative to the current school year (idempotent).

Everyone else picks up their class year the next time they sign in, so there's no separate backfill.
