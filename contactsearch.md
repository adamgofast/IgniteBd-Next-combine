# Contact Search Architecture

## Overview

The contact search system provides real-time, inline filtering of contacts as users type. It uses a centralized **ContactsRegistry** service for fast, indexed lookups.

## Basic Search Capability

### Real-Time Inline Filtering

- **Shows all contacts** with email addresses when search is empty
- **Filters instantly** as user types in the search input
- **Searches across**:
  - Contact name (firstName + lastName)
  - Email address
  - Company name (contactCompany.companyName)

### Search Flow

```
User types in search box
  ↓
onChange event fires
  ↓
searchTerm state updates
  ↓
useMemo recalculates availableContacts
  ↓
ContactsRegistry.searchWithEmail(query) filters contacts
  ↓
UI updates instantly with filtered results
```

## Query Mechanism

### ContactsRegistry Service

Located at: `src/lib/services/contactsRegistry.js`

**Key Methods:**
- `search(query)` - Searches all contacts by name, email, or company
- `searchWithEmail(query)` - Searches and filters to only contacts with email addresses
- `getWithEmail()` - Returns all contacts that have email addresses
- `getById(contactId)` - Fast lookup by contact ID
- `getByEmail(email)` - Fast lookup by email address
- `getByCompany(companyName)` - Get all contacts for a company

### Indexed Lookups

The registry maintains three indexes for fast lookups:
- `byId` - Map of contactId → Contact
- `byEmail` - Map of email (lowercase) → Contact
- `byCompany` - Map of companyName (lowercase) → Contact[]

## CompanyHQId Relationship

### How CompanyHQId is Set

1. **Owner Authentication**
   - User logs in via Firebase
   - System finds Owner record by `firebaseId`
   - Owner has relationship to `CompanyHQ` via `ownedCompanies` or `managedCompanies`

2. **LocalStorage Storage**
   - `companyHQId` is stored in `localStorage` after owner hydration
   - Retrieved via: `localStorage.getItem('companyHQId')` or `localStorage.getItem('companyId')`
   - Used as tenant identifier for all contact queries

3. **Contact Scoping**
   - All contacts are scoped to `companyHQId` (tenant boundary)
   - Contact model has `crmId` field that links to `CompanyHQ.id`
   - API queries filter by: `/api/contacts?companyHQId=${companyHQId}`

### Owner → CompanyHQ → Contacts Chain

```
Owner (firebaseId)
  ↓
CompanyHQ (ownerId/managerId relationship)
  ↓
Contacts (crmId = companyHQId)
```

## Finding All Contacts in CompanyHQId

### API Endpoint

**GET** `/api/contacts?companyHQId=${companyHQId}`

**Response:**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "contact-id",
      "crmId": "company-hq-id",
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "contactCompany": {
        "companyName": "Acme Corp"
      }
    }
  ]
}
```

### Hydration Flow

1. **Load from Cache** (fast, no API call)
   - Registry loads from `localStorage.getItem('contacts')`
   - Parses JSON and builds indexes
   - Sets `hydrated = true`

2. **Fetch from API** (if cache empty or refresh needed)
   - Calls `/api/contacts?companyHQId=${companyHQId}`
   - Registry hydrates with fetched contacts
   - Saves to `localStorage.setItem('contacts', JSON.stringify(contacts))`
   - Rebuilds indexes for fast lookups

## Inline Typing Filter

### Implementation

**File:** `src/app/(authenticated)/client-operations/invite-prospect/page.jsx`

```javascript
// Search input with real-time filtering
<input
  type="text"
  value={searchTerm}
  onChange={(e) => setSearchTerm(e.target.value)}
  placeholder="Type to search contacts..."
/>

// useMemo recalculates on searchTerm change
const availableContacts = useMemo(() => {
  if (!searchTerm || !searchTerm.trim()) {
    return registry.getWithEmail(); // Show all with email
  }
  return registry.searchWithEmail(searchTerm); // Filter by query
}, [searchTerm, registry]);
```

### Search Behavior

- **Empty search** → Shows all contacts with email addresses
- **Typing "john"** → Filters to contacts matching "john" in name/email/company
- **Case-insensitive** → All searches are lowercase
- **Instant updates** → No debounce, filters on every keystroke

## Callback Pattern

### Registry Singleton

The ContactsRegistry uses a singleton pattern:

```javascript
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

const registry = getContactsRegistry();
// Auto-loads from localStorage on first access
```

### State Management

- **Registry state** - Maintains contacts array and indexes
- **React state** - `searchTerm` triggers re-renders
- **useMemo** - Memoizes filtered results for performance

### Refresh Callbacks

1. **Refresh from Cache**
   ```javascript
   refreshContacts = () => {
     registry.loadFromCache();
   }
   ```

2. **Fetch from API**
   ```javascript
   fetchContactsFromAPI = async () => {
     const response = await api.get(`/api/contacts?companyHQId=${companyHQId}`);
     registry.hydrate(response.data.contacts);
     registry.saveToCache();
   }
   ```

## Usage Example

```javascript
import { getContactsRegistry } from '@/lib/services/contactsRegistry';

// Get registry instance (singleton)
const registry = getContactsRegistry();

// Search contacts
const results = registry.searchWithEmail('john');
// Returns: Array of contacts matching "john" that have email addresses

// Get all contacts with email
const allWithEmail = registry.getWithEmail();

// Fast lookup by ID
const contact = registry.getById('contact-id');

// Fast lookup by email
const contact = registry.getByEmail('john@example.com');
```

## Performance

- **Indexed lookups** - O(1) for ID/email lookups
- **Search filtering** - O(n) but optimized with Set deduplication
- **Memoization** - useMemo prevents unnecessary recalculations
- **LocalStorage cache** - Fast initial load, no API call needed

## Data Flow Summary

```
1. Owner logs in → Firebase auth
2. System finds Owner → Gets CompanyHQ relationship
3. companyHQId stored in localStorage
4. ContactsRegistry loads from localStorage (cache)
5. User types in search → Registry filters in real-time
6. If cache empty → Fetch from API → Hydrate registry → Save to cache
```

