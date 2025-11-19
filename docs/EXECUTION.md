# Work Package Execution System

## Overview

The Execution Hub is where consultants go **after** a work package has been created. It's the operational center for viewing work packages, tracking progress, and building deliverables.

## Workflow

### 1. Build the Work Package

First, create a work package:
- Go to **Work Packages** → **Create Work Package**
- Import from CSV, use templates, or build from scratch
- Define phases, items, and timelines

### 2. View in Execution Hub

Once built, navigate to:
- **Client Operations** → **Execution Hub** (sidebar)
- See all your work packages listed
- Each package shows:
  - Client name
  - Number of phases and items
  - Total estimated hours
  - Cost (if set)

### 3. Open Execution Dashboard

Click **"View Execution Dashboard"** on any work package to see:

#### **Work Package Overview**
- Title, description, and metadata
- Item statistics:
  - Total Items
  - Completed Items
  - In Progress
  - Needs Review

#### **Phase-Level Timeline**
Each phase displays:
- **Timeline Status Badge**:
  - 🟢 **On Track** (green) - More than 3 days until expected end
  - 🟡 **Warning** (yellow) - Within 3 days of expected end
  - 🔴 **Overdue** (red) - Past expected end date
  - ⚪ **Complete** (gray) - Phase is completed
- **Expected End Date** - Calculated from phase start + estimated hours
- **Aggregated Hours** - Sum of all item hours in the phase

#### **Work Package Items**
Each item shows:
- Label and type
- Status (not_started, in_progress, completed)
- Progress (completed artifacts / total quantity)
- Estimated hours per unit
- **Clickable Navigation** - Items automatically route to their edit pages based on label:
  - `blog_post` → `/owner/work/edit/blog/[id]`
  - `research` → `/owner/work/edit/research/[id]`
  - `deliverable` → `/owner/work/edit/artifact/[id]`
  - `summary` → `/owner/work/edit/summary/[id]`
  - `client_review` → `/owner/work/review/[id]`
  - And more (see `workPackageLabelRouter.js`)

### 4. Build Off the Work Package

From the execution dashboard:

1. **Click any item** - Automatically routes to the appropriate edit page based on the item's label
2. **Create deliverables** - Use the item's context to build artifacts
3. **Track progress** - See real-time updates as artifacts are created and linked
4. **Monitor timelines** - Watch phase status change as work progresses

## Key Features

### Timeline Calculations

- **Expected End Date** = Phase effective date + (total estimated hours ÷ 8 hours/day)
- **Timeline Status** computed daily:
  - Compares today's date to expected end date
  - Accounts for phase completion status
  - Provides visual warnings before deadlines

### Label-Based Routing

Items automatically route to their appropriate edit pages:
- No need for 20 different buttons
- Simple click-to-edit workflow
- Routes defined in `workPackageLabelRouter.js`
- Fallback to default view if no route mapping exists

### Progress Tracking

- Items track completed artifacts vs. total quantity
- Phases aggregate item progress
- Work package shows overall completion percentage
- Real-time updates as deliverables are created

## Architecture

### Server-Side

- **Route**: `/api/workpackages/owner/[id]/hydrate`
- **Service**: `WorkPackageHydrationService.js`
  - Hydrates WorkPackage with phases, items, and artifacts
  - Calculates timeline status for each phase
  - Aggregates hours from items
  - Derives phase effective dates from WorkPackage start date

### Client-Side

- **Hook**: `useWorkPackageHydration(workPackageId)`
  - Fetches hydrated work package data
  - Includes timeline calculations
  - Same data structure as Client Portal (for consistency)

### Utilities

- **`workPackageTimeline.js`**:
  - `convertHoursToDays()` - Converts hours to days (8 hours = 1 day)
  - `computeExpectedEndDate()` - Calculates phase end date
  - `computePhaseTimelineStatus()` - Determines timeline status
  - `getTimelineStatusColor()` - Returns Tailwind classes for UI

- **`workPackageLabelRouter.js`**:
  - `labelRouter` - Mapping of labels to routes
  - `getRouteForItem()` - Gets route for an item
  - `buildItemRoute()` - Builds full route with item ID

## Data Flow

```
1. User clicks "View Execution Dashboard"
   ↓
2. Page loads with useWorkPackageHydration hook
   ↓
3. Hook calls /api/workpackages/owner/[id]/hydrate
   ↓
4. Server hydrates WorkPackage:
   - Loads phases with items
   - Calculates aggregated hours per phase
   - Derives effective dates from WorkPackage start
   - Computes expected end dates
   - Calculates timeline status
   - Loads artifacts for each item
   ↓
5. Client receives hydrated data
   ↓
6. UI renders:
   - Phase timeline status badges
   - Clickable items with label routing
   - Progress indicators
   - Item statistics
```

## Best Practices

1. **Always set `effectiveStartDate`** on WorkPackage for accurate timeline calculations
2. **Use consistent labels** for items to leverage automatic routing
3. **Update item status** as work progresses (not_started → in_progress → completed)
4. **Link artifacts** to items via Collateral model for progress tracking
5. **Review timeline status** regularly to catch overdue phases early

## Future Enhancements

- [ ] Notifications for overdue phases
- [ ] Reminders for approaching deadlines
- [ ] Task-level scheduling (beyond phase-level)
- [ ] Gantt chart visualization
- [ ] Bulk operations on items
- [ ] Export execution reports

