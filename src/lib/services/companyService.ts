/**
 * Company Service
 * 
 * Handles universal company record management
 * Companies are matched by domain - all contacts with same domain point to same Company
 */

import { prisma } from '@/lib/prisma';

/**
 * Find or create Company by domain
 * 
 * Universal company records - all contacts with same domain point to same Company
 * 
 * @param domain - Company domain (e.g., "example.com")
 * @param companyHQId - Tenant identifier
 * @param companyName - Optional company name (used if creating new)
 * @returns Company record
 */
export async function findOrCreateCompanyByDomain(
  domain: string,
  companyHQId: string,
  companyName?: string
): Promise<any> {
  if (!domain) {
    return null;
  }

  // Normalize domain
  const normalizedDomain = domain.toLowerCase().trim().replace(/^www\./, '');

  // Try to find existing company by domain (domain is globally unique, so use findUnique)
  let existingCompany = null;
  try {
    existingCompany = await prisma.companies.findUnique({
      where: {
        domain: normalizedDomain,
      },
    });
    
    // If found, verify it's in the same tenant
    if (existingCompany && existingCompany.companyHQId === companyHQId) {
      return existingCompany;
    } else if (existingCompany) {
      // Domain exists in a different tenant - this is a conflict
      // Return null or throw? For now, return null to let caller handle
      console.warn(`⚠️ Domain ${normalizedDomain} exists in different tenant (${existingCompany.companyHQId} vs ${companyHQId})`);
      return null;
    }
  } catch (error) {
    // findUnique throws P2025 if not found, which is fine
    if (error.code !== 'P2025') {
      throw error;
    }
  }

  // Create new company
  const { randomUUID } = await import('crypto');
  const companyId = randomUUID();
  
  try {
    const newCompany = await prisma.companies.create({
      data: {
        id: companyId,
        companyHQId,
        companyName: companyName || 'Unknown Company',
        domain: normalizedDomain,
        updatedAt: new Date(),
      },
    });

    console.log(`✅ Created universal company record: ${newCompany.companyName} (${normalizedDomain})`);
    return newCompany;
  } catch (createError: any) {
    // Handle domain uniqueness violation
    if (createError.code === 'P2002' && createError.meta?.target?.includes('domain')) {
      console.warn(`⚠️ Domain ${normalizedDomain} already exists, attempting to find...`);
      // Try to find the existing company by domain
      try {
        const existing = await prisma.companies.findUnique({
          where: { domain: normalizedDomain },
        });
        if (existing) {
          // Check if it's in the same tenant
          if (existing.companyHQId === companyHQId) {
            console.log(`✅ Found existing company by domain: ${existing.companyName} (${normalizedDomain})`);
            return existing;
          } else {
            console.warn(`⚠️ Domain ${normalizedDomain} exists in different tenant`);
            return null;
          }
        }
      } catch (findError) {
        // If we can't find it, re-throw the original error
        throw createError;
      }
    }
    throw createError;
  }
}

/**
 * Find Company by domain (does not create)
 */
export async function findCompanyByDomain(
  domain: string,
  companyHQId: string
): Promise<any | null> {
  if (!domain) {
    return null;
  }

  const normalizedDomain = domain.toLowerCase().trim().replace(/^www\./, '');

  // Domain is globally unique, so use findUnique
  try {
    const company = await prisma.companies.findUnique({
      where: {
        domain: normalizedDomain,
      },
    });
    
    // Verify it's in the same tenant
    if (company && company.companyHQId === companyHQId) {
      return company;
    }
    return null;
  } catch (error) {
    // findUnique throws P2025 if not found
    if (error.code === 'P2025') {
      return null;
    }
    throw error;
  }
}

