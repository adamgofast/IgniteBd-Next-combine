/**
 * PersonaGeneratorService
 * 
 * Simple persona generation service - helps clients think through who they're targeting.
 * This is a THINKING TOOL, not a complex system.
 * 
 * Returns simple JSON with ~10 fields:
 * - Who is this person? (personName, title, role, seniority)
 * - What do they want? (coreGoal, painPoints, needForOurProduct, potentialPitch)
 * - What company are they at? (industry, companySize, company)
 * 
 * Usage:
 *   const result = await PersonaGeneratorService.generate({
 *     contactId: "contact_123", // OR
 *     redisKey: "preview:123:abc", // OR
 *     description: "Enterprise CMO at SaaS company",
 *     companyHQId: "company_hq_123",
 *     productId: "product_123", // Required - used as context
 *     productDescription: "Our BD platform", // Fallback if no productId
 *   });
 */

import { prisma } from '@/lib/prisma';
import { getEnrichedContact, getEnrichedContactByKey } from '@/lib/redis';
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

export interface PersonaGeneratorOptions {
  contactId?: string;
  redisKey?: string;
  description?: string;
  companyHQId: string;
  productId?: string;
  productDescription?: string;
  notes?: string;
}

export interface PersonaJSON {
  // WHO IS THIS PERSON
  personName: string;
  title: string;
  role: string | null;
  seniority: string | null;
  
  // WHAT DO THEY WANT
  coreGoal: string;              // Their north star (regardless of our product)
  painPoints: string[];          // What problems do they have?
  needForOurProduct: string;     // Need for OUR PRODUCT assessment (key field!)
  potentialPitch: string | null; // How we would pitch (inferred)
  
  // WHAT COMPANY ARE THEY AT
  industry: string | null;
  companySize: string | null;
  company: string | null;        // Company type/archetype
}

export interface PersonaGeneratorResult {
  success: boolean;
  persona?: PersonaJSON;
  error?: string;
  details?: string;
}

export class PersonaGeneratorService {
  /**
   * Generate persona JSON (doesn't save to DB)
   */
  static async generate(options: PersonaGeneratorOptions): Promise<PersonaGeneratorResult> {
    try {
      const { contactId, redisKey, description, companyHQId, productId, productDescription, notes } = options;

      // Product context is helpful but not strictly required
      // If missing, we'll use a generic context in the prompt

      // Step 1: Fetch product (if productId provided)
      let product: any = null;
      if (productId) {
        product = await prisma.products.findUnique({
          where: { id: productId },
          select: {
            id: true,
            name: true,
            description: true,
            valueProp: true,
          },
        });

        if (!product) {
          return {
            success: false,
            error: 'Product not found',
          };
        }
      }

      // Step 2: Fetch CompanyHQ
      const companyHQ = await prisma.company_hqs.findUnique({
        where: { id: companyHQId },
        select: {
          id: true,
          companyName: true,
          companyIndustry: true,
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

      // Step 3: Fetch contact/enrichment data (if provided)
      let contactData: any = null;
      let apolloData: any = null;

      if (contactId) {
        contactData = await prisma.contact.findUnique({
          where: { id: contactId },
          include: {
            companies: true,
          },
        });

        if (contactData?.enrichmentRedisKey) {
          apolloData = await this.fetchApolloData(contactData.enrichmentRedisKey);
        }
      } else if (redisKey) {
        apolloData = await this.fetchApolloData(redisKey);
      }

      // Step 4: Build prompt
      const { systemPrompt, userPrompt } = this.buildPersonaPrompt({
        product,
        productDescription,
        companyHQ,
        contactData,
        apolloData,
        description,
        notes,
      });

      // Step 5: Call OpenAI
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

      // Step 6: Parse and normalize
      const persona = this.parseAndNormalizePersona(content);

      return {
        success: true,
        persona,
      };
    } catch (error: any) {
      console.error('❌ PersonaGeneratorService error:', error);
      return {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      };
    }
  }

  /**
   * Build persona prompt
   */
  private static buildPersonaPrompt(context: {
    product: any;
    productDescription?: string;
    companyHQ: any;
    contactData?: any;
    apolloData?: any;
    description?: string;
    notes?: string;
  }): { systemPrompt: string; userPrompt: string } {
    const { product, productDescription, companyHQ, contactData, apolloData, description, notes } = context;

    const systemPrompt = `You are a business persona inference engine. Your task is to infer a REUSABLE PERSONA MODEL from input signals. You are NOT preserving CRM data or mapping fields. You are creating an archetypal model that represents "who we are selling to" - not "who is in our database". Return only valid JSON. Never include markdown code blocks, explanations, or any text outside the JSON object.`;

    // Build input signals section (these are WEAK SIGNALS for inference, not outputs)
    let inputSignals = '';
    if (apolloData) {
      inputSignals = `=== INPUT SIGNALS (for inference only) ===
Enriched Contact Data: ${JSON.stringify(apolloData, null, 2)}`;
    } else if (contactData) {
      const fullName = `${contactData.firstName || ''} ${contactData.lastName || ''}`.trim();
      inputSignals = `=== INPUT SIGNALS (for inference only) ===
Contact Name: ${fullName || 'Not specified'}
Contact Title: ${contactData.title || 'Not specified'}
Contact Company: ${contactData.companyName || contactData.companies?.companyName || 'Not specified'}
Contact Industry: ${contactData.companyIndustry || contactData.companies?.industry || 'Not specified'}`;
    } else if (description) {
      inputSignals = `=== INPUT SIGNAL (for inference only) ===
Description: ${description}`;
    }

    // Company context (also a signal, not output)
    const companyHQName = companyHQ.companyName || 'Not specified';
    const companyHQIndustry = companyHQ.companyIndustry || 'Not specified';
    const companyHQWhatYouDo = companyHQ.whatYouDo || 'Not specified';

    // Product context (for product-specific inference)
    const productContext = product
      ? `=== PRODUCT CONTEXT ===
Product Name: ${product.name}
Description: ${product.description || 'Not specified'}
Value Prop: ${product.valueProp || 'Not specified'}`
      : productDescription
      ? `=== PRODUCT CONTEXT ===
Product Description: ${productDescription}`
      : '';

    const userPrompt = `You are inferring a REUSABLE PERSONA MODEL. This is NOT CRM hydration and NOT data preservation.

=== AUTHORITATIVE CONCEPT ===

We are inferring a REUSABLE PERSONA MODEL.

The persona should still make sense if:
- the person changes jobs
- the company name changes  
- the specific contact disappears

If the output resembles a real individual or exact employer, the persona is WRONG.

=== INPUT SIGNALS (for inference only) ===

CRM Context:
Company: ${companyHQName}
Industry: ${companyHQIndustry}
What We Do: ${companyHQWhatYouDo}

${productContext ? `${productContext}\n` : ''}

${inputSignals ? `${inputSignals}\n` : ''}

${notes ? `Additional Notes: ${notes}\n` : ''}

=== RULES (NON-NEGOTIABLE) ===

1. Contact name, exact title, and exact company name are NEVER the goal.
   These fields exist ONLY to infer:
   - role archetype
   - company TYPE
   - industry
   - goals
   - pain points
   - product needs

2. Literal reuse is allowed ONLY if it is already archetypal. Otherwise, GENERALIZE.

   Examples of generalization:
   - "Group Chief Compliance Officer" → "Chief Compliance Officer"
   - "Gemcorp Capital" → "Global Asset Management Firm"
   - "VP, Legal & Compliance" → "Compliance Leader"
   - "John Smith" → NEVER use real names
   - "Acme Corp" → "Mid-size B2B SaaS Company"

3. OUTPUT IS A MODEL, NOT A RECORD

   This output should feel like:
   "Who we are selling to"
   
   NOT
   "Who is in our database"

4. THINKING MODE

   Treat LinkedIn titles, company info, and CRM fields as WEAK SIGNALS.
   Infer intent, responsibility, pressure, and incentives.
   
   If the output looks like it belongs on LinkedIn or in Salesforce, you FAILED.
   If it looks like a slide titled "Target Persona: Compliance Leader at Asset Managers", you SUCCEEDED.

=== OUTPUT FORMAT ===

CRITICAL: Return ONLY valid JSON in this exact format:
{
  "personName": "string",          // role archetype (never a real title string, never a person's name)
  "title": "string",               // simplified / generalized role (NOT literal title)
  "companyType": "string",         // abstracted company description (NOT literal company name)
  "companySize": "string",         // company size range (e.g., "1-10", "11-50", "51-200", "200-1000", "1000+")
  "industry": "string",            // broad industry classification
  "coreGoal": "string",            // one sentence, maximum ~25 words
  "painPoints": ["string"],        // 3–5 inferred pains (array of strings)
  "whatProductNeeds": "string",   // one sentence describing what product/service they need
  "role": "string",                // Optional - Additional role context - can be null
  "seniority": "string",           // Optional - Seniority level - can be null
  "potentialPitch": "string"       // Optional - How we would pitch - can be null
}

=== FIELD REQUIREMENTS ===

1. **personName**: Role archetype label. NEVER a real person's name. NEVER a literal job title. 
   Examples: "Compliance Leader", "Operations Director", "Sales Executive", "Legal Counsel"
   BAD: "John Smith", "Deputy Counsel", "VP of Sales at Acme"

2. **title**: Simplified/generalized role. Generalize from input signals. Remove company-specific details.
   Examples: "Chief Compliance Officer", "Operations Director", "Sales Leader"
   BAD: "Group Chief Compliance Officer at Gemcorp Capital", "VP of Sales at Acme Corp"

3. **companyType**: Abstracted company description. NEVER use literal company names.
   Examples: "Global Asset Management Firm", "Mid-size B2B SaaS Company", "Enterprise Software Provider"
   BAD: "Gemcorp Capital", "Acme Corp", "TechCorp"

4. **companySize**: Company size range. Infer from input signals or use standard ranges.
   Examples: "1-10", "11-50", "51-200", "200-1000", "1000+", "Enterprise (1000+)"
   Use ranges, not specific numbers. Infer from company type and industry context.

5. **industry**: Broad industry classification. Use standard industry categories.
   Examples: "Asset Management", "Enterprise Software", "Financial Services", "Healthcare Technology"

6. **coreGoal**: One sentence describing their primary objective. Maximum ~25 words. NO bullet points, NO semicolons.

7. **painPoints**: Array of 3–5 inferred pain points. Each should be a complete sentence or phrase.
   Infer from role, industry, and company type - not from literal contact data.
   ${product ? 'Focus on pain points that our product can solve.' : ''}

8. **whatProductNeeds**: One sentence describing what product/service they need based on their role and pain points.
   ${product ? `Infer what they need from OUR PRODUCT specifically: ${product.name}` : 'Infer general product needs from their role and pain points.'}

9. **role**: Optional - Additional role context beyond title. Can be null.

10. **seniority**: Optional - Seniority level (e.g., "C-Level", "Director", "VP"). Can be null.

11. **potentialPitch**: Optional - How we would pitch to them (inferred from pain points + needs). Can be null.
    ${product ? `Infer how we would pitch OUR PRODUCT: ${product.name}` : ''}

CRITICAL: Return ONLY the JSON object. Do not include markdown code blocks, explanations, or any text outside the JSON object.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse and normalize persona response
   */
  private static parseAndNormalizePersona(content: string): PersonaJSON {
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

    const personaData = parsed.persona || parsed;

    // Map new format fields to PersonaJSON format
    // companyType -> company, whatProductNeeds -> needForOurProduct
    return {
      personName: personaData.personName || '',
      title: personaData.title || '',
      role: personaData.role || null,
      seniority: personaData.seniority || null,
      coreGoal: personaData.coreGoal || '',
      painPoints: normalizeArray(personaData.painPoints),
      needForOurProduct: personaData.whatProductNeeds || personaData.needForOurProduct || '', // Support both formats
      potentialPitch: personaData.potentialPitch || null,
      industry: personaData.industry || null,
      companySize: personaData.companySize || null,
      company: personaData.companyType || personaData.company || null, // Support both formats (companyType is new)
    };
  }

  /**
   * Fetch Apollo data from Redis
   */
  private static async fetchApolloData(redisKey: string): Promise<any | null> {
    // Try preview intelligence first
    if (redisKey.startsWith('preview:')) {
      try {
        const { getPreviewIntelligence } = await import('@/lib/redis');
        const previewData = await getPreviewIntelligence(redisKey);
        if (previewData?.rawEnrichmentPayload) {
          return previewData.rawEnrichmentPayload;
        }
      } catch (e) {
        // Continue to try other methods
      }
    }

    // Try direct Redis key
    try {
      const data = await getEnrichedContactByKey(redisKey);
      if (data?.rawEnrichmentPayload) {
        return data.rawEnrichmentPayload;
      }
      if (data?.enrichedData?.rawApolloResponse) {
        return data.enrichedData.rawApolloResponse;
      }
      return data;
    } catch (e) {
      // Try as LinkedIn URL
      try {
        const data = await getEnrichedContact(redisKey);
        if (data?.enrichedData?.rawApolloResponse) {
          return data.enrichedData.rawApolloResponse;
        }
        if (data?.enrichedData?.enrichedProfile) {
          return data.enrichedData.enrichedProfile;
        }
        return data;
      } catch (e) {
        return null;
      }
    }
  }
}

