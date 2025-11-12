-- Manual SQL to clean clientPortalAuth from notes JSON
-- Run this AFTER running the Prisma migration and backfill script

-- Step 1: Migrate firebaseUid and clientPortalUrl from notes to fields
UPDATE contacts
SET 
  "firebaseUid" = (notes::json->>'clientPortalAuth')::json->>'firebaseUid',
  "clientPortalUrl" = COALESCE((notes::json->>'clientPortalAuth')::json->>'portalUrl', 'https://clientportal.ignitegrowth.biz')
WHERE 
  notes IS NOT NULL 
  AND notes::json->>'clientPortalAuth' IS NOT NULL
  AND (notes::json->>'clientPortalAuth')::json->>'firebaseUid' IS NOT NULL;

-- Step 2: Clean notes - remove clientPortalAuth from JSON, keep rest
UPDATE contacts
SET notes = (
  SELECT jsonb_build_object(
    key, value
  )
  FROM jsonb_each(notes::jsonb)
  WHERE key != 'clientPortalAuth'
)::text
WHERE 
  notes IS NOT NULL 
  AND notes::json->>'clientPortalAuth' IS NOT NULL;

-- Step 3: Set notes to NULL if it's now empty JSON
UPDATE contacts
SET notes = NULL
WHERE notes = '{}' OR notes = 'null';

-- Verify results
SELECT 
  id,
  email,
  "firebaseUid",
  "clientPortalUrl",
  notes,
  "isActivated",
  "activatedAt"
FROM contacts
WHERE "firebaseUid" IS NOT NULL;

