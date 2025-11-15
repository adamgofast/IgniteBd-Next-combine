import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { getEnrichedContact } from '@/lib/redis';
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

/**
 * POST /api/personas/generate
 * 
 * Stage 2: Persona Generation (OpenAI)
 * 
 * Takes enriched Apollo data from Redis and generates a persona
 * 
 * Body:
 * {
 *   "redisKey": "apollo:enriched:https://linkedin.com/in/...",
 *   "companyHQId": "xxx" (required)
 * }
 * 
 * Returns: Created Persona with all new fields
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { redisKey, companyHQId } = body;

    if (!redisKey) {
      return NextResponse.json(
        { success: false, error: 'redisKey is required' },
        { status: 400 },
      );
    }

    if (!companyHQId) {
      return NextResponse.json(
        { success: false, error: 'companyHQId is required' },
        { status: 400 },
      );
    }

    // Get enriched data from Redis
    const redisData = await getEnrichedContact(redisKey);
    if (!redisData) {
      return NextResponse.json(
        { success: false, error: 'Enriched data not found in Redis' },
        { status: 404 },
      );
    }

    // Extract raw Apollo response from Redis data structure
    // Redis stores: { linkedinUrl, enrichedData: { enrichedProfile, rawApolloResponse }, enrichedAt }
    const enrichedData = redisData.enrichedData || redisData;
    const rawApolloResponse = enrichedData.rawApolloResponse || enrichedData.enrichedProfile || enrichedData;
    
    // Build OpenAI prompt
    const systemPrompt = `You are an expert in executive psychology and business persona modeling. 
Given enriched Apollo or LinkedIn contact JSON, generate a precise, non-generic persona for this specific human.

Infer from:
- their role and seniority
- their industry and company size
- their headline / bio
- their responsibilities and pressures
- what they optimize for
- what risks they manage
- how they decide

Return JSON ONLY in this exact structure:
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

    const userPrompt = `Generate a persona from this Apollo enrichment data:

${JSON.stringify(rawApolloResponse, null, 2)}`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    console.log(`🤖 Calling OpenAI (${model}) for persona generation...`);
    
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
      throw new Error('No GPT output received');
    }

    // Parse JSON response
    let personaData;
    try {
      personaData = JSON.parse(content);
    } catch (parseError) {
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        personaData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate required fields
    if (!personaData.personName) {
      return NextResponse.json(
        { success: false, error: 'personName is required' },
        { status: 400 },
      );
    }

    if (!personaData.title) {
      return NextResponse.json(
        { success: false, error: 'title is required' },
        { status: 400 },
      );
    }

    // Save persona to database
    const persona = await prisma.persona.create({
      data: {
        companyHQId,
        personName: personaData.personName,
        title: personaData.title,
        headline: personaData.headline || null,
        seniority: personaData.seniority || null,
        industry: personaData.industry || null,
        subIndustries: personaData.subIndustries || [],
        company: personaData.company || null,
        companySize: personaData.companySize || null,
        annualRevenue: personaData.annualRevenue || null,
        location: personaData.location || null,
        description: personaData.description || null,
        whatTheyWant: personaData.whatTheyWant || null,
        painPoints: personaData.painPoints || [],
        risks: personaData.risks || [],
        decisionDrivers: personaData.decisionDrivers || [],
        buyerTriggers: personaData.buyerTriggers || [],
      },
    });

    console.log(`✅ Persona created: ${persona.id}`);

    return NextResponse.json({
      success: true,
      persona,
    });
  } catch (error: any) {
    console.error('❌ Persona generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

