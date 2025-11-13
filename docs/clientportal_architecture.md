# Client Portal Architecture

## Overview

The Client Portal is a **separate Next.js application** that provides clients with a view into their engagement with IgniteBD. It's a reflection of work being done by the production owner (the `companyHQId` tenant) - clients see their proposals, deliverables, timeline, and payments.

**Key Principle:** The portal hydrates based on the Contact's relationship to their Company and Proposals. It's Contact-first, scoped to the production owner's tenant.

### What Happens After Login

**Current State (What Exists):**
1. **Dashboard** - Shows deliverables list, stats, and "Promote to Owner" CTA
2. **Settings** - Change password functionality
3. **Navigation buttons** - Exist but are placeholders (not functional yet)

**What's Missing:**
- Proposal detail pages (`/proposals/[proposalId]`)
- Foundational Work page (`/foundational-work`)
- Timeline page (`/timeline`)
- Proposal list page (`/proposals`)

**The Flow:**
```
Login → Welcome → Dashboard (current end point)
                    ↓
            [Nav buttons exist but don't work yet]
                    ↓
            Settings (works - password change)
```

**Data Available:**
- Portal hydrates proposals, deliverables, payments, status
- All data comes from shared database
- Read-only view (clients can't edit)

---

## Architecture Model

### Separate App, Shared Database

- **Standalone Product**: Separate Next.js app (`ignitebd-clientportal`)
- **Shared Database**: Uses same Prisma schema and PostgreSQL database as IgniteBD
- **Direct DB Access**: Reads/writes directly via Prisma (no dependency on IgniteBD API)
- **Independent Deployment**: Own domain (`clientportal.ignitegrowth.biz`)

### Universal Personhood: Contact-First

**The Core Concept:**
- Contact exists in IgniteBD (in funnel, outreach, etc.)
- Same Contact can access Client Portal
- **No new user record needed** - Contact IS the user
- Contact's email = Firebase login username
- Contact's `firebaseUid` = Portal identity

**Data Scoping:**
- All data is scoped to `companyHQId` (the production owner/tenant)
- Contact sees proposals for their `contactCompanyId` → `Company`
- Proposals are linked to `Company` which belongs to `companyHQId`
- Deliverables are linked to `Contact` and `Proposal`

---

## User Flow

### 1. Link Generation (IgniteBD Side)

**BD User Action:**
```
BD User → Contact Detail Page
  → Click "Generate Portal Access"
  → POST /api/contacts/:contactId/generate-portal-access
```

**What Happens:**
1. System ensures Firebase user exists for `Contact.email` via `ensureFirebaseUser()`
   - Uses Firebase Admin SDK to get or create user
   - Creates user WITHOUT password (passwordless state)
2. Stores `firebaseUid` in `Contact.firebaseUid` field
3. Generates `InviteToken` record via `generateInviteLink()`
   - Creates unique token (16 char hex string)
   - Sets expiration (24 hours)
   - Stores in `InviteToken` table
4. Returns activation link to BD user

**Activation Link Format:**
```
https://clientportal.ignitegrowth.biz/activate?token=<inviteToken>
```

**BD User sends link to Contact** (via email, copy/paste, etc.)

### 2. Contact Activation

**Contact receives link and clicks it:**
```
Contact clicks activation link
  → GET /activate?token=<inviteToken>
  → Client Portal calls POST /api/activate (IgniteBD API)
  → System verifies InviteToken:
     - Checks token exists in InviteToken table
     - Verifies not used
     - Verifies not expired
  → Marks token as used
  → Returns Firebase UID, email, contactId
  → Redirects to /set-password?uid=<firebaseUid>&email=<email>&contactId=<contactId>
```

**Contact sets password:**
```
Contact → /set-password page
  → Enters new password (min 8 chars)
  → POST /api/set-password (IgniteBD API)
  → Firebase Admin SDK updates password: admin.auth().updateUser(uid, { password })
  → Marks Contact as activated: isActivated = true, activatedAt = now()
  → Redirects to /login?activated=true
```

### 3. Contact Login

**Contact logs in:**
```
Contact → /login page
  → Enters email (Contact.email)
  → Enters password (their password)
  → Firebase Client SDK authenticates: signInWithEmailAndPassword(auth, email, password)
  → GET /api/contacts/by-email?email=<email> (Client Portal API)
  → System finds Contact by email
  → Stores in localStorage:
     - clientPortalContactId
     - clientPortalCompanyHQId (from Contact.crmId)
     - clientPortalContactEmail
     - firebaseToken (ID token)
     - firebaseId (Firebase UID)
  → Redirects to /welcome
```

### 4. Welcome Screen

**Welcome page hydrates:**
```
/welcome page loads
  → Gets contactId from localStorage
  → Gets proposalId from URL params or localStorage
  → If no proposalId:
     → GET /api/contacts/:contactId/proposals
     → Finds proposals for Contact's company
     → Uses first proposal
  → If proposalId exists:
     → GET /api/proposals/:proposalId/portal
     → Verifies access and loads proposal data
  → Shows welcome message with engagement info
  → "Continue to Dashboard" button
```

### 5. Dashboard Hydration

**Dashboard loads and hydrates everything:**
```
/dashboard page loads
  → Gets contactId from localStorage
  → Gets proposalId from localStorage or finds via API
  → GET /api/proposals/:proposalId/portal
  → Portal data includes:
     - Client info (name, company, email, contactId)
     - Contract info (contractId, status)
     - Deliverables (what we're providing)
     - Proposal structure (phases, milestones)
     - Payments (payment schedule)
     - Status (overall, completed/total deliverables)
  → Displays dashboard with all engagement data
```

---

## Portal Hydration

### What Gets Hydrated

The portal hydrates **all engagement data** for the Contact:

**1. Client Information**
- Contact name, company, email
- Contact ID (for linking)

**2. Contract Information**
- Contract ID (`Company.contractId`)
- Contract status (active/pending)

**3. Deliverables (What We're Providing)**
- List of `ConsultantDeliverable` records
- Each deliverable shows:
  - Title, description, category
  - Status (pending/in-progress/completed/blocked)
  - Due date, completion date
  - Linked to proposal and milestone

**4. Proposal Structure**
- Proposal purpose
- Phases (with deliverables, activities, KPIs)
- Milestones (timeline, completion status)
- Proposal status

**5. Payments**
- Payment schedule from `Proposal.compensation.paymentSchedule`
- Payment amounts, due dates, status
- Payment history

**6. Overall Status**
- Overall engagement status
- Completed vs total deliverables count
- Next milestone
- Next payment due

### Hydration Endpoint

**GET /api/proposals/:proposalId/portal**

**Returns:**
```javascript
{
  success: true,
  portalData: {
    client: {
      name: "Joel Gulick",
      company: "BusinessPoint Law",
      contactEmail: "joel@businesspointlaw.com",
      contactId: "xxx"
    },
    contract: {
      contractId: "contract-xxx",
      status: "active"
    },
    deliverables: [
      {
        id: "del-1",
        title: "3 Target Personas",
        status: "completed",
        category: "foundation",
        dueDate: "2025-11-15",
        completedAt: "2025-11-10"
      },
      // ... more deliverables
    ],
    proposal: {
      id: "proposal-xxx",
      purpose: "...",
      phases: [/* phase data */],
      milestones: [/* milestone data */],
      status: "active"
    },
    payments: [
      {
        id: "payment-1",
        amount: 500,
        dueDate: "2025-11-15",
        status: "pending",
        description: "Kickoff payment"
      },
      // ... more payments
    ],
    status: {
      overall: "in-progress",
      completedDeliverables: 3,
      totalDeliverables: 8
    }
  }
}
```

### Data Relationships

**How Data is Linked:**
```
CompanyHQ (Production Owner/Tenant)
  └── Company (Client Company)
        ├── Contact (Client Person)
        │     ├── Firebase Account (email = Contact.email)
        │     └── ConsultantDeliverable[] (What we're providing)
        │           └── Linked to Proposal
        └── Proposal[] (Engagements)
              ├── ConsultantDeliverable[] (Deliverables)
              └── Compensation (Payment Schedule)
```

**Key Links:**
- `Contact.email` → Firebase Auth (universal personhood)
- `Contact.contactCompanyId` → `Company.id` (Contact works for Company)
- `Proposal.companyId` → `Company.id` (Proposal is for Company)
- `ConsultantDeliverable.contactId` → `Contact.id` (Deliverable is for Contact)
- `ConsultantDeliverable.proposalId` → `Proposal.id` (Deliverable from Proposal)
- `Company.contractId` → Contract (formal agreement)

---

## Portal Pages & Routes

### Core Routes (Implemented)

**`/splash`** - Auth check
- Checks Firebase auth state
- Redirects to `/welcome` if authenticated
- Redirects to `/login` if not authenticated
- 2.5s delay for smooth transition

**`/login`** - Client login
- Email + password form
- Firebase authentication
- Finds Contact by email
- Stores session in localStorage
- Redirects to `/welcome`

**`/welcome`** - Welcome screen
- Shows welcome message
- Displays engagement company name
- Verifies proposal access
- "Continue to Dashboard" button
- Redirects to `/dashboard`

**`/dashboard`** - Main dashboard (CURRENT STATE)
- Hydrates all engagement data via `/api/proposals/:proposalId/portal`
- Shows:
  - Welcome message with client name/company
  - Stats cards: Total Deliverables, Completed, Status
  - "Elevation CTA" - Promote to Owner button (if not already owner)
  - Deliverables list (Foundational Work section)
- Navigation header with buttons (currently placeholders):
  - Foundational Work (button - no route yet)
  - Proposals (button - no route yet)
  - Timeline (button - no route yet)
  - Settings (works - goes to `/settings`)

**`/settings`** - Settings page
- Change password link (works)
- Billing section (coming soon placeholder)
- Profile settings (future)

**`/settings/password`** - Change password
- Current password + new password form
- Firebase password update
- Re-authentication required

### Additional Routes

**`/activate`** - Account activation (InviteToken flow)
- Receives token from activation link
- Calls `/api/activate` (IgniteBD API) to verify token
- Gets Firebase UID, email, contactId
- Redirects to `/set-password` with params

**`/set-password`** - Initial password setup
- Receives uid, email, contactId from activation
- Client enters password (min 8 chars)
- Calls `/api/set-password` (IgniteBD API)
- Firebase Admin SDK sets password
- Contact marked as activated
- Redirects to `/login?activated=true`

**`/reset-password`** - Password reset
- Firebase password reset flow
- Email-based reset link
- Uses Firebase Client SDK

---

## Authentication & Session Management

### Firebase Authentication

**Contact Identity:**
- `Contact.email` = Firebase email
- `Contact.firebaseUid` = Firebase UID (stored in Contact model)
- `Contact.isActivated` = true after password is set
- Password managed by Firebase

**InviteToken System:**
- `InviteToken` table stores activation tokens
- Token: 16 char hex string (unique)
- Expires: 24 hours from creation
- Used: boolean flag (one-time use)
- Links to Contact via `contactId`

**Session Storage (localStorage):**
- `clientPortalContactId` - Contact ID
- `clientPortalCompanyHQId` - Tenant ID (from Contact.crmId)
- `clientPortalContactEmail` - Contact email
- `clientPortalProposalId` - Current proposal ID
- `firebaseToken` - Firebase ID token
- `firebaseId` - Firebase UID

### Password Management

**Initial Setup (InviteToken Flow):**
- BD user generates portal access via `/api/contacts/:contactId/generate-portal-access`
- System creates Firebase account (passwordless) via Admin SDK
- Creates `InviteToken` record (24h expiration)
- Activation link sent to Contact: `/activate?token=<token>`
- Contact clicks link → `/api/activate` verifies token
- Contact sets password via `/set-password` → `/api/set-password` sets Firebase password
- Contact marked as `isActivated: true`

**Password Changes:**
- Contact goes to `/settings/password`
- Enters current password (re-authentication via Firebase)
- Enters new password
- Firebase Client SDK updates password: `updatePassword(user, newPassword)`
- No backend changes needed

**Password Reset:**
- Contact uses Firebase password reset
- Email sent with reset link
- Contact resets via `/reset-password`
- Firebase handles reset flow (Client SDK)

---

## API Endpoints

### Client Portal Endpoints

**GET /api/proposals/:proposalId/portal**
- Gets all portal data for a proposal
- Returns client info, deliverables, payments, status
- Public endpoint (scoped by proposalId)

**GET /api/contacts/:contactId/proposals**
- Gets all proposals for a contact
- Finds proposals linked to Contact's company
- Returns proposal list with contact info

**GET /api/contacts/by-email?email=xxx**
- Finds Contact by email
- Used during login to get Contact ID
- Returns Contact info

**POST /api/auth/login**
- Firebase authentication endpoint
- Verifies credentials
- Returns contact info

**POST /api/set-password**
- Sets initial password for new accounts
- Updates Firebase password
- Requires activation token

### IgniteBD Endpoints (Called from Client Portal)

**POST /api/activate**
- Verifies InviteToken and returns redirect URL
- Checks token in InviteToken table
- Marks token as used
- Returns Firebase UID, email, contactId
- CORS enabled for client portal domain

**POST /api/set-password**
- Sets Firebase password using Admin SDK
- Updates Contact.isActivated = true
- Updates Contact.activatedAt
- CORS enabled for client portal domain

**GET /api/contacts/by-firebase-uid**
- Gets Contact by Firebase UID
- Returns contact info including role
- CORS enabled for client portal domain
- Used to check if contact is already an owner

---

## Notifications & Updates

### Current State

**No Real-Time Notifications Yet:**
- Portal hydrates on page load
- No WebSocket/SSE connections
- No push notifications
- No email notifications

### Planned Notification Features

**When Deliverables Change:**
- Email notification when deliverable status changes
- Portal shows updated status on next load
- Future: Real-time updates via WebSocket/SSE

**When Proposals Update:**
- Email notification when proposal is approved
- Portal shows new proposal status
- Future: Real-time proposal updates

**Payment Reminders:**
- Email reminder before payment due date
- Portal shows upcoming payments
- Future: In-app payment notifications

**Milestone Completions:**
- Email when milestone is completed
- Portal shows milestone progress
- Future: Real-time milestone updates

### Notification Setup (Future)

**Settings Page Enhancement:**
- Notification preferences
- Email notification toggles
- Frequency settings
- Delivery method preferences

**Backend Notification Service:**
- Trigger on deliverable status change
- Trigger on proposal approval
- Trigger on payment due
- Send email via SendGrid
- Future: In-app notifications

---

## Data Scoping & Security

### Tenant Scoping

**All Data Scoped to Production Owner:**
- `CompanyHQ` = Production owner (tenant)
- `Contact.crmId` = `CompanyHQ.id` (tenant boundary)
- `Proposal.companyHQId` = Tenant ID
- `Company.companyHQId` = Tenant ID

**Contact Sees Only Their Data:**
- Proposals for their `contactCompanyId` → `Company`
- Deliverables linked to their `contactId`
- Payments from their proposals
- Cannot access other tenants' data

### Security Model

**Authentication:**
- Firebase handles authentication
- Token verified on API calls
- Contact identity verified via Firebase UID

**Authorization:**
- Contact can only see their own proposals
- Proposals scoped to Contact's company
- Deliverables scoped to Contact ID
- No cross-tenant access

**Data Access:**
- Direct Prisma access (shared database)
- Queries filtered by tenant ID
- Contact ID used for deliverable filtering
- Company ID used for proposal filtering

---

## Key Features

### What Clients Can Do

**1. View Engagement Data:**
- See all proposals for their company
- View proposal details (phases, milestones)
- Track deliverables (what we're providing)
- Monitor engagement status

**2. Track Deliverables:**
- See list of deliverables
- View deliverable status
- See due dates and completion dates
- Filter by category

**3. View Payments:**
- See payment schedule
- View payment status
- See upcoming payments
- View payment history (future)

**4. Manage Account:**
- Change password
- Update profile (future)
- Set notification preferences (future)

**5. Elevation to Owner (Future):**
- Promote to IgniteBD owner
- Get their own stack
- Manage their own BD operations

### What Clients Cannot Do

**1. Create/Edit Proposals:**
- Read-only view
- Cannot modify proposals
- Cannot create new proposals

**2. Update Deliverables:**
- Cannot change deliverable status
- Cannot add deliverables
- Read-only view

**3. Process Payments:**
- Cannot process payments (yet)
- Can view payment schedule
- Future: Payment processing integration

**4. Access Other Tenants:**
- Cannot see other clients' data
- Scoped to their own company
- Tenant isolation enforced

---

## Technical Implementation

### Tech Stack

**Frontend:**
- Next.js 14 (App Router)
- React (Client Components)
- Tailwind CSS
- Firebase Auth (Client SDK)

**Backend:**
- Next.js API Routes
- Prisma ORM
- PostgreSQL (shared database)
- Firebase Admin SDK (for token verification)

**Authentication:**
- Firebase Authentication
- Email/password auth
- Token-based session

### Database Access

**Shared Database:**
- Same Prisma schema as IgniteBD
- Same PostgreSQL database
- Direct Prisma queries
- No API dependency on IgniteBD

**Key Models Used:**
- `Contact` - Client identity (with `firebaseUid`, `isActivated`, `activatedAt`)
- `InviteToken` - Activation tokens (one-time use, 24h expiration)
- `Company` - Client company
- `Proposal` - Engagement proposals
- `ConsultantDeliverable` - Deliverables
- `CompanyHQ` - Tenant boundary

### Deployment

**Separate Deployment:**
- Own Vercel project
- Own domain: `clientportal.ignitegrowth.biz`
- Same database connection string
- Independent scaling

**Environment Variables:**
- `DATABASE_URL` - Shared PostgreSQL database
- `NEXT_PUBLIC_FIREBASE_API_KEY` - Firebase config
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` - Firebase config
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID` - Firebase config
- `FIREBASE_ADMIN_PRIVATE_KEY` - Admin SDK (if needed)

---

## Current State vs. Planned Features

### What Exists Now

**After Login, Client Sees:**
1. **Dashboard (`/dashboard`)**
   - Welcome message
   - Stats overview (deliverables count, completed, status)
   - Deliverables list (read-only)
   - "Promote to Owner" CTA (if not already owner)
   - Navigation buttons (placeholders - not functional yet)

2. **Settings (`/settings`)**
   - Change password (works)
   - Billing placeholder

**What's Missing (Nav Buttons Exist But No Pages):**
- `/foundational-work` - Detailed deliverables view
- `/proposals` - Proposal list/detail pages
- `/timeline` - Timeline visualization
- `/proposals/[proposalId]` - Individual proposal view

### Planned Features

**1. Proposal Pages (High Priority)**
- `/proposals` - List all proposals for client
- `/proposals/[proposalId]` - Full proposal view
  - Hero/Header with welcome
  - Purpose section
  - Scope of Work (phases)
  - Compensation section
  - Interactive Timeline (milestones)
  - CLE Spotlight
  - Feedback & Collaboration
  - Approval footer
- Based on `PROPOSAL_STRUCTURE.md` design

**2. Foundational Work Page**
- `/foundational-work` or `/deliverables`
- Detailed deliverables view
- Filter by status, category
- View deliverable details
- Track progress

**3. Timeline Page**
- `/timeline`
- Visual timeline of milestones
- Progress tracking
- Phase visualization
- Payment schedule integration

**4. Real-Time Updates:**
- WebSocket/SSE for live updates
- Deliverable status changes
- Proposal updates
- Payment status changes

**5. Payment Processing:**
- Stripe integration
- Pay invoices directly
- Payment history
- Receipts

**6. Notifications:**
- Email notifications
- In-app notifications
- Notification preferences
- Delivery method selection

**7. Collaboration:**
- Client feedback on deliverables
- Comments on proposals
- File sharing
- Document viewing

**8. Elevation Flow:**
- Promote Contact to Owner (partially implemented)
- Create their own IgniteBD stack
- Migrate their data
- Onboarding flow

---

## Related Documentation

- **`CLIENT_OPERATIONS.md`** - Client operations architecture
- **`docs/architecture/client-operations.md`** - Detailed client operations docs
- **`ignitebd-clientportal/README.md`** - Client portal setup
- **`ignitebd-clientportal/SETUP.md`** - Setup instructions
- **`ignitebd-clientportal/docs/PROPOSAL_STRUCTURE.md`** - Proposal structure

---

**Last Updated**: November 2025  
**Architecture**: Contact-First (Universal Personhood)  
**Authentication**: Contact.email + Firebase  
**Portal**: Separate Next.js app, shared database  
**Hydration**: On-demand via API endpoints  
**Scoping**: Tenant-scoped (companyHQId)

