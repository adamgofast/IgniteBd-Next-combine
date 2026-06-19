/**
 * ContactAnalysisService
 * 
 * Generates meeting prep analysis for REAL contacts.
 * This is separate from personas - personas are hypothetical, this is for actual people.
 * 
 * Usage:
 *   const result = await ContactAnalysisService.generate({
 *     contactId: "contact_123",
 *     productId: "product_123", // Optional - for product-specific analysis
 *   });
 */

import { prisma } from '@/lib/prisma';
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

export interface ContactAnalysisOptions {
  contactId: string;
  productId?: string;
}

export interface ContactAnalysisJSON {
  fitScore: number;                    // 0-100
  painAlignmentScore: number;          // 0-100
  workflowFitScore: number;            // 0-100
  urgencyScore: number;                // 0-100
  adoptionBarrierScore: number;        // 0-100
  risks: string[];                     // Risks to consider
  opportunities: string[];             // Opportunities to leverage
  recommendedTalkTrack: string;        // How to speak with THIS person
  recommendedSequence: string | null;  // Outreach sequence (email → LinkedIn → call)
  recommendedLeadSource: string | null;
  finalSummary: string;                // Prep summary for meeting
}

export interface ContactAnalysisResult {
  success: boolean;
  analysis?: ContactAnalysisJSON;
  error?: string;
  details?: string;
}

export class ContactAnalysisService {
  /**
   * Generate contact analysis (meeting prep)
   */
  static async generate(options: ContactAnalysisOptions): Promise<ContactAnalysisResult> {
    try {
      const { contactId, productId } = options;

      // Step 1: Fetch contact with company data
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          companies: true,
        },
      });

      if (!contact) {
        return {
          success: false,
          error: 'Contact not found',
        };
      }

      // Step 2: Fetch product if provided
      let product: any = null;
      if (productId) {
        product = await prisma.products.findUnique({
          where: { id: productId },
          select: {
            id: true,
            name: true,
            description: true,
            valueProp: true,
            price: true,
            priceCurrency: true,
            features: true,
            competitiveAdvantages: true,
          },
        });
      }

      // Step 3: Fetch enrichment data if available
      let enrichmentData: any = null;
      if (contact.enrichmentRedisKey) {
        enrichmentData = await this.fetchEnrichmentData(contact.enrichmentRedisKey);
      }

      // Step 4: Build prompt
      const { systemPrompt, userPrompt } = this.buildAnalysisPrompt({
        contact,
        product,
        enrichmentData,
      });

      // Step 5: Call OpenAI
      console.log(`🤖 Generating contact analysis for ${contact.fullName || contact.email}...`);
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
      const analysis = this.parseAndNormalizeAnalysis(content);

      return {
        success: true,
        analysis,
      };
    } catch (error: any) {
      console.error('❌ ContactAnalysisService error:', error);
      return {
        success: false,
        error: 'Failed to generate contact analysis',
        details: error.message,
      };
    }
  }

  /**
   * Build analysis prompt
   */
  private static buildAnalysisPrompt(context: {
    contact: any;
    product: any | null;
    enrichmentData: any | null;
  }): { systemPrompt: string; userPrompt: string } {
    const { contact, product, enrichmentData } = context;

    const systemPrompt = `You are a senior BD strategist preparing for a meeting with a real contact.

Generate business development intelligence to help prepare for meeting with THIS PERSON.

Return EXACTLY this JSON structure:
{
  "fitScore": 0-100,              // Overall fit score
  "painAlignmentScore": 0-100,    // How well product addresses their pains
  "workflowFitScore": 0-100,      // Workflow compatibility
  "urgencyScore": 0-100,          // How urgent is their need
  "adoptionBarrierScore": 0-100,  // How hard would adoption be
  "risks": [],                    // Array of risks to consider
  "opportunities": [],            // Array of opportunities to leverage
  "recommendedTalkTrack": "",     // How to speak with THIS person (key output)
  "recommendedSequence": "",      // Outreach sequence (email → LinkedIn → call) - can be null
  "recommendedLeadSource": "",    // Where to find leads like this - can be null
  "finalSummary": ""              // Prep summary for meeting
}`;

    const contactContext = `Contact:
${JSON.stringify({
  name: contact.fullName || `${contact.firstName} ${contact.lastName}`,
  title: contact.title,
  seniority: contact.seniority,
  email: contact.email,
  company: contact.companyName,
  industry: contact.companyIndustry,
  companySize: contact.companySize,
  notes: contact.notes,
  painPoints: contact.painPoints,
  goals: contact.goals,
}, null, 2)}`;

    const productContext = product
      ? `Product:
${JSON.stringify({
  name: product.name,
  description: product.description,
  valueProp: product.valueProp,
  price: product.price,
  features: product.features,
  competitiveAdvantages: product.competitiveAdvantages,
}, null, 2)}`
      : 'No specific product provided - provide general BD intelligence';

    const enrichmentContext = enrichmentData
      ? `Enrichment Data:\n${JSON.stringify(enrichmentData, null, 2)}`
      : 'No enrichment data available';

    const userPrompt = `Generate meeting prep analysis for this contact.

${contactContext}

${productContext}

${enrichmentContext}

Focus on:
- How to speak with THIS specific person (recommendedTalkTrack is key)
- Their specific pain points and how to address them
- Meeting readiness and urgency
- Risks and opportunities specific to THIS contact
- Practical prep summary for the meeting

Return the complete analysis JSON structure.`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse and normalize analysis response
   */
  private static parseAndNormalizeAnalysis(content: string): ContactAnalysisJSON {
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

    const analysisData = parsed.analysis || parsed;

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

    // Normalize scores (0-100)
    const normalizeScore = (value: any, defaultValue: number = 50): number => {
      const num = typeof value === 'number' ? value : parseInt(value, 10);
      if (isNaN(num)) return defaultValue;
      return Math.max(0, Math.min(100, num));
    };

    return {
      fitScore: normalizeScore(analysisData.fitScore, 50),
      painAlignmentScore: normalizeScore(analysisData.painAlignmentScore, 50),
      workflowFitScore: normalizeScore(analysisData.workflowFitScore, 50),
      urgencyScore: normalizeScore(analysisData.urgencyScore, 50),
      adoptionBarrierScore: normalizeScore(analysisData.adoptionBarrierScore, 50),
      risks: normalizeArray(analysisData.risks),
      opportunities: normalizeArray(analysisData.opportunities),
      recommendedTalkTrack: analysisData.recommendedTalkTrack || '',
      recommendedSequence: analysisData.recommendedSequence || null,
      recommendedLeadSource: analysisData.recommendedLeadSource || null,
      finalSummary: analysisData.finalSummary || '',
    };
  }

  /**
   * Fetch enrichment data from Redis
   */
  private static async fetchEnrichmentData(redisKey: string): Promise<any | null> {
    try {
      const { getPreviewIntelligence } = await import('@/lib/redis');
      const previewData = await getPreviewIntelligence(redisKey);
      if (previewData?.rawEnrichmentPayload) {
        return previewData.rawEnrichmentPayload;
      }
    } catch (e) {
      // Continue to try other methods
    }

    try {
      const { getEnrichedContactByKey, getEnrichedContact } = await import('@/lib/redis');
      
      // Try direct Redis key
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
        const { getEnrichedContact } = await import('@/lib/redis');
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

