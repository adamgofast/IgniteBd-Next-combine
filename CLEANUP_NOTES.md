# 🧹 Clean Up Notes JSON - Step by Step

## Problem
The `notes` field still contains `clientPortalAuth` JSON data that should be in proper Prisma fields.

## ✅ Verification: Are we updating the right contactId?

**YES** - The API route uses:
```javascript
await prisma.contact.update({
  where: { id: contactId },  // ✅ Using contactId from request body
  data: {
    firebaseUid: firebaseUser.uid,
    clientPortalUrl: clientPortalUrl,
  },
});
```

The `contactId` comes from the request body and is validated against the contact's email.

## 🔧 Steps to Clean Up

### Step 1: Run Prisma Migration
```bash
# Make sure DATABASE_URL is set in .env.local
npx prisma migrate dev --name add_client_portal_auth_fields
```

This adds:
- `firebaseUid String? @unique`
- `clientPortalUrl String? @default("https://clientportal.ignitegrowth.biz")`
- `isActivated Boolean @default(false)`
- `activatedAt DateTime?`

### Step 2: Run Migration Script
```bash
node scripts/migrateNotesToAuth.js
```

This script:
- ✅ Extracts `clientPortalAuth.firebaseUid` → `firebaseUid` field
- ✅ Extracts `clientPortalAuth.portalUrl` → `clientPortalUrl` field
- ✅ **Removes `clientPortalAuth` from notes JSON**
- ✅ Keeps other notes data intact

### Step 3: Verify Cleanup
```sql
SELECT 
  id,
  email,
  "firebaseUid",
  "clientPortalUrl",
  notes,
  "isActivated"
FROM contacts
WHERE "firebaseUid" IS NOT NULL;
```

**Expected:**
- ✅ `firebaseUid` is filled
- ✅ `clientPortalUrl` is filled
- ✅ `notes` does NOT contain `clientPortalAuth` JSON

### Alternative: Manual SQL Cleanup

If you prefer SQL, run `scripts/cleanNotesSQL.sql` directly in your database.

## 🎯 After Cleanup

All new invites will:
- ✅ Write to `firebaseUid` field (NOT notes)
- ✅ Write to `clientPortalUrl` field (NOT notes)
- ✅ Keep `notes` clean for actual notes/context

