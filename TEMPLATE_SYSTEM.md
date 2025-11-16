# Template System Architecture

**Premise**: Single point of entry to see and create templates that are the foundation of proposals.

## Overview

Templates are the building blocks for proposals. The system provides a unified entry point (`/templates`) where users can view existing templates and create new ones through multiple methods.

## Entry Point

**Route**: `/templates` (Sidebar: "Proposal Templates")

This is the **single point of entry** for all template management. From here, users choose to either:
- **See Templates** - View and use existing templates
- **Make Templates** - Create new templates

## Flow Architecture

### Level 1: Main Chooser (`/templates`)

```
Proposal Templates
├── See Templates → /templates/library?tab=phases
└── Make Templates → /templates/library?tab=make-templates
```

### Level 2: Make Templates Chooser (`/templates/library?tab=make-templates`)

When "Make Templates" is selected, users choose the template type:

```
Make Templates
├── Phase Templates → create-phase chooser
├── Deliverable Templates → create-deliverable chooser
└── Proposal Templates → create-proposal chooser
```

### Level 3: Creation Method Chooser

After selecting a template type (Phase/Deliverable/Proposal), users choose how to create it:

```
Create [Type] Template
├── Make from CSV → Upload CSV file
├── Previous → Clone existing template
└── Start Scratch → Create from blank form
```

## Template Types

### 1. Phase Templates
- **Purpose**: Define reusable phases for proposals
- **Fields**: `name`, `description`, `companyHQId`
- **Storage**: `phase_templates` table
- **Usage**: Foundation for `ProposalPhase` creation

### 2. Deliverable Templates
- **Purpose**: Define reusable deliverables for proposals
- **Fields**: `deliverableType`, `deliverableLabel`, `defaultDuration`, `defaultUnitOfMeasure`, `companyHQId`
- **Storage**: `deliverable_templates` table
- **Usage**: Foundation for `ProposalDeliverable` creation

### 3. Proposal Templates (Future)
- **Purpose**: Bundle phases and deliverables into reusable proposal packages
- **Example**: "Starter Package", "Enterprise Package"
- **Status**: Architecture ready, implementation pending

## Creation Methods

### 1. Make from CSV
- **Route**: `/client-operations/proposals/create/csv/phases` or `/deliverables`
- **Flow**: 
  - Download CSV template
  - Upload CSV file
  - Preview and validate
  - Confirm import
  - Redirect to template library with success toast

### 2. Previous (Clone)
- **Status**: Coming soon
- **Flow**: Select existing template → Clone → Edit → Save

### 3. Start Scratch
- **Status**: Coming soon
- **Flow**: Blank form → Fill fields → Save

## Data Flow

### Hydration
1. **Universal Company Hydration** (`/api/company/hydrate`)
   - Includes `phaseTemplates` and `deliverableTemplates`
   - Stores in localStorage: `phaseTemplates`, `deliverableTemplates`
   - Also stored in `companyHydration_{companyHQId}` cache

2. **Template Library Hook** (`useTemplates`)
   - Loads from localStorage on mount (instant)
   - Provides `sync()` function for manual refresh
   - Sync is backup-only, not auto-hydration

3. **Template Library Page** (`/templates/library`)
   - Uses `useTemplates` hook
   - Displays templates in tabs: Phases, Deliverables, Proposals
   - Sync button for manual refresh from backend

### Storage
- **localStorage keys**:
  - `phaseTemplates` - Array of phase templates
  - `deliverableTemplates` - Array of deliverable templates
  - `companyHydration_{companyHQId}` - Full company hydration cache

## Routes

### Main Routes
- `/templates` - Main chooser (See Templates | Make Templates)
- `/templates/library` - Template library with tabs
  - `?tab=phases` - Phase templates view
  - `?tab=deliverables` - Deliverable templates view
  - `?tab=proposals` - Proposal templates chooser
  - `?tab=make-templates` - Make templates type chooser
  - `?tab=create-phase` - Phase creation method chooser
  - `?tab=create-deliverable` - Deliverable creation method chooser
  - `?tab=create-proposal` - Proposal creation method chooser

### CSV Upload Routes
- `/client-operations/proposals/create/csv` - CSV type chooser
- `/client-operations/proposals/create/csv/phases` - Phase CSV upload
- `/client-operations/proposals/create/csv/deliverables` - Deliverable CSV upload

### API Routes
- `GET /api/templates/phases?companyHQId={id}` - Get phase templates
- `GET /api/templates/deliverables?companyHQId={id}` - Get deliverable templates
- `POST /api/csv/phases/upload` - Upload phase CSV
- `POST /api/csv/deliverables/upload` - Upload deliverable CSV
- `GET /api/company/hydrate?companyHQId={id}` - Universal hydration (includes templates)

## Integration with Proposals

Templates are the **foundation** of proposals:

1. **Proposal Creation** uses templates:
   - User selects templates → Creates `ProposalPhase` and `ProposalDeliverable` from templates
   - Templates define "what" exists, proposals define "how" (order, specific values)

2. **Template → Proposal Flow**:
   - Templates are stored at company level (`companyHQId`)
   - Proposals copy template data into detached `ProposalDeliverable` records
   - No template linking in proposals - templates are just the starting point

## Key Principles

1. **Single Point of Entry**: `/templates` is the only entry point
2. **Templates are Foundation**: All proposals start from templates
3. **localStorage-First**: Templates load instantly from cache
4. **Sync is Backup**: Manual sync button, no auto-hydration
5. **Modular Creation**: Multiple methods (CSV, Previous, Scratch)
6. **Company-Scoped**: All templates scoped to `companyHQId`

## Future Enhancements

- [ ] Proposal Templates (bundle phases + deliverables)
- [ ] Clone from Previous template
- [ ] Start from Scratch form creation
- [ ] Template versioning
- [ ] Template sharing across companies

