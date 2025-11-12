// TEMPORARILY DISABLED: Redis/Upstash commented out for deployment
// import { Redis } from '@upstash/redis';
import { prisma } from '@/lib/prisma';

const BASE_URL = 'https://api.lusha.com/prospecting';

function getHeaders() {
  const apiKey = process.env.LUSHA_API_KEY;
  if (!apiKey) {
    throw new Error('LUSHA_API_KEY environment variable is not set');
  }
  return { api_key: apiKey };
}

// TEMPORARILY DISABLED: Redis initialization commented out
// Lazy Redis initialization to prevent build-time errors
// let redis = null;

// function getRedis() {
//   if (redis) {
//     return redis;
//   }

//   const url = process.env.UPSTASH_REDIS_REST_URL;
//   const token = process.env.UPSTASH_REDIS_REST_TOKEN;

//   if (!url || !token) {
//     throw new Error(
//       'Redis configuration is missing. Please set UPSTASH_REDIS_REST_URL and UPSTASH_REDIS_REST_TOKEN environment variables.'
//     );
//   }

//   redis = new Redis({
//     url,
//     token,
//   });

//   return redis;
// }

// Temporary function to indicate Redis is disabled
function getRedis() {
  throw new Error('Redis is temporarily disabled');
}

/**
 * Enqueue a candidate for enrichment
 * @param {Object} candidate - Candidate object with id, firstName, lastName, companyName, etc.
 * @returns {Promise<string>} Job ID
 * 
 * TEMPORARILY DISABLED: Redis is commented out
 */
export async function enqueueCandidate(candidate) {
  // TEMPORARILY DISABLED: Redis functionality
  // const redisClient = getRedis();
  // const jobId = `lusha:job:${candidate.id}`;
  // await redisClient.hset(jobId, { ...candidate, status: 'pending' });
  // await redisClient.expire(jobId, 3600); // 1 hour TTL
  // return jobId;
  
  console.warn('⚠️ Redis is temporarily disabled. Enqueue functionality is not available.');
  throw new Error('Redis is temporarily disabled. Enqueue functionality is not available.');
}

/**
 * Search for contacts using Lusha API
 * @param {Object} filters - Search filters
 * @param {number} page - Page number (default: 0)
 * @param {number} size - Page size (default: 40)
 * @returns {Promise<Object>} Search results
 */
export async function searchContacts(filters, page = 0, size = 40) {
  const res = await fetch(`${BASE_URL}/contact/search/`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ pages: { page, size }, filters }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Lusha API error: ${res.status} - ${errorText}`);
  }

  return res.json();
}

/**
 * Enrich contacts using Lusha API
 * @param {string} requestId - Request ID from search
 * @param {string[]} contactIds - Array of contact IDs to enrich
 * @returns {Promise<Object>} Enrichment results
 */
export async function enrichContacts(requestId, contactIds) {
  const res = await fetch(`${BASE_URL}/contact/enrich`, {
    method: 'POST',
    headers: { ...getHeaders(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, contactIds }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Lusha API error: ${res.status} - ${errorText}`);
  }

  return res.json();
}

/**
 * Enrich a contact by name and company
 * @param {string} firstName - First name
 * @param {string} lastName - Last name
 * @param {string} companyName - Company name
 * @returns {Promise<Object|null>} Enriched contact data or null if not found
 */
async function enrichByNameAndCompany(firstName, lastName, companyName) {
  const filters = {
    contacts: {
      include: {
        names: [{ first: firstName, last: lastName }],
        companies: [{ name: companyName }],
      },
    },
  };

  const search = await searchContacts(filters);
  if (!search?.requestId || !Array.isArray(search.data) || !search.data.length) {
    return null;
  }

  const contactIds = search.data.map((c) => c.contactId);
  const enrich = await enrichContacts(search.requestId, contactIds);
  return enrich?.contacts?.[0]?.data || null;
}

/**
 * Process the enrichment queue
 * Processes all pending jobs in Redis and enriches contacts
 * 
 * TEMPORARILY DISABLED: Redis is commented out
 */
export async function processQueue() {
  // TEMPORARILY DISABLED: Redis functionality
  // const redisClient = getRedis();
  // const keys = await redisClient.keys('lusha:job:*');
  // const results = {
  //   processed: 0,
  //   succeeded: 0,
  //   failed: 0,
  //   errors: [],
  // };

  // for (const key of keys) {
  //   try {
  //     const job = await redisClient.hgetall(key);
  //     if (job.status === 'pending') {
  //       results.processed++;

  //       try {
  //         const result = await enrichByNameAndCompany(
  //           job.firstName,
  //           job.lastName,
  //           job.companyName
  //         );

  //         if (result) {
  //           // Extract email from enrichment payload
  //           const email = result.email || result.emails?.[0]?.email;
  //           const domain = result.domain || (email ? email.split('@')[1] : null);
  //           const enrichedCompanyName = result.companyName || result.companies?.[0]?.name || job.companyName;

  //           // Only persist if we have an email (verified contact)
  //           if (email) {
  //             // Check if contact already exists
  //             const existingContact = await prisma.contact.findFirst({
  //               where: { email },
  //             });

  //             const contactData = {
  //               enrichmentSource: 'Lusha',
  //               enrichmentFetchedAt: new Date(),
  //               enrichmentPayload: result,
  //               firstName: result.firstName || job.firstName,
  //               lastName: result.lastName || job.lastName,
  //               email,
  //               domain,
  //               companyName: enrichedCompanyName,
  //               title: result.title || result.jobTitle,
  //               phone: result.phone || result.phones?.[0]?.phone,
  //             };

  //             if (existingContact) {
  //               // Update existing contact
  //               await prisma.contact.update({
  //                 where: { id: existingContact.id },
  //                 data: contactData,
  //               });
  //             } else {
  //               // Create new contact
  //               await prisma.contact.create({
  //                 data: {
  //                   ...contactData,
  //                   crmId: job.crmId || job.companyHQId || '', // Required field
  //                   createdById: job.userId,
  //                 },
  //               });
  //             }

  //             await redisClient.hset(key, { status: 'done' });
  //             results.succeeded++;
  //             console.log(`✅ Enriched contact: ${email}`);
  //           } else {
  //             await redisClient.hset(key, { status: 'failed', error: 'No email found in enrichment result' });
  //             results.failed++;
  //             console.log(`⚠️ No email found for: ${job.firstName} ${job.lastName} at ${job.companyName}`);
  //           }
  //         } else {
  //           await redisClient.hset(key, { status: 'failed', error: 'No enrichment result' });
  //           results.failed++;
  //           console.log(`⚠️ No enrichment result for: ${job.firstName} ${job.lastName} at ${job.companyName}`);
  //         }
  //       } catch (err) {
  //         const errorMsg = String(err);
  //         await redisClient.hset(key, { status: 'error', error: errorMsg });
  //         results.failed++;
  //         results.errors.push({ key, error: errorMsg });
  //         console.error(`❌ Error processing job ${key}:`, err);
  //       }
  //     }
  //   } catch (err) {
  //     console.error(`❌ Error reading job ${key}:`, err);
  //     results.errors.push({ key, error: String(err) });
  //   }
  // }

  // return results;
  
  console.warn('⚠️ Redis is temporarily disabled. Queue processing is not available.');
  return {
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
    message: 'Redis is temporarily disabled',
  };
}

