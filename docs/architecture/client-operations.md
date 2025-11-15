# Client Operations & Portal Architecture

## Overview

**Client Operations** is about **delivering value** to clients once they enter our architecture. This document covers both the **owner-side operations** (creating deliverables, managing work) and the **client-side portal** (where clients view their engagement).

**The Core Reality:**
```
Contact → Contract → Deliverables → Client Portal → Pay Bills
```

**Key Principle:** Contact-First (Universal Personhood)
- Contact exists in IgniteBD (funnel, outreach, etc.)
- Same Contact can access Client Portal
- **No new user record needed** - Contact IS the user
- Contact's email = Firebase login username
- Contact's `firebaseUid` = Portal identity

---

## Owner-Side Operations

### The Owner Flow

**1. Create Proposal**
```
Owner → Select Contact
  → Create/upsert Company (via contactCompanyId)
  → Create Proposal (linked to companyHQId, companyId)
  → Proposal status: "draft" → "active" → "approved"
```

**2. Convert Proposal to Deliverables**
```
When Proposal status = "approved":
  → ProposalToDeliverablesService.convertProposalToDeliverables()
  → Extracts deliverables from Proposal.phases/milestones
  → Creates ConsultantDeliverable records
  → Links to contactId, proposalId, companyHQId, contactCompanyId
  → Status starts as "pending"
```

**3. Start Work**
```
Owner → Select Contact
  → Navigate to deliverable build page (?contactId=xyz)
  → Build work artifact (persona, blog, upload, etc.)
  → Save to ConsultantDeliverable.workContent (JSON)
  → Update status: "pending" → "in-progress"
```

**4. Generate Portal Access**
```
Owner → Contact Detail Page
  → Click "Generate Portal Access"
  → POST /api/contacts/:contactId/generate-portal-access
  → Creates Firebase account (passwordless)
  → Generates InviteToken (24h expiration)
  → Returns activation link
  → Owner sends link to Contact
```

### Owner-Side Hydration/Upsert Pattern

**All upserts follow this pattern:**
1. **Link to Tenant** - Everything scoped to `companyHQId` (tenant boundary)
2. **Contact-First** - Start with Contact (the person)
3. **Company Association** - Use `contactCompanyId` to link Contact → Company
4. **Create/Update** - Based on contact/companyId associations

**Example: Creating Deliverable**
```javascript
// 1. Get contact (already has companyHQId via crmId)
const contact = await prisma.contact.findUnique({
  where: { id: contactId },
  include: { contactCompany: true }
});

// 2. Extract tenant and company info
const companyHQId = contact.crmId; // Tenant boundary
const contactCompanyId = contact.contactCompanyId; // Contact's company

// 3. Create deliverable (linked to tenant, contact, company)
const deliverable = await prisma.consultantDeliverable.create({
  data: {
    contactId,              // Link to Contact
    companyHQId,            // Tenant boundary
    contactCompanyId,       // Contact's company
    proposalId,             // Optional: link to Proposal
    title: "...",
    status: "pending",
    // ... other fields
  }
});
```

**Example: Converting Proposal to Deliverables**
```javascript
// When proposal is approved:
// ProposalToDeliverablesService.convertProposalToDeliverables(proposalId)

// 1. Get proposal with company/contact
const proposal = await prisma.proposal.findUnique({
  where: { id: proposalId },
  include: {
    company: {
      include: { contacts: { take: 1 } }
    }
  }
});

// 2. Extract deliverables from proposal structure
const deliverables = extractDeliverablesFromProposal(proposal);

// 3. Create ConsultantDeliverable for each
const created = await Promise.all(
  deliverables.map(d => prisma.consultantDeliverable.create({
    data: {
      contactId: proposal.company.contacts[0].id,
      companyHQId: proposal.companyHQId,
      contactCompanyId: proposal.companyId,
      proposalId: proposal.id,
      title: d.title,
      status: 'pending',
      // ... other fields
    }
  }))
);
```

### ConsultantDeliverable Model

**Schema:**
```prisma
model ConsultantDeliverable {
  id          String   @id @default(cuid())
  contactId   String   // Link to Contact (the client)
  contact     Contact  @relation(fields: [contactId], references: [id], onDelete: Cascade)
  
  // What we're delivering
  title       String
  description String?
  category    String?  // "foundation", "integration", "enrichment", etc.
  type        String?  // "persona", "blog", "upload", etc.
  
  // Work content (stored as JSON for flexibility)
  workContent Json?    // Actual work artifact (persona data, blog content, etc.)
  
  // Status tracking
  status      String   @default("pending") // "pending" | "in-progress" | "completed" | "blocked"
  
  // Link to proposal/milestone (optional)
  proposalId  String?
  proposal    Proposal? @relation(fields: [proposalId], references: [id], onDelete: SetNull)
  milestoneId String?  // Reference to milestone in Proposal.milestones JSON
  
  // Delivery tracking
  dueDate     DateTime?
  completedAt DateTime?
  notes       String?
  
  // Tenant scoping
  companyHQId     String   // Always linked to owner's company
  companyHQ       CompanyHQ @relation(fields: [companyHQId], references: [id], onDelete: Cascade)
  contactCompanyId String? // Link to contact's company
  
  // Metadata
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  
  @@index([contactId])
  @@index([proposalId])
  @@index([companyHQId])
  @@map("consultant_deliverables")
}
```

**Key Fields:**
- `workContent` (JSON) - Actual work artifact (persona, blog, etc.) - **This indicates work has started**
- `status` - Tracks progress: pending → in-progress → completed
- `companyHQId` - Tenant boundary (owner's company)
- `contactCompanyId` - Contact's company (for scoping)

---

## Client Portal Architecture

### Separate App, Shared Database

- **Standalone Product**: Separate Next.js app (`ignitebd-clientportal`)
- **Shared Database**: Uses same Prisma schema and PostgreSQL database as IgniteBD
- **Direct DB Access**: Reads/writes directly via Prisma (no dependency on IgniteBD API)
- **Independent Deployment**: Own domain (`clientportal.ignitegrowth.biz`)

### Strategic Routing (Welcome Page)

**Owners send contacts to portal in two scenarios:**

1. **First Visit: Proposal Ready**
   - Proposal exists (draft/active/approved)
   - No deliverables OR deliverables exist but no workContent
   - **Route:** `/proposals/[proposalId]` (proposal view)

2. **Second Visit: Work Started**
   - Deliverables exist with `workContent` (actual work artifacts)
   - OR deliverables have status "in-progress" or "completed"
   - **Route:** `/dashboard` (work view with deliverables)

**Welcome Router Logic:**
```javascript
// GET /api/client/state
// Checks:
// 1. Does contact have deliverables with workContent?
// 2. Do deliverables have active status (in-progress/completed)?
// 3. Does contact have proposals?

if (workHasStarted) {
  route = '/dashboard';  // Scenario 2: Work has started
} else if (primaryProposal) {
  route = `/proposals/${primaryProposal.id}`;  // Scenario 1: Proposal ready
} else {
  route = '/dashboard';  // Fallback: Empty state
}
```

### Portal Routes

**Core Routes:**
- `/splash` - Auth check (redirects to welcome/login)
- `/login` - Contact login (email + password via Firebase)
- `/welcome` - **Strategic router** (routes to proposal view or dashboard)
- `/dashboard` - Main dashboard (deliverables, stats, invoices)
- `/proposals/[proposalId]` - Proposal detail view (when proposal ready)
- `/settings` - Settings (password change, billing)

**Missing Routes (Nav buttons exist but not implemented):**
- `/foundational-work` - Detailed deliverables view
- `/proposals` - Proposal list page
- `/timeline` - Timeline visualization

### Portal Hydration

**Hydration Endpoint:** `GET /api/proposals/:proposalId/portal`

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
        completedAt: "2025-11-10",
        hasWorkContent: true  // Indicates work has started
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

### Authentication Flow

**1. Generate Portal Access (Owner Side)**
```
Owner → POST /api/contacts/:contactId/generate-portal-access
  → Creates Firebase account (passwordless)
  → Stores firebaseUid in Contact.firebaseUid
  → Generates InviteToken (24h expiration)
  → Returns activation link: /activate?token=<token>
```

**2. Contact Activation**
```
Contact clicks activation link
  → GET /activate?token=<token>
  → POST /api/activate (verifies token)
  → Redirects to /set-password?uid=<firebaseUid>&email=<email>&contactId=<contactId>
  → Contact sets password
  → POST /api/set-password (sets Firebase password)
  → Marks Contact.isActivated = true
  → Redirects to /login?activated=true
```

**3. Contact Login**
```
Contact → /login
  → Enters email + password
  → Firebase authenticates
  → GET /api/contacts/by-email?email=<email>
  → Stores in localStorage:
     - clientPortalContactId
     - clientPortalContactEmail
     - firebaseToken
     - firebaseId
  → Redirects to /welcome
```

**4. Welcome Router**
```
/welcome loads
  → GET /api/client/state
  → Checks:
     - Deliverables with workContent? → /dashboard
     - Proposals exist? → /proposals/[proposalId]
     - Otherwise → /dashboard (empty state)
  → Routes accordingly
```

**5. Dashboard Hydration**
```
/dashboard loads
  → Gets contactId from localStorage
  → Gets proposalId from localStorage or finds via API
  → GET /api/proposals/:proposalId/portal
  → Displays engagement data
```

---

## Data Relationships

**Contact-First Hierarchy:**
```
CompanyHQ (Tenant/Owner)
  └── Contact (Person)
        ├── Firebase Account (email = Contact.email)
        ├── contactCompanyId → Company (Client Business)
        │     ├── Proposal[] (Engagements)
        │     │     └── ConsultantDeliverable[] (Deliverables)
        │     └── contractId (Formal agreement)
        └── ConsultantDeliverable[] (What we're providing)
              └── Linked to Proposal
```

**Key Associations:**
- `Contact.email` → Firebase Auth (universal personhood)
- `Contact.firebaseUid` → Firebase UID (stored in Contact model)
- `Contact.contactCompanyId` → `Company.id` (Contact works for Company)
- `Proposal.companyId` → `Company.id` (Proposal is for Company)
- `ConsultantDeliverable.contactId` → `Contact.id` (Deliverable is for Contact)
- `ConsultantDeliverable.proposalId` → `Proposal.id` (Deliverable from Proposal)
- `ConsultantDeliverable.companyHQId` → `CompanyHQ.id` (Tenant boundary)
- `ConsultantDeliverable.workContent` → JSON (Actual work artifact - indicates work started)

---

## API Endpoints

### Owner Side (IgniteBD)

**POST /api/deliverables**
- Create deliverable
- Body: `{ contactId, title, description, category, proposalId, milestoneId, dueDate, status, workContent }`
- Auth: Required (Firebase token)

**GET /api/deliverables?contactId=xxx**
- List deliverables for contact
- Auth: Optional (scoped by contactId)

**PUT /api/deliverables/:deliverableId**
- Update deliverable status/workContent
- Body: `{ status, completedAt, notes, workContent }`
- Auth: Required (Firebase token)

**POST /api/contacts/:contactId/generate-portal-access**
- Generate portal access for contact
- Creates Firebase account, generates InviteToken
- Returns activation link
- Auth: Required (Firebase token)

### Client Portal

**GET /api/client/state**
- Get contact state for strategic routing
- Returns: proposals, deliverables, routing decision
- Auth: Required (Firebase token)

**GET /api/proposals/:proposalId/portal**
- Get portal data for proposal
- Returns: client info, deliverables, payments, status
- Auth: Optional (scoped by proposalId)

**GET /api/contacts/:contactId/proposals**
- Get all proposals for contact
- Auth: Optional (scoped by contactId)

**GET /api/contacts/by-email?email=xxx**
- Find contact by email
- Used during login
- Auth: Optional

**GET /api/contacts/by-firebase-uid**
- Get contact by Firebase UID
- Returns contact info including role
- Auth: Required (Firebase token)

---

## Key Takeaways

**Owner-Side:**
1. **Contact-First** - All operations start with Contact
2. **Tenant Scoping** - Everything linked to `companyHQId`
3. **Proposal → Deliverables** - When proposal approved, convert to deliverables
4. **Work Content** - `workContent` field indicates work has started
5. **Upsert Pattern** - Link to tenant, then create based on contact/company associations

**Client Portal:**
1. **Strategic Routing** - Routes based on work state (proposal ready vs work started)
2. **Universal Personhood** - Contact IS the user (no separate user model)
3. **Shared Database** - Direct Prisma access, no API dependency
4. **Hydration** - Portal hydrates on load via `/api/proposals/:proposalId/portal`
5. **Read-Only** - Clients can view but not edit

**Work Has Started Indicator:**
- Deliverables with `workContent` (JSON field with actual work artifacts)
- OR deliverables with status "in-progress" or "completed"
- Used by welcome router to determine routing

---

## Related Documentation

- **`ignitebd-clientportal/README.md`** - Client portal setup
- **`ignitebd-clientportal/docs/PROPOSAL_STRUCTURE.md`** - Proposal data structure
- **`HYDRATION_ARCHITECTURE.md`** - Hydration patterns

---

**Last Updated**: November 2025  
**Architecture**: Contact-First (Universal Personhood)  
**Owner Side**: Proposal → Deliverables → Work Content  
**Client Portal**: Strategic Routing → Proposal View or Dashboard  
**Work Indicator**: `workContent` field or active status  
**Authentication**: Contact.email + Firebase  
**Portal**: Separate Next.js app, shared database
