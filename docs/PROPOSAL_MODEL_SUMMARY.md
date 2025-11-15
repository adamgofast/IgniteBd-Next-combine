# Proposal Model Summary - Product vs Deliverable

## TL;DR

✅ **Models are correct** - No changes needed to schema
✅ **Product** = CompanyHQ level template (for BD Intelligence, pain point matching)
✅ **Deliverable** = Client-specific work items (what shows in proposal UX)
✅ **Proposal** = Bridge between them with `phases.deliverables` and `milestones.deliverable`

## The Confusion

The naming can be confusing:
- **Products** are called "services" in the proposal builder UI
- But **deliverables** are what actually show in the proposal UX
- Products become `serviceInstances` (copies) in proposals
- Deliverables come from `phases.deliverables` and `milestones.deliverable`

## Model Verification

### ✅ Product Model (Correct)
- Scoped to `CompanyHQ` ✓
- Used for BD Intelligence scoring ✓
- No direct relationship to Proposal (intentional) ✓
- Becomes `serviceInstances` (copies) when selected in proposal ✓

### ✅ ConsultantDeliverable Model (Correct)
- Scoped to `Contact` (client) ✓
- Linked to `Proposal` (optional) ✓
- Linked to `CompanyHQ` (tenant scoping) ✓
- Has `milestoneId` (string reference to milestone in JSON) ✓
- This is what shows in proposal UX ✓

### ✅ Proposal Model (Correct)
- Has `serviceInstances` (JSON - copies of products) ✓
- Has `phases` (JSON - with `deliverables` array) ✓
- Has `milestones` (JSON - with `deliverable` field) ✓
- Links to `ConsultantDeliverable` records ✓

## Proposal Structure Alignment

The database Proposal model matches PROPOSAL_STRUCTURE.md expectations:

**PROPOSAL_STRUCTURE.md expects:**
```javascript
phases: [{
  deliverables: ["Deliverable 1", "Deliverable 2"]
}]
timeline: [{
  deliverable: "Deliverable description"
}]
```

**Database Proposal model has:**
```javascript
phases: Json? // Array of Phase objects (with deliverables, activities, kpis)
milestones: Json? // Array of Milestone objects (week, label, completed, deliverable)
```

✅ **Matches perfectly** - The JSON structure allows for the exact format expected by the client portal.

## For Joel's Proposal Hydration

When creating Joel's proposal:

1. **Products** (if needed):
   - Should exist at CompanyHQ level
   - Used for BD Intelligence (optional for proposal)
   - NOT directly in proposal

2. **Proposal Structure**:
   ```javascript
   {
     phases: [
       {
         id: 1,
         name: "Phase Name",
         deliverables: ["Deliverable 1", "Deliverable 2"], // ← These are the deliverables
         // ... other phase fields
       }
     ],
     milestones: [
       {
         week: 1,
         deliverable: "Deliverable description", // ← This is also a deliverable
         // ... other milestone fields
       }
     ],
     serviceInstances: [...] // Optional - high-level services (copies of products)
   }
   ```

3. **Deliverables Creation**:
   - When proposal is approved, `ProposalToDeliverablesService` extracts:
     - From `phases[].deliverables[]` (primary)
     - From `milestones[].deliverable` (secondary)
   - Creates `ConsultantDeliverable` records
   - These are what show in the proposal UX

## Key Takeaway

**In the proposal UX, you show DELIVERABLES, not products.**

- Products = CompanyHQ level templates
- Deliverables = Client-specific work items from phases/milestones
- The proposal UX displays deliverables from `phases.deliverables` and `milestones.deliverable`

## No Action Required

The models are correctly structured. The confusion was just in understanding the distinction, which is now documented in `PRODUCT_VS_DELIVERABLE.md`.

