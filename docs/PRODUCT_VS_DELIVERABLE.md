# Product vs Deliverable - Model Clarification

## Overview

There's an important distinction between **Product** and **Deliverable** in the IgniteBD system. This document clarifies their roles and relationships.

## Product Model

**Location**: `CompanyHQ` level (tenant-scoped)

**Purpose**: 
- Template/catalog item that describes what services/products your company offers
- Used for **BD Intelligence scoring** to match contacts to products based on pain points
- Represents your service offerings at a high level

**Key Fields**:
- `name` - Product/service name
- `valueProp` - Value proposition (used for fit scoring)
- `description` - Full description
- `price`, `priceCurrency`, `pricingModel` - Pricing info
- `targetMarketSize`, `salesCycleLength` - Market characteristics
- `targetedTo` - Persona ID this product targets

**Relationships**:
- Belongs to `CompanyHQ` (one-to-many)
- Can be linked to `Persona` (many-to-many via `targetedTo`)

**Usage**:
- Created in `/products/builder`
- Used in proposal builder as "services" (loaded from `/api/products`)
- Used for BD Intelligence fit scoring
- **NOT directly used in proposals** - they become "serviceInstances" in proposals

## Deliverable Model (ConsultantDeliverable)

**Location**: `Contact` level (client-specific)

**Purpose**:
- Actual work items delivered to a specific client/contact
- What shows up in the **proposal UX** (per PROPOSAL_STRUCTURE.md)
- Created when proposals are approved

**Key Fields**:
- `title` - Deliverable name
- `description` - What's being delivered
- `category` - "foundation", "integration", "enrichment", etc.
- `type` - "persona", "blog", "upload", etc.
- `workContent` - JSON with actual work artifact
- `status` - "pending" | "in-progress" | "completed" | "blocked"
- `proposalId` - Link to proposal
- `milestoneId` - Reference to milestone in proposal

**Relationships**:
- Belongs to `Contact` (the client)
- Belongs to `CompanyHQ` (tenant scoping)
- Optional: linked to `Proposal`
- Optional: linked to `ContactCompany`

**Usage**:
- Created from approved proposals via `ProposalToDeliverablesService`
- Extracted from `Proposal.phases.deliverables` or `Proposal.milestones.deliverable`
- Displayed in proposal UX as the actual deliverables
- Tracked in client portal

## Proposal Model

**Purpose**: Bridge between Products and Deliverables

**Structure**:
```javascript
{
  serviceInstances: Json?, // Array of ProposalServiceInstance (selected products/services)
  phases: Json?,           // Array of Phase objects (with deliverables, activities, kpis)
  milestones: Json?,       // Array of Milestone objects (week, label, completed, deliverable)
  compensation: Json?      // Payment structure
}
```

**Flow**:
1. **Products** → Selected in proposal builder → Become `serviceInstances`
2. **Phases** → Created in proposal builder → Contain `deliverables` array
3. **Milestones** → Created in proposal builder → Reference `deliverable` field
4. **Approval** → `ProposalToDeliverablesService` extracts deliverables → Creates `ConsultantDeliverable` records

## Key Distinctions

| Aspect | Product | Deliverable |
|--------|---------|-------------|
| **Level** | CompanyHQ (template) | Contact (client-specific) |
| **Purpose** | Match pain points, BD Intelligence | Actual work delivered |
| **Scope** | Catalog item | Specific to proposal/client |
| **Created** | In Products builder | From approved proposals |
| **Used In** | BD Intelligence, Proposal selection | Proposal UX, Client portal |
| **Relationships** | CompanyHQ, Persona | Contact, Proposal, CompanyHQ |

## Proposal Builder Flow

1. **Select Services**: Load products from `/api/products` → Display as selectable services
2. **Transform to serviceInstances**: Selected products become `serviceInstances` (copies with name, description, quantity, unitPrice, price) - NOT references to Product IDs
3. **Create Phases**: User creates phases with `deliverables` array (the actual work items)
4. **Create Milestones**: User creates milestones with `deliverable` field (week-by-week deliverables)
5. **Save Proposal**: Stores `serviceInstances`, `phases`, `milestones` as JSON
6. **Approval**: `convertProposalToDeliverables()` extracts deliverables from:
   - First: `phases.deliverables` (preferred)
   - Second: `milestones.deliverable` (fallback)
   - Last: `serviceInstances` (only if no phases/milestones)
7. **Deliverables Created**: `ConsultantDeliverable` records created for each deliverable

## Current State Check

✅ **Product Model**: Correctly scoped to CompanyHQ, used for BD Intelligence
✅ **Deliverable Model**: Correctly scoped to Contact, linked to Proposal
✅ **Proposal Model**: Has both `serviceInstances` (copies of products) and `phases.deliverables` (actual deliverables)

## Key Implementation Details

### serviceInstances Structure
When products are selected in proposal builder, they become `serviceInstances`:
```javascript
{
  name: string,        // From Product.name
  description: string, // From Product.description
  quantity: number,   // User-specified
  unitPrice: number,  // User-specified
  price: number       // Calculated (quantity * unitPrice)
}
```
**Important**: These are **copies**, not references to Product IDs. This allows proposals to be independent of product changes.

### Deliverables Extraction Priority
When converting approved proposals to deliverables:
1. **Primary**: Extract from `phases[].deliverables[]` array
2. **Secondary**: Extract from `milestones[].deliverable` field
3. **Fallback**: Create from `serviceInstances[]` (only if no phases/milestones)

## Potential Issues to Verify

1. **Naming Confusion**: 
   - Proposal builder calls products "services" - this is fine for UX
   - But in data model: Products ≠ Deliverables
2. **serviceInstances vs deliverables**: 
   - `serviceInstances` = high-level services (copies of products)
   - `phases.deliverables` = actual deliverables (specific work items) ← **This is what shows in proposal UX**
3. **Proposal Structure**: Should match PROPOSAL_STRUCTURE.md expectations
4. **No Product ID Reference**: serviceInstances don't reference Product.id - this is intentional (proposals are independent)

## For Joel's Proposal

When hydrating Joel's proposal:
- **Products** should already exist at CompanyHQ level (if needed for BD Intelligence)
- **Proposal** should have:
  - `phases` with `deliverables` array (the actual deliverables)
  - `milestones` with `deliverable` field (week-by-week deliverables)
- **Deliverables** (ConsultantDeliverable) will be created when proposal is approved

The proposal UX should display **deliverables** from phases/milestones, NOT products.

