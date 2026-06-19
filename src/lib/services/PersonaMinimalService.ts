/**
 * PersonaMinimalService
 * 
 * MVP1: Generate minimal persona (who they are, what company, core goal)
 * No product complexity, no deep dives - just the essentials
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

interface MinimalPersonaJSON {
  personName: string;  // e.g., "Compliance Manager"
  title: string;       // e.g., "Deputy Counsel"
  company: string;     // e.g., "X Firm"
  coreGoal: string;    // Their north star
}

interface GenerateParams {
  contactId?: string;
  contactData?: {
    firstName?: string;
    lastName?: string;
    title?: string;
    companyName?: string;
    companyIndustry?: string;
    fullName?: string;
  };
  companyHQId: string;
  description?: string;
}

export class PersonaMinimalService {
  /**
   * Generate minimal persona (MVP1)
   */
  static async generate(params: GenerateParams): Promise<{
    success: boolean;
    persona?: MinimalPersonaJSON;
    error?: string;
  }> {
    try {
      const { contactId, contactData: providedContactData, companyHQId, description } = params;

      // Ensure prisma is initialized
      if (!prisma) {
        console.error('❌ PersonaMinimalService: Prisma client is not initialized');
        return { success: false, error: 'Database connection not available' };
      }

      // Fetch company context
      const companyHQ = await prisma.companyHQ.findUnique({
        where: { id: companyHQId },
        select: {
          companyName: true,
          companyIndustry: true,
          whatYouDo: true,
        },
      });

      if (!companyHQ) {
        return { success: false, error: 'Company not found' };
      }

      // Use provided contact data if available, otherwise fetch if contactId is provided
      let contactData = providedContactData || null;
      if (!contactData && contactId) {
        contactData = await prisma.contact.findUnique({
          where: { id: contactId },
          select: {
            firstName: true,
            lastName: true,
            title: true,
            companyName: true,
            companyIndustry: true,
          },
        });
      }

      // Build prompt
      const { systemPrompt, userPrompt } = this.buildPrompt({
        companyHQ,
        contactData,
        description,
      });

      // Call OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_MODEL || 'gpt-4o';

      console.log(`🤖 PersonaMinimalService: Generating minimal persona (${model})...`);

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
        return { success: false, error: 'No response from OpenAI' };
      }

      // Parse response
      const persona = this.parseResponse(content);

      return { success: true, persona };
    } catch (error: any) {
      console.error('❌ PersonaMinimalService error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate minimal persona',
      };
    }
  }

  /**
   * Build minimal prompt
   */
  private static buildPrompt(context: {
    companyHQ: any;
    contactData: any;
    description?: string;
  }): { systemPrompt: string; userPrompt: string } {
    const { companyHQ, contactData, description } = context;

    const systemPrompt = `You are an expert in business persona modeling.

Generate a MINIMAL persona - just the essentials:
1. Who they are (personName + title)
2. What company (company)
3. Core goal (their north star)

Return EXACTLY this JSON structure:
{
  "personName": "",      // e.g., "Compliance Manager" or "Deputy Counsel"
  "title": "",           // e.g., "Deputy Counsel" or "Compliance Manager at X Firm"
  "company": "",         // e.g., "X Firm" or company name
  "coreGoal": ""         // Their main goal/north star (one sentence)
}

Keep it simple. This is MVP1 - just the basics.`;

    let contactContext = '';
    if (contactData) {
      contactContext = `Contact Info:
- Name: ${contactData.firstName || ''} ${contactData.lastName || ''}
- Title: ${contactData.title || 'Not specified'}
- Company: ${contactData.companyName || 'Not specified'}
- Industry: ${contactData.companyIndustry || 'Not specified'}`;
    } else if (description) {
      contactContext = `Description: ${description}`;
    }

    const userPrompt = `Generate a minimal persona.

Company Context:
- Name: ${companyHQ.companyName}
- Industry: ${companyHQ.companyIndustry || 'Not specified'}
- What We Do: ${companyHQ.whatYouDo || 'Not specified'}

${contactContext ? `${contactContext}\n` : ''}

Return the JSON structure with:
- personName: A clear identifier (e.g., "Compliance Manager", "Deputy Counsel")
- title: Their role/title
- company: Company name/type
- coreGoal: Their main goal (one sentence)`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse OpenAI response
   */
  private static parseResponse(content: string): MinimalPersonaJSON {
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

    // Extract persona data (could be nested or flat)
    const personaData = parsed.persona || parsed;

    return {
      personName: personaData.personName || '',
      title: personaData.title || '',
      company: personaData.company || '',
      coreGoal: personaData.coreGoal || '',
    };
  }
}

