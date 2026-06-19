/**
 * PersonaBDIntelligenceService
 * 
 * BD Intelligence layer - Read-only, persona-driven event discovery
 * Returns top BD-relevant events based on persona signals only
 * 
 * MUST NOT accept or reference:
 * - budget preferences
 * - travel preferences
 * - geography preferences
 * - user filters of any kind
 * 
 * Output: PersonaBDSignal[] - Advisory intelligence only, not selectable events
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

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

export interface PersonaBDSignal {
  eventName: string;
  organization: string;
  location: string | null;
  dateRange: string | null;
  bdScore: number; // Single score 0-100 or ranking index
  bdRationale: string; // Why this event is BD-relevant for the persona
  eventMetaId?: string; // If matched to existing EventMeta
}

/**
 * Generate BD Intelligence signals for a persona
 * Returns top ~10 BD-relevant events based on persona signals only
 */
export async function generatePersonaBDIntelligence(
  personaId: string,
  limit: number = 10
): Promise<PersonaBDSignal[]> {
  try {
    // Get persona
    const persona = await prisma.personas.findUnique({
      where: { id: personaId },
      include: {
        companyHQ: true,
      },
    });

    if (!persona) {
      throw new Error('Persona not found');
    }

    // Get candidate EventMeta records
    const candidateEvents = await prisma.event_metas.findMany({
      take: limit * 2, // Get more candidates than needed
      orderBy: { createdAt: 'desc' },
    });

    if (candidateEvents.length === 0) {
      throw new Error('No event candidates found. Please ingest events first.');
    }

    // Build BD intelligence prompt (NO preferences, NO filters)
    const personaSummary = `
Persona:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
- Pain Points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(', ') : 'Not specified'}
- Goals: ${persona.whatTheyWant || 'Not specified'}
- Decision Drivers: ${Array.isArray(persona.decisionDrivers) ? persona.decisionDrivers.join(', ') : 'Not specified'}
`;

    const eventsSummary = candidateEvents
      .slice(0, limit)
      .map(
        (event, idx) => `
Event ${idx + 1}:
- Name: ${event.name}
- Type: ${event.eventType}
- Location: ${event.city || ''} ${event.state || ''}
- Date: ${event.dateRange || event.startDate || 'TBD'}
- Cost: ${event.costMin ? `$${event.costMin}` : 'Unknown'}
`
      )
      .join('\n');

    const prompt = `You are a BD intelligence engine. Analyze events for BD opportunity based on persona signals only.

${personaSummary}

Events to analyze:
${eventsSummary}

For each event, return ONLY JSON with BD intelligence:
{
  "signals": [
    {
      "eventIndex": 1,
      "bdScore": 0-100,  // Single BD opportunity score (higher = more BD value)
      "bdRationale": "Brief explanation of BD opportunity (density, exposure, industry relevance, etc.)"
    },
    ...
  ]
}

BD Intelligence Focus:
- Allocator density (if relevant to persona)
- GP/dealflow density (if relevant to persona)
- Industry relevance
- Network exposure potential
- BD opportunity signals

DO NOT consider:
- Cost constraints
- Travel preferences
- Geographic preferences
- User budget
- User travel willingness

Return exactly ${limit} signals, one per event`;

    // Call OpenAI for BD intelligence
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        {
          role: 'system',
          content:
            'You are a BD intelligence engine. Return only valid JSON with BD signals. No markdown, no code blocks.',
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

    // Parse signals
    let signalsData: any;
    try {
      signalsData = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      throw new Error('Invalid JSON response from OpenAI');
    }

    const signals = signalsData.signals || [];

    // Map to PersonaBDSignal format
    const bdSignals: PersonaBDSignal[] = [];
    for (let i = 0; i < Math.min(signals.length, candidateEvents.length); i++) {
      const signal = signals[i];
      const event = candidateEvents[signal.eventIndex - 1]; // eventIndex is 1-based

      if (!event) continue;

      bdSignals.push({
        eventName: event.name,
        organization: 'Unknown', // TODO: Get from organizer if available
        location: event.city && event.state ? `${event.city}, ${event.state}` : event.city || null,
        dateRange: event.dateRange || null,
        bdScore: signal.bdScore || 0,
        bdRationale: signal.bdRationale || 'BD opportunity based on persona signals',
        eventMetaId: event.id,
      });
    }

    // Sort by BD score (highest first)
    bdSignals.sort((a, b) => b.bdScore - a.bdScore);

    return bdSignals.slice(0, limit);
  } catch (error) {
    console.error('❌ Persona BD Intelligence error:', error);
    throw error;
  }
}

