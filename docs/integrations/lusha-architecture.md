# Lusha Integration - Contact Enrichment

**Last Updated**: November 2025  
**Status**: ⚠️ Partially Disabled (Redis queue disabled)  
**Purpose**: Contact enrichment service to find and populate contact information

---

## Premise

**Lusha** is a contact enrichment service that helps find and populate missing contact information (emails, phone numbers, job titles, etc.) when you only have basic information like a person's name and company.

### Use Case

When you have:
- ✅ First name
- ✅ Last name  
- ✅ Company name

But you need:
- ❓ Email address
- ❓ Phone number
- ❓ Job title
- ❓ Additional contact details

**Lusha** searches its database and enriches the contact with verified information.

---

## How It Works

### 1. Search Phase
Lusha searches for contacts matching:
- Name (first + last)
- Company name

### 2. Enrichment Phase
Once found, Lusha enriches the contact with:
- Email address (verified)
- Phone number
- Job title
- Company information
- Additional metadata

### 3. Storage Phase
The enriched data is stored in the `Contact` model with:
- `enrichmentSource: "Lusha"`
- `enrichmentFetchedAt: timestamp`
- `enrichmentPayload: full JSON response`
- Extracted fields: `email`, `phone`, `title`, `companyName`, `domain`

---

## Architecture

### Current Implementation

**Service Location**: `src/lib/services/enrichment/lushaService.js`

**API Endpoints**:
- **Search**: `POST https://api.lusha.com/prospecting/contact/search/`
- **Enrich**: `POST https://api.lusha.com/prospecting/contact/enrich`

**Current Flow**:
```
CSV Upload → /api/enqueue-csv → ProspectCandidate (DB) → Redis Queue → /api/hydration/run → Contact (DB)
```

### Proposed Architecture (Not Yet Implemented)

**Proposed Flow**:
```
CSV Upload → /api/lusha/upload → TempContact (Redis Session) → /api/lusha/enrich → Contact (DB)
```

**Key Differences**:

| Aspect | Current | Proposed |
|--------|---------|----------|
| **Upload Endpoint** | `/api/enqueue-csv` | `/api/lusha/upload` |
| **Enrichment Endpoint** | `/api/hydration/run` | `/api/lusha/enrich` |
| **Storage Model** | `ProspectCandidate` (Prisma) | `TempContact` (Redis) |
| **Session Management** | Job-based (Redis keys) | Session-based (`sessionId`) |
| **CSV Parser** | Custom parser | PapaParse |
| **API Endpoint** | `/prospecting/contact/search/` | `/prospect/search` or `/enrich/contact` |
| **TTL** | 1 hour per job | 1 hour per session |

**Proposed Components** (Not Yet Built):
- `/lib/redis/lusha.ts` - Session storage handler
- `/lib/lushaClient.ts` - Lusha API client
- `/api/lusha/upload.ts` - CSV upload endpoint
- `/api/lusha/enrich.ts` - Enrichment endpoint

**Note**: The proposed architecture is a design document and has not been implemented yet. The current implementation uses the queue-based approach.

### Database Fields

The `Contact` model includes enrichment fields:

```prisma
model Contact {
  // ... other fields
  enrichmentSource    String?   // "Lusha"
  enrichmentFetchedAt DateTime? // When enrichment was fetched
  enrichmentPayload   Json?     // Full enrichment response
  companyName         String?   // Company name from enrichment
  domain              String?   // Domain inferred from email
}
```

---

## Usage

### Direct API Functions (Currently Available)

#### 1. Search Contacts

```javascript
import { searchContacts } from '@/lib/services/enrichment/lushaService';

const filters = {
  contacts: {
    include: {
      names: [{ first: 'John', last: 'Doe' }],
      companies: [{ name: 'Acme Corp' }],
    },
  },
};

const results = await searchContacts(filters, page = 0, size = 40);
// Returns: { requestId, data: [{ contactId, ... }] }
```

#### 2. Enrich Contacts

```javascript
import { enrichContacts } from '@/lib/services/enrichment/lushaService';

const requestId = 'search-request-id';
const contactIds = ['contact-id-1', 'contact-id-2'];

const enriched = await enrichContacts(requestId, contactIds);
// Returns: { contacts: [{ data: { email, phone, title, ... } }] }
```

#### 3. Enrich by Name and Company (Helper)

```javascript
// Internal function - not exported, but used in processQueue
// Searches and enriches in one call
const result = await enrichByNameAndCompany('John', 'Doe', 'Acme Corp');
// Returns: enriched contact data or null
```

### Queue-Based Enrichment (Currently Disabled)

#### 1. Enqueue Candidate

**Status**: ⚠️ **DISABLED** (requires Redis)

```javascript
import { enqueueCandidate } from '@/lib/services/enrichment/lushaService';

// This would enqueue a candidate for batch processing
await enqueueCandidate({
  id: 'candidate-id',
  userId: 'user-id',
  firstName: 'John',
  lastName: 'Doe',
  companyName: 'Acme Corp',
  crmId: 'company-hq-id',
  companyHQId: 'company-hq-id',
});
```

#### 2. Process Queue

**Status**: ⚠️ **DISABLED** (requires Redis)

```javascript
import { processQueue } from '@/lib/services/enrichment/lushaService';

// This would process all pending enrichment jobs
const results = await processQueue();
// Returns: { processed, succeeded, failed, errors }
```

**API Endpoint**: `POST /api/hydration/run`

---

## CSV Upload Workflow

### Endpoint
`POST /api/enqueue-csv`

### Purpose
Upload a CSV file with contacts (firstName, lastName, companyName) and enqueue them for enrichment.

### CSV Format
```csv
firstName,lastName,companyName
John,Doe,Acme Corp
Jane,Smith,Tech Inc
```

### Flow
1. Parse CSV file
2. Create `ProspectCandidate` records
3. Enqueue each candidate for enrichment (currently disabled)
4. Process queue to enrich contacts (currently disabled)

### Current Status
⚠️ **Partially functional** - CSV parsing works, but enqueue/process requires Redis

---

## Enrichment Data Mapping

When a contact is enriched, the following data is extracted and stored:

| Lusha Field | Contact Field | Notes |
|------------|---------------|-------|
| `email` or `emails[0].email` | `email` | Primary email address |
| `domain` or inferred from email | `domain` | Company domain |
| `companyName` or `companies[0].name` | `companyName` | Company name |
| `title` or `jobTitle` | `title` | Job title |
| `phone` or `phones[0].phone` | `phone` | Phone number |
| `firstName` | `firstName` | First name |
| `lastName` | `lastName` | Last name |
| Full response | `enrichmentPayload` | Complete JSON response |

### Contact Creation/Update Logic

```javascript
// Only create/update if email is found (verified contact)
if (email) {
  const contactData = {
    enrichmentSource: 'Lusha',
    enrichmentFetchedAt: new Date(),
    enrichmentPayload: result,
    firstName: result.firstName || job.firstName,
    lastName: result.lastName || job.lastName,
    email,
    domain,
    companyName: enrichedCompanyName,
    title: result.title || result.jobTitle,
    phone: result.phone || result.phones?.[0]?.phone,
  };

  // Update existing contact or create new one
  if (existingContact) {
    await prisma.contact.update({ where: { id }, data: contactData });
  } else {
    await prisma.contact.create({ data: { ...contactData, crmId, createdById } });
  }
}
```

---

## Configuration

### Environment Variables

**Required**:
- `LUSHA_API_KEY` - Lusha API key for authentication

**Optional** (for queue processing):
- `UPSTASH_REDIS_REST_URL` - Redis REST URL (currently disabled)
- `UPSTASH_REDIS_REST_TOKEN` - Redis REST token (currently disabled)

### API Configuration

- **Base URL**: `https://api.lusha.com/prospecting`
- **Authentication**: API key in `api_key` header

---

## Current Limitations

### ⚠️ Redis Queue Disabled

The queue-based enrichment workflow is **temporarily disabled** because:
1. Redis/Upstash integration is commented out
2. `enqueueCandidate()` throws an error
3. `processQueue()` returns empty results

### To Re-enable

1. Uncomment Redis code in `lushaService.js`
2. Uncomment Redis code in `src/app/api/hydration/run/route.js`
3. Set `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` environment variables
4. Test the queue workflow

### What Still Works

✅ Direct API calls (`searchContacts`, `enrichContacts`)  
✅ CSV parsing in `/api/enqueue-csv`  
❌ Queue-based batch processing  
❌ Automatic enrichment processing

---

## Integration with Domain Registry

Lusha enrichment is part of the broader enrichment ecosystem:

- **Domain Registry Service** (`domainRegistryService.ts`) mentions Lusha/Clearbit as enrichment sources
- Enriched contacts help populate the domain registry
- Domain registry helps link contacts to CompanyHQ records

---

## Testing

### Test Script
`test-lusha-hydration.js`

### Usage
```bash
# Set environment variables
export LUSHA_API_KEY=your_api_key
export UPSTASH_REDIS_REST_URL=your_redis_url
export UPSTASH_REDIS_REST_TOKEN=your_redis_token
export DATABASE_URL=your_database_url

# Run tests
node test-lusha-hydration.js
```

### Test Coverage
- ✅ CSV parsing
- ⚠️ Enqueue candidate (requires Redis)
- ⚠️ Process queue (requires Redis)

---

## Best Practices

### 1. Verify Email Before Creating Contact

Only create/update contacts if enrichment returns an email address (verified contact).

### 2. Store Full Payload

Store the complete `enrichmentPayload` JSON for:
- Debugging
- Future data extraction
- Audit trail

### 3. Track Enrichment Source

Always set `enrichmentSource: 'Lusha'` to track where data came from.

### 4. Handle Missing Data

Gracefully handle cases where:
- No contact found
- No email in enrichment result
- Partial data (e.g., name but no email)

### 5. Rate Limiting

Be mindful of Lusha API rate limits. The queue system helps batch requests.

---

## Future Improvements

### 1. Re-enable Redis Queue
- Uncomment Redis code
- Test queue processing
- Monitor queue status

### 2. Add Enrichment UI
- Manual enrichment button on contact pages
- Bulk enrichment from contact lists
- Enrichment status indicators

### 3. Multiple Enrichment Sources
- Add Clearbit integration
- Fallback chain: Lusha → Clearbit → Manual
- Compare results from multiple sources

### 4. Enrichment Analytics
- Track success rates
- Monitor API costs
- Identify enrichment patterns

---

## Related Documentation

- [Contact Management Architecture](../architecture/contacts.md)
- [Domain Registry Service](../../src/lib/services/domainRegistryService.ts)
- [Environment Variables](../setup/environment-variables.md)
- [VERCEL_ENV_VARS.md](../../VERCEL_ENV_VARS.md)

---

## Proposed Architecture Details

### Core Concept

> **"You owe Lusha something (identifiers), it dances, and gives you something back (verified data)."**

### TempContact Model (Redis - Proposed)

Ephemeral object stored per upload session:

```typescript
{
  id: string,             // uuid
  sessionId: string,      // group key
  firstName: string,
  lastName: string,
  companyName: string,
  companyDomain?: string,
  jobTitle?: string,
  lushaStatus: 'pending' | 'success' | 'failed',
  lushaResponse?: any,    // raw Lusha API response
  enrichedAt?: Date
}
```

### Proposed Contact Schema Extensions

Additional fields for Lusha integration:

```prisma
model Contact {
  // ... existing fields
  linkedinUrl   String?
  lushaScore    Int?
  lushaMeta     Json?
}
```

### Proposed Service Structure

#### `/lib/redis/lusha.ts`
Handles session storage:
```typescript
await lushaRedis.set(`lusha:${sessionId}`, JSON.stringify(tempContacts), { ex: 3600 })
```

#### `/lib/lushaClient.ts`
Handles outbound API calls:
```typescript
const response = await fetch('https://api.lusha.co/prospect/search', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.LUSHA_API_KEY}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ firstName, lastName, company }),
})
```

### Proposed API Endpoints

#### `/api/lusha/upload.ts`
- Receives CSV file
- Parses with PapaParse
- Stores as TempContact array in Redis session
- Returns `sessionId`

#### `/api/lusha/enrich.ts`
- Fetches session data from Redis
- For each TempContact:
  - Calls Lusha API
  - Maps results to Contact schema
  - Updates TempContact status
- Returns enrichment summary
- Optionally saves to Prisma Contact model

### Key Considerations (Proposed)

1. **Rate Limiting**: Each enrichment call costs credits → batch carefully (e.g., 5/sec max)
2. **Session TTL**: 1 hour in Redis
3. **Error Handling**: Graceful rate-limiting with retries and error logs
4. **Analytics**: Consider adding `lushaLog` table for usage tracking

### Implementation Status

- ❌ **Not Implemented** - This is a design document
- 📋 **Next Steps**: Generate the proposed components once architecture is approved

---

## Summary

**Lusha** is used to enrich contacts when you have basic information (name + company) but need contact details (email, phone, title).

**Current Implementation Status**:
- ✅ Direct API functions work (`searchContacts`, `enrichContacts`)
- ⚠️ Queue-based batch processing disabled (requires Redis)
- ✅ CSV upload parsing works (`/api/enqueue-csv`)
- ❌ Automatic enrichment processing disabled

**Proposed Architecture Status**:
- 📋 Design documented in this file (see "Proposed Architecture Details" section)
- ❌ Not yet implemented
- 🔨 Components to build: `/lib/redis/lusha.ts`, `/lib/lushaClient.ts`, `/api/lusha/upload.ts`, `/api/lusha/enrich.ts`

**To Use Current Implementation**:
1. Set `LUSHA_API_KEY` environment variable
2. Use `searchContacts()` and `enrichContacts()` directly
3. Or re-enable Redis queue for batch processing

**To Implement Proposed Architecture**:
1. Review "Proposed Architecture Details" section in this document
2. Generate `/lib/redis/lusha.ts`
3. Generate `/lib/lushaClient.ts`
4. Generate `/api/lusha/upload.ts`
5. Generate `/api/lusha/enrich.ts`
6. Update Prisma Contact schema if needed

---

**Last Updated**: November 2025  
**Service**: Lusha Contact Enrichment  
**Purpose**: Find and populate missing contact information  
**Architecture**: Current (queue-based) + Proposed (session-based)

