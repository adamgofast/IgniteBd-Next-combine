/**
 * EnrichmentToPersonaService
 * 
 * Generates a Persona from enriched Apollo contact data.
 * 
 * This is the natural next step after contact enrichment:
 * 1. User enriches contact (Apollo) → saves to contact
 * 2. Success modal → "Start Persona Flow" button
 * 3. Persona builder → calls this service to generate persona from enriched contact
 * 
 * ProductFit and BdIntel are generated separately later (when viewing/editing persona).
 * 
 * Usage:
 *   const result = await EnrichmentToPersonaService.run({
 *     redisKey: "preview:123:abc", // or "apollo:enriched:https://linkedin.com/..." or contactId
 *     companyHQId: "company_hq_123",
 *     mode: "save" | "hydrate"
 *   });
 */

import { prisma } from '@/lib/prisma';
import { getPreviewIntelligence, getEnrichedContactByKey, getEnrichedContact } from '@/lib/redis';
import { OpenAI } from 'openai';

// Initialize OpenAI client
let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not configured');
  }

  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface EnrichmentToPersonaOptions {
  redisKey?: string; // Preview ID or Redis key with Apollo data
  contactId?: string; // Contact ID (alternative to redisKey)
  companyHQId: string;
  mode: 'hydrate' | 'save'; // 'hydrate' = return data only, 'save' = persist to DB
  notes?: string; // Optional freeform human notes
}

export interface EnrichmentToPersonaResult {
  success: boolean;
  persona?: any;
  error?: string;
  details?: string;
}

export class EnrichmentToPersonaService {
  /**
   * Main entry point - runs the complete pipeline
   */
  static async run(options: EnrichmentToPersonaOptions): Promise<EnrichmentToPersonaResult> {
    try {
      const { redisKey, contactId, companyHQId, mode, notes } = options;

      // Step 1: Fetch Apollo data from Redis or Contact
      let apolloData: any = null;
      let contactData: any = null;

      if (contactId) {
        console.log('🔍 Fetching contact:', contactId);
        contactData = await prisma.contact.findUnique({
          where: { id: contactId },
          include: {
            companies: true, // Company relation via contactCompanyId
          },
        });

        if (!contactData) {
          return {
            success: false,
            error: 'Contact not found',
          };
        }

        // Try to get Apollo data from Redis if available
        // Check if contact has enrichment data stored
        if (contactData.enrichmentRedisKey) {
          apolloData = await this.fetchApolloData(contactData.enrichmentRedisKey);
        }
      } else if (redisKey) {
        console.log('🔍 Fetching Apollo data from Redis:', redisKey);
        apolloData = await this.fetchApolloData(redisKey);
      } else {
        return {
          success: false,
          error: 'Either redisKey or contactId is required',
        };
      }

      // If no Apollo data but we have contact, use contact data as fallback
      if (!apolloData && contactData) {
        // Map Company object to Apollo organization format
        const organization = contactData.companies
          ? {
              name: contactData.companies.companyName,
              industry: contactData.companies.industry || null,
            }
          : {
              name: contactData.companyName,
              industry: contactData.companyIndustry,
            };

        apolloData = {
          person: {
            first_name: contactData.firstName,
            last_name: contactData.lastName,
            title: contactData.title,
            headline: contactData.title,
            employment_history: contactData.careerTimeline || [],
          },
          organization,
        };
      }

      if (!apolloData) {
        return {
          success: false,
          error: 'Unable to generate persona: contact data is insufficient. Please ensure the contact has at least a name or title.',
        };
      }

      // Step 2: Fetch CompanyHQ
      console.log('🔍 Fetching CompanyHQ:', companyHQId);
      const companyHQ = await prisma.companyHQ.findUnique({
        where: { id: companyHQId },
        select: {
          id: true,
          companyName: true,
          companyIndustry: true,
          companyAnnualRev: true,
          whatYouDo: true,
          teamSize: true,
        },
      });

      if (!companyHQ) {
        return {
          success: false,
          error: 'CompanyHQ not found',
        };
      }

      // Step 3: Build persona prompt
      console.log('🤖 Building persona prompt...');
      const { systemPrompt, userPrompt } = this.buildPersonaPrompt(
        apolloData,
        companyHQ,
        contactData,
        notes
      );

      // Step 4: Call OpenAI
      console.log('🤖 Calling OpenAI for persona generation...');
      const openai = getOpenAIClient();
      const model = process.env.OPENAI_MODEL || 'gpt-4o';

      const completion = await openai.chat.completions.create({
        model,
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
      });

      const content = completion.choices?.[0]?.message?.content;
      if (!content) {
        return {
          success: false,
          error: 'No GPT output received',
        };
      }

      // Step 5: Parse and normalize response
      console.log('📦 Parsing GPT response...');
      const persona = this.parseAndNormalizePersona(content);

      // Step 6: Save to database if mode is "save"
      if (mode === 'save') {
        console.log('💾 Saving persona to database...');
        const saved = await this.savePersonaToDatabase(persona, companyHQId);
        return {
          success: true,
          persona: saved,
        };
      } else {
        // Mode: hydrate - return data only
        return {
          success: true,
          persona,
        };
      }
    } catch (error: any) {
      console.error('❌ EnrichmentToPersonaService error:', error);
      return {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      };
    }
  }

  /**
   * Fetch Apollo data from Redis
   * Handles both previewId format and direct Redis keys
   */
  private static async fetchApolloData(redisKey: string): Promise<any | null> {
    // Try preview intelligence first (from generate-intel endpoint)
    if (redisKey.startsWith('preview:')) {
      const previewData = await getPreviewIntelligence(redisKey);
      if (previewData?.rawEnrichmentPayload) {
        return previewData.rawEnrichmentPayload;
      }
      // If preview has normalized data, extract raw Apollo from redisKey
      if (previewData?.redisKey) {
        const rawData = await getEnrichedContactByKey(previewData.redisKey);
        return rawData?.rawEnrichmentPayload || rawData;
      }
    }

    // Try direct Redis key
    if (redisKey.startsWith('apollo:')) {
      const data = await getEnrichedContactByKey(redisKey);
      if (data?.rawEnrichmentPayload) {
        return data.rawEnrichmentPayload;
      }
      if (data?.enrichedData?.rawApolloResponse) {
        return data.enrichedData.rawApolloResponse;
      }
      return data;
    }

    // Try as LinkedIn URL
    const data = await getEnrichedContact(redisKey);
    if (data?.enrichedData?.rawApolloResponse) {
      return data.enrichedData.rawApolloResponse;
    }
    if (data?.enrichedData?.enrichedProfile) {
      return data.enrichedData.enrichedProfile;
    }

    return data;
  }

  /**
   * Build persona prompt
   */
  private static buildPersonaPrompt(
    apollo: any,
    companyHQ: any,
    contactData?: any,
    notes?: string
  ): { systemPrompt: string; userPrompt: string } {
    const systemPrompt = `You are an expert in executive psychology and business persona modeling.

You take:
1. A deeply enriched Apollo person profile (raw JSON)
2. A CompanyHQ record (company context)
3. Optional contact data from database
4. Optional freeform human notes

Your task is to infer a detailed Persona model.

🔥 PERSONA RULES — DO NOT VIOLATE:

1. Do NOT use the real contact's name. Ever.
2. Do NOT use the real company name. Ever.
3. Do NOT include a biography or life story.
4. Generalize the company into a company archetype (e.g., "mid-large asset manager", "small B2B SaaS firm", "solo consultant").
5. Generalize the person's role into a role archetype (e.g., "Private Credit Director", "Enterprise Sales Leader", "Operations Manager").
6. Company size must be a RANGE (e.g., 1–10, 11–50, 51–200, 200–1000, 1000–10000).
7. Titles should be role-based, not person-based.
8. Persona Name must be a role + context, NEVER an individual's name.
9. Description should describe the archetype, not the person.
10. All insights must reflect the role archetype, industry, and company type — not personal specifics.

Infer ALL fields, even when not explicitly stated:
- Interpret job title as self-identity (but generalize to role archetype)
- Interpret company context as environmental constraints (but generalize to company type)
- Infer domain (credit, ops, finance, strategy, etc.)
- Infer behavior, psychology, decision drivers, risks, and triggers
- Use CompanyHQ industry + size + revenue to contextualize pains
- Use Apollo title + headline to infer operational role (but generalize)

When uncertain, infer the MOST LIKELY value based on industry norms.
Never leave fields empty unless explicitly allowed.

Return EXACTLY this JSON structure:
{
  "personName": "",
  "title": "",
  "headline": "",
  "seniority": "",
  "industry": "",
  "subIndustries": [],
  "company": "",
  "companySize": "",
  "annualRevenue": "",
  "location": "",
  "description": "",
  "whatTheyWant": "",
  "painPoints": [],
  "risks": [],
  "decisionDrivers": [],
  "buyerTriggers": []
}`;

    const userPrompt = `Here is the contact data. Use it ONLY to infer the role and company archetype.

🔥 CRITICAL: Do NOT output the person's name. Do NOT output the real company. Do NOT output any personally identifying details. Generalize everything into role and company type.

APOLLO PROFILE:
${JSON.stringify(apollo, null, 2)}

COMPANY HQ CONTEXT:
${JSON.stringify(companyHQ, null, 2)}

${contactData ? `CONTACT DATA:\n${JSON.stringify({
  firstName: contactData.firstName,
  lastName: contactData.lastName,
  title: contactData.title,
  email: contactData.email,
  companyName: contactData.companyName,
  companyIndustry: contactData.companyIndustry,
  profileSummary: contactData.profileSummary,
  notes: contactData.notes,
}, null, 2)}\n` : ''}

${notes ? `HUMAN NOTES:\n${notes}\n` : ''}

Generate a persona that represents the ROLE ARCHETYPE and COMPANY TYPE, not the specific individual or company. Return the complete persona JSON structure.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse and normalize persona response
   */
  private static parseAndNormalizePersona(content: string): any {
    let parsed;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Normalize arrays
    const normalizeArray = (value: any): string[] => {
      if (!value) return [];
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [value];
        } catch {
          return value.split('\n').filter(Boolean);
        }
      }
      return [];
    };

    // Normalize persona (handle both direct persona object and nested structure)
    const personaData = parsed.persona || parsed;
    
    return {
      personName: personaData.personName || '',
      title: personaData.title || '',
      headline: personaData.headline || null,
      seniority: personaData.seniority || null,
      industry: personaData.industry || null,
      subIndustries: normalizeArray(personaData.subIndustries),
      company: personaData.company || null,
      companySize: personaData.companySize || null,
      annualRevenue: personaData.annualRevenue || null,
      location: personaData.location || null,
      description: personaData.description || null,
      whatTheyWant: personaData.whatTheyWant || null,
      painPoints: normalizeArray(personaData.painPoints),
      risks: normalizeArray(personaData.risks),
      decisionDrivers: normalizeArray(personaData.decisionDrivers),
      buyerTriggers: normalizeArray(personaData.buyerTriggers),
    };
  }

  /**
   * Save persona to database
   */
  private static async savePersonaToDatabase(
    persona: any,
    companyHQId: string
  ): Promise<any> {
    // Validate required fields
    if (!persona.personName || !persona.title) {
      throw new Error('Persona personName and title are required');
    }

    // Create Persona
    const saved = await prisma.personas.create({
      data: {
        companyHQId,
        personName: persona.personName,
        title: persona.title,
        headline: persona.headline,
        seniority: persona.seniority,
        industry: persona.industry,
        subIndustries: persona.subIndustries,
        company: persona.company,
        companySize: persona.companySize,
        annualRevenue: persona.annualRevenue,
        location: persona.location,
        description: persona.description,
        whatTheyWant: persona.whatTheyWant,
        painPoints: persona.painPoints,
        risks: persona.risks,
        decisionDrivers: persona.decisionDrivers,
        buyerTriggers: persona.buyerTriggers,
      },
      include: {
        product_fits: true,
        bd_intels: true,
      },
    });

    console.log(`✅ Persona created: ${saved.id}`);

    return saved;
  }
}

