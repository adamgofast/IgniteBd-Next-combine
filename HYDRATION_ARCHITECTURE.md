# Hydration Architecture: ownerId → companyHQId → Everything

## Core Principle

**ownerId-first architecture** (later managerId support)
- Everything flows from `ownerId`
- `companyHQId` is the tenant boundary
- All feature data hydrates from `companyHQId`
- Maximize localStorage usage
- Surgical hydration points (minimal, targeted)

---

## The Hydration Chain

```
ownerId (from Firebase Auth)
  ↓
companyHQId (from Owner.ownedCompanies[0] or CompanyHQ creation)
  ↓
Everything else (all scoped to companyHQId)
```

---

## What Can Be Hydrated from companyHQId

Based on Prisma schema, `CompanyHQ` has these direct relations:

### Direct Relations (via companyHQId)

1. **contacts** (`Contact[]`)
   - Field: `crmId` (renamed from companyId for clarity)
   - Query: `WHERE crmId = companyHQId`
   - localStorage key: `contacts`

2. **contactLists** (`ContactList[]`)
   - Field: `companyId` (points to CompanyHQ)
   - Query: `WHERE companyId = companyHQId`
   - localStorage key: `contactLists`

3. **companies** (`Company[]`) - Prospect/Client companies
   - Field: `companyHQId`
   - Query: `WHERE companyHQId = companyHQId`
   - localStorage key: `companies`

4. **proposals** (`Proposal[]`)
   - Field: `companyHQId`
   - Query: `WHERE companyHQId = companyHQId`
   - localStorage key: `proposals`

5. **products** (`Product[]`)
   - Field: `companyHQId`
   - Query: `WHERE companyHQId = companyHQId`
   - localStorage key: `products`

6. **personas** (`Persona[]`)
   - Field: `companyHQId`
   - Query: `WHERE companyHQId = companyHQId`
   - localStorage key: `personas`

### Derived Data (via relations)

7. **pipelines** (via contacts)
   - Contact has `pipeline Pipeline?` relation
   - Query: Get contacts with `include: { pipeline: true }`
   - Can be stored as part of contacts or separately
   - localStorage key: `pipelines` (optional, can be embedded in contacts)

8. **campaigns** (not in schema yet, but would be companyHQId scoped)
   - Future: Email campaigns, outreach campaigns
   - localStorage key: `campaigns` or `outreachCampaigns`

---

## localStorage Structure

### Level 1: Owner (Required for all authenticated routes)

```javascript
{
  ownerId: string,              // Owner database ID
  owner: Owner,                 // Full Owner object
  firebaseId: string,           // Firebase UID
  managerId?: string,           // If user is a manager (future)
}
```

**Hydration Point:** `/welcome` → `GET /api/owner/hydrate`

### Level 2: Company (Required for main app)

```javascript
{
  companyHQId: string,          // CompanyHQ database ID (tenant identifier)
  companyHQ: CompanyHQ,         // Full CompanyHQ object
}
```

**Hydration Point:** `/welcome` (if exists) or `/company/profile` (on creation)

### Level 3: Feature Data (Hydrated on-demand, all scoped to companyHQId)

```javascript
{
  // Core CRM
  contacts: Contact[],           // All contacts for tenant
  contactLists: ContactList[],   // All contact lists for tenant
  companies: Company[],          // Prospect/client companies
  
  // Business Development
  proposals: Proposal[],         // All proposals for tenant
  products: Product[],           // All products for tenant
  personas: Persona[],           // All personas for tenant
  
  // Pipeline & Outreach (derived or separate)
  pipelines: Pipeline[],         // Pipeline states (can be embedded in contacts)
  campaigns: Campaign[],         // Email/outreach campaigns (future)
  
  // Roadmap & Planning
  bdRoadmapItems: RoadmapItem[], // BD roadmap items (future)
}
```

**Hydration Points:** Feature-specific layouts (surgical hydration)

---

## Surgical Hydration Points

### 1. Welcome Hydration (`/welcome`)

**What it hydrates:**
- Owner data
- Primary CompanyHQ (if exists)

**localStorage writes:**
```javascript
localStorage.setItem('ownerId', ownerData.id);
localStorage.setItem('owner', JSON.stringify(ownerData));
if (ownerData.companyHQId) {
  localStorage.setItem('companyHQId', ownerData.companyHQId);
  localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
}
```

**API:** `GET /api/owner/hydrate`

**When:** On sign-in, before routing to main app

---

### 2. Company Creation (`/company/profile`)

**What it hydrates:**
- New CompanyHQ
- Re-hydrates Owner to sync

**localStorage writes:**
```javascript
localStorage.setItem('companyHQId', companyHQ.id);
localStorage.setItem('companyHQ', JSON.stringify(companyHQ));
// Then re-hydrate owner
```

**API:** `POST /api/companyhq/create` → `GET /api/owner/hydrate`

**When:** On company creation

---

### 3. Contacts Layout (`/contacts/layout.jsx`)

**What it hydrates:**
- All contacts for tenant
- Contact lists (optional, can be separate)

**localStorage writes:**
```javascript
localStorage.setItem('contacts', JSON.stringify(contacts));
// Optionally:
localStorage.setItem('contactLists', JSON.stringify(contactLists));
```

**API:** `GET /api/contacts?companyHQId=${companyHQId}`

**When:** On mount of any `/contacts/*` route

**Pattern:**
1. Read `companyHQId` from localStorage
2. Check `localStorage.getItem('contacts')` for cache
3. If cached, use for fast initial render
4. Fetch fresh from API
5. Update localStorage

---

### 4. Companies Layout (`/contacts/companies` - future)

**What it hydrates:**
- Prospect/client companies

**localStorage writes:**
```javascript
localStorage.setItem('companies', JSON.stringify(companies));
```

**API:** `GET /api/companies?companyHQId=${companyHQId}`

**When:** On mount of companies page

---

### 5. Proposals Layout (`/proposals/layout.jsx` - future)

**What it hydrates:**
- All proposals for tenant

**localStorage writes:**
```javascript
localStorage.setItem('proposals', JSON.stringify(proposals));
```

**API:** `GET /api/proposals?companyHQId=${companyHQId}`

**When:** On mount of any `/proposals/*` route

---

### 6. Products Layout (`/products/layout.jsx` - future)

**What it hydrates:**
- All products for tenant

**localStorage writes:**
```javascript
localStorage.setItem('products', JSON.stringify(products));
```

**API:** `GET /api/products?companyHQId=${companyHQId}`

**When:** On mount of any `/products/*` route

---

### 7. Personas Layout (`/personas/layout.jsx` - future)

**What it hydrates:**
- All personas for tenant

**localStorage writes:**
```javascript
localStorage.setItem('personas', JSON.stringify(personas));
```

**API:** `GET /api/personas?companyHQId=${companyHQId}`

**When:** On mount of any `/personas/*` route

---

### 8. Outreach Layout (`/outreach/layout.jsx`)

**What it hydrates:**
- Campaigns (when schema is added)

**localStorage writes:**
```javascript
localStorage.setItem('campaigns', JSON.stringify(campaigns));
// or
localStorage.setItem('outreachCampaigns', JSON.stringify(campaigns));
```

**API:** `GET /api/campaigns?companyHQId=${companyHQId}`

**When:** On mount of any `/outreach/*` route

---

### 9. Pipelines Layout (`/pipelines/layout.jsx`)

**What it hydrates:**
- Pipeline configuration
- Roadmap items (future)

**localStorage writes:**
```javascript
localStorage.setItem('pipelineConfig', JSON.stringify(config));
localStorage.setItem('bdRoadmapItems', JSON.stringify(items));
```

**API:** `GET /api/pipelines/config?companyHQId=${companyHQId}`

**When:** On mount of any `/pipelines/*` route

---

## Hydration Pattern (Universal)

Every feature layout follows this pattern:

```javascript
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';

const FeatureContext = createContext({
  data: [],
  loading: false,
  hydrated: false,
  refresh: async () => {},
});

export function useFeature() {
  return useContext(FeatureContext);
}

export default function FeatureLayout({ children }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [companyHQId, setCompanyHQId] = useState('');

  // Step 1: Get companyHQId from localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = localStorage.getItem('companyHQId') || localStorage.getItem('companyId') || '';
    setCompanyHQId(stored);
  }, []);

  // Step 2: Check cache and hydrate
  useEffect(() => {
    if (!companyHQId) return;

    // Check localStorage cache
    const cached = localStorage.getItem('featureData'); // Replace with actual key
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setData(parsed);
        setHydrated(true);
      } catch (error) {
        console.warn('Failed to parse cached data', error);
      }
    }

    // Fetch fresh data
    refreshData(companyHQId);
  }, [companyHQId]);

  // Step 3: Fetch from API
  const refreshData = useCallback(async (tenantId) => {
    if (!tenantId) return;

    setLoading(true);
    try {
      const response = await api.get(`/api/feature?companyHQId=${tenantId}`);
      const freshData = response.data?.data ?? [];
      
      setData(freshData);
      
      // Step 4: Update localStorage
      if (typeof window !== 'undefined') {
        localStorage.setItem('featureData', JSON.stringify(freshData));
      }
      
      setHydrated(true);
    } catch (error) {
      console.error('Error hydrating feature data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const contextValue = {
    data,
    loading,
    hydrated,
    companyHQId,
    refresh: () => refreshData(companyHQId),
  };

  return (
    <FeatureContext.Provider value={contextValue}>
      {children}
    </FeatureContext.Provider>
  );
}
```

---

## API Route Pattern

All feature API routes follow this pattern:

```javascript
// src/app/api/feature/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request) {
  try {
    // 1. Verify Firebase token
    const firebaseUser = await verifyFirebaseToken(request);
    
    // 2. Get companyHQId from query params
    const { searchParams } = new URL(request.url);
    const companyHQId = searchParams.get('companyHQId');
    
    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId required' },
        { status: 400 }
      );
    }
    
    // 3. Query database (scoped to companyHQId)
    const data = await prisma.featureModel.findMany({
      where: { companyHQId },
      include: { /* relations */ }
    });
    
    // 4. Return data
    return NextResponse.json({
      success: true,
      data,
      count: data.length,
    });
  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

---

## localStorage Key Naming Convention

**Pattern:** `{featureName}` (camelCase, plural for arrays)

**Examples:**
- `contacts` - Array of Contact objects
- `contactLists` - Array of ContactList objects
- `companies` - Array of Company objects
- `proposals` - Array of Proposal objects
- `products` - Array of Product objects
- `personas` - Array of Persona objects
- `campaigns` - Array of Campaign objects
- `pipelineConfig` - Pipeline configuration object
- `bdRoadmapItems` - Array of RoadmapItem objects

**Core keys (always present):**
- `ownerId` - Owner database ID
- `owner` - Full Owner object
- `companyHQId` - CompanyHQ database ID
- `companyHQ` - Full CompanyHQ object
- `firebaseId` - Firebase UID

---

## Benefits of This Architecture

1. **Fast Initial Render**: localStorage cache provides instant data
2. **Surgical Hydration**: Only hydrate what's needed per route
3. **Offline Support**: Cached data available even if API is slow
4. **Clear Dependencies**: ownerId → companyHQId → everything else
5. **Scalable**: Easy to add new features following the same pattern
6. **Type-Safe**: Can type localStorage keys and validate on read

---

## Future: managerId Support

When managerId is added:

```javascript
// Check if user is manager
const managerId = localStorage.getItem('managerId');
const companyHQId = localStorage.getItem('companyHQId');

// If manager, verify they have access to this companyHQId
// (check managedCompanies array in owner data)
```

**Hydration remains the same** - managerId is just an access control check, not a hydration boundary.

---

## Implementation Checklist

- [x] Welcome hydration (ownerId, companyHQId)
- [x] Company creation hydration
- [x] Contacts layout hydration
- [ ] Contact lists hydration (separate or with contacts?)
- [ ] Companies layout hydration
- [ ] Proposals layout hydration
- [ ] Products layout hydration
- [ ] Personas layout hydration
- [ ] Outreach/Campaigns layout hydration
- [ ] Pipelines layout hydration
- [ ] Roadmap items hydration

---

**Last Updated**: November 2025  
**Architecture**: ownerId → companyHQId → Everything  
**Principle**: Maximize localStorage, surgical hydration points

