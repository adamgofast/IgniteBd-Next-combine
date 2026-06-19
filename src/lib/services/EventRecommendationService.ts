/**
 * EventRecommendationService
 * 
 * Generates event recommendations using OpenAI with BD-specific match signals
 * 
 * NOTE: This service uses the new BDEventOpp format with matchSignals.
 * The prompt structure needs to be updated to request matchSignals from AI.
 */

import { OpenAI } from 'openai';
import type { BDEventOpp } from '@/lib/types/BD_EventOpp';

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

interface EventRecommendationRequest {
  persona: any;
  priorities: string[];
  travelPreference?: string;
  budgetPreference?: string;
  userRegion?: string | null;
  count?: number;
}

export async function generateEventRecommendations({
  persona,
  priorities,
  travelPreference = 'anywhere',
  budgetPreference = 'standard',
  userRegion = null,
  count = 6,
}: EventRecommendationRequest): Promise<BDEventOpp[]> {
  try {
    console.log('🎯 Generating BD event recommendations with match signals...');

    // Validate inputs
    if (!persona) {
      throw new Error('Persona is required');
    }

    if (!priorities || priorities.length === 0) {
      throw new Error('At least one priority is required');
    }

    // Build prompt for new format
    const personaSummary = persona
      ? `Persona:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
- Pain Points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(', ') : persona.painPoints || 'Not specified'}
- Goals: ${persona.whatTheyWant || 'Not specified'}`
      : 'No persona provided';

    const prompt = `You are an event intelligence planner. Generate ${count} real, specific event recommendations for business development purposes.

${personaSummary}

User Region: ${userRegion || 'Not specified'}

Priority Filters:
${priorities.length > 0 ? priorities.map(p => `- ${p}`).join('\n') : '- None specified'}

Travel Preference: ${travelPreference}
Budget Preference: ${budgetPreference}

Requirements:
1. Return EXACTLY ${count} events
2. All events must be REAL, specific events (not generic types)
3. Use multiple producer types (Association, Commercial, Media, Institution, Corporate)
4. Each event must have:
   - name: Full event name
   - organizerName: Organizer name
   - producerType: One of "Association", "Commercial", "Media", "Institution", "Corporate"
   - location: City, State/Country or null (legacy format)
   - city: City name
   - stateOrRegion: State/Region or null
   - dateRange: "Q1 2025", "March 2025", "TBD", etc. or null (legacy format)
   - startDate: ISO date string or null
   - endDate: ISO date string or null
   - personaAlignment: 0-100 (overall alignment score)
   - matchSignals: Object with 8 signals (0-100 each):
     * industryMatch: How well event industry matches persona industry
     * roleMatch: How well event targets persona's role/title
     * seniorityMatch: How well event targets persona's seniority level
     * themeMatch: How well event themes match persona's interests
     * speakerMatch: Quality/relevance of speakers for this persona
     * sponsorMatch: Quality/relevance of sponsors for this persona
     * audienceMatch: How well event audience matches persona's peer group
     * geoMatch: Geographic fit (0-100, higher = better travel fit)
   - relevanceReason: 2-3 sentence explanation of why this event fits
   - url: Event website URL if available (optional)

5. Calculate matchSignals based on persona attributes and event characteristics
6. Calculate personaAlignment as weighted average of matchSignals (or your best judgment)

Return ONLY a valid JSON object with this structure:
{
  "events": [
    { /* event 1 with all fields above */ },
    { /* event 2 */ },
    ...
  ]
}

The "events" array must contain exactly ${count} event objects. No markdown, no code blocks, just the JSON object.`;

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`🤖 Calling OpenAI (${model}) for BD event recommendations...`);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You are an expert event intelligence planner specializing in BD opportunities. Return only valid JSON. Return a JSON object with an "events" key containing an array of event objects with matchSignals. No markdown, no code blocks.',
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
    let parsedResponse: any;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('❌ Failed to parse OpenAI JSON response:', parseError);
      // Try to extract JSON from markdown code blocks
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Extract events array
    let events: any[] = [];
    if (Array.isArray(parsedResponse)) {
      events = parsedResponse;
    } else if (parsedResponse.events && Array.isArray(parsedResponse.events)) {
      events = parsedResponse.events;
    } else if (parsedResponse.data && Array.isArray(parsedResponse.data)) {
      events = parsedResponse.data;
    } else {
      throw new Error('Response does not contain an events array');
    }

    // Validate and normalize events
    const validatedEvents: BDEventOpp[] = events.slice(0, count).map((event: any, index: number) => {
      // Ensure matchSignals exist with defaults
      const matchSignals = event.matchSignals || {
        industryMatch: event.personaAlignment || 50,
        roleMatch: event.personaAlignment || 50,
        seniorityMatch: event.personaAlignment || 50,
        themeMatch: event.personaAlignment || 50,
        speakerMatch: event.personaAlignment || 50,
        sponsorMatch: event.personaAlignment || 50,
        audienceMatch: event.personaAlignment || 50,
        geoMatch: event.personaAlignment || 50,
      };

      // Clamp all match signals to 0-100
      Object.keys(matchSignals).forEach(key => {
        matchSignals[key] = Math.max(0, Math.min(100, Number(matchSignals[key]) || 50));
      });

      // Calculate personaAlignment if not provided
      const personaAlignment = event.personaAlignment 
        ? Math.max(0, Math.min(100, Number(event.personaAlignment)))
        : Math.round(
            (matchSignals.industryMatch +
             matchSignals.roleMatch +
             matchSignals.seniorityMatch +
             matchSignals.themeMatch +
             matchSignals.speakerMatch +
             matchSignals.sponsorMatch +
             matchSignals.audienceMatch +
             matchSignals.geoMatch) / 8
          );

      return {
        name: event.name || `Event ${index + 1}`,
        organizerName: event.organizerName || event.organization || 'Unknown',
        producerType: (event.producerType || 'Commercial') as BDEventOpp['producerType'],
        location: event.location || null,
        city: event.city || null,
        stateOrRegion: event.stateOrRegion || null,
        dateRange: event.dateRange || null,
        startDate: event.startDate || null,
        endDate: event.endDate || null,
        costMin: event.cost?.min ?? event.costMin ?? null,
        costMax: event.cost?.max ?? event.costMax ?? null,
        currency: event.cost?.currency ?? event.currency ?? 'USD',
        personaAlignment,
        matchSignals,
        relevanceReason: event.relevanceReason || 'Event recommendation based on persona and filters',
        url: event.url || null,
        rawJson: event,
      } as BDEventOpp;
    });

    // Ensure we have exactly count events
    while (validatedEvents.length < count) {
      const defaultSignals = {
        industryMatch: 50,
        roleMatch: 50,
        seniorityMatch: 50,
        themeMatch: 50,
        speakerMatch: 50,
        sponsorMatch: 50,
        audienceMatch: 50,
        geoMatch: 50,
      };

      validatedEvents.push({
        name: `Event ${validatedEvents.length + 1}`,
        organizerName: 'TBD',
        producerType: 'Commercial',
        location: null,
        city: null,
        stateOrRegion: null,
        dateRange: null,
        startDate: null,
        endDate: null,
        costMin: null,
        costMax: null,
        currency: 'USD',
        personaAlignment: 50,
        matchSignals: defaultSignals,
        relevanceReason: 'Additional event recommendation',
        url: null,
        rawJson: {},
      } as BDEventOpp);
    }

    console.log(`✅ Generated ${validatedEvents.length} BD event recommendations`);
    return validatedEvents.slice(0, count);
  } catch (error) {
    console.error('❌ BD Event recommendation generation failed:', error);
    throw error;
  }
}

