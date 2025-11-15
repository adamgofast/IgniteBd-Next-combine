# Clean Proposal Structure

## Overview

Proposals use **Deliverable** consistently throughout. No more "serviceInstances" or "products" in proposals.

## Structure

```javascript
{
  // Proposal level
  proposalId: "proposal-123",
  companyHQId: "hq-456",
  clientName: "Client Name",
  clientCompany: "Company Name",
  purpose: "Proposal purpose",
  status: "draft" | "active" | "approved" | "rejected",
  totalPrice: 1500,
  
  // Phases - each has phaseId and deliverables array
  phases: [
    {
      phaseId: "phase-1",
      name: "Phase Name",
      weeks: "1-3",
      color: "red" | "yellow" | "purple",
      goal: "Phase goal",
      outcome: "Expected outcome",
      deliverables: [
        {
          deliverableId: "deliverable-1",
          title: "Deliverable 1",
          description: "Description of deliverable",
          category: "foundation" | "integration" | "enrichment",
          type: "persona" | "blog" | "upload",
          dueDate: "2025-01-15",
          status: "pending" | "in-progress" | "completed"
        },
        {
          deliverableId: "deliverable-2",
          title: "Deliverable 2",
          // ... same structure
        }
      ]
    }
  ],
  
  // Milestones - reference deliverables by deliverableId
  milestones: [
    {
      milestoneId: "milestone-1",
      week: 1,
      phaseId: "phase-1",
      phaseColor: "red",
      milestone: "Milestone Name",
      deliverableId: "deliverable-1", // Reference to deliverable
      paymentId: "payment-1" // Optional
    }
  ],
  
  // Compensation
  compensation: {
    total: 1500,
    currency: "USD",
    paymentStructure: "3 × $500 payments",
    payments: [
      {
        paymentId: "payment-1",
        amount: 500,
        week: 1,
        trigger: "Kickoff",
        status: "pending" | "paid",
        dueDate: "Week 1"
      }
    ]
  }
}
```

## Key Principles

1. **All IDs are explicit**: `proposalId`, `phaseId`, `deliverableId`, `milestoneId`, `paymentId`
2. **Deliverables are objects**: Not strings, always objects with `deliverableId`
3. **Milestones reference deliverables**: Use `deliverableId` to link
4. **No serviceInstances**: Removed entirely
5. **Phases contain deliverables**: Deliverables belong to phases

## Database Schema

The Proposal model stores this as JSON:

```prisma
model Proposal {
  id          String    @id @default(cuid())
  companyHQId String
  // ... other fields
  
  // Proposal structure (stored as JSON)
  phases      Json?     // Array of Phase objects (with deliverables array)
  milestones  Json?     // Array of Milestone objects (with deliverableId references)
  compensation Json?    // Compensation object
  
  // REMOVED: serviceInstances Json? // No longer used
}
```

## Migration from Old Structure

### Old Structure (Current)
```javascript
{
  serviceInstances: [...], // REMOVE
  phases: [
    {
      id: 1, // Change to phaseId
      deliverables: ["String 1", "String 2"] // Change to objects with deliverableId
    }
  ],
  milestones: [
    {
      deliverable: "String" // Change to deliverableId reference
    }
  ]
}
```

### New Structure (Target)
```javascript
{
  // serviceInstances removed
  phases: [
    {
      phaseId: "phase-1", // Explicit ID
      deliverables: [
        {
          deliverableId: "deliverable-1", // Explicit ID
          title: "Deliverable 1",
          // ... full object
        }
      ]
    }
  ],
  milestones: [
    {
      deliverableId: "deliverable-1" // Reference by ID
    }
  ]
}
```

## Benefits

1. **Clear relationships**: `milestone.deliverableId` → `phase.deliverables[].deliverableId`
2. **No ambiguity**: Everything is a deliverable, with explicit IDs
3. **Easier to reference**: Can link milestones to specific deliverables
4. **Simpler mental model**: Phases → Deliverables → Milestones reference them
5. **Better for conversion**: When creating ConsultantDeliverable records, we have explicit IDs

## For Joel's Proposal

When hydrating Joel's proposal:
- Use this structure
- Each deliverable gets a `deliverableId`
- Each phase gets a `phaseId`
- Milestones reference deliverables by `deliverableId`
- No `serviceInstances` field

