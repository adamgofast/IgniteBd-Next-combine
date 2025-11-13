/**
 * Domain Registry Service
 * 
 * Single source of truth for all company domains
 * Normalizes domains and automatically links contacts + CompanyHQ records
 * Powers enrichment (Lusha/Clearbit), predictive BD, and cross-app intelligence
 */

import { prisma } from '@/lib/prisma';
import { inferDomainFromEmail } from '@/lib/utils/inferDomain';

interface RegisterDomainOptions {
  /**
   * CompanyHQ ID to associate with this domain
   */
  companyHqId: string;
  
  /**
   * Normalized company name (optional)
   * e.g., "Business Point Law" for domain "businesspointlaw.com"
   */
  normalizedName?: string | null;
  
  /**
   * Confidence score (0.0 to 1.0)
   * Default: 1.0 (high confidence)
   */
  confidenceScore?: number | null;
}

interface FindDomainOptions {
  /**
   * If true, also updates lastSeen timestamp
   */
  updateLastSeen?: boolean;
}

/**
 * Register or update a domain in the Domain Registry
 * 
 * @param domain - Domain string (e.g., "businesspointlaw.com")
 * @param options - Registration options
 * @returns DomainRegistry entry
 */
export async function registerDomain(
  domain: string,
  options: RegisterDomainOptions
): Promise<any> {
  if (!domain || typeof domain !== 'string') {
    throw new Error('Domain is required');
  }

  // Normalize domain (lowercase, trim)
  const normalizedDomain = domain.toLowerCase().trim();

  // Verify CompanyHQ exists
  const companyHQ = await prisma.companyHQ.findUnique({
    where: { id: options.companyHqId },
  });

  if (!companyHQ) {
    throw new Error(`CompanyHQ not found: ${options.companyHqId}`);
  }

  // Upsert domain registry entry
  const domainEntry = await prisma.domainRegistry.upsert({
    where: {
      domain: normalizedDomain,
    },
    update: {
      // Update if domain already exists (might be reassigning to different CompanyHQ)
      companyHqId: options.companyHqId,
      normalizedName: options.normalizedName || null,
      confidenceScore: options.confidenceScore ?? 1.0,
      lastSeen: new Date(),
    },
    create: {
      domain: normalizedDomain,
      companyHqId: options.companyHqId,
      normalizedName: options.normalizedName || null,
      confidenceScore: options.confidenceScore ?? 1.0,
      firstSeen: new Date(),
      lastSeen: new Date(),
    },
    include: {
      companyHQ: {
        select: {
          id: true,
          companyName: true,
          companyWebsite: true,
        },
      },
    },
  });

  return domainEntry;
}

/**
 * Find CompanyHQ by domain
 * 
 * @param domain - Domain string (e.g., "businesspointlaw.com")
 * @param options - Find options
 * @returns DomainRegistry entry with CompanyHQ, or null if not found
 */
export async function findCompanyHQByDomain(
  domain: string,
  options: FindDomainOptions = {}
): Promise<any | null> {
  if (!domain || typeof domain !== 'string') {
    return null;
  }

  const normalizedDomain = domain.toLowerCase().trim();

  const domainEntry = await prisma.domainRegistry.findUnique({
    where: {
      domain: normalizedDomain,
    },
    include: {
      companyHQ: {
        select: {
          id: true,
          companyName: true,
          companyWebsite: true,
        },
      },
    },
  });

  if (domainEntry && options.updateLastSeen) {
    // Update lastSeen timestamp
    await prisma.domainRegistry.update({
      where: { id: domainEntry.id },
      data: { lastSeen: new Date() },
    });
  }

  return domainEntry;
}

/**
 * Register domain from email address
 * Infers domain from email and registers it
 * 
 * @param email - Email address (e.g., "joel@businesspointlaw.com")
 * @param options - Registration options
 * @returns DomainRegistry entry
 */
export async function registerDomainFromEmail(
  email: string,
  options: RegisterDomainOptions
): Promise<any> {
  const domain = inferDomainFromEmail(email);
  
  if (!domain) {
    throw new Error(`Could not infer domain from email: ${email}`);
  }

  return registerDomain(domain, options);
}

/**
 * Find CompanyHQ by email address
 * Infers domain from email and looks up CompanyHQ
 * 
 * @param email - Email address (e.g., "joel@businesspointlaw.com")
 * @param options - Find options
 * @returns DomainRegistry entry with CompanyHQ, or null if not found
 */
export async function findCompanyHQByEmail(
  email: string,
  options: FindDomainOptions = {}
): Promise<any | null> {
  const domain = inferDomainFromEmail(email);
  
  if (!domain) {
    return null;
  }

  return findCompanyHQByDomain(domain, options);
}

/**
 * Get all domains for a CompanyHQ
 * 
 * @param companyHqId - CompanyHQ ID
 * @returns Array of DomainRegistry entries
 */
export async function getDomainsForCompanyHQ(companyHqId: string): Promise<any[]> {
  return prisma.domainRegistry.findMany({
    where: {
      companyHqId,
    },
    orderBy: {
      confidenceScore: 'desc',
    },
    include: {
      companyHQ: {
        select: {
          id: true,
          companyName: true,
        },
      },
    },
  });
}

/**
 * Auto-register domain from CompanyHQ website
 * Extracts domain from companyWebsite and registers it
 * 
 * @param companyHqId - CompanyHQ ID
 * @returns DomainRegistry entry or null if no website
 */
export async function autoRegisterDomainFromWebsite(
  companyHqId: string
): Promise<any | null> {
  const companyHQ = await prisma.companyHQ.findUnique({
    where: { id: companyHqId },
    select: {
      id: true,
      companyName: true,
      companyWebsite: true,
    },
  });

  if (!companyHQ || !companyHQ.companyWebsite) {
    return null;
  }

  // Extract domain from website URL
  // e.g., "https://www.businesspointlaw.com" -> "businesspointlaw.com"
  const websiteUrl = companyHQ.companyWebsite;
  let domain = websiteUrl
    .replace(/^https?:\/\//, '') // Remove protocol
    .replace(/^www\./, '') // Remove www
    .split('/')[0] // Get domain part only
    .toLowerCase()
    .trim();

  // Remove port if present
  domain = domain.split(':')[0];

  if (!domain) {
    return null;
  }

  return registerDomain(domain, {
    companyHqId,
    normalizedName: companyHQ.companyName,
    confidenceScore: 1.0, // High confidence if from official website
  });
}

/**
 * Bulk register domains from contacts
 * Scans contacts for domains and registers them to their CompanyHQ
 * 
 * @param companyHqId - CompanyHQ ID to register domains for
 * @returns Array of registered DomainRegistry entries
 */
export async function bulkRegisterDomainsFromContacts(
  companyHqId: string
): Promise<any[]> {
  // Get all contacts for this CompanyHQ that have emails
  const contacts = await prisma.contact.findMany({
    where: {
      crmId: companyHqId,
      email: { not: null },
    },
    select: {
      email: true,
      domain: true,
    },
  });

  const registeredDomains: any[] = [];
  const seenDomains = new Set<string>();

  for (const contact of contacts) {
    if (!contact.email) continue;

    const domain = contact.domain || inferDomainFromEmail(contact.email);
    if (!domain || seenDomains.has(domain)) continue;

    seenDomains.add(domain);

    try {
      const domainEntry = await registerDomain(domain, {
        companyHqId,
        confidenceScore: 0.8, // Medium confidence from contact emails
      });
      registeredDomains.push(domainEntry);
    } catch (error) {
      console.warn(`Failed to register domain ${domain}:`, error);
    }
  }

  return registeredDomains;
}

