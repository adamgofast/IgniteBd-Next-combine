# 🔍 WorkPackage Creation Forensics Report

## Executive Summary

**Root Cause:** Multiple creation paths with fallback defaults, no schema validation, and silent field acceptance.

**Primary Issue:** `workPackageCsvMapper.js` line 208 sets `title: firstRow.title || 'Imported Work Package'` when CSV title is missing.

**Secondary Issues:**
1. `/api/workpackages/route.js` creates WorkPackages with **NO title field** (only `contactId`)
2. `/api/workpackages/bulk-upload/csv/route.js` creates WorkPackages with **NO title field** (only `contactId`)
3. `/api/workpackages/bulk-upload/route.js` creates WorkPackages with **NO title field** (only `contactId`)
4. No validation prevents `proposalId` or other invalid fields from being spread into WorkPackage

---

## 1. WorkPackage Creation Locations

### ✅ Location 1: `/api/workpackages/route.js` (Line 48)
**File:** `src/app/api/workpackages/route.js`

**Code:**
```javascript
const workPackage = await prisma.workPackage.create({
  data: {
    contactId,
  },
  // NO TITLE FIELD - Prisma schema allows null, but UI expects string
});
```

**Issues:**
- ❌ **No title field** - Creates WorkPackage with `title: null`
- ❌ **No validation** - Only checks `contactId` exists
- ❌ **No field stripping** - If body contains extra fields, they're ignored (but not validated)
- ⚠️ **Silent failure** - No error if title is missing

**Could allow proposalId leak?** No - only sets `contactId` explicitly.

---

### ✅ Location 2: `/api/workpackages/bulk-upload/csv/route.js` (Line 132)
**File:** `src/app/api/workpackages/bulk-upload/csv/route.js`

**Code:**
```javascript
const workPackage = await prisma.workPackage.create({
  data: {
    contactId,
    phases: { create: [...] },
  },
  // NO TITLE FIELD
});
```

**Issues:**
- ❌ **No title field** - Creates WorkPackage with `title: null`
- ❌ **No validation** - Only validates CSV columns, not WorkPackage fields
- ❌ **No field extraction** - Doesn't extract title from CSV even if present

**Could allow proposalId leak?** No - only sets `contactId` and `phases` explicitly.

---

### ✅ Location 3: `/api/workpackages/bulk-upload/route.js` (Line 90)
**File:** `src/app/api/workpackages/bulk-upload/route.js`

**Code:**
```javascript
const workPackage = await prisma.workPackage.create({
  data: {
    contactId,
    phases: { create: [...] },
  },
  // NO TITLE FIELD
});
```

**Issues:**
- ❌ **No title field** - Creates WorkPackage with `title: null`
- ❌ **No validation** - Only validates `contactId` and `rows` array
- ❌ **No field extraction** - Doesn't extract title from rows

**Could allow proposalId leak?** No - only sets `contactId` and `phases` explicitly.

---

### ✅ Location 4: `workPackageCsvMapper.js` (Line 207-212) - **PRIMARY CULPRIT**
**File:** `src/lib/services/workPackageCsvMapper.js`

**Code:**
```javascript
// Extract WorkPackage metadata from first row
const firstRow = transformedRows[0] || {};
const workPackage = {
  title: firstRow.title || 'Imported Work Package',  // ⚠️ FALLBACK HERE
  description: firstRow.description || null,
  totalCost: firstRow.totalCost || null,
  effectiveStartDate: firstRow.effectiveStartDate || null,
};
```

**Issues:**
- ⚠️ **Fallback default:** `'Imported Work Package'` when `firstRow.title` is missing/empty
- ⚠️ **No validation:** Doesn't check if `firstRow.title` is a valid string
- ⚠️ **Silent fallback:** Uses `||` operator - if `firstRow.title` is `""`, `null`, `undefined`, or `0`, it falls back
- ⚠️ **No field stripping:** If `firstRow` contains extra fields (like `proposalId`), they're not included in the object (safe)

**Could allow proposalId leak?** No - explicitly constructs object with only 4 fields.

**This is the source of "Imported Work Package" title.**

---

### ✅ Location 5: `/api/workpackages/import/one-shot/route.js` (Line 26, 103)
**File:** `src/app/api/workpackages/import/one-shot/route.js`

**Code:**
```javascript
const title = formData.get('title') || 'Imported Work Package';  // Line 26
// ...
const proposalTitle = title || normalizedRows[0].proposalDescription || 'Imported Work Package';  // Line 103
```

**Issues:**
- ⚠️ **Multiple fallbacks:** Falls back to `'Imported Work Package'` twice
- ⚠️ **Uses proposalDescription:** If title missing, tries to use `proposalDescription` (wrong field)
- ⚠️ **No validation:** Doesn't validate title is a proper string

**Could allow proposalId leak?** No - uses `hydrateWorkPackageFromCSV` which calls `createWorkPackage` with explicit fields.

---

### ✅ Location 6: `workpackageHydrationService.ts` (Line 59)
**File:** `src/lib/services/workpackageHydrationService.ts`

**Code:**
```javascript
export async function createWorkPackage(params: {
  contactId: string;
  companyId?: string;
  title: string;  // Required in function signature
  description?: string;
  totalCost?: number;
  effectiveStartDate?: Date;
}): Promise<string> {
  const workPackage = await prisma.workPackage.create({
    data: {
      contactId,
      companyId: companyId || null,
      title,  // Uses provided title (no fallback here)
      description,
      totalCost,
      effectiveStartDate,
    },
  });
}
```

**Issues:**
- ✅ **Good:** Requires `title` in function signature
- ⚠️ **But:** Callers can pass `undefined` or `null` and TypeScript won't catch it at runtime
- ⚠️ **No runtime validation:** Prisma will accept `null` for title (schema allows it)

**Could allow proposalId leak?** No - explicitly sets only allowed fields.

---

## 2. Fallback Patterns Found

### Pattern 1: `title || 'Imported Work Package'`
**Locations:**
- `workPackageCsvMapper.js:208`
- `workpackages/import/one-shot/route.js:26`
- `workpackages/import/one-shot/route.js:103`

**Problem:** If CSV has empty string `""`, `null`, `undefined`, or falsy value for title, it defaults to `'Imported Work Package'`.

---

### Pattern 2: Missing Title Field Entirely
**Locations:**
- `workpackages/route.js:48` - Creates with only `contactId`
- `workpackages/bulk-upload/csv/route.js:132` - Creates with only `contactId` + `phases`
- `workpackages/bulk-upload/route.js:90` - Creates with only `contactId` + `phases`

**Problem:** These create WorkPackages with `title: null` (Prisma schema allows it).

---

### Pattern 3: Proposal Field Confusion
**Location:** `workpackages/import/one-shot/route.js:103`
```javascript
const proposalTitle = title || normalizedRows[0].proposalDescription || 'Imported Work Package';
```

**Problem:** Uses `proposalDescription` as fallback for WorkPackage title - wrong field type.

---

## 3. CSV Mapping Logic

### File: `workPackageCsvMapper.js`

**Fuzzy Matching (Line 74-90):**
```javascript
const aliases = {
  'proposaltitle': 'title',  // ⚠️ Maps proposalTitle to WorkPackage.title
  'proposaldescription': 'description',
  'proposaltotalcost': 'totalCost',
  // ...
};
```

**Issues:**
- ⚠️ **Alias mapping:** Maps `proposaltitle` CSV column to `title` field (intentional, but could be confusing)
- ⚠️ **No validation:** Doesn't validate that mapped fields are valid WorkPackage fields
- ⚠️ **No field stripping:** Only maps known fields, but doesn't explicitly reject unknown fields

**Transform Logic (Line 141-168):**
- ✅ **Good:** Only maps fields that are in the `mappings` object
- ✅ **Good:** Doesn't spread entire row
- ⚠️ **Issue:** Type conversions use `|| 0` and `|| ''` which could mask invalid data

---

## 4. Validation Gaps

### ❌ No Schema Validation
**Finding:** No Zod, Yup, Superstruct, or any validation library found in WorkPackage creation paths.

**Impact:**
- Unknown fields in request body are silently ignored (safe, but no error)
- Invalid types (e.g., `title: 123`) would be accepted by Prisma if schema allows it
- Missing required fields (like `title`) are not caught until database constraint fails

### ❌ No Field Stripping
**Finding:** No explicit field stripping - Prisma only accepts fields defined in schema.

**Impact:**
- If `proposalId` is in request body, Prisma will reject it (schema doesn't have it) - **SAFE**
- But no explicit validation error - just Prisma error

### ❌ No Type Enforcement
**Finding:** TypeScript types exist but no runtime validation.

**Impact:**
- `title: string` in function signature doesn't prevent `undefined` at runtime
- Prisma accepts `null` for optional fields

---

## 5. Most Likely Root Cause

### **PRIMARY CULPRIT: `workPackageCsvMapper.js:208`**

```javascript
const workPackage = {
  title: firstRow.title || 'Imported Work Package',  // ⚠️ THIS LINE
  // ...
};
```

**Why this is the problem:**
1. CSV import uses this mapper
2. If CSV has empty/missing title column, it defaults to `'Imported Work Package'`
3. This object is then passed to `createWorkPackage()` which accepts it
4. WorkPackage is created with the fallback title

**Secondary Issues:**
1. Three routes create WorkPackages with **no title at all** (`title: null`)
2. No validation prevents empty strings from becoming fallbacks
3. No validation ensures title is a proper string

---

## 6. Structural Weaknesses

### Weakness 1: Prisma Schema Allows Null Title
**Schema:**
```prisma
model WorkPackage {
  title String   // Required in schema, but Prisma allows null if not @default
}
```

**Problem:** If `title` is not provided, Prisma will set it to `null` (not empty string).

### Weakness 2: No Validation Layer
**Problem:** No validation between API request and Prisma create.

**Impact:** Invalid data can reach Prisma, which may:
- Accept it (if schema allows)
- Reject it with cryptic error
- Create bad data silently

### Weakness 3: Fallback Logic Uses `||` Operator
**Problem:** `||` treats empty string `""` as falsy, so `"" || 'default'` becomes `'default'`.

**Better:** Use nullish coalescing `??` or explicit checks.

---

## 7. How to Patch Permanently

### Patch 1: Fix `workPackageCsvMapper.js`
```javascript
// BEFORE:
title: firstRow.title || 'Imported Work Package',

// AFTER:
title: (firstRow.title && firstRow.title.trim()) || null,  // Don't default, let caller decide
// OR:
title: firstRow.title?.trim() || `Work Package ${new Date().toISOString()}`,  // Better default
```

### Patch 2: Add Title to All Creation Paths
```javascript
// In workpackages/route.js, bulk-upload/csv/route.js, bulk-upload/route.js:
const workPackage = await prisma.workPackage.create({
  data: {
    contactId,
    title: body.title || `Work Package for ${contact.firstName} ${contact.lastName}`,  // Better default
    // ...
  },
});
```

### Patch 3: Add Validation Layer
```javascript
// Create validation schema (using Zod example):
import { z } from 'zod';

const WorkPackageCreateSchema = z.object({
  contactId: z.string().min(1),
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  totalCost: z.number().optional(),
  // Explicitly reject proposalId:
}).strict();  // Reject unknown fields

// Use in routes:
const validated = WorkPackageCreateSchema.parse(body);
```

### Patch 4: Fix Fallback Logic
```javascript
// Use nullish coalescing instead of ||
title: firstRow.title?.trim() ?? 'Imported Work Package',
// OR better:
title: firstRow.title?.trim() || (() => {
  throw new Error('Title is required in CSV');
})(),
```

---

## 8. Summary

**Root Cause:** `workPackageCsvMapper.js:208` uses `||` fallback to `'Imported Work Package'` when CSV title is missing/empty.

**Contributing Factors:**
1. Three routes create WorkPackages with no title (null)
2. No validation layer
3. Prisma schema allows null title
4. Fallback logic uses `||` instead of explicit checks

**Fix Priority:**
1. **HIGH:** Fix `workPackageCsvMapper.js` fallback logic
2. **HIGH:** Add title to all WorkPackage creation paths
3. **MEDIUM:** Add validation layer (Zod/Yup)
4. **LOW:** Update Prisma schema to require title with default

**proposalId Leak Risk:** ✅ **LOW** - No spread operators found that would leak proposalId. All creation paths explicitly set fields.

