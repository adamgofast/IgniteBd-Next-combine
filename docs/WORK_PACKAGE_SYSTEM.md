# Work Package System - Hybrid Architecture

## ✅ Implementation Complete

The hybrid WorkPackage system has been implemented with **NO WorkDeliverable table**. Instead, `WorkPackageItem` stores display names, quantities, and arrays of artifact IDs.

## 📋 Schema Structure

### WorkPackage Model
```prisma
model WorkPackage {
  id               String            @id @default(cuid())
  contactId        String
  contactCompanyId String?
  companyHQId      String?
  
  title            String
  description      String?
  status           WorkPackageStatus @default(ACTIVE)
  
  items            WorkPackageItem[]
  
  createdAt        DateTime          @default(now())
  updatedAt        DateTime          @updatedAt
}
```

### WorkPackageItem Model
```prisma
model WorkPackageItem {
  id              String          @id @default(cuid())
  workPackageId   String
  
  // Human-facing label
  deliverableName String          // e.g. "Blog Posts", "Personas"
  type            WorkItemType
  quantity        Int             // number owed
  
  // Actual artifacts produced (arrays of artifact IDs)
  blogIds          String[]       @default([])
  personaIds       String[]       @default([])
  templateIds      String[]       @default([])
  eventPlanIds    String[]       @default([])
  cleDeckIds       String[]       @default([])
  landingPageIds   String[]       @default([])
  
  createdAt        DateTime       @default(now())
  updatedAt        DateTime       @updatedAt
}
```

### Enums
```prisma
enum WorkPackageStatus {
  ACTIVE
  COMPLETED
}

enum WorkItemType {
  BLOG
  PERSONA
  OUTREACH_TEMPLATE
  EVENT_CLE_PLAN
  CLE_DECK
  LANDING_PAGE
}
```

## 🎯 Key Design Principles

### 1. **No Content Storage**
- `WorkPackageItem` stores **ONLY artifact IDs**
- No content is stored on `WorkPackageItem`
- All content lives in standalone artifact models

### 2. **Artifact Models Are Standalone**
Each artifact type has its own:
- Full model with all content fields
- Dedicated builder UX
- Independent lifecycle

### 3. **WorkPackageItem Purpose**
`WorkPackageItem` is **ONLY** for:
- ✅ Container hydration (linking artifacts to work packages)
- ✅ Progress tracking (# done vs # owed)
- ✅ Display names ("Blog Posts", "Personas")
- ✅ Quantity tracking (how many we owe)
- ✅ Linking to artifact IDs

## 📦 Artifact Models (To Be Created)

The following artifact models need to be created as **standalone models** with their own builders:

### ✅ Persona (Already Exists)
- Model: `Persona`
- Builder: `/persona/builder` or similar
- Fields: name, role, goals, painPoints, etc.

### 🔨 To Create:

1. **Blog**
   - Model: `Blog`
   - Builder: `/blog/builder`
   - Fields: title, content, author, publishedAt, etc.

2. **OutreachTemplate**
   - Model: `OutreachTemplate` or `Template`
   - Builder: `/template/builder`
   - Fields: subject, body, type, etc.

3. **EventPlan**
   - Model: `EventPlan`
   - Builder: `/event-plan/builder`
   - Fields: eventName, date, location, agenda, etc.

4. **CleDeck**
   - Model: `CleDeck`
   - Builder: `/cle-deck/builder`
   - Fields: title, slides, presenter, etc.

5. **LandingPage**
   - Model: `LandingPage`
   - Builder: `/landing-page/builder`
   - Fields: title, url, content, etc.

## 🔄 Usage Pattern

### Creating a WorkPackage
```javascript
const workPackage = await prisma.workPackage.create({
  data: {
    contactId: "contact-123",
    contactCompanyId: "company-456",
    companyHQId: "hq-789",
    title: "Q1 Content Package",
    description: "Blog posts and personas for Q1",
    status: "ACTIVE",
    items: {
      create: [
        {
          deliverableName: "Blog Posts",
          type: "BLOG",
          quantity: 5,
          blogIds: [], // Empty initially, populated as blogs are created
        },
        {
          deliverableName: "Target Personas",
          type: "PERSONA",
          quantity: 3,
          personaIds: [], // Empty initially
        },
      ],
    },
  },
});
```

### Adding Artifacts to WorkPackageItem
```javascript
// When a blog is created, add its ID to the work package item
await prisma.workPackageItem.update({
  where: { id: "item-123" },
  data: {
    blogIds: {
      push: "blog-456", // Add new blog ID
    },
  },
});
```

### Tracking Progress
```javascript
const item = await prisma.workPackageItem.findUnique({
  where: { id: "item-123" },
});

const progress = {
  owed: item.quantity,
  done: item.blogIds.length,
  remaining: item.quantity - item.blogIds.length,
  percentage: (item.blogIds.length / item.quantity) * 100,
};
```

## 🎨 Frontend Integration

### WorkPackage Display
```jsx
<WorkPackageCard>
  <h3>{workPackage.title}</h3>
  {workPackage.items.map(item => (
    <WorkPackageItemCard key={item.id}>
      <h4>{item.deliverableName}</h4>
      <ProgressBar 
        done={item.blogIds.length} 
        owed={item.quantity} 
      />
      <ArtifactList 
        type={item.type}
        ids={item.blogIds} // or personaIds, etc.
      />
      <CreateArtifactButton 
        type={item.type}
        onCreated={(artifactId) => {
          // Add artifactId to appropriate array
        }}
      />
    </WorkPackageItemCard>
  ))}
</WorkPackageCard>
```

### Artifact Creation Flow
1. User clicks "Create Blog" (or Persona, etc.)
2. Opens dedicated artifact builder (`/blog/builder`)
3. User creates artifact
4. Artifact saved to `Blog` table
5. Artifact ID added to `WorkPackageItem.blogIds[]`
6. Progress updates automatically

## 🔍 Query Examples

### Get WorkPackage with Progress
```javascript
const workPackage = await prisma.workPackage.findUnique({
  where: { id: "wp-123" },
  include: {
    items: true,
    contact: true,
    contactCompany: true,
  },
});

// Calculate progress for each item
const itemsWithProgress = workPackage.items.map(item => ({
  ...item,
  progress: {
    done: getArtifactCount(item),
    owed: item.quantity,
    percentage: (getArtifactCount(item) / item.quantity) * 100,
  },
}));

function getArtifactCount(item) {
  switch (item.type) {
    case "BLOG": return item.blogIds.length;
    case "PERSONA": return item.personaIds.length;
    case "OUTREACH_TEMPLATE": return item.templateIds.length;
    case "EVENT_CLE_PLAN": return item.eventPlanIds.length;
    case "CLE_DECK": return item.cleDeckIds.length;
    case "LANDING_PAGE": return item.landingPageIds.length;
    default: return 0;
  }
}
```

### Get All Artifacts for a WorkPackageItem
```javascript
// For BLOG type
const blogs = await prisma.blog.findMany({
  where: {
    id: { in: workPackageItem.blogIds },
  },
});

// For PERSONA type
const personas = await prisma.persona.findMany({
  where: {
    id: { in: workPackageItem.personaIds },
  },
});
```

## ✅ Database Status

- ✅ `work_packages` table created
- ✅ `work_package_items` table created
- ✅ Enums created
- ✅ Relations configured
- ✅ Indexes added
- ✅ Prisma Client generated

## 🚀 Next Steps

1. **Create Artifact Models** (Blog, Template, EventPlan, CleDeck, LandingPage)
2. **Build Artifact Builders** (dedicated UX for each artifact type)
3. **Create WorkPackage API Routes** (CRUD operations)
4. **Build WorkPackage UI** (display, progress tracking, artifact linking)
5. **Implement Artifact Linking** (add artifact IDs to WorkPackageItems)

## 📝 Notes

- **Persona model already exists** - can be used immediately
- **Other artifact models** need to be created as standalone models
- **WorkPackageItem is a container** - never stores content, only IDs
- **Artifacts are reusable** - same artifact can be linked to multiple WorkPackages
- **Progress is calculated** - done = array length, owed = quantity

