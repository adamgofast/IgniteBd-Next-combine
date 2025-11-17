# Client Operations & Portal Architecture

## Overview

**Client Operations** is about **delivering value** to clients once they enter our architecture. This document covers **owner-side operations** (creating deliverables, managing work).

**For Client Portal Development:** See `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md` - focused guide on what clients see and how the portal works.

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

## Client Portal (What Clients See)

**📖 For detailed client portal development guide, see:** `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md`

**Quick Summary:**
- **Separate App**: `ignitebd-clientportal` - standalone Next.js app
- **Shared Database**: Same Prisma schema and PostgreSQL database
- **Data Sources**: Hydrates from Proposals, WorkPackages, and ConsultantDeliverables
- **Strategic Routing**: Welcome page routes based on work state (proposal ready vs work started)
- **Read-Only**: Clients can view but not edit

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

**GET /api/workpackages/client/:contactId**
- Get work packages for contact (client view - published artifacts only)
- Returns: WorkPackages with hydrated artifacts
- Auth: Required (Firebase token)

### Client Portal Endpoints

**See:** `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md` for full client portal API documentation

---

## Key Takeaways

**Owner-Side:**
1. **Contact-First** - All operations start with Contact
2. **Tenant Scoping** - Everything linked to `companyHQId`
3. **Proposal → Deliverables** - When proposal approved, convert to deliverables
4. **Work Content** - `workContent` field indicates work has started
5. **Upsert Pattern** - Link to tenant, then create based on contact/company associations

**Client Portal:**
- See `ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md` for full client portal details

**Work Has Started Indicator:**
- Deliverables with `workContent` (JSON field with actual work artifacts)
- OR deliverables with status "in-progress" or "completed"
- Used by welcome router to determine routing

---

## Related Documentation

- **`ignitebd-clientportal/docs/CLIENT_PORTAL_DEV_GUIDE.md`** - **Client portal dev guide (what clients see)**
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
