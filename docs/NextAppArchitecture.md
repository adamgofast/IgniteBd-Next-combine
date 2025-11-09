# Ignite BD Next.js App Architecture

## Overview

The legacy Ignite BD stack lived in two repos: a Vite React frontend (`Ignite-frontend-production`) and an Express API (`ignitebd-backend`).  
The new `IgniteBd-Next-combine` project merges both layers into a single Next.js App Router app that deploys on Vercel.

```
/app              → App Router pages, layouts, API routes
/components       → Shared UI primitives migrated from the React repo
/lib              → Prisma client, Firebase helpers, config/services
/public           → Static assets (favicon, logo, etc.)
/prisma           → Schema + migrations copied from the backend repo
```

Next.js 16 powers both **server-rendered UI** and **API functions**. Everything still talks to the same Render Postgres database via Prisma.

## Routing & Pages

### App Router

* `src/app/page.js` redirects to `/splash`.
* Auth pages (`/splash`, `/signup`, `/signin`) run as client components with Firebase hooks.
* Onboarding pages (`/profilesetup`, `/company/create-or-choose`, `/companyprofile`, `/company/create-success`, `/welcome`) mirror the old React routes one-for-one.
* Feature pages (e.g. `/product`, `/persona`, `/growth-dashboard`) live beside their API routes under the same `/app` tree.
* Sidebar navigation is handled globally by `src/app/providers.jsx` → `src/components/AppShell.jsx`, which decides when to render the left rail.

### Local Storage Hydration

1. **Welcome page** (`/welcome`) calls `/api/owner/hydrate`.
2. The response is cached locally:
   * `ownerId`, `owner`
   * `companyHQId`, `companyHQ`
   * `firebaseToken` (from the Firebase SDK)
3. Subsequent pages read these keys to personalize the dashboard and scoping.

## API Design

Each Express route from `ignitebd-backend/routes` became a Next.js route:

| Old Express path                         | New App Router file                                           |
| --------------------------------------- | ------------------------------------------------------------- |
| `routes/Owner/CreateOwnerRoute.js`      | `src/app/api/owner/create/route.js`                          |
| `routes/Owner/IgniteUniversalHydrateRoute.js` | `src/app/api/owner/hydrate/route.js`                   |
| `routes/Owner/OwnerProfileSetupRoute.js`| `src/app/api/owner/[ownerId]/profile/route.js`               |
| `routes/Company/CreateCompanyHQRoute.js`| `src/app/api/company/route.js`                               |
| `routes/Contact/ContactRoutes.js`       | `src/app/api/contacts/**` (RESTful handlers)                 |
| `routes/Proposal/ProposalRoutes.js`     | `src/app/api/proposals/**`                                   |
| `routes/Persona/PersonaRoutes.js`       | `src/app/api/personas/**`                                    |
| `routes/productRoutes.js` (new layer)   | `src/app/api/products/route.js`                              |
| `routes/pipelineConfigRoute.js`         | `src/app/api/pipelines/config/route.js`                      |
| `routes/User/userCreateRoute.js`        | `src/app/api/user/create/route.js`                           |

Each handler exports `GET`, `POST`, etc., receives a standard `Request`, and returns `Response.json()`. Prisma is imported from `src/lib/prisma.js`, which keeps the singleton pattern for local dev.

## Services & Config

* `src/lib/services/**` contains the backend service modules moved from `ignitebd-backend/services`.
* `src/lib/firebase.js` is the Firebase client SDK logic used by the auth pages.
* `src/lib/firebaseAdmin.js` wraps the Admin SDK for API routes that need token verification.
* Config files like `buyerConfig`, `pipelineConfig`, and `howMetConfig` now live in `src/lib`.

## Environment Variables

The consolidated app still requires the same secrets:

```
DATABASE_URL=postgresql://... (Render Postgres)
OPENAI_API_KEY=sk-...
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account", ...}
```

Because Next.js hosts both frontend and backend, these live in `.env.local` (dev) and the Vercel project settings (prod). The Firebase client keys remain public, just as in the legacy frontend.

## Deployment Flow

1. Push to GitHub (`Ignite-Strategies/IgniteBd-Next-combine`). Vercel listens to `main`.
2. Vercel runs `npm install`, `npm run build` (Next.js build + Prisma generate).  
   * `next.config.mjs` sets `Cross-Origin-Opener-Policy` headers for Google OAuth popups.
3. All `/api` requests run in the same deployment; there is no Render Express layer anymore.
4. Prisma connects to the Render Postgres instance using `DATABASE_URL`.

## References

* Legacy architecture guide: `Ignitebd_stack_devguide.md`
* Migration commits: see Git history in this repo (`chore: port backend api and onboarding flows to app router`)
* Firebase auth patterns: `FIREBASE-AUTH-AND-USER-MANAGEMENT.md` (copied into this repo from backend docs)

Use this document as the canonical reference for how the consolidated Next.js stack is structured going forward.

