/**
 * ContactAnalysisMinimalService
 * 
 * MVP1: Basic contact info extraction (who they are, what company, core goal)
 * Same minimal structure as PersonaMinimalService but for real contacts
 * 
 * MVP1 Fields:
 * - personName (who they are)
 * - title
 * - company
 * - coreGoal (what they might want)
 */

import { prisma } from '@/lib/prisma';
import { OpenAI } from 'openai';

interface MinimalContactAnalysisJSON {
  personName: string;  // e.g., "Compliance Manager"
  title: string;       // e.g., "Deputy Counsel"
  company: string;     // e.g., "X Firm"
  coreGoal: string;    // What they might want / their north star
}

interface GenerateParams {
  contactId: string;
  companyHQId?: string;
}

export class ContactAnalysisMinimalService {
  /**
   * Generate minimal contact analysis (MVP1)
   */
  static async generate(params: GenerateParams): Promise<{
    success: boolean;
    analysis?: MinimalContactAnalysisJSON;
    error?: string;
  }> {
    try {
      const { contactId, companyHQId } = params;

      // Fetch contact
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          companies: true,
        },
      });

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      // Fetch company context if provided
      let companyHQ = null;
      if (companyHQId) {
        companyHQ = await prisma.companyHQ.findUnique({
          where: { id: companyHQId },
          select: {
            companyName: true,
            companyIndustry: true,
            whatYouDo: true,
          },
        });
      }

      // Build prompt
      const { systemPrompt, userPrompt } = this.buildPrompt({
        contact,
        companyHQ,
      });

      // Call OpenAI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const model = process.env.OPENAI_MODEL || 'gpt-4o';

      console.log(`🤖 ContactAnalysisMinimalService: Generating basic contact info for ${contact.fullName || contact.email}...`);

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
      const analysis = this.parseResponse(content);

      return { success: true, analysis };
    } catch (error: any) {
      console.error('❌ ContactAnalysisMinimalService error:', error);
      return {
        success: false,
        error: error.message || 'Failed to generate minimal contact analysis',
      };
    }
  }

  /**
   * Build minimal prompt
   */
  private static buildPrompt(context: {
    contact: any;
    companyHQ: any;
  }): { systemPrompt: string; userPrompt: string } {
    const { contact, companyHQ } = context;

    const systemPrompt = `You are an expert in business contact analysis.

Generate basic contact info - just the essentials:
1. Who they are (personName + title)
2. What company (company)
3. Core goal (what they might want / their north star)

Return EXACTLY this JSON structure:
{
  "personName": "",      // e.g., "Compliance Manager" or contact's name/archetype
  "title": "",           // e.g., "Deputy Counsel" or their job title
  "company": "",         // e.g., "X Firm" or company name
  "coreGoal": ""         // What they might want / their north star (one sentence)
}

Keep it simple. This is MVP1 - just the basics.`;

    const contactContext = `Contact Info:
- Name: ${contact.fullName || `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'Unknown'}
- Title: ${contact.title || 'Not specified'}
- Company: ${contact.companyName || 'Not specified'}
- Industry: ${contact.companyIndustry || 'Not specified'}
- Notes: ${contact.notes || 'None'}`;

    const companyContext = companyHQ
      ? `Your Company Context:
- Name: ${companyHQ.companyName}
- Industry: ${companyHQ.companyIndustry || 'Not specified'}
- What You Do: ${companyHQ.whatYouDo || 'Not specified'}`
      : '';

    const userPrompt = `Generate basic contact info for this real contact.

${contactContext}

${companyContext ? `${companyContext}\n` : ''}

Return the JSON structure with:
- personName: A clear identifier (e.g., their name or role like "Compliance Manager")
- title: Their job title/role
- company: Company name
- coreGoal: What they might want / their north star (one sentence)`;

    return { systemPrompt, userPrompt };
  }

  /**
   * Parse OpenAI response
   */
  private static parseResponse(content: string): MinimalContactAnalysisJSON {
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

    // Extract analysis data (could be nested or flat)
    const analysisData = parsed.analysis || parsed;

    return {
      personName: analysisData.personName || '',
      title: analysisData.title || '',
      company: analysisData.company || '',
      coreGoal: analysisData.coreGoal || '',
    };
  }
}
