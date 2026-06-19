/**
 * PersonaSaveMapper
 * 
 * Maps parsed persona data from AI response to database schema format
 * Transforms inference-based persona model to Prisma personas model
 */

import { MinimalPersonaJSON } from './PersonaParsingService';

/**
 * Database schema format (matches Prisma personas model)
 */
export interface PersonaDatabaseFormat {
  personName: string;
  title: string;
  company: string | null;
  industry: string | null;
  coreGoal: string | null;
  needForOurProduct: string | null;
  painPoints: string[];
  // Optional fields that can be set later
  headline?: string | null;
  seniority?: string | null;
  role?: string | null;
  subIndustries?: string[];
  companySize?: string | null;
  annualRevenue?: string | null;
  location?: string | null;
  description?: string | null;
  whatTheyWant?: string | null;
  potentialPitch?: string | null;
  risks?: string[];
  decisionDrivers?: string[];
  buyerTriggers?: string[];
}

export class PersonaSaveMapper {
  /**
   * Map parsed persona JSON to database format
   * Maps from inference-based format to Prisma schema format
   */
  static mapToDatabase(parsed: MinimalPersonaJSON): PersonaDatabaseFormat {
    return {
      personName: parsed.personName,
      title: parsed.title,
      company: parsed.companyType, // companyType -> company
      companySize: parsed.companySize, // companySize from parsed data
      industry: parsed.industry,
      coreGoal: parsed.coreGoal,
      needForOurProduct: parsed.whatProductNeeds, // whatProductNeeds -> needForOurProduct
      painPoints: parsed.painPoints,
      // Optional fields default to null/empty
      headline: null,
      seniority: null,
      role: null,
      subIndustries: [],
      annualRevenue: null,
      location: null,
      description: null,
      whatTheyWant: null,
      potentialPitch: null,
      risks: [],
      decisionDrivers: [],
      buyerTriggers: [],
    };
  }
}

