/**
 * Association Inference Service
 * AI-powered inference for ecosystem associations from raw spreadsheet data
 */

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

export interface AssociationInferenceInput {
  name: string;
  website?: string;
  location?: string;
}

export interface AssociationInferenceResult {
  normalizedName: string;
  description: string;
  missionSummary?: string;
  industryTags: string[];
  memberTypes: string[];
  memberSeniority?: string;
  authorityLevel: number; // 1-5
  valueProposition?: string;
  personaAlignment: Record<string, number>; // { personaId: score }
  bdRelevanceScore: number; // 0-100
}

/**
 * Run AI inference on association data
 */
export async function runAssociationInference(
  raw: AssociationInferenceInput
): Promise<AssociationInferenceResult> {
  try {
    console.log(`🤖 Running association inference for: ${raw.name}`);

    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const prompt = `You are an expert in business development ecosystems and professional associations.

Given the following organization data:

Name: ${raw.name}
Website: ${raw.website || 'Not provided'}
Location: ${raw.location || 'Not provided'}

Infer the following fields. Use your training knowledge of associations and your ability to infer based on naming structure.

Return ONLY JSON with this exact structure:
{
  "normalizedName": "Standardized name of the association",
  "description": "Brief description of what the association does",
  "missionSummary": "Summary of the association's mission and purpose",
  "industryTags": ["array", "of", "relevant", "industry", "tags"],
  "memberTypes": ["array", "of", "member", "types", "e.g.", "companies", "individuals", "nonprofits"],
  "memberSeniority": "Typical seniority level of members (e.g., 'C-Suite', 'VP+', 'Director+', 'Mid-level', 'Entry-level')",
  "authorityLevel": 1-5, // 1 = Local/Regional, 2 = State, 3 = National, 4 = International, 5 = Global Authority
  "valueProposition": "Key value proposition for members",
  "personaAlignment": {}, // Empty object - will be populated later with persona scores
  "bdRelevanceScore": 0-100 // Business development relevance score based on member quality, networking opportunities, etc.
}

Guidelines:
- authorityLevel: 1 = Local/Regional, 2 = State/Province, 3 = National, 4 = International, 5 = Global Authority (like World Economic Forum)
- bdRelevanceScore: Higher scores for associations with decision-makers, high-quality networking, relevant industry focus
- industryTags: Use specific, relevant tags (e.g., "Technology", "Healthcare", "Finance", "Professional Services")
- memberTypes: Be specific about what types of organizations or individuals typically join
- If information is not available, make reasonable inferences based on naming patterns and common association structures`;

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3, // Lower temperature for more consistent, factual outputs
      messages: [
        {
          role: 'system',
          content:
            'You are an expert business development analyst specializing in professional associations and ecosystem intelligence. Return only valid JSON. No markdown, no code blocks.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse JSON response
    let result: any;
    try {
      result = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        result = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate and normalize result
    const inferenceResult: AssociationInferenceResult = {
      normalizedName: result.normalizedName || raw.name,
      description: result.description || '',
      missionSummary: result.missionSummary || undefined,
      industryTags: Array.isArray(result.industryTags) ? result.industryTags : [],
      memberTypes: Array.isArray(result.memberTypes) ? result.memberTypes : [],
      memberSeniority: result.memberSeniority || undefined,
      authorityLevel: typeof result.authorityLevel === 'number' ? Math.max(1, Math.min(5, result.authorityLevel)) : 3,
      valueProposition: result.valueProposition || undefined,
      personaAlignment: typeof result.personaAlignment === 'object' ? result.personaAlignment : {},
      bdRelevanceScore: typeof result.bdRelevanceScore === 'number' ? Math.max(0, Math.min(100, result.bdRelevanceScore)) : 50,
    };

    console.log(`✅ Association inference completed for: ${raw.name}`);

    return inferenceResult;
  } catch (error) {
    console.error(`❌ Association inference failed for ${raw.name}:`, error);
    throw error;
  }
}

