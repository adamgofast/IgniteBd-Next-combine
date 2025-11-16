# Hydration Architecture

Complete guide to the hydration system: ownerId → companyHQId → Everything

## Table of Contents

1. [Core Principle](#core-principle)
2. [Hydration Chain](#hydration-chain)
3. [localStorage Structure](#localstorage-structure)
4. [Hydration Points](#hydration-points)
5. [Hydration Pattern](#hydration-pattern)
6. [API Route Pattern](#api-route-pattern)
7. [Best Practices](#best-practices)

---

## Core Principle

**ownerId-first architecture** (with future managerId support)
- Everything flows from `ownerId`
- `companyHQId` is the tenant boundary
- All feature data hydrates from `companyHQId`
- Maximize localStorage usage
- Surgical hydration points (minimal, targeted)

---

## Hydration Chain

```
ownerId (from Firebase Auth)
  ↓
companyHQId (from Owner.ownedCompanies[0] or CompanyHQ creation)
  ↓
Everything else (all scoped to companyHQId)
```

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
  personas: Persona[],          // All personas for tenant
  
  // Pipeline & Outreach (derived or separate)
  pipelines: Pipeline[],         // Pipeline states (can be embedded in contacts)
  campaigns: Campaign[],         // Email/outreach campaigns (future)
  
  // Roadmap & Planning
  bdRoadmapItems: RoadmapItem[], // BD roadmap items (future)
}
```

**Hydration Points:** Feature-specific layouts (surgical hydration)

---

## Hydration Points

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
- All contacts for tenant (with pipeline and company data included)
- Contact lists (optional, can be separate)

**localStorage writes:**
```javascript
localStorage.setItem('contacts', JSON.stringify(contacts));
// Optionally:
localStorage.setItem('contactLists', JSON.stringify(contactLists));
```

**API:** `GET /api/contacts?companyHQId=${companyHQId}`

**API Response:** Contacts array with `pipeline: true` and `contactCompany: true` included in Prisma query

**When:** On mount of any `/contacts/*` route

**Pattern:**
1. Read `companyHQId` from localStorage
2. Check `localStorage.getItem('contacts')` for cache
3. If cached, use for fast initial render (set hydrated = true)
4. Fetch fresh from API (includes pipeline and company data)
5. Update localStorage with full contact objects

**Contact Detail Page:**
- Uses cached contacts array from ContactsContext for fast initial render
- Fetches fresh data from API in background
- Updates contacts cache when fresh data arrives

---

### 4. Company Hydration (`/api/company/hydrate`)

**What it hydrates:**
- `companyHQ` (full object)
- `personas[]` → localStorage
- `contacts[]` → localStorage (limit 100)
- `products[]` → localStorage
- `pipelines[]` → localStorage (limit 100)
- `stats` (counts and metrics)

**When it runs:**
- Should run on Growth Dashboard
- When `refresh()` is called

**localStorage keys:**
- `companyHydration_{companyHQId}` (full cached object with timestamp)
- `companyHQ`
- `companyHQId`
- `personas`
- `personaId` (first persona ID or null)
- `contacts`
- `products`
- `pipelines`

**Cache TTL**: 5 minutes

---

## Hydration Pattern (Universal)

Every feature layout follows this pattern:

```javascript
'use client';

import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';
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
  const { companyHQId } = useCompanyHQ();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  // Step 1: Check localStorage cache
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const cached = localStorage.getItem('featureData');
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          setData(parsed);
          setHydrated(true);
        }
      } catch (error) {
        console.warn('Failed to parse cached data', error);
      }
    }
  }, []);

  // Step 2: Fetch from API
  const refresh = useCallback(async () => {
    if (!companyHQId) return;
    setLoading(true);
    try {
      const response = await api.get(`/api/feature?companyHQId=${companyHQId}`);
      const fetched = response.data?.data ?? [];
      setData(fetched);
      localStorage.setItem('featureData', JSON.stringify(fetched));
      setHydrated(true);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  }, [companyHQId]);

  // Step 3: Auto-fetch if not hydrated
  useEffect(() => {
    if (companyHQId && !hydrated) {
      refresh();
    }
  }, [companyHQId, hydrated, refresh]);

  return (
    <FeatureContext.Provider value={{ data, loading, hydrated, refresh }}>
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
    // 1. Verify Firebase token (optional for GET)
    const firebaseUser = await optionalAuth(request);
    
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


