# Contact to Client Walkthrough
## First Onboarding Meeting Guide

**Goal**: Set up client account, demonstrate persona functionality, walk through deliverables, and establish value proposition.

---

## Pre-Meeting Checklist: Must-Build Items

### ✅ Critical Path (Must Have)
1. **Client Account Setup**
   - [ ] CompanyHQ created for client
   - [ ] At least one Contact created
   - [ ] Company linked to Contact via `contactCompanyId`
   - [ ] Product(s) created (if applicable)

2. **Persona Functionality**
   - [ ] Persona creation form working (`/persona` or `/personas/builder`)
   - [ ] Can create persona with:
     - Name, Role, Title, Industry
     - Goals, Pain Points, Desired Outcome
     - Value Prop to Persona
   - [ ] Product alignment working (if product selected)
   - [ ] Alignment score calculation working
   - [ ] Can view/edit existing personas

3. **Basic Deliverables Demo**
   - [ ] At least one ConsultantDeliverable created
   - [ ] Linked to Contact
   - [ ] Status tracking visible

### 🎯 Nice to Have (If Time Permits)
- [ ] Proposal creation wizard working
- [ ] Client portal access generation
- [ ] Timeline view

---

## Meeting Flow

### 1. Account Setup (5-10 min)

**Objective**: Get client's account configured in the system

**Steps**:
1. **Create CompanyHQ** (if not already done)
   - Navigate to company setup
   - Enter:
     - Company Name
     - Industry
     - What You Do (description)
     - Website (optional)
   - Save CompanyHQ ID for reference

2. **Create Contact** (the client person)
   - Go to Contacts
   - Add contact with:
     - First Name, Last Name
     - Email (critical - used for portal access)
     - Phone (optional)
     - Title/Role
   - Link to Company via `contactCompanyId`

3. **Create Product** (if applicable)
   - Go to Products
   - Create product with:
     - Name
     - Value Prop (this is what aligns with personas)
   - Link to CompanyHQ

**Demo Points**:
- "This is your tenant account - everything is scoped to your CompanyHQ"
- "Contacts are universal - same person can be in outreach AND client portal"
- "Products help us align personas with your value proposition"

---

### 2. Persona Walkthrough (15-20 min) ⭐ **CORE DEMO**

**Objective**: Show how personas work and demonstrate value prop alignment

**Starting Point**: Navigate to `/persona` or `/personas/builder`

**Live Demo Flow**:

1. **Create a Persona Together**
   - "Let's build a persona for your ideal client"
   - Fill out form together:
     - **Persona Name**: e.g., "Solo Biz Owner"
     - **Role**: e.g., "Founder"
     - **Title**: e.g., "Principal Consultant"
     - **Industry**: e.g., "Professional Services"
   
2. **Capture Their Insights**
   - **Goals**: "What outcomes do they care about?"
     - Example: "Grow revenue without working more hours"
   - **Pain Points**: "Where are they feeling friction?"
     - Example: "Manual follow-up, inconsistent pipeline visibility"
   - **Desired Outcome**: "What do they want?"
     - Example: "Automate client follow-up so nothing slips"

3. **Value Prop Alignment** ⭐ **KEY MOMENT**
   - **Value Prop to Persona**: "How does your solution help them?"
     - Example: "Simplify client management without hiring an assistant"
   - **Select Product** (if product exists)
   - **Show Alignment Score**: "See how well your product aligns with this persona"
     - Score calculated automatically (0-100)
     - Higher score = better fit

4. **Save & Review**
   - Save persona
   - Show persona details
   - Explain: "This persona now informs all your outreach and messaging"

**Demo Points**:
- "Personas help you speak directly to your ideal client"
- "Alignment score shows product-market fit"
- "Use personas to craft targeted messaging"
- "Personas drive your outreach strategy"

**Value Prop Pitch**:
- "We help you understand WHO you're selling to"
- "Alignment scores show you which personas are best fits"
- "Personas become the foundation for all your messaging"

---

### 3. Deliverables Overview (10-15 min)

**Objective**: Show what you're delivering to the client

**Starting Point**: Navigate to Client Operations or Proposals

**Demo Flow**:

1. **Show Deliverables Concept**
   - "Deliverables are what we're providing to clients"
   - Show ConsultantDeliverable model:
     - Title (e.g., "3 Target Personas")
     - Description
     - Category (foundation, integration, enrichment)
     - Status (pending, in-progress, completed)
     - Linked to Contact

2. **Create Sample Deliverable** (if time)
   - Create deliverable linked to their Contact
   - Set status to "in-progress"
   - Show how it tracks progress

3. **Connect to Proposals** (if applicable)
   - Show how deliverables link to proposals
   - Show how proposals have phases/milestones
   - Show how deliverables map to milestones

**Demo Points**:
- "Deliverables = what we're actually providing"
- "Status tracking = real-time visibility"
- "Everything links back to the Contact (the person)"

---

### 4. Value Proposition Summary (5 min)

**Closing Pitch**:

**What We Do**:
1. **Persona Development**: Understand your ideal client deeply
2. **Alignment Scoring**: Measure product-market fit
3. **Deliverable Tracking**: Clear visibility into what we're providing
4. **Contact-First Operations**: One person, multiple contexts (outreach + client portal)

**Why It Matters**:
- **Better Messaging**: Personas inform all outreach
- **Better Fit**: Alignment scores show best opportunities
- **Better Operations**: Clear deliverables and status tracking
- **Better Experience**: Clients see everything in portal

**Next Steps**:
- "We'll build out 2-3 personas together"
- "We'll create deliverables based on your engagement"
- "You'll see everything in your client portal"

---

## Technical Notes for Demo

### Routes to Know
- `/persona` - Simple persona creation form
- `/personas/builder` - Advanced persona builder with templates
- `/personas` - List all personas
- `/client-operations/proposals` - Proposal management
- `/client-operations/proposals/wizard` - Create new proposal
- `/contacts` - Contact management

### Key API Endpoints
- `POST /api/personas` - Create/update persona
- `GET /api/personas` - List personas (filtered by companyHQId)
- `POST /api/contacts` - Create contact
- `POST /api/companies` - Upsert company
- `POST /api/proposals` - Create proposal

### Data Flow
```
CompanyHQ (Tenant)
  └── Contact (Person)
        ├── Persona[] (Ideal clients)
        ├── Company (via contactCompanyId)
        │     └── Proposal[]
        │           └── ConsultantDeliverable[]
        └── Firebase Account (for portal)
```

### Common Issues & Solutions

**Issue**: "Can't find CompanyHQ ID"
- **Solution**: Check localStorage for `companyHQId` or use `NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID`

**Issue**: "Persona alignment score not calculating"
- **Solution**: Ensure both `product.valueProp` and `persona.valuePropToPersona` are filled

**Issue**: "Contact not linking to Company"
- **Solution**: Set `contactCompanyId` when creating/updating contact

**Issue**: "Can't see personas"
- **Solution**: Ensure filtering by `companyHQId` - personas are tenant-scoped

---

## Post-Meeting Action Items

### Immediate (Same Day)
- [ ] Create 2-3 personas based on meeting discussion
- [ ] Set up initial deliverables
- [ ] Create first proposal (if engagement agreed)

### Short Term (This Week)
- [ ] Generate client portal access
- [ ] Set up proposal with phases/milestones
- [ ] Link deliverables to proposal milestones

### Follow-Up
- [ ] Schedule next check-in
- [ ] Share persona documents
- [ ] Review alignment scores together

---

## Success Metrics

**Meeting Success =**:
- ✅ Client account created
- ✅ At least 1 persona created together
- ✅ Client understands value prop
- ✅ Deliverables concept explained
- ✅ Next steps clear

**Post-Meeting Success =**:
- ✅ 2-3 personas documented
- ✅ Initial deliverables created
- ✅ Proposal created (if applicable)
- ✅ Client portal access generated

---

## Quick Reference: Persona Fields

| Field | Purpose | Example |
|-------|---------|---------|
| **Name** | Persona identifier | "Solo Biz Owner" |
| **Role** | Their function | "Founder" |
| **Title** | Job title | "Principal Consultant" |
| **Industry** | Sector | "Professional Services" |
| **Goals** | What they want | "Grow revenue without working more hours" |
| **Pain Points** | Friction areas | "Manual follow-up, inconsistent pipeline" |
| **Desired Outcome** | End state | "Automate client follow-up" |
| **Value Prop to Persona** | How you help | "Simplify client management" |
| **Product Alignment** | Link to product | Select product → Auto-calculates alignment score |

---

## Value Prop Talking Points

### For Personas
- "Personas help you speak directly to your ideal client"
- "Alignment scores show product-market fit in real-time"
- "Use personas to craft targeted messaging that resonates"
- "Personas become the foundation for all your outreach"

### For Deliverables
- "Deliverables = what we're actually providing"
- "Status tracking = real-time visibility into progress"
- "Everything links back to the Contact (the person)"
- "Clients see deliverables in their portal"

### For System Overall
- "Contact-first: One person, multiple contexts"
- "Everything scoped to your tenant (CompanyHQ)"
- "Universal personhood: Same contact in outreach AND client portal"
- "Real-time alignment scoring"

---

**Last Updated**: [Date]  
**Next Review**: After first client meeting


