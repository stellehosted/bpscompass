-- Migration: users.grade becomes a graduation year
-- Description: grade was VARCHAR holding '9'-'12'; it now holds the class year as an INTEGER
-- (2027 = Class of 2027), synced from the Entra "Class of 20XX" group at sign-in.
--
-- Existing grades are converted relative to the school year this runs in (the school year
-- starts in July): a 12th grader becomes that school year's graduating class. Anything that
-- isn't 9-12 becomes NULL and is filled in at the next sign-in.
-- Idempotent: does nothing once the column is already INTEGER.

DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_name = 'users' AND column_name = 'grade') <> 'integer' THEN
    ALTER TABLE users ALTER COLUMN grade TYPE INTEGER USING (
      CASE WHEN grade IN ('9', '10', '11', '12')
        THEN EXTRACT(YEAR FROM CURRENT_DATE)::int
             + CASE WHEN EXTRACT(MONTH FROM CURRENT_DATE) >= 7 THEN 1 ELSE 0 END
             + (12 - grade::int)
      END
    );
  END IF;
END $$;
