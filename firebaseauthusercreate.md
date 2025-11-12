# Firebase Auth User Creation - Internal Admin Flow

## Overview

**We (internally) create Firebase user accounts for Contacts using Firebase Admin SDK.** This is server-side user creation that happens BEFORE the client ever logs in.

## The Flow - Step by Step

### 1. Contact Selection (Frontend)
```
User selects Contact → contactId sent to API
```

**File:** `src/app/(authenticated)/client-operations/invite-prospect/page.jsx`

```javascript
// User clicks "Generate Portal Access"
const response = await api.post(
  `/api/contacts/${selectedContact.id}/generate-portal-access`
);
```

### 2. API Route Receives contactId

**File:** `src/app/api/contacts/[contactId]/generate-portal-access/route.js`

```javascript
// contactId comes from URL params
const { contactId } = await params;

// Fetch Contact from database
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
});
// contact.email = "joel@example.com"
```

### 3. Firebase Admin SDK Initialization

**File:** `src/lib/firebaseAdmin.js`

```javascript
// We use Firebase Admin SDK (server-side, privileged)
const admin = getFirebaseAdmin();
// Uses FIREBASE_SERVICE_ACCOUNT_KEY from environment
// This gives us admin privileges to create users
```

**Key Point:** We're using **Firebase Admin SDK**, not the client SDK. This allows us to:
- Create users programmatically
- Generate password reset links
- Manage users without their password

### 4. User Creation/Upsert Logic (Server-Side Only)

**File:** `src/app/api/contacts/[contactId]/generate-portal-access/route.js`

```javascript
const auth = admin.auth(); // Firebase Admin Auth instance (SERVER-SIDE)

// Try to get existing user by email
try {
  firebaseUser = await auth.getUserByEmail(contact.email);
  // Returns: { uid, email, displayName, ... } - Firebase UserRecord object
  // User already exists in Firebase - we'll reuse it
} catch (error) {
  // User doesn't exist - CREATE NEW USER
  firebaseUser = await auth.createUser({
    email: contact.email,                    // joel@example.com
    displayName: `${firstName} ${lastName}`,  // "Joel Gulick"
    emailVerified: false,                     // They'll verify via reset link
    disabled: false,                          // Account is active
    // NOTE: NO PASSWORD SET HERE!
  });
  // Returns: { uid, email, displayName, ... } - Firebase UserRecord object
}
```

**What Admin SDK Returns:**
- `firebaseUser` is a **Firebase UserRecord object** (server-side only)
- Contains: `uid`, `email`, `displayName`, `emailVerified`, `disabled`, `metadata`, etc.
- **NOT a token** - it's the user record itself
- This happens **entirely server-side** - frontend never sees this

**Critical:** We're **NOT setting a password** when creating the user. Firebase creates the account in a "passwordless" state.

### 5. Generate Password Reset Link (Full URL String)

```javascript
// Firebase generates a password reset link
const resetLink = await auth.generatePasswordResetLink(contact.email);
// Returns: "https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123xyz&apiKey=..."
```

**What This Returns:**
- A **complete URL string** (not a parameter, not a token)
- Example: `https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123xyz&apiKey=...`
- This is a **clickable link** that the client will use in their browser

**Critical: How It Works Even Without a Password**
- Firebase's `generatePasswordResetLink` works **even when the user has NO password set**
- When the client clicks the link, Firebase takes them to **Firebase's hosted password reset page** (not our client portal)
- It's not really a "reset" - it's more like a "set your initial password" link
- The client doesn't need to know any existing password because **there isn't one**
- Firebase uses the `oobCode` (out-of-band code) in the URL to verify the request is legitimate
- The link is time-limited and expires after a set time (Firebase default)
- After setting their password, Firebase redirects them to our client portal login page (via `continueUrl`)
- Once they set their password via the link, they can then log in normally with email + password

**Important:** The password setup happens on Firebase's page, NOT our client portal. After they set it, they're redirected to our portal login.

### 6. Store Firebase UID in Database (Server-Side)

```javascript
// Link Contact to Firebase user
await prisma.contact.update({
  where: { id: contactId },
  data: {
    notes: JSON.stringify({
      ...existingNotes,
      clientPortalAuth: {
        firebaseUid: firebaseUser.uid,  // Extract UID from Firebase UserRecord
        generatedAt: new Date().toISOString(),
        portalUrl: 'http://localhost:3001',
      },
    }),
  },
});
```

**What Gets Stored:**
- `firebaseUser.uid` → Stored in `Contact.notes.clientPortalAuth.firebaseUid` (Prisma DB)
- This is the **link** between our Contact and Firebase user
- Stored server-side in database - frontend doesn't hydrate this directly

**The Link:**
- `Contact.id` (Prisma) → `Contact.notes.clientPortalAuth.firebaseUid` → `Firebase User.uid`
- This is how we connect our Contact record to Firebase user

### 7. Return Password Reset Link to Frontend

```javascript
// Return reset link to frontend
return NextResponse.json({
  success: true,
  invite: {
    contactId,
    contactEmail: contact.email,
    passwordResetLink: resetLink,  // This is what frontend gets
    loginUrl: 'http://localhost:3001/login',
  },
});
```

**What Frontend Receives:**
- ✅ `passwordResetLink` - A **complete URL string** like `https://your-project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...`
- ✅ `contactId` - For reference
- ✅ `contactEmail` - For display
- ❌ **NOT** the Firebase UID (stored in DB, not sent to frontend)
- ❌ **NOT** a token (no token needed - the URL itself is the credential)
- ❌ **NOT** a parameter (it's a full URL the client clicks)

## Answering Your Questions

### Q: Are we basically upserting?

**A: YES - We're doing an upsert pattern:**

1. **Try to get existing user** by email
   - If exists → Use existing Firebase user
   - If not → Create new Firebase user

2. **Always generate a new reset link** (even for existing users)
   - This allows re-inviting contacts
   - Each link is unique and time-limited

### Q: How does the client reset their password if they don't have one yet?

**A: They don't "reset" - they SET it for the first time!**

**The Flow:**
1. We create Firebase user **WITHOUT a password** (passwordless state)
2. We generate a password reset link with `continueUrl` pointing to our client portal login
3. Client clicks the link → Firebase takes them to **Firebase's hosted password reset page** (not our portal)
4. Client enters a NEW password (no "old password" field because there isn't one)
5. Firebase validates the `oobCode` in the URL to ensure it's legitimate
6. Client's password is now set
7. Firebase redirects them to our client portal login page (`/login`)
8. Client can now log in normally with email + password on our client portal

**Key Point:** Firebase's `generatePasswordResetLink` works for BOTH:
- Users who have a password (actual reset)
- Users who don't have a password (first-time setup)

The client doesn't need to know any existing password because **there isn't one**.

### Q: Does Firebase just spit out a password?

**A: NO - Firebase does NOT create a password for us.**

**What Actually Happens:**
1. We create user **WITHOUT a password** (passwordless state)
2. Firebase generates a **password reset link**
3. Client clicks link → Firebase shows password setup page
4. Client **sets their own password** on Firebase's page
5. Client can then log in with email + their password

**We never see or know the password!**

### Q: Is this even possible?

**A: YES - This is exactly what Firebase Admin SDK is for:**

- **Client SDK** (`firebase/auth`) - For end users to sign up/login
- **Admin SDK** (`firebase-admin`) - For server-side user management

**Admin SDK Capabilities:**
- ✅ Create users programmatically
- ✅ Generate password reset links
- ✅ Manage users without passwords
- ✅ Set custom claims
- ✅ Disable/enable accounts

## The Complete Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ 1. BD User selects Contact (joel@example.com)              │
│    → contactId sent to API                                 │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. API Route: /api/contacts/:contactId/generate-portal-access│
│    → Fetch Contact from Prisma by contactId                 │
│    → Get contact.email                                       │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. Firebase Admin SDK                                        │
│    → admin.auth().getUserByEmail(email)                     │
│    → If not found: admin.auth().createUser({ email })      │
│    → NO PASSWORD SET - User created passwordless             │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. Generate Password Reset Link                             │
│    → admin.auth().generatePasswordResetLink(email)          │
│    → Returns: https://firebase-auth...?oobCode=xxx          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. Store Link in Contact                                    │
│    → Update Contact.notes.clientPortalAuth                  │
│    → Store firebaseUid for future lookups                    │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. Return Reset Link to BD User                             │
│    → BD User sends link to Contact                          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. Contact Clicks Link                                      │
│    → Firebase shows password setup page                     │
│    → Contact sets their own password                        │
│    → Password stored in Firebase (we never see it)          │
└────────────────────┬──────────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────────┐
│ 8. Contact Logs In                                          │
│    → Client Portal: /login                                 │
│    → Uses Firebase Client SDK                              │
│    → signInWithEmailAndPassword(email, password)            │
│    → System finds Contact by email                          │
│    → Portal hydrates with Contact data                      │
└─────────────────────────────────────────────────────────────┘
```

## Key Technical Details

### Firebase Admin SDK Setup

**Environment Variable:**
```
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
```

**Initialization:**
```javascript
// src/lib/firebaseAdmin.js
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});
```

### User Creation vs User Signup

**What We Do (Admin SDK):**
```javascript
// Server-side, privileged
admin.auth().createUser({
  email: 'joel@example.com',
  // No password - user will set it via reset link
});
```

**What Client Does (Client SDK):**
```javascript
// Client-side, in client portal
signInWithEmailAndPassword(auth, email, password);
// Uses password they set via reset link
```

### The Password Reset Link

**What It Actually Does:**
- Works for users **with or without** passwords
- If no password: User sets initial password
- If password exists: User resets existing password
- Link is **one-time use** and **time-limited**

**Link Format:**
```
https://[project].firebaseapp.com/__/auth/action?
  mode=resetPassword
  &oobCode=[code]
  &continueUrl=[portal-url]
```

## Security Model

### Why This Works

1. **Admin SDK is server-side only**
   - Requires service account key
   - Never exposed to client
   - Can only run on our backend

2. **Password reset links are secure**
   - Cryptographically signed by Firebase
   - Time-limited (expires)
   - One-time use
   - Can't be guessed

3. **Contact.email is the bridge**
   - Contact.email → Firebase User.email
   - Contact.id → Contact.notes.firebaseUid → Firebase User.uid
   - Universal personhood maintained

## Data Flow Summary

### Server-Side (API Route)
```
1. Admin SDK creates/gets Firebase user
   → Returns: Firebase UserRecord { uid, email, ... }
   
2. Extract firebaseUser.uid
   → Store in Prisma: Contact.notes.clientPortalAuth.firebaseUid
   
3. Generate password reset link
   → Returns: Full URL string (e.g., "https://project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=...")
   
4. Return to frontend
   → { passwordResetLink: "https://...", contactId, contactEmail }
```

### What Gets Stored Where

**In Prisma Database:**
- `Contact.notes.clientPortalAuth.firebaseUid` - Firebase UID (for linking)
- Stored server-side, not hydrated to frontend directly

**Sent to Frontend:**
- `passwordResetLink` - A **complete URL string** (e.g., `"https://project.firebaseapp.com/__/auth/action?mode=resetPassword&oobCode=ABC123..."`)
- `contactId` - For reference
- `contactEmail` - For display

**NOT Sent to Frontend:**
- ❌ Firebase UID (stored in DB only)
- ❌ Token (not needed - the URL itself contains the credential)
- ❌ Password (doesn't exist yet)
- ❌ Parameter (it's a full URL, not a query param)

### Frontend Hydration

**Frontend does NOT hydrate Firebase user data:**
- Frontend only receives the password reset link (full URL string)
- Frontend displays/copies the URL to send to client
- Client clicks the URL → Redirects to Firebase's password reset page
- Client sets password on Firebase's page
- Client then logs in using Firebase Client SDK (not Admin SDK)

## Summary

**We ARE creating Firebase users internally:**
- ✅ Using Firebase Admin SDK (server-side only)
- ✅ Admin SDK returns UserRecord object (not a token)
- ✅ Extract `firebaseUser.uid` and store in Prisma DB
- ✅ Generate password reset link (string URL)
- ✅ Return link to frontend (not the UID or token)
- ✅ Creating users WITHOUT passwords
- ✅ Clients set their own passwords via reset link
- ✅ We never see or store passwords

**This is the standard pattern for:**
- Inviting users to platforms
- Onboarding flows
- Enterprise user provisioning

