/**
 * EventPlannerService
 * 
 * Generates event recommendations using OpenAI based on persona and filters
 */

import { OpenAI } from 'openai';
import type { EventSuggestion, EventRecommendationRequest, EventProducerType } from '@/types/events';

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

function buildEventRecommendationPrompt(
  persona: any,
  filters: EventRecommendationRequest['filters'],
  userRegion?: string | null
): string {
  const personaSummary = persona
    ? `Persona:
- Title: ${persona.title || persona.personName || 'Not specified'}
- Industry: ${persona.industry || 'Not specified'}
- Location: ${persona.location || 'Not specified'}
- Description: ${persona.description || 'Not specified'}
- Pain Points: ${Array.isArray(persona.painPoints) ? persona.painPoints.join(', ') : persona.painPoints || 'Not specified'}
- Goals: ${persona.whatTheyWant || 'Not specified'}`
    : 'No persona provided';

  const priorityFilters = filters.priorityTypes || [];
  const travelPref = filters.travelPreference || 'anywhere';
  const budgetPref = filters.budgetPreference || 'standard';

  return `You are an event intelligence planner. Generate 6 real, specific event recommendations for business development purposes.

${personaSummary}

User Region: ${userRegion || 'Not specified'}

Priority Filters:
${priorityFilters.length > 0 ? priorityFilters.map(p => `- ${p}`).join('\n') : '- None specified'}

Travel Preference: ${travelPref}
Budget Preference: ${budgetPref}

Requirements:
1. Return EXACTLY 6 events
2. All events must be REAL, specific events (not generic types)
3. Use multiple producer types (Association, Commercial, Media, Institution, Corporate)
4. Each event must have:
   - name: Full event name
   - producerType: One of "Association", "Commercial", "Media", "Institution", "Corporate"
   - organization: Organizer name
   - location: City, State/Country or null
   - dateRange: "Q1 2025", "March 2025", "TBD", etc. or null
   - wellKnownScore: 1-10 (how well-known is this event)
   - attendanceScore: 1-10 (expected attendance level)
   - bdValueScore: 1-10 (business development value for this persona)
   - travelFitScore: 1-10 (how well does travel fit user's region/preference)
   - costScore: 1-10 (cost-effectiveness, higher = more cost-effective)
   - totalScore: Sum of all 5 scores above
   - relevanceReason: 2-3 sentence explanation of why this event fits
   - url: Event website URL if available (optional)

5. Apply scoring logic based on priority filters:
   - If "well-known" is selected, prioritize higher wellKnownScore
   - If "well-attended" is selected, prioritize higher attendanceScore
   - If "bd-exposure" is selected, prioritize higher bdValueScore
   - If "local-travel" is selected, prioritize higher travelFitScore
   - If "cost-effective" is selected, prioritize higher costScore
   - If "allocator-density" is selected, prioritize events with high allocator attendance
   - If "gp-density" is selected, prioritize events with high GP/dealflow attendance

6. Travel fit scoring:
   - If userRegion is provided and travelPreference is "near-me", prioritize events in/near that region
   - If travelPreference is "domestic", only include US events
   - If travelPreference is "major-hubs", prioritize major cities
   - If travelPreference is "anywhere", no geographic restrictions

7. Budget scoring:
   - "budget": Prioritize free/low-cost events (higher costScore)
   - "standard": Standard pricing events
   - "premium": High-end events (may have lower costScore but higher other scores)

Return ONLY a valid JSON object with this structure:
{
  "events": [
    { /* event 1 */ },
    { /* event 2 */ },
    ...
  ]
}

The "events" array must contain exactly 6 event objects. No markdown, no code blocks, just the JSON object.`;
}

export async function generateEventRecommendations(
  request: EventRecommendationRequest
): Promise<EventSuggestion[]> {
  try {
    console.log('🎯 Generating event recommendations...');

    // Validate inputs
    if (!request.persona) {
      throw new Error('Persona is required');
    }

    if (!request.filters.priorityTypes || request.filters.priorityTypes.length === 0) {
      throw new Error('At least one priority filter is required');
    }

    // Build prompt
    const prompt = buildEventRecommendationPrompt(
      request.persona,
      request.filters,
      request.userRegion
    );

    // Call OpenAI
    const openai = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    console.log(`🤖 Calling OpenAI (${model}) for event recommendations...`);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.7,
      messages: [
        {
          role: 'system',
          content: 'You are an expert event intelligence planner. Return only valid JSON. Return a JSON object with an "events" key containing an array of 6 event objects. No markdown, no code blocks.',
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

    // Extract events array (OpenAI might wrap it in an object)
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
    const validatedEvents: EventSuggestion[] = events.slice(0, 6).map((event: any, index: number) => {
      // Ensure all required fields exist
      const validated: EventSuggestion = {
        name: event.name || `Event ${index + 1}`,
        producerType: (event.producerType || 'Commercial') as EventProducerType,
        organization: event.organization || 'Unknown',
        location: event.location || null,
        dateRange: event.dateRange || null,
        wellKnownScore: Math.max(1, Math.min(10, Number(event.wellKnownScore) || 5)),
        attendanceScore: Math.max(1, Math.min(10, Number(event.attendanceScore) || 5)),
        bdValueScore: Math.max(1, Math.min(10, Number(event.bdValueScore) || 5)),
        travelFitScore: Math.max(1, Math.min(10, Number(event.travelFitScore) || 5)),
        costScore: Math.max(1, Math.min(10, Number(event.costScore) || 5)),
        totalScore: 0, // Will calculate below
        relevanceReason: event.relevanceReason || 'Event recommendation based on persona and filters',
        url: event.url || undefined,
      };

      // Calculate total score
      validated.totalScore =
        validated.wellKnownScore +
        validated.attendanceScore +
        validated.bdValueScore +
        validated.travelFitScore +
        validated.costScore;

      return validated;
    });

    // Ensure we have exactly 6 events
    while (validatedEvents.length < 6) {
      validatedEvents.push({
        name: `Event ${validatedEvents.length + 1}`,
        producerType: 'Commercial',
        organization: 'TBD',
        location: null,
        dateRange: null,
        wellKnownScore: 5,
        attendanceScore: 5,
        bdValueScore: 5,
        travelFitScore: 5,
        costScore: 5,
        totalScore: 25,
        relevanceReason: 'Additional event recommendation',
      });
    }

    console.log(`✅ Generated ${validatedEvents.length} event recommendations`);
    return validatedEvents.slice(0, 6);
  } catch (error) {
    console.error('❌ Event recommendation generation failed:', error);
    throw error;
  }
}

