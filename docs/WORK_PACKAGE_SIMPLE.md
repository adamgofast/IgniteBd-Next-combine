# WorkPackage System - Simplified Container Pattern

## ✅ What We Built

### 1. **WorkPackage Route** (`/api/workpackages`)
- **POST** - Upsert WorkPackage (simple container: title, description, status)
- **GET** - Get WorkPackage(s) by id or contactId
- Just metadata - no overbuilding

### 2. **WorkPackageItem Route** (`/api/workpackages/items`)
- **POST** - Create item (deliverableName, type, quantity)
- **PATCH /:itemId** - Add/remove artifact IDs to arrays
- **DELETE /:itemId** - Delete item

## 🎯 Design Pattern

### WorkPackage = Container
```javascript
{
  id: "wp-123",
  title: "Q1 Content Package",
  description: "Blog posts and personas",
  status: "ACTIVE",
  contactId: "contact-456",
  // That's it - just metadata
}
```

### WorkPackageItem = Artifact Linker
```javascript
{
  id: "item-789",
  workPackageId: "wp-123",
  deliverableName: "Blog Posts",
  type: "BLOG",
  quantity: 5,
  blogIds: ["blog-1", "blog-2"], // Links to artifacts
  // Other arrays empty until artifacts created
}
```

### Artifacts = Standalone Models
- **Blog** - Already has builder at `/builder/blog/[blogId]`
- **Persona** - Already exists
- **Template, EventPlan, CleDeck, LandingPage** - To be built

## 🔗 Linking Flow

1. **Create WorkPackage** (container)
   ```javascript
   POST /api/workpackages
   { title: "Q1 Package", contactId: "..." }
   ```

2. **Create WorkPackageItem** (deliverable)
   ```javascript
   POST /api/workpackages/items
   { workPackageId: "wp-123", deliverableName: "Blog Posts", type: "BLOG", quantity: 5 }
   ```

3. **Create Artifact** (via its own builder)
   ```javascript
   // User goes to /builder/blog/new?workPackageId=wp-123&itemId=item-789
   // Blog builder creates blog, then calls:
   ```

4. **Link Artifact to Item**
   ```javascript
   PATCH /api/workpackages/items/item-789
   { type: "BLOG", artifactId: "blog-456", action: "add" }
   // This pushes blog-456 into item.blogIds[]
   ```

## 📝 What's NOT Built Yet

- Artifact API routes (`/api/artifacts/blogs`, etc.) - **Will be built when we figure out blogId vs clientBlogId**
- Full hydration service - **Can add later when needed**
- Client portal routes - **Will build when artifact structure is clear**

## 🎨 Existing UX

- ✅ Blog builder exists: `/builder/blog/[blogId]`
- ✅ Content page exists: `/content` (placeholder)
- ✅ WorkPackage pages exist: `/workpackages/[id]` and `/workpackages/[id]/items/[itemId]`

## 🚀 Next Steps

1. **Figure out artifact structure** - What's in blogId vs clientBlogId?
2. **Build artifact API routes** - Once structure is clear
3. **Wire up linking** - Blog builder → add-artifact endpoint
4. **Add hydration** - Load artifacts when viewing WorkPackage

## 💡 Key Insight

**WorkPackage is just a container** - it doesn't need to know about artifact content. Artifacts are created via their own builders and linked via IDs. Keep it simple!

