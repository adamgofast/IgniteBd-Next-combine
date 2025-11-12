import { OpenAI } from 'openai';
import { prisma } from '../prisma';

// Initialize OpenAI client for Next.js
// In Next.js API routes, process.env is available on the server
let openaiClient = null;

function getOpenAIClient() {
  if (openaiClient) {
    return openaiClient;
  }

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Please set it in your environment variables.',
    );
  }

  openaiClient = new OpenAI({
    apiKey: apiKey,
  });

  return openaiClient;
}

/**
 * Business Intelligence Scoring Service
 * 
 * Evaluates how well a business offer (Product) matches a contact's current situation
 * Returns a 0-100 Fit Score with detailed breakdown
 * 
 * @param {string} contactId - Contact ID
 * @param {string} productId - Product ID (the "offer")
 * @param {string} personaId - Optional Persona ID (if contact is matched to a persona)
 * @returns {Promise<Object>} Scoring result with dimensions and total score
 */
export async function calculateFitScore(contactId, productId, personaId = null) {
  try {
    console.log(`🎯 Calculating Fit Score for Contact: ${contactId}, Product: ${productId}`);

    // Fetch all required data
    const [contact, product, pipeline, persona] = await Promise.all([
      prisma.contact.findUnique({
        where: { id: contactId },
        include: {
          contactCompany: {
            select: {
              companyName: true,
              industry: true,
            },
          },
        },
      }),
      prisma.product.findUnique({
        where: { id: productId },
      }),
      prisma.pipeline.findUnique({
        where: { contactId },
      }),
      personaId
        ? prisma.persona.findUnique({
            where: { id: personaId },
          })
        : null,
    ]);

    // Validate required data
    if (!contact) {
      throw new Error(`Contact not found: ${contactId}`);
    }
    if (!product) {
      throw new Error(`Product not found: ${productId}`);
    }

    // Map fields to prompt template - using actual DB schema field names
    const contactName =
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      'Unknown';
    const contactRole = contact.title || 'Not specified';
    const contactOrg =
      contact.contactCompany?.companyName || 'Not specified';
    
    // Get goals and pain points from persona (founder's manual input) or contact notes
    // These are stored as free text in DB - can include dashes, newlines, bullet points
    // OpenAI handles this formatted text just fine
    const contactGoals = persona?.goals || contact.notes || 'Not specified';
    const contactPainPoints = persona?.painPoints || 'Not specified';
    
    const budgetSensitivity = inferBudgetSensitivity(
      pipeline?.stage,
      pipeline?.pipeline,
    );
    const pipelineName = pipeline?.pipeline || 'Not specified';
    const stageName = pipeline?.stage || 'Not specified';
    const contactNotes = contact.notes || 'None';

    // Format product price for OpenAI prompt
    const offerPrice = product.price
      ? `${product.priceCurrency || 'USD'} ${product.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
      : 'Not specified';

    // Build the user prompt - matching exact template structure
    // Free text fields (goals, painPoints) are inserted as-is - OpenAI handles formatted text well
    const userPrompt = `Offer:
Title: ${product.name}
Value Prop: ${product.valueProp || product.description || 'Not specified'}
Price: ${offerPrice}

Contact:
Name: ${contactName}
Role: ${contactRole}
Organization: ${contactOrg}
Goals: ${contactGoals}
Pain Points: ${contactPainPoints}
Budget Sensitivity: ${budgetSensitivity}
Pipeline: ${pipelineName}
Stage: ${stageName}
Notes: ${contactNotes}

Evaluate the fit and return ONLY a valid JSON object with these exact keys:
{
  "point_of_need": <0-20>,
  "pain_alignment": <0-20>,
  "willingness_to_pay": <0-20>,
  "impact_potential": <0-20>,
  "context_fit": <0-20>,
  "total_score": <sum of all five>,
  "summary": "<brief explanation>"
}`;

    // System prompt - matches exact template structure
    const systemPrompt = `You are a Business Intelligence Logic Scorer.

Your job is to evaluate how well a business offer matches a contact's current situation.

You will reason objectively and output a structured JSON object with numeric scores (0–100 total) and a summary.

Each dimension scores 0–20:

1. Point of Need — how directly the contact needs this offer.
2. Pain Alignment — how well the offer relieves known pains.
3. Willingness to Pay — likelihood of allocating budget at this stage.
4. Impact Potential — magnitude of improvement if adopted.
5. Context Fit — alignment with role, metrics, and pipeline stage.

Use these anchors:
0–5 = weak / irrelevant  
6–10 = partial  
11–15 = moderate  
16–20 = strong  

Compute total_score = sum(all five) and return JSON with keys:
{ point_of_need, pain_alignment, willingness_to_pay, impact_potential, context_fit, total_score, summary }

You must return valid JSON only. All scores must be integers between 0-20. The total_score must be the sum of all five dimension scores.`;

    // Call OpenAI
    // Using gpt-4o for better performance and cost efficiency
    // Can be overridden with OPENAI_MODEL env variable
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`🤖 Calling OpenAI (${model}) for fit score calculation...`);
    
    // Get OpenAI client (validates API key is configured)
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: userPrompt,
        },
      ],
      response_format: { type: 'json_object' }, // Ensure JSON response (requires gpt-4o, gpt-4-turbo, or gpt-3.5-turbo)
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No GPT output received.');
    }

    // Parse JSON response
    let scoringResult;
    try {
      scoringResult = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        scoringResult = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate response structure
    const requiredKeys = [
      'point_of_need',
      'pain_alignment',
      'willingness_to_pay',
      'impact_potential',
      'context_fit',
      'total_score',
      'summary',
    ];

    for (const key of requiredKeys) {
      if (!(key in scoringResult)) {
        throw new Error(`Missing required key in response: ${key}`);
      }
    }

    // Ensure scores are within valid ranges
    const dimensionKeys = [
      'point_of_need',
      'pain_alignment',
      'willingness_to_pay',
      'impact_potential',
      'context_fit',
    ];

    for (const key of dimensionKeys) {
      const score = scoringResult[key];
      if (typeof score !== 'number' || score < 0 || score > 20) {
        console.warn(
          `⚠️ Invalid score for ${key}: ${score}. Clamping to 0-20 range.`,
        );
        scoringResult[key] = Math.max(0, Math.min(20, score));
      }
    }

    // Recalculate total_score to ensure accuracy
    scoringResult.total_score = dimensionKeys.reduce(
      (sum, key) => sum + (scoringResult[key] || 0),
      0,
    );

    // Ensure total_score is 0-100
    scoringResult.total_score = Math.max(0, Math.min(100, scoringResult.total_score));

    console.log(`✅ Fit Score calculated: ${scoringResult.total_score}/100`);

    return {
      success: true,
      contactId,
      productId,
      personaId,
      scores: {
        pointOfNeed: scoringResult.point_of_need,
        painAlignment: scoringResult.pain_alignment,
        willingnessToPay: scoringResult.willingness_to_pay,
        impactPotential: scoringResult.impact_potential,
        contextFit: scoringResult.context_fit,
        totalScore: scoringResult.total_score,
      },
      summary: scoringResult.summary,
      rawResponse: content,
    };
  } catch (error) {
    console.error('❌ Business Intelligence Scoring failed:', error);
    return {
      success: false,
      error: error.message,
      contactId,
      productId,
      personaId,
    };
  }
}

/**
 * Infer budget sensitivity from pipeline stage
 * This is a heuristic - can be enhanced with actual budget data later
 */
function inferBudgetSensitivity(stage, pipeline) {
  if (!stage || !pipeline) {
    return 'Unknown';
  }

  // Early stages = lower budget sensitivity
  const earlyStages = ['interest', 'meeting', 'proposal'];
  if (earlyStages.includes(stage.toLowerCase())) {
    return 'Low - Early stage';
  }

  // Contract stages = higher budget sensitivity
  const contractStages = [
    'contract',
    'contract-signed',
    'kickoff',
    'work-started',
  ];
  if (contractStages.includes(stage.toLowerCase())) {
    return 'High - Contract stage';
  }

  // Client pipeline = higher budget sensitivity
  if (pipeline.toLowerCase() === 'client') {
    return 'High - Existing client';
  }

  return 'Moderate';
}

/**
 * Find best matching persona for a contact
 * Matches based on role/title, industry, and semantic similarity of goals/pain points
 * 
 * @param {string} contactId - Contact ID
 * @param {string} companyHQId - CompanyHQ ID (tenant)
 * @param {Object} options - Optional configuration
 * @param {boolean} options.returnDetails - If true, returns { personaId, confidence, matchDetails } instead of just personaId
 * @returns {Promise<string|null>} Persona ID or null (or match details if returnDetails=true)
 */
export async function findMatchingPersona(contactId, companyHQId, options = {}) {
  const { returnDetails = false } = options;
  
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactCompany: {
          select: {
            industry: true,
            companyName: true,
          },
        },
      },
    });

    if (!contact) {
      return returnDetails ? { personaId: null, confidence: 0, matchDetails: null } : null;
    }

    // Find personas for this tenant
    const personas = await prisma.persona.findMany({
      where: {
        companyHQId,
      },
    });

    if (personas.length === 0) {
      return returnDetails ? { personaId: null, confidence: 0, matchDetails: null } : null;
    }

    // Normalize contact data for matching
    const contactTitle = (contact.title || '').toLowerCase().trim();
    const contactIndustry = (contact.contactCompany?.industry || '').toLowerCase().trim();
    const contactNotes = (contact.notes || '').toLowerCase().trim();

    // Find best match with scoring
    let bestMatch = null;
    let bestScore = 0;
    const matchDetails = [];

    for (const persona of personas) {
      let score = 0;
      const reasons = [];

      // 1. Match by role/title (weight: 3 points)
      const personaRole = (persona.role || '').toLowerCase().trim();
      const personaTitle = (persona.title || '').toLowerCase().trim();
      
      if (contactTitle && (personaRole || personaTitle)) {
        // Exact match
        if (contactTitle === personaRole || contactTitle === personaTitle) {
          score += 3;
          reasons.push('Exact role/title match');
        }
        // Partial match (contains)
        else if (
          (personaRole && (personaRole.includes(contactTitle) || contactTitle.includes(personaRole))) ||
          (personaTitle && (personaTitle.includes(contactTitle) || contactTitle.includes(personaTitle)))
        ) {
          score += 2;
          reasons.push('Partial role/title match');
        }
        // Keyword match (common titles)
        else {
          const commonKeywords = ['ceo', 'cto', 'cfo', 'coo', 'founder', 'owner', 'director', 'manager', 'head', 'lead', 'vp', 'president'];
          const contactKeywords = commonKeywords.filter(k => contactTitle.includes(k));
          const personaKeywords = commonKeywords.filter(k => 
            (personaRole && personaRole.includes(k)) || (personaTitle && personaTitle.includes(k))
          );
          if (contactKeywords.length > 0 && personaKeywords.length > 0 && 
              contactKeywords.some(k => personaKeywords.includes(k))) {
            score += 1;
            reasons.push('Keyword match');
          }
        }
      }

      // 2. Match by industry (weight: 2 points)
      const personaIndustry = (persona.industry || '').toLowerCase().trim();
      if (contactIndustry && personaIndustry) {
        if (contactIndustry === personaIndustry) {
          score += 2;
          reasons.push('Exact industry match');
        } else if (personaIndustry.includes(contactIndustry) || contactIndustry.includes(personaIndustry)) {
          score += 1;
          reasons.push('Partial industry match');
        }
      }

      // 3. Match by goals/pain points in notes (weight: 1 point)
      // Simple keyword matching - can be enhanced with semantic similarity later
      if (contactNotes && (persona.goals || persona.painPoints)) {
        const personaText = ((persona.goals || '') + ' ' + (persona.painPoints || '')).toLowerCase();
        const keywords = personaText.split(/\s+/).filter(w => w.length > 4); // Words longer than 4 chars
        const matchingKeywords = keywords.filter(k => contactNotes.includes(k));
        if (matchingKeywords.length > 0) {
          score += Math.min(1, matchingKeywords.length / 3); // Cap at 1 point
          reasons.push(`Found ${matchingKeywords.length} matching keywords in notes`);
        }
      }

      matchDetails.push({
        personaId: persona.id,
        personaName: persona.name,
        score,
        reasons: reasons.length > 0 ? reasons : ['No matches found'],
      });

      if (score > bestScore) {
        bestScore = score;
        bestMatch = persona;
      }
    }

    // Calculate confidence (0-100) based on best score
    // Max possible score is 6 (3 for role + 2 for industry + 1 for notes)
    const maxPossibleScore = 6;
    const confidence = bestScore > 0 
      ? Math.round((bestScore / maxPossibleScore) * 100) 
      : 0;

    // Only return match if confidence is at least 20% (threshold can be adjusted)
    const minConfidenceThreshold = 20;
    if (confidence < minConfidenceThreshold) {
      console.log(`⚠️ Persona match confidence too low (${confidence}%) for contact ${contactId}`);
      return returnDetails 
        ? { personaId: null, confidence, matchDetails } 
        : null;
    }

    if (bestMatch) {
      console.log(`✅ Matched persona "${bestMatch.name}" (${bestMatch.id}) to contact ${contactId} with ${confidence}% confidence`);
    }

    if (returnDetails) {
      return {
        personaId: bestMatch?.id || null,
        confidence,
        matchDetails: matchDetails.sort((a, b) => b.score - a.score), // Sort by score descending
        bestMatch: bestMatch ? {
          id: bestMatch.id,
          name: bestMatch.name,
          role: bestMatch.role,
          industry: bestMatch.industry,
        } : null,
      };
    }

    return bestMatch?.id || null;
  } catch (error) {
    console.error('❌ Error finding matching persona:', error);
    return returnDetails 
      ? { personaId: null, confidence: 0, matchDetails: null, error: error.message } 
      : null;
  }
}

export default {
  calculateFitScore,
  findMatchingPersona,
};

