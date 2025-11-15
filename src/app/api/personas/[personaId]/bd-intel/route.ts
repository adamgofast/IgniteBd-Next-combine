import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
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

/**
 * POST /api/personas/:personaId/bd-intel
 * 
 * Stage 4: BD Intelligence Layer (OpenAI)
 * 
 * Generates business development intelligence from persona + product fit
 * 
 * Returns: Created BdIntel
 */
export async function POST(
  request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { personaId } = await params;

    // Fetch persona with product fit
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        productFit: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                description: true,
                valueProp: true,
                price: true,
                priceCurrency: true,
                targetMarketSize: true,
                features: true,
                competitiveAdvantages: true,
              },
            },
          },
        },
      },
    });

    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'Persona not found' },
        { status: 404 },
      );
    }

    if (!persona.productFit) {
      return NextResponse.json(
        { success: false, error: 'Product fit not found. Generate product fit first.' },
        { status: 400 },
      );
    }

    // Build OpenAI prompt
    const systemPrompt = `You are a senior BD strategist. 
Given the persona AND the chosen productFit, generate business development intelligence.

Return JSON ONLY:
{
  "fitScore": 0-100,
  "painAlignmentScore": 0-100,
  "workflowFitScore": 0-100,
  "urgencyScore": 0-100,
  "adoptionBarrierScore": 0-100,
  "risks": [],
  "opportunities": [],
  "recommendedTalkTrack": "",
  "recommendedSequence": "",
  "recommendedLeadSource": "",
  "finalSummary": ""
}`;

    const userPrompt = `Persona:
${JSON.stringify({
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
}, null, 2)}

Product Fit:
${JSON.stringify({
  product: persona.productFit.product,
  valuePropToThem: persona.productFit.valuePropToThem,
  alignmentReasoning: persona.productFit.alignmentReasoning,
}, null, 2)}

Generate BD intelligence.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    console.log(`🤖 Calling OpenAI (${model}) for BD intelligence...`);
    
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
    let bdIntelData;
    try {
      bdIntelData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        bdIntelData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate scores are 0-100
    const scoreFields = ['fitScore', 'painAlignmentScore', 'workflowFitScore', 'urgencyScore', 'adoptionBarrierScore'];
    for (const field of scoreFields) {
      const score = bdIntelData[field];
      if (typeof score !== 'number' || score < 0 || score > 100) {
        bdIntelData[field] = Math.max(0, Math.min(100, score || 0));
      }
    }

    // Create or update BdIntel
    const bdIntel = await prisma.bdIntel.upsert({
      where: { personaId },
      create: {
        personaId,
        fitScore: bdIntelData.fitScore || 0,
        painAlignmentScore: bdIntelData.painAlignmentScore || 0,
        workflowFitScore: bdIntelData.workflowFitScore || 0,
        urgencyScore: bdIntelData.urgencyScore || 0,
        adoptionBarrierScore: bdIntelData.adoptionBarrierScore || 0,
        risks: bdIntelData.risks || null,
        opportunities: bdIntelData.opportunities || null,
        recommendedTalkTrack: bdIntelData.recommendedTalkTrack || null,
        recommendedSequence: bdIntelData.recommendedSequence || null,
        recommendedLeadSource: bdIntelData.recommendedLeadSource || null,
        finalSummary: bdIntelData.finalSummary || null,
      },
      update: {
        fitScore: bdIntelData.fitScore || 0,
        painAlignmentScore: bdIntelData.painAlignmentScore || 0,
        workflowFitScore: bdIntelData.workflowFitScore || 0,
        urgencyScore: bdIntelData.urgencyScore || 0,
        adoptionBarrierScore: bdIntelData.adoptionBarrierScore || 0,
        risks: bdIntelData.risks || null,
        opportunities: bdIntelData.opportunities || null,
        recommendedTalkTrack: bdIntelData.recommendedTalkTrack || null,
        recommendedSequence: bdIntelData.recommendedSequence || null,
        recommendedLeadSource: bdIntelData.recommendedLeadSource || null,
        finalSummary: bdIntelData.finalSummary || null,
      },
    });

    console.log(`✅ BdIntel created/updated: ${bdIntel.id}`);

    return NextResponse.json({
      success: true,
      bdIntel,
    });
  } catch (error: any) {
    console.error('❌ BD intelligence error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate BD intelligence',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

