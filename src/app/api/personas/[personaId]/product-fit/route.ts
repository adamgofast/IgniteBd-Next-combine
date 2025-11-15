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
 * POST /api/personas/:personaId/product-fit
 * 
 * Stage 3: Product Intelligence Mapping (OpenAI)
 * 
 * Matches persona to the best fitting product
 * 
 * Returns: Created ProductFit
 */
export async function POST(
  request: Request,
  { params }: { params: { personaId: string } }
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
    const { personaId } = params;

    // Fetch persona
    const persona = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        companyHQ: {
          select: {
            id: true,
            companyName: true,
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

    // Fetch all products for this tenant
    const products = await prisma.product.findMany({
      where: { companyHQId: persona.companyHQId },
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
    });

    if (products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No products found for this tenant' },
        { status: 404 },
      );
    }

    // Build OpenAI prompt
    const systemPrompt = `You are a product strategist. 
Match this persona to the single Ignite product that fits them best.

Use:
- persona data
- company size
- economic drivers
- industry context
- how they buy services
- what they value
- what they fear

Return JSON ONLY:
{
  "productId": "",
  "alignmentReasoning": "",
  "valuePropToThem": ""
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

Available Products:
${JSON.stringify(products, null, 2)}

Match the persona to the best product and return the JSON.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    
    console.log(`🤖 Calling OpenAI (${model}) for product fit...`);
    
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
    let productFitData;
    try {
      productFitData = JSON.parse(content);
    } catch (parseError) {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        productFitData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate product exists
    const selectedProduct = products.find(p => p.id === productFitData.productId);
    if (!selectedProduct) {
      return NextResponse.json(
        { success: false, error: 'Selected product not found' },
        { status: 400 },
      );
    }

    // Create or update ProductFit
    const productFit = await prisma.productFit.upsert({
      where: { personaId },
      create: {
        personaId,
        productId: productFitData.productId,
        valuePropToThem: productFitData.valuePropToThem || '',
        alignmentReasoning: productFitData.alignmentReasoning || '',
      },
      update: {
        productId: productFitData.productId,
        valuePropToThem: productFitData.valuePropToThem || '',
        alignmentReasoning: productFitData.alignmentReasoning || '',
      },
    });

    console.log(`✅ ProductFit created/updated: ${productFit.id}`);

    return NextResponse.json({
      success: true,
      productFit,
    });
  } catch (error: any) {
    console.error('❌ Product fit error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate product fit',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

