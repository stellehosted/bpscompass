-- Local test fixtures. Requires the schema to be applied first (see scripts/reset-db.sh).
--   * Miku Club: fully populated (sponsor, president, VP, officer, member, posts, tags, a like)
--   * A coordinator (user_roles) who isn't in any club
--   * Clubby McClubface: unclaimed, no members/posts, for testing empty states
--   * The Extraordinarily Long-Winded...: absurdly long name/time/location/description and a post with a
--     max-length title, for testing truncation and shrink-to-fit
-- The users below are also the demo-mode personas (NEXT_PUBLIC_DEMO_PERSONA, see lib/demo-mode.ts):
-- demo mode signs in as one of them by email, so this file is the only place they're defined.
-- Uses fixed UUIDs + ON CONFLICT DO NOTHING, so re-running never overwrites existing rows.
-- To pick up edits to rows that already exist, reset the database instead: scripts/reset-db.sh
-- Run: psql school_social_app -f database/test-data.sql

-- Users
INSERT INTO users (id, email, name, role, grade, user_type) VALUES
  ('00000000-0000-0000-0000-000000000001', 'test.sponsor@berkeleyprep.org', 'Quincy Sponsor', 'sponsor', NULL, 'teacher'),
  ('00000000-0000-0000-0000-000000000002', 'test.president@berkeleyprep.org', 'Gwen President', 'student', '12', 'student'),
  ('00000000-0000-0000-0000-000000000003', 'test.vp@berkeleyprep.org', 'Obyn VP', 'student', '11', 'student'),
  ('00000000-0000-0000-0000-000000000004', 'test.officer@berkeleyprep.org', 'Striker Officer', 'student', '10', 'student'),
  ('00000000-0000-0000-0000-000000000005', 'test.member@berkeleyprep.org', 'Churchill Member', 'student', '9', 'student'),
  ('00000000-0000-0000-0000-000000000006', 'test.coordinator@berkeleyprep.org', 'Benjamin Coordinator', 'admin', NULL, 'teacher')
ON CONFLICT (id) DO NOTHING;

-- Coordinator (site-wide admin; deliberately not a member of any club).
-- user_roles has no unique constraint, so guard re-runs with NOT EXISTS instead of ON CONFLICT.
INSERT INTO user_roles (user_id, role)
SELECT '00000000-0000-0000-0000-000000000006', 'coordinator'
WHERE NOT EXISTS (
  SELECT 1 FROM user_roles WHERE user_id = '00000000-0000-0000-0000-000000000006' AND role = 'coordinator'
);

-- Miku Club (Filled)
INSERT INTO clubs (id, name, description, meeting_time, location, image_url, is_claimed, president_id) VALUES
  ('10000000-0000-0000-0000-000000000001', 'Miku Club', 'The world is hers', 'Always', 'U000', '/uploads/mikuClub.jpg', true, '00000000-0000-0000-0000-000000000002')
ON CONFLICT (id) DO NOTHING;

-- Clubby McClubface (Empty)
INSERT INTO clubs (id, name, description, meeting_time, location, image_url, is_claimed) VALUES
  ('10000000-0000-0000-0000-000000000002', 'Clubby McClubface', 'Its Clubby McClubface. What more could you want?', 'Never', 'U999', '', false)
ON CONFLICT DO NOTHING;

-- Extremely long text (name/meeting_time/location are VARCHAR(255), post titles VARCHAR(200))
INSERT INTO clubs (id, name, description, meeting_time, location, image_url, is_claimed, president_id) VALUES
  ('10000000-0000-0000-0000-000000000003',
   'The Extraordinarily Long-Winded Society for the Appreciation, Preservation, and Enthusiastic Discussion of Absurdly Lengthy Club Names',
   'This club exists purely to find out what happens when a description goes on and on and on, well past the point where any reasonable card layout could show all of it, so that we can check it is cut off with an ellipsis instead of stretching or breaking the page. It has no end in sight.',
   'Every second Tuesday, Thursday, and occasional Friday of the month, before school, during lunch, and sometimes after school until the custodians ask us to leave',
   'The third floor annex behind the old science wing, past the vending machines, next to the stairwell that only sort of connects to the library',
   '', true, '00000000-0000-0000-0000-000000000002')
ON CONFLICT DO NOTHING;

-- Members (getUserRoles() reads the president from club_members, not clubs.president_id)
INSERT INTO club_members (club_id, user_id, role) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'president'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003', 'vice_president'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'officer'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'member'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002', 'president'),
  ('10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 'member')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Sponsor (this is what makes isSponsor true)
INSERT INTO club_sponsors (club_id, user_id, status) VALUES
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'active')
ON CONFLICT (club_id, user_id) DO NOTHING;

-- Posts (title is nullable)
INSERT INTO posts (id, club_id, user_id, title, content, created_at) VALUES
  ('20000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'World is Mine', 'Sekaide ichiban ohime sama!', now() - interval '3 days'),
  ('20000000-0000-0000-0000-000000000002', '10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', NULL, 'Untitled Post Test', now() - interval '1 day'),
  ('20000000-0000-0000-0000-000000000003', '10000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000002',
   'An Announcement With a Truly Remarkable Title That Keeps Going Long After Anyone Reasonably Expected It To Stop, Just To See What The Post Card Does With It',
   'Welcome to the very first meeting of the club with the longest name in school. Agenda: 1) argue about whether the name fits on one line, 2) discover it does not, 3) admire Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious_Supercalifragilisticexpialidocious as an unbreakable word, 4) snacks. Please bring a pen, a friend, and an unreasonable amount of enthusiasm. Also see https://example.com/a/very/long/link/that/goes/on/and/on/and/on/and/on/and/on/and/on/and/on/forever for the full minutes of every meeting we have never had.',
   now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

-- A like
INSERT INTO post_likes (post_id, user_id) VALUES
  ('20000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000003')
ON CONFLICT (post_id, user_id) DO NOTHING;
