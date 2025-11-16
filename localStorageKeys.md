# LocalStorage Keys Configuration

This document catalogs all localStorage keys used throughout the application. All data should be loaded from localStorage first, with manual sync buttons as fallback.

## Core Identity & Company

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `ownerId` | string | Current owner/user ID | `useOwner` hook | ❌ No |
| `owner` | object | Full owner/user object | `useOwner` hook | ❌ No |
| `companyHQId` | string | Current company HQ ID (legacy: `companyId`) | `useCompanyHQ` hook | ❌ No |
| `companyHQ` | object | Full company HQ object | `useCompanyHQ` hook | ❌ No |
| `adminId` | string | Admin ID (legacy, use `ownerId`) | Signup/Signin | ❌ No |
| `userId` | string | User ID (legacy, use `ownerId`) | Signin | ❌ No |
| `email` | string | User email | Signup/Signin | ❌ No |

## Authentication

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `firebaseToken` | string | Firebase auth token | Login/Auth | ❌ No |
| `firebaseId` | string | Firebase user UID | Login/Auth | ❌ No |

## Business Data

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `personas` | array | All personas for company | Personas pages | ❌ No |
| `personaId` | string | Currently selected persona ID | `useCompanyHydration` | ❌ No |
| `contacts` | array | All contacts for company | Contacts layout | ❌ No |
| `products` | array | All products/services | Products pages | ❌ No |
| `pipelines` | array | Pipeline configurations | Pipelines layout | ❌ No |
| `proposals` | array | All proposals | Proposals pages | ❌ No |

## Outreach & Campaigns

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `outreachCampaigns` | array | Outreach campaigns | Outreach layout | ❌ No |
| `contactLists` | array | Contact lists for campaigns | List manager | ❌ No |
| `campaigns` | array | Campaigns (legacy) | List manager | ❌ No |

## Company Hydration Cache

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `companyHydration_{companyHQId}` | object | Cached full company hydration data with timestamp | `useCompanyHydration` | ❌ No |

## Client Portal

| Key | Type | Description | Managed By | Auto-Fetch? |
|-----|------|-------------|------------|-------------|
| `clientPortalProposalId` | string | Proposal ID for client portal | Client portal | ❌ No |

## Legacy/Deprecated

| Key | Type | Description | Status |
|-----|------|-------------|--------|
| `companyId` | string | Legacy company ID (use `companyHQId`) | ⚠️ Deprecated |
| `personaData` | object | Legacy persona storage (use `personas`) | ⚠️ Deprecated |
| `companies` | array | Legacy companies storage | ⚠️ Deprecated |

## Rules & Best Practices

1. **NO AUTO-FETCH**: All pages should load from localStorage only on mount
2. **NULL IS OK**: If localStorage is null/empty, show empty state - don't auto-fetch
3. **SYNC BUTTONS**: Provide manual sync/refresh buttons for user-initiated updates
4. **HOOKS FIRST**: Use hooks (`useCompanyHQ`, `useOwner`, `useContacts`, etc.) when available
5. **CONSISTENT KEYS**: Always use the keys listed above - don't create new ones without updating this doc
6. **CLEAN ON LOGOUT**: Clear all localStorage keys on user logout

## Hook Reference

- `useOwner()` - Manages `ownerId`, `owner`, `companyHQId`, `companyHQ`
- `useCompanyHQ()` - Manages `companyHQId`, `companyHQ`
- `useCompanyHydration(companyHQId)` - Manages bulk company data (personas, contacts, products, etc.)
- `useContacts()` - Manages `contacts` array (from ContactsLayout)
- `useLocalStorage(key, initialValue)` - Generic hook for any localStorage key

## Migration Notes

- `companyId` → `companyHQId` (migration complete, but still checking for legacy)
- `personaData` → `personas` (migration in progress)
- Always check both old and new keys during transition periods


