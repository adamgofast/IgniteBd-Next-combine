# WorkPackage System - Build Documentation

> **Status**: In Progress - Documenting as we build

## 🎯 Core Concept

**WorkPackage** = Simple container (name/strings/metadata)
**WorkPackageItem** = Links artifacts via ID arrays
**Artifacts** = Standalone models with their own builders (Blog, Persona, etc.)

---

## 📋 Database Schema

### ✅ Completed
- `WorkPackage` model - Container with title, description, status
- `WorkPackageItem` model - Links artifacts via ID arrays
- Artifact models: `Blog`, `Template`, `EventPlan`, `CleDeck`, `LandingPage`
- Enums: `WorkPackageStatus`, `WorkItemType`

### 🔨 To Determine
- **blogId vs clientBlogId** - What's the difference?
- Artifact content structure - What fields go in each artifact?
- Client vs Admin artifact models - Same or different?

---

## 🔌 API Routes

### ✅ Built

#### `/api/workpackages`
- **POST** - Upsert WorkPackage (create or update)
- **GET** - Get WorkPackage(s) by id or contactId

#### `/api/workpackages/items`
- **POST** - Create WorkPackageItem
- **PATCH /:itemId** - Add/remove artifact IDs
- **DELETE /:itemId** - Delete item

### 🔨 To Build

#### `/api/workpackages/:id`
- **GET** - Get single WorkPackage with hydrated items
- **PATCH** - Update WorkPackage metadata
- **DELETE** - Delete WorkPackage

#### `/api/workpackages/client/:contactId`
- **GET** - Client portal view (read-only, published artifacts only)

#### `/api/artifacts/blogs`
- **POST** - Create blog
- **GET /:id** - Get blog
- **PATCH /:id** - Update blog
- **DELETE /:id** - Delete blog

#### `/api/artifacts/personas`
- Same CRUD structure

#### `/api/artifacts/templates`
- Same CRUD structure

#### `/api/artifacts/eventplans`
- Same CRUD structure

#### `/api/artifacts/cledecks`
- Same CRUD structure

#### `/api/artifacts/landingpages`
- Same CRUD structure

---

## 🎨 Frontend Pages

### ✅ Existing (Basic UX)

#### Admin Routes
- `/workpackages/[id]/page.jsx` - WorkPackage detail page
- `/workpackages/[id]/items/[itemId]/page.jsx` - WorkPackageItem detail
- `/builder/blog/[blogId]/page.jsx` - Blog builder (exists!)

#### Content
- `/content/page.jsx` - Content hub (placeholder)

### 🔨 To Build/Enhance

#### Admin Routes
- `/workpackages` - List all WorkPackages
- `/workpackages/new` - Create WorkPackage
- `/workpackages/[id]/page.jsx` - **Enhance**: Show items with progress
- `/workpackages/[id]/items/[itemId]/page.jsx` - **Enhance**: Show artifacts, "Add Artifact" button

#### Builder Routes
- `/builder/blog/[blogId]/page.jsx` - **Enhance**: Link to WorkPackageItem after save
- `/builder/persona/[personaId]/page.jsx` - Create persona builder
- `/builder/template/[templateId]/page.jsx` - Create template builder
- `/builder/event/[eventPlanId]/page.jsx` - Create event plan builder
- `/builder/cledeck/[deckId]/page.jsx` - Create CLE deck builder
- `/builder/landingpage/[landingPageId]/page.jsx` - Create landing page builder

#### Client Portal Routes
- `/client/workpackages/[id]/page.jsx` - Client view (read-only)
- `/client/workpackages/[id]/items/[itemId]/page.jsx` - Client item view
- `/client/artifacts/blog/[blogId]/page.jsx` - Client blog view (published only)
- `/client/artifacts/persona/[personaId]/page.jsx` - Client persona view
- `/client/artifacts/template/[templateId]/page.jsx` - Client template view
- `/client/artifacts/event/[eventPlanId]/page.jsx` - Client event view
- `/client/artifacts/cledeck/[deckId]/page.jsx` - Client CLE deck view
- `/client/artifacts/landingpage/[landingPageId]/page.jsx` - Client landing page view

---

## 🔄 Hydration Logic

### 🔨 To Build

When loading a WorkPackage:

1. Load WorkPackage with items
2. For each item, check type and load artifacts by IDs
3. Calculate progress:
   - `completedCount` = artifact array length
   - `progress` = completedCount / quantity
4. Return hydrated shape:

```javascript
{
  id: "wp-123",
  title: "Q1 Content Package",
  items: [
    {
      id: "item-789",
      deliverableName: "Blog Posts",
      type: "BLOG",
      quantity: 5,
      completedCount: 2, // blogIds.length
      progress: 0.4, // 2/5
      artifacts: [
        { id: "blog-1", title: "...", ... },
        { id: "blog-2", title: "...", ... }
      ]
    }
  ]
}
```

### Service Location
- `src/lib/services/WorkPackageHydrationService.js` - **To create**

---

## 🔗 Artifact Linking Flow

### Current Flow (To Implement)

1. **User creates WorkPackage**
   ```
   POST /api/workpackages
   { title: "Q1 Package", contactId: "..." }
   ```

2. **User creates WorkPackageItem**
   ```
   POST /api/workpackages/items
   { workPackageId: "wp-123", deliverableName: "Blog Posts", type: "BLOG", quantity: 5 }
   ```

3. **User clicks "Add Blog" button**
   - Navigate to: `/builder/blog/new?workPackageId=wp-123&itemId=item-789`

4. **User creates blog in builder**
   - Blog builder saves to `/api/artifacts/blogs`
   - Returns blog ID: `blog-456`

5. **Blog builder links artifact to item**
   ```
   PATCH /api/workpackages/items/item-789
   { type: "BLOG", artifactId: "blog-456", action: "add" }
   ```
   - This pushes `blog-456` into `item.blogIds[]`

6. **Redirect back to WorkPackageItem page**
   - Shows updated progress: "1 of 5 complete"

### 🔨 To Implement
- Blog builder needs to call add-artifact endpoint after save
- Other builders need same pattern
- Progress calculation on WorkPackageItem page

---

## 🎨 UI Components

### 🔨 To Build

#### WorkPackage List Page
- Card for each WorkPackage
- Shows title, contact, status
- Link to detail page

#### WorkPackage Detail Page
- WorkPackage metadata (title, description, status)
- List of WorkPackageItems
- Each item shows:
  - Deliverable name
  - Progress: "2 of 5 complete"
  - Progress bar
  - "Open Item" button

#### WorkPackageItem Detail Page
- Item metadata (deliverableName, type, quantity)
- Progress display
- List of attached artifacts
- "Add Artifact" button (opens builder)
- Each artifact card:
  - Title/name
  - Status (draft/published)
  - Link to artifact detail
  - Remove button

#### Artifact Builders
- Each builder needs:
  - Form fields (TBD - depends on artifact structure)
  - Save button
  - Link to WorkPackageItem after save (if workPackageId/itemId in URL)

---

## 🔍 Questions to Resolve

### Artifact Structure
- [ ] What fields go in Blog model?
- [ ] What fields go in Persona model? (exists but verify)
- [ ] What fields go in Template model?
- [ ] What fields go in EventPlan model?
- [ ] What fields go in CleDeck model?
- [ ] What fields go in LandingPage model?

### Client vs Admin
- [ ] Are artifacts shared between client and admin?
- [ ] Do we need separate clientBlogId vs blogId?
- [ ] How do we handle client-specific vs company-wide artifacts?

### Publishing
- [ ] How do artifacts get published?
- [ ] What's the publish workflow?
- [ ] Client portal shows only published artifacts?

### Content UX
- [ ] Where is the content management UX?
- [ ] Is `/content` page the hub?
- [ ] How do users discover/create artifacts?

---

## 📝 Notes

### Current State
- ✅ Database schema ready
- ✅ Basic API routes (WorkPackage, WorkPackageItem)
- ✅ Blog builder exists (needs linking)
- ✅ Basic page structure exists

### Next Steps
1. **Figure out artifact structure** - What goes in blogId vs clientBlogId?
2. **Build artifact API routes** - Once structure is clear
3. **Wire up linking** - Blog builder → add-artifact endpoint
4. **Add hydration** - Load artifacts when viewing WorkPackage
5. **Build client portal** - Read-only views for published artifacts

### Key Principle
**Keep it simple** - WorkPackage is just a container. Artifacts are created via their own builders and linked via IDs.

---

## 🚀 Implementation Log

### 2025-01-XX
- ✅ Created WorkPackage and WorkPackageItem models
- ✅ Created artifact models (Blog, Template, EventPlan, CleDeck, LandingPage)
- ✅ Built basic WorkPackage API routes (POST, GET)
- ✅ Built WorkPackageItem API routes (POST, PATCH add/remove, DELETE)
- ✅ Documented existing blog builder
- 🔨 Need to determine artifact structure before building artifact APIs

---

## 📚 Related Docs
- `WORK_PACKAGE_SYSTEM.md` - Full system overview
- `WORK_PACKAGE_SIMPLE.md` - Simplified container pattern
- `PROPOSAL_BUILDER_SYSTEM.md` - Related proposal system

