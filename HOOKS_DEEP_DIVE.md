# Hooks Deep Dive 🔍

Complete guide to all React hooks in the IgniteGrowth codebase.

## Available Hooks

### 1. `useOwner` - Owner & Company Data Management
**Location:** `src/hooks/useOwner.js`

**What it does:**
- Manages owner profile data and companyHQ data
- Loads from localStorage instantly (no blocking)
- Provides `refresh()` to hydrate from API
- Handles `ownerId`, `owner`, `companyHQId`, `companyHQ`

**Returns:**
```javascript
{
  ownerId: string | null,
  owner: object | null,        // Full owner object with companyHQ
  companyHQId: string | null,
  companyHQ: object | null,    // Primary companyHQ object
  loading: boolean,
  hydrated: boolean,
  error: string | null,
  refresh: () => Promise<void> // Call to refresh from API
}
```

**Usage:**
```javascript
import { useOwner } from '@/hooks/useOwner';

function MyComponent() {
  const { owner, ownerId, companyHQ, companyHQId, refresh } = useOwner();
  
  // Data loads instantly from localStorage
  // If no data, call refresh() to hydrate from API
  
  return (
    <div>
      <p>Name: {owner?.name}</p>
      <p>Company: {companyHQ?.companyName}</p>
    </div>
  );
}
```

**localStorage keys it manages:**
- `ownerId`
- `owner` (full object)
- `companyHQId`
- `companyHQ` (full object)

---

### 2. `useCompanyHQ` - Company Data Only
**Location:** `src/hooks/useCompanyHQ.js`

**What it does:**
- Lightweight hook for just company data
- Loads from localStorage instantly
- Provides `refresh()` to get latest companyHQ

**Returns:**
```javascript
{
  companyHQId: string | null,
  companyHQ: object | null,
  loading: boolean,
  hydrated: boolean,
  refresh: () => Promise<void>
}
```

**Usage:**
```javascript
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function MyComponent() {
  const { companyHQ, companyHQId, refresh } = useCompanyHQ();
  
  return <div>{companyHQ?.companyName}</div>;
}
```

**When to use:**
- When you only need company data (not owner data)
- Lighter weight than `useOwner`

---

### 3. `useCompanyHydration` - Full Company Data Hydration
**Location:** `src/hooks/useCompanyHydration.js`

**What it does:**
- Comprehensive company data hydration
- Fetches companyHQ + personas + contacts + products + pipelines
- Caches with 5-minute TTL
- Used for feature-rich pages like Growth Dashboard

**Returns:**
```javascript
{
  data: {
    companyHQ: object | null,
    personas: array,
    contacts: array,
    products: array,
    pipelines: array,
    stats: {
      personaCount: number,
      contactCount: number,
      productCount: number,
      pipelineCount: number,
      prospectCount: number,
      clientCount: number,
    }
  },
  loading: boolean,
  hydrated: boolean,
  error: string | null,
  refresh: () => Promise<void>,
  // Convenience getters:
  companyHQ: object | null,
  personas: array,
  contacts: array,
  products: array,
  pipelines: array,
  stats: object
}
```

**Usage:**
```javascript
import { useCompanyHydration } from '@/hooks/useCompanyHydration';
import { useCompanyHQ } from '@/hooks/useCompanyHQ';

function GrowthDashboard() {
  const { companyHQId } = useCompanyHQ();
  const { data, loading, refresh } = useCompanyHydration(companyHQId);
  
  if (loading) return <Loader />;
  
  return (
    <div>
      <p>Contacts: {data.contacts.length}</p>
      <p>Personas: {data.personas.length}</p>
    </div>
  );
}
```

**localStorage keys it manages:**
- `companyHydration_{companyHQId}` (cached with timestamp)
- `companyHQ`
- `companyHQId`
- `personas`
- `personaId`
- `contacts`
- `products`
- `pipelines`

---

### 4. `useLocalStorage` - Generic localStorage Hook
**Location:** `src/hooks/useLocalStorage.js`

**What it does:**
- Generic hook for any localStorage key
- Syncs React state with localStorage
- Automatically serializes/deserializes JSON

**Returns:**
```javascript
[value, setValue] // Like useState but with localStorage sync
```

**Usage:**
```javascript
import { useLocalStorage } from '@/hooks/useLocalStorage';

function MyComponent() {
  const [theme, setTheme] = useLocalStorage('theme', 'light');
  
  return (
    <button onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}>
      Current theme: {theme}
    </button>
  );
}
```

---

### 5. `useMicrosoftGraph` - Microsoft Graph API (Client-Side)
**Location:** `src/hooks/useMicrosoftGraph.js`

**What it does:**
- Client-side Microsoft Graph integration
- Uses MSAL (Microsoft Authentication Library) for auth
- Provides Graph API methods (contacts, email, calendar)

**Returns:**
```javascript
{
  // Authentication
  signIn: () => Promise<{success: boolean}>,
  signOut: () => Promise<{success: boolean}>,
  isAuthenticated: boolean,
  user: object | null, // Microsoft user profile
  
  // Contacts
  hydrateContacts: () => Promise<{success, contacts, count}>,
  createContact: (contactData) => Promise<{success, contact}>,
  
  // Messaging
  sendMessage: (message) => Promise<{success}>,
  
  // Calendar
  getCalendarEvents: (startDateTime, endDateTime) => Promise<{success, events}>,
  
  // State
  loading: boolean,
  error: string | null
}
```

**Usage:**
```javascript
import { useMicrosoftGraph } from '@/hooks/useMicrosoftGraph';

function MyComponent() {
  const { signIn, isAuthenticated, hydrateContacts, loading } = useMicrosoftGraph();
  
  if (!isAuthenticated) {
    return <button onClick={signIn}>Sign in with Microsoft</button>;
  }
  
  return <button onClick={hydrateContacts}>Fetch Contacts</button>;
}
```

**Note:** This is for client-side use. For server-side OAuth (what we're using in settings), use the API routes instead.

---

### 6. `useDynamics` - Dynamics 365 Integration (Placeholder)
**Location:** `src/hooks/useDynamics.js`

**What it does:**
- Placeholder for Dynamics 365 integration
- Currently not implemented

**Returns:**
```javascript
{
  syncAccounts: () => Promise<{success: boolean, error?: string}>,
  loading: boolean,
  error: string | null
}
```

---

## Hook Usage Patterns

### Pattern 1: Instant Load from localStorage
```javascript
// ✅ GOOD: Loads instantly, no blocking
const { owner, companyHQ } = useOwner();
// Data is available immediately from localStorage
```

### Pattern 2: Hydrate When Needed
```javascript
// ✅ GOOD: Load from localStorage, hydrate if stale
const { owner, refresh } = useOwner();

useEffect(() => {
  if (!owner) {
    refresh(); // Only hydrate if no data
  }
}, [owner, refresh]);
```

### Pattern 3: Feature-Specific Hydration
```javascript
// ✅ GOOD: Use specific hook for feature data
const { companyHQId } = useCompanyHQ();
const { contacts, personas } = useCompanyHydration(companyHQId);
```

---

## localStorage Structure

### Owner Data
```javascript
localStorage.setItem('ownerId', 'cuid-123');
localStorage.setItem('owner', JSON.stringify({
  id: 'cuid-123',
  firebaseId: 'firebase-uid',
  name: 'John Doe',
  email: 'john@example.com',
  companyHQId: 'company-cuid',
  companyHQ: { /* full company object */ }
}));
```

### Company Data
```javascript
localStorage.setItem('companyHQId', 'company-cuid');
localStorage.setItem('companyHQ', JSON.stringify({
  id: 'company-cuid',
  companyName: 'GoFast',
  // ... all company fields
}));
```

### Feature Data (from useCompanyHydration)
```javascript
localStorage.setItem('personas', JSON.stringify([...]));
localStorage.setItem('contacts', JSON.stringify([...]));
localStorage.setItem('products', JSON.stringify([...]));
```

---

## Best Practices

1. **Use `useOwner` for settings/profile pages** - It has everything you need
2. **Use `useCompanyHQ` when you only need company data** - Lighter weight
3. **Use `useCompanyHydration` for dashboard/feature pages** - Gets all related data
4. **Always check if data exists before rendering** - Handle loading/empty states
5. **Call `refresh()` after mutations** - Keep localStorage in sync

---

## Common Issues & Solutions

### Issue: Settings page is blank
**Solution:** Use `useOwner` hook - it loads from localStorage instantly
```javascript
const { owner, companyHQ } = useOwner();
// Data loads immediately, no blocking
```

### Issue: Data not updating after save
**Solution:** Call `refresh()` after mutations
```javascript
await api.put('/api/owner/...', data);
await refresh(); // Updates localStorage
```

### Issue: companyHQId is null
**Solution:** Check hydration - it should be in owner.companyHQId
```javascript
const { owner } = useOwner();
const companyHQId = owner?.companyHQId; // Should be here
```

---

## Quick Reference

| Hook | Use Case | Data Source | Blocking? |
|------|----------|-------------|-----------|
| `useOwner` | Settings, Profile pages | localStorage + API | No (instant) |
| `useCompanyHQ` | Company-only pages | localStorage + API | No (instant) |
| `useCompanyHydration` | Dashboard, Feature pages | localStorage + API | No (cached) |
| `useLocalStorage` | Any custom localStorage | localStorage only | No |
| `useMicrosoftGraph` | Client-side Graph API | MSAL + Graph API | No |
| `useDynamics` | Dynamics 365 (TODO) | N/A | N/A |

