/**
 * PersonaPromptPrepService
 * 
 * SIMPLE DATA HYDRATION - NO BUSINESS LOGIC
 * 
 * Fetches raw database records for persona generation:
 * - CompanyHQ record (CRM context)
 * - Contact record (the person)
 * - Contact's Company record (if exists)
 * 
 * Returns full records as JSON. No reshaping, no inference, no normalization.
 */

import { prisma } from '@/lib/prisma';

export interface PreparedData {
  contact: any; // Full Contact record as JSON
  contactCompany: any | null; // Full Company record as JSON (if exists)
  companyHQ: any; // Full CompanyHQ record as JSON
}

export class PersonaPromptPrepService {
  /**
   * Hydrate raw database records for persona generation
   * 
   * @param contactId - Contact ID
   * @param companyHQId - CompanyHQ ID (CRM context)
   * @returns Full records as JSON
   */
  static async prepare(params: {
    contactId: string;
    companyHQId: string;
  }): Promise<{
    success: boolean;
    data?: PreparedData;
    error?: string;
  }> {
    // TEMPORARY: Service execution log
    console.log('🧠 SERVICE EXECUTED', {
      time: new Date().toISOString(),
      random: Math.random(),
    });
    
    try {
      const { contactId, companyHQId } = params;

      // Input validation
      if (!contactId || typeof contactId !== 'string' || contactId.trim() === '') {
        return { success: false, error: 'contactId is required and must be a non-empty string' };
      }

      if (!companyHQId || typeof companyHQId !== 'string' || companyHQId.trim() === '') {
        return { success: false, error: 'companyHQId is required and must be a non-empty string' };
      }

      if (!prisma) {
        return { success: false, error: 'Database connection not available' };
      }

      // Fetch CompanyHQ (CRM context)
      const companyHQ = await prisma.company_hqs.findUnique({
        where: { id: companyHQId.trim() },
      });

      if (!companyHQ) {
        return { success: false, error: 'CompanyHQ not found' };
      }

      // Fetch Contact
      const contact = await prisma.contact.findUnique({
        where: { id: contactId.trim() },
      });

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      // Verify contact belongs to same company context (crmId ↔ companyHQId)
      if (contact.crmId !== companyHQId.trim()) {
        return { success: false, error: 'Contact does not belong to this company context' };
      }

      // Fetch Contact's Company (if contactCompanyId exists)
      let contactCompany = null;
      if (contact.contactCompanyId) {
        contactCompany = await prisma.companies.findUnique({
          where: { id: contact.contactCompanyId },
        });
        // Return null explicitly if not found (don't fail)
      }

      // Return full records as JSON
      return {
        success: true,
        data: {
          contact: contact as any, // Full Contact record
          contactCompany: contactCompany as any | null, // Full Company record or null
          companyHQ: companyHQ as any, // Full CompanyHQ record
        },
      };
    } catch (error: any) {
      console.error('❌ PersonaPromptPrepService error:', error);
      
      // Prisma-specific errors
      if (error.code === 'P2025') {
        return { success: false, error: 'Record not found' };
      }
      
      return {
        success: false,
        error: error.message || 'Failed to prepare persona data',
      };
    }
  }
}
