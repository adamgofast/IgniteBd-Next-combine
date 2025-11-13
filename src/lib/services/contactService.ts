/**
 * Contact Upsert Service
 * 
 * Provides upsert functionality for Contacts with automatic domain inference
 * and optional CompanyHQ association via domain matching
 */

import { prisma } from '@/lib/prisma';
import { inferDomainFromEmail } from '@/lib/utils/inferDomain';
import {
  findCompanyHQByEmail,
  registerDomain,
} from '@/lib/services/domainRegistryService';

interface UpsertContactData {
  email: string;
  firstName?: string | null;
  lastName?: string | null;
  goesBy?: string | null;
  phone?: string | null;
  title?: string | null;
  contactCompanyId?: string | null;
  buyerDecision?: string | null;
  howMet?: string | null;
  notes?: string | null;
  contactListId?: string | null;
  companyName?: string | null;
  enrichmentSource?: string | null;
  enrichmentFetchedAt?: Date | null;
  enrichmentPayload?: any;
  createdById?: string | null;
  crmId?: string; // CompanyHQId (tenant identifier)
}

interface UpsertContactOptions {
  /**
   * If true, attempts to find and associate CompanyHQ by domain match
   * Looks for CompanyHQ where companyWebsite contains the domain
   */
  associateCompanyHQ?: boolean;
  
  /**
   * Required CompanyHQId (tenant identifier)
   * If not provided, will try to infer from domain if associateCompanyHQ is true
   */
  companyHQId?: string;
}

/**
 * Upsert a contact with automatic domain inference from email
 * 
 * @param email - Contact email address (required)
 * @param data - Additional contact data (optional)
 * @param options - Upsert options (optional)
 * @returns Hydrated contact record with relations
 */
export async function upsertContactWithDomain(
  email: string,
  data?: Partial<UpsertContactData>,
  options: UpsertContactOptions = {}
): Promise<any> {
  if (!email || typeof email !== 'string') {
    throw new Error('Email is required for contact upsert');
  }

  // Normalize email
  const normalizedEmail = email.toLowerCase().trim();
  
  // Infer domain from email
  const domain = inferDomainFromEmail(normalizedEmail);
  
  // Determine CompanyHQId (crmId)
  let crmId = data?.crmId || options.companyHQId;
  
  // If associateCompanyHQ is enabled and no crmId provided, try to find by domain via Domain Registry
  if (options.associateCompanyHQ && !crmId && domain) {
    const domainEntry = await findCompanyHQByEmail(normalizedEmail, { updateLastSeen: true });
    
    if (domainEntry?.companyHQ) {
      crmId = domainEntry.companyHQ.id;
    }
  }
  
  if (!crmId) {
    throw new Error('CompanyHQId (crmId) is required. Provide it in data.crmId or options.companyHQId');
  }

  // Auto-register domain in Domain Registry if we have domain and crmId
  if (domain && crmId) {
    try {
      await registerDomain(domain, {
        companyHqId: crmId,
        normalizedName: data?.companyName || null,
        confidenceScore: data?.crmId ? 1.0 : 0.8, // Higher confidence if explicitly provided
      });
    } catch (error) {
      // Log but don't fail - domain registration is optional
      console.warn(`⚠️ Failed to register domain ${domain} for CompanyHQ ${crmId}:`, error);
    }
  }

  // Prepare upsert data
  const upsertData: any = {
    email: normalizedEmail,
    domain,
    firstName: data?.firstName || null,
    lastName: data?.lastName || null,
    goesBy: data?.goesBy || null,
    phone: data?.phone || null,
    title: data?.title || null,
    contactCompanyId: data?.contactCompanyId || null,
    buyerDecision: data?.buyerDecision || null,
    howMet: data?.howMet || null,
    notes: data?.notes || null,
    contactListId: data?.contactListId || null,
    companyName: data?.companyName || null,
    enrichmentSource: data?.enrichmentSource || null,
    enrichmentFetchedAt: data?.enrichmentFetchedAt || null,
    enrichmentPayload: data?.enrichmentPayload || null,
    createdById: data?.createdById || null,
    crmId,
  };

  // Upsert contact (create or update by email)
  const { crmId: _, ...updateData } = upsertData; // Remove crmId from update data
  
  const contact = await prisma.contact.upsert({
    where: {
      email: normalizedEmail,
    },
    update: {
      // Update all fields except crmId (tenant identifier shouldn't change on existing contacts)
      ...updateData,
    },
    create: upsertData,
    include: {
      contactCompany: {
        select: {
          id: true,
          companyName: true,
        },
      },
      companyHQ: {
        select: {
          id: true,
          companyName: true,
          companyWebsite: true,
        },
      },
      pipeline: {
        select: {
          pipeline: true,
          stage: true,
        },
      },
    },
  });

  return contact;
}

/**
 * Batch upsert multiple contacts with domain inference
 * 
 * @param contacts - Array of contact data objects (must include email)
 * @param options - Upsert options applied to all contacts
 * @returns Array of upserted contacts
 */
export async function batchUpsertContactsWithDomain(
  contacts: Array<{ email: string } & Partial<UpsertContactData>>,
  options: UpsertContactOptions = {}
): Promise<any[]> {
  const results = await Promise.allSettled(
    contacts.map((contact) =>
      upsertContactWithDomain(contact.email, contact, options)
    )
  );

  const successful: any[] = [];
  const failed: Array<{ email: string; error: string }> = [];

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      successful.push(result.value);
    } else {
      failed.push({
        email: contacts[index].email,
        error: result.reason?.message || 'Unknown error',
      });
    }
  });

  if (failed.length > 0) {
    console.warn('⚠️ Some contacts failed to upsert:', failed);
  }

  return successful;
}

