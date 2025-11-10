# IgniteBD Stack Next.js Development Guide

## Premise

**IgniteBD is a business development platform designed to help professional services clients with systematic outreach, relationship building, and growth acceleration.**

The core mission: **Attract → Engage → Nurture**

- **Attract**: Build awareness through content, branding, SEO, and advertising
- **Engage**: Convert prospects into meaningful relationships through outreach, events, and personalized campaigns
- **Nurture**: Maintain and deepen relationships to drive long-term business growth

---

## Stack Overview - Next.js Combined Architecture

### Combined Stack: `IgniteBd-Next-combine`
- **Framework**: Next.js 14+ (App Router)
- **Frontend**: React 18 (Server & Client Components)
- **Backend**: Next.js API Routes (replacing Express)
- **Database**: PostgreSQL with Prisma ORM
- **Authentication**: Firebase Auth (client SDK + Admin SDK)
- **Styling**: Tailwind CSS
- **State Management**: React Context API + localStorage hydration
- **HTTP Client**: Axios (with Firebase token interceptors)
- **Deployment**: Vercel (full-stack deployment)
- **Production URL**: https://app.ignitegrowth.biz

### Key Difference from Original Stack

**Original Stack** (`Ignite-frontend-production` + `ignitebd-backend`):
- Separate React (Vite) frontend on Vercel
- Separate Express backend on Render
- Cross-origin API calls

**Next.js Combined Stack** (`IgniteBd-Next-combine`):
- **Monorepo**: Frontend + Backend in single Next.js app
- **API Routes**: Next.js API routes (`/app/api/**/route.js`) replace Express routes
- **Server Components**: Can render on server for better performance
- **Client Components**: Interactive UI with `'use client'` directive
- **Single Deployment**: Everything deploys together on Vercel

---

## Architecture Principles

### Core Architecture Pattern
**Contact + Company First Architecture** - Designed to drive business growth through systematic relationship management.

This architecture emphasizes:
- Multi-tenancy via `CompanyHQId`
- Contact as universal personhood
- Pipeline/stage tracking
- Company relationships (prospect/client companies)

### Key Concepts

1. **Multi-Tenancy**: Everything scoped to `CompanyHQId` (root container)
2. **Universal Personhood**: Contacts represent people across their entire journey
3. **Pipeline Tracking**: Intentional pipeline/stage state management
4. **Company Hierarchy**: CompanyHQ (tenant) vs Company (prospect/client)

---

## Next.js App Router Structure

### Route Organization

```
src/app/
├── (public)/              # Public routes (no auth required)
│   ├── signin/
│   ├── signup/
│   └── splash/
│
├── (onboarding)/          # Onboarding flow (auth required)
│   ├── welcome/           # Owner hydration & routing
│   ├── profilesetup/     # Owner profile completion
│   └── company/
│       ├── create-or-choose/
│       ├── profile/       # CompanyHQ creation
│       └── create-success/
│
├── (authenticated)/       # Main app (auth + company required)
│   ├── growth-dashboard/
│   ├── contacts/
│   │   ├── layout.jsx     # Contacts context hydration
│   │   ├── page.jsx       # People Hub
│   │   ├── upload/
│   │   ├── list-manager/
│   │   ├── deal-pipelines/
│   │   └── [contactId]/
│   ├── outreach/
│   │   ├── layout.jsx     # Campaigns context hydration
│   │   ├── campaigns/
│   │   └── campaigns/[campaignId]/
│   ├── personas/
│   ├── pipelines/
│   │   ├── layout.jsx     # Pipeline context hydration
│   │   └── roadmap/
│   ├── proposals/
│   └── [other feature pages]/
│
└── api/                   # Next.js API Routes (backend)
    ├── owner/
    │   ├── create/route.js
    │   ├── hydrate/route.js
    │   └── [ownerId]/profile/route.js
    ├── contacts/
    ├── company/
    └── [other entities]/
```

### Route Groups Explained

- `(public)`: Routes accessible without authentication
- `(onboarding)`: Routes for new users setting up their account
- `(authenticated)`: Main application routes requiring full setup

Route groups (parentheses) don't affect URLs but allow shared layouts.

---

## Hydration Flow & Data Management

### Quick Reference: What Gets Hydrated When

**The hydration chain:**
1. **ownerId** → Stored first (from signup/welcome)
2. **companyHQId** → Stored after company creation (or from welcome if exists)
3. **Everything else** → Hydrates off of `companyHQId`

**Summary:**
- **Welcome** hydrates: `ownerId`, `owner`, `companyHQId` (if exists), `companyHQ` (if exists)
- **Company Creation** stores: `companyHQId`, `companyHQ`, then re-hydrates owner
- **Contacts** hydrates off: `companyHQId` → stores `contacts` array
- **Outreach** hydrates off: `companyHQId` → stores `outreachCampaigns` array
- **Pipelines** hydrates off: `companyHQId` → stores `bdRoadmapItems` array

**Key Point:** All feature data requires `companyHQId` to exist first. Features check localStorage for cached data, then fetch fresh from API using `companyHQId`.

### localStorage Keys Hierarchy

```
Level 1: Owner (Required for all authenticated routes)
├── ownerId          # Owner database ID
├── owner            # Full Owner object (JSON)
└── firebaseId       # Firebase UID (from signup)

Level 2: Company (Required for main app)
├── companyHQId      # CompanyHQ database ID (tenant identifier)
└── companyHQ         # Full CompanyHQ object (JSON)

Level 3: Feature Data (Hydrated on-demand per feature)
├── contacts         # Array of Contact objects (hydrated by companyHQId)
├── outreachCampaigns # Array of Campaign objects (hydrated by companyHQId)
├── bdRoadmapItems   # Array of Roadmap items (hydrated by companyHQId)
└── [other feature data]
```

### 1. Welcome Hydration (`/welcome`)

**What it hydrates:**
- Owner data from `/api/owner/hydrate`
- Primary CompanyHQ (if exists)
- All owned/managed companies

**What gets stored in localStorage:**
```javascript
// Level 1: Owner (always stored)
localStorage.setItem('ownerId', ownerData.id);
localStorage.setItem('owner', JSON.stringify(ownerData));

// Level 2: Company (if exists)
if (ownerData.companyHQId) {
  localStorage.setItem('companyHQId', ownerData.companyHQId);
}
if (ownerData.companyHQ) {
  localStorage.setItem('companyHQ', JSON.stringify(ownerData.companyHQ));
}
```

**Routing logic:**
- No `companyHQId` or no `ownedCompanies` → `/company/create-or-choose`
- Has company → `/growth-dashboard`

**API Route:** `src/app/api/owner/hydrate/route.js`
- Verifies Firebase token
- Queries Prisma for Owner by `firebaseId`
- Includes `ownedCompanies` and `managedCompanies` with relations
- Returns hydrated owner object

### 2. Company Creation (`/company/profile`)

**What gets stored:**
```javascript
// After creating CompanyHQ
localStorage.setItem('companyHQId', companyHQ.id);
localStorage.setItem('companyHQ', JSON.stringify(companyHQ));

// Then re-hydrate owner to sync
const hydrateResponse = await api.get('/api/owner/hydrate');
localStorage.setItem('ownerId', hydrateResponse.data.owner.id);
localStorage.setItem('owner', JSON.stringify(hydrateResponse.data.owner));
if (hydrateResponse.data.owner.companyHQId) {
  localStorage.setItem('companyHQId', hydrateResponse.data.owner.companyHQId);
  localStorage.setItem('companyHQ', JSON.stringify(hydrateResponse.data.owner.companyHQ));
}
```

### 3. Feature-Level Hydration (After companyHQId exists)

**Contacts Hydration** (`/contacts/layout.jsx`):
```javascript
// Step 1: Get companyHQId from localStorage
const companyHQId = localStorage.getItem('companyHQId');

// Step 2: Check for cached contacts
const cached = localStorage.getItem('contacts');
if (cached) {
  setContacts(JSON.parse(cached)); // Fast initial render
}

// Step 3: Fetch fresh contacts from API
const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
const contacts = response.data.contacts;

// Step 4: Store in localStorage for next time
localStorage.setItem('contacts', JSON.stringify(contacts));
```

**Pattern for all features:**
1. Read `companyHQId` from localStorage
2. Check localStorage for cached feature data
3. If cached, use it for fast initial render
4. Fetch fresh data from API using `companyHQId`
5. Update localStorage with fresh data
6. Provide via React Context to child components

**Other Feature Layouts:**

**Outreach Layout** (`/outreach/layout.jsx`):
- Hydrates campaigns for the tenant using `companyHQId`
- Provides `useOutreach()` hook
- Stores `outreachCampaigns` in localStorage

**Pipelines Layout** (`/pipelines/layout.jsx`):
- Hydrates pipeline configuration using `companyHQId`
- Provides `usePipelines()` hook
- Stores `bdRoadmapItems` in localStorage

---

## API Architecture

### Next.js API Routes vs Express Routes

**Old Pattern (Express):**
```
ignitebd-backend/routes/Owner/IgniteUniversalHydrateRoute.js
→ GET /api/owner/hydrate
```

**New Pattern (Next.js):**
```
src/app/api/owner/hydrate/route.js
→ GET /api/owner/hydrate
```

### API Route Structure

```javascript
// src/app/api/owner/hydrate/route.js
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request) {
  // 1. Verify Firebase token
  const firebaseUser = await verifyFirebaseToken(request);
  
  // 2. Query database
  const owner = await prisma.owner.findUnique({
    where: { firebaseId: firebaseUser.uid },
    include: { /* relations */ }
  });
  
  // 3. Return JSON response
  return NextResponse.json({ success: true, owner });
}
```

### API Client Configuration

**File:** `src/lib/api.js`

```javascript
const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_BACKEND_URL || '', // Empty = relative URLs (Next.js API routes)
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Interceptor adds Firebase token to all requests
api.interceptors.request.use(async (config) => {
  const user = getAuth().currentUser;
  if (user) {
    const token = await user.getIdToken();
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
```

**Important:** If `NEXT_PUBLIC_BACKEND_URL` is empty or unset, API calls use relative URLs and hit Next.js API routes. If set to external URL (e.g., `https://ignitebd-backend.onrender.com`), calls go to external backend.

---

## Authentication Flow

### Complete Onboarding Flow

1. **Sign Up** (`/signup`)
   - Firebase Auth creates user
   - `POST /api/owner/create` creates Owner record
   - Stores `ownerId` in localStorage
   - Redirects to `/welcome`

2. **Welcome Hydration** (`/welcome`)
   - `GET /api/owner/hydrate` loads full Owner data
   - Stores `owner`, `companyHQId`, `companyHQ` in localStorage
   - Routes based on completeness:
     - No company → `/company/create-or-choose`
     - Has company → `/growth-dashboard`

3. **Company Setup** (`/company/profile`)
   - `POST /api/companyhq/create` creates CompanyHQ
   - Updates localStorage with new `companyHQId`
   - Redirects to `/growth-dashboard`

4. **Dashboard** (`/growth-dashboard`)
   - Reads from localStorage for fast initial render
   - May refresh data from API as needed

### Firebase Token Management

- **Client-side**: Firebase Auth SDK provides tokens
- **API Routes**: `verifyFirebaseToken()` middleware validates tokens
- **Automatic**: Axios interceptor adds token to all requests

---

## Database & Prisma

### Prisma Setup

**File:** `prisma/schema.prisma`
- Shared schema with original backend
- Same models: Owner, CompanyHQ, Contact, Pipeline, etc.

**Client:** `src/lib/prisma.js`
```javascript
import { PrismaClient } from '@prisma/client';
export const prisma = globalThis.prisma || new PrismaClient();
```

### Database Connection

- **Development**: Local PostgreSQL or connection string in `.env.local`
- **Production**: Vercel environment variable `DATABASE_URL`
- **Migrations**: `npx prisma migrate dev` (same as Express backend)

---

## Development Workflow

### Local Development

```bash
# Install dependencies
npm install

# Set up environment variables (.env.local)
DATABASE_URL="postgresql://..."
FIREBASE_SERVICE_ACCOUNT_KEY='{"type":"service_account",...}'
NEXT_PUBLIC_BACKEND_URL=""  # Empty = use Next.js API routes

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Start development server
npm run dev
```

**Runs on:** http://localhost:3000

### API Development

- **Next.js API Routes**: Edit files in `src/app/api/**/route.js`
- **Hot Reload**: Changes reflect immediately (no separate server restart)
- **Database**: Same Prisma client, same database as Express backend

### Testing API Routes

```bash
# Test locally
curl http://localhost:3000/api/owner/hydrate \
  -H "Authorization: Bearer <firebase-token>"

# Test in browser
# Navigate to page that calls API, check Network tab
```

---

## Key Differences from Original Stack

### 1. API Routes Location

**Old:**
```
ignitebd-backend/routes/Owner/IgniteUniversalHydrateRoute.js
```

**New:**
```
src/app/api/owner/hydrate/route.js
```

### 2. Routing

**Old (React Router):**
```javascript
import { useNavigate } from 'react-router-dom';
navigate('/contacts');
```

**New (Next.js):**
```javascript
import { useRouter } from 'next/navigation';
router.push('/contacts');
```

### 3. Links

**Old (React Router):**
```javascript
import { Link } from 'react-router-dom';
<Link to="/contacts">Contacts</Link>
```

**New (Next.js):**
```javascript
import Link from 'next/link';
<Link href="/contacts">Contacts</Link>
```

### 4. Server vs Client Components

**Server Component** (default):
- Renders on server
- No `'use client'` directive
- Can't use hooks or browser APIs
- Good for static content

**Client Component**:
- Must have `'use client'` at top
- Renders on client
- Can use hooks, state, browser APIs
- Required for interactive UI

### 5. Data Fetching

**Old (Express):**
- All data fetching in client components
- Axios calls to external backend

**New (Next.js):**
- Can fetch in Server Components (direct Prisma calls)
- Can fetch in Client Components (API routes)
- Can fetch in API routes (for client components)

---

## Hydration Hooks Pattern

### Custom Hooks for Feature Contexts

**Contacts Hook:**
```javascript
// src/app/(authenticated)/contacts/layout.jsx
export function useContacts() {
  return useContext(ContactsContext);
}

// Usage in page:
const { contacts, loading, refreshContacts } = useContacts();
```

**Outreach Hook:**
```javascript
// src/app/(authenticated)/outreach/layout.jsx
export function useOutreach() {
  return useContext(OutreachContext);
}
```

**Pipelines Hook:**
```javascript
// src/app/(authenticated)/pipelines/layout.jsx
export function usePipelines() {
  return useContext(PipelinesContext);
}
```

### Hook Usage Pattern

1. Layout provides context via `useContext`
2. Pages import and use the hook
3. Hook provides: data, loading state, refresh function
4. localStorage used for fast initial hydration

---

## Deployment

### Vercel Deployment

1. **Connect Repository**: Link GitHub repo to Vercel
2. **Environment Variables**:
   - `DATABASE_URL` - PostgreSQL connection string
   - `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase Admin SDK JSON
   - `NEXT_PUBLIC_BACKEND_URL` - Leave empty or unset (use Next.js API routes)
3. **Build**: Vercel automatically runs `npm run build`
4. **Deploy**: Every push to main triggers deployment

### Production URLs

- **App**: https://app.ignitegrowth.biz
- **API Routes**: https://app.ignitegrowth.biz/api/owner/hydrate (same domain)

### Database

- Same PostgreSQL database as Express backend
- Shared Prisma schema
- Can run migrations from either codebase

---

## Troubleshooting

### API Routes Not Working

**Issue:** API calls failing, 404s on `/api/**` routes

**Check:**
1. Is `NEXT_PUBLIC_BACKEND_URL` set? If yes, it's calling external backend
2. Are API route files in correct location? (`src/app/api/**/route.js`)
3. Are route handlers exported correctly? (`export async function GET(request)`)
4. Check Vercel function logs for errors

### Hydration Errors

**Issue:** React hydration mismatch errors

**Check:**
1. Are you using `react-router-dom` components? (should use Next.js `Link`)
2. Are you accessing `window`/`localStorage` before mount? (use `useEffect`)
3. Are Server Components trying to use hooks? (add `'use client'`)

### Database Connection Issues

**Issue:** Prisma errors, can't connect to database

**Check:**
1. Is `DATABASE_URL` set in environment variables?
2. Is database accessible from Vercel? (check firewall/network)
3. Run `npx prisma generate` after schema changes

---

## Migration Notes

### From Express Backend to Next.js API Routes

**Route Mapping:**
| Express Route | Next.js API Route |
|--------------|-------------------|
| `routes/Owner/CreateOwnerRoute.js` | `src/app/api/owner/create/route.js` |
| `routes/Owner/IgniteUniversalHydrateRoute.js` | `src/app/api/owner/hydrate/route.js` |
| `routes/Owner/OwnerProfileSetupRoute.js` | `src/app/api/owner/[ownerId]/profile/route.js` |

**Middleware:**
- Express: `verifyFirebaseToken` middleware
- Next.js: `verifyFirebaseToken(request)` function call in route handler

**Response:**
- Express: `res.json({ success: true, data })`
- Next.js: `NextResponse.json({ success: true, data })`

---

## Related Documentation

- **`HYDRATION_ARCHITECTURE.md`** - **⭐ Core hydration architecture** (ownerId → companyHQId → everything)
- **`Ignitebd_stack_devguide.md`** - Original stack documentation (React + Express)
- **`docs/NextAppArchitecture.md`** - Next.js App Router architecture details
- **`IGNITE_ARCHITECTURE.md`** - Complete database schema and data flow
- **`FIREBASE-AUTH-AND-USER-MANAGEMENT.md`** - Authentication patterns

---

## Current Status

**✅ Completed:**
- Next.js App Router structure
- Route groups (public, onboarding, authenticated)
- API routes for Owner, Contacts, Company
- Hydration flows (Welcome, Contacts, Outreach, Pipelines)
- Feature-level layouts with context
- Dynamic routes ([contactId], [personaId], [proposalId])

**🚧 In Progress:**
- Full API route migration from Express
- Contact upload CSV processing
- Campaign management
- Proposal builder

**📋 Future:**
- Server Components for better performance
- Streaming SSR
- Optimistic UI updates
- Real-time features

---

**Last Updated**: November 2025  
**Stack Version**: 2.0.0 (Next.js Combined)  
**Architecture**: Contact + Company First  
**Multi-Tenancy**: CompanyHQ-scoped  
**Authentication**: Firebase Auth  
**Deployment**: Vercel (Full-Stack)

