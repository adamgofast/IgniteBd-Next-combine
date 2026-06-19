/**
 * EventPickerService
 * 
 * EXPLORATORY AI PLUMBING - NOT A RULES ENGINE
 * 
 * Flow:
 * 1. Hydrate the FULL preference + context object
 * 2. Send that object to OpenAI
 * 3. Ask OpenAI to reason about events
 * 4. Return the OpenAI response AS-IS (JSON)
 * 5. Done
 * 
 * No filtering. No branching. No "if empty then". No database-vs-generated logic.
 * No enrichment. No safety rails.
 * 
 * We are discovering shape — not enforcing schema.
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

export interface EventPickerModel {
  eventTitle: string;
  description: string;
  whyGo: string;
  location?: string; // City, State or City, Country
  timeFrame?: string; // General timeframe like "Q1 2025", "Spring 2025", "Early 2025", "Mid-2025", "Late 2025", "Upcoming"
  sponsor?: string; // Main sponsor or organizer name
  costEstimate?: string; // Cost estimate like "$500-$2,000", "Free", "$5,000+"
}

export interface EventPickerResponse {
  eventPickerModel: EventPickerModel[];
}

/**
 * Generate event recommendations from EventTuner using OpenAI
 * Returns OpenAI response AS-IS - no filtering, no enrichment, no post-processing
 */
export async function pickEventsByPreferences(
  eventTunerId: string
): Promise<EventPickerResponse> {
  console.log(`🎯 EventPickerService: Starting for tunerId: ${eventTunerId}`);

  // 1. Hydrate the FULL preference + context object
  const tuner = await prisma.event_tuners.findUnique({
    where: { id: eventTunerId },
    include: {
      event_tuner_states: true,
      event_tuner_personas: {
        include: {
          personas: true,
        },
      },
    },
  });

  if (!tuner) {
    throw new Error('EventTuner not found');
  }

  // Build the FULL hydrated object
  const hydratedContext = {
    preferences: {
      name: tuner.name,
      costRange: tuner.costRange,
      travelDistance: tuner.travelDistance,
      eventSearchRawText: tuner.eventSearchRawText,
      conferencesPerQuarter: tuner.conferencesPerQuarter,
      preferredStates: tuner.event_tuner_states.map(ps => ps.state),
    },
    persona: tuner.event_tuner_personas.length > 0 ? {
      personName: tuner.event_tuner_personas[0].personas.personName,
      title: tuner.event_tuner_personas[0].personas.title,
      industry: tuner.event_tuner_personas[0].personas.industry,
      location: tuner.event_tuner_personas[0].personas.location,
      description: tuner.event_tuner_personas[0].personas.description,
    } : null,
  };

  console.log(`📦 EventPickerService: Hydrated context:`, JSON.stringify(hydratedContext, null, 2));

  // 2. Build the prompt
  const systemPrompt = `You are an event recommendation assistant.
Return ONLY valid JSON.
No markdown.
No explanations.
No text outside the JSON object.`;

  const userPrompt = `You are given a complete event preference object and context.

Your task:
Based on the preferences and context below, recommend events that the user should consider attending.

You are NOT limited to the database events.
If database events are empty or not ideal, recommend reasonable real-world events based on your knowledge.

We are exploring ideas — perfection is not required.

INPUT CONTEXT (JSON)

${JSON.stringify(hydratedContext, null, 2)}

OUTPUT FORMAT (STRICT)

You MUST return JSON in exactly this format, organized by quarters:

{
  "eventPickerModel": [
    {
      "eventTitle": "Name of the event",
      "description": "What this event is about in plain language",
      "whyGo": "Why this event makes sense given the preferences",
      "location": "City, State or City, Country (e.g., 'San Francisco, CA' or 'New York, NY')",
      "timeFrame": "Q1 2025, Q2 2025, Q3 2025, or Q4 2025 - use quarter format",
      "sponsor": "Main sponsor or organizer name (optional, only if known)",
      "costEstimate": "Cost estimate like '$500-$2,000', 'Free', '$5,000+', 'TBD' (optional)"
    }
  ]
}

CRITICAL ORGANIZATION RULES:
- YOU MUST organize events by quarters: Q1 2025, Q2 2025, Q3 2025, Q4 2025
- Return at least 3 events per quarter (3+N format - 3 options plus more if relevant)
- Distribute events evenly across all 4 quarters
- If user specified conferencesPerQuarter, use that as the minimum per quarter, but still give 3+ options per quarter
- Use timeFrame format EXACTLY: "Q1 2025", "Q2 2025", "Q3 2025", "Q4 2025" (NOT "Spring 2025", "Early 2025", or any other format)
- Ensure every quarter has events - don't skip quarters

Rules:
- eventPickerModel MUST be an array
- Return at least 12 events total (3 per quarter minimum)
- Be concise but thoughtful
- Include location and timeFrame for all events
- Include sponsor and costEstimate only if you have reasonable information
- Do not invent IDs or metadata
- Do not include anything outside the JSON object`;

  console.log(`📝 EventPickerService: Prompt length: ${userPrompt.length} chars`);

  // 3. Call OpenAI ONCE
  const openai = getOpenAIClient();
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  console.log(`🤖 EventPickerService: Calling OpenAI (${model})...`);

  const completion = await openai.chat.completions.create({
    model,
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
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    console.error('❌ EventPickerService: No response from OpenAI');
    throw new Error('No response from OpenAI');
  }

  console.log(`✅ EventPickerService: Received response from OpenAI (${content.length} chars)`);
  console.log(`📄 EventPickerService: Raw OpenAI response:`, content);

  // 4. Parse JSON
  let pickerData: EventPickerResponse;
  try {
    pickerData = JSON.parse(content);
    console.log(`✅ EventPickerService: Successfully parsed JSON`);
  } catch (parseError) {
    console.error('❌ EventPickerService: Failed to parse OpenAI JSON response:', parseError);
    console.error('❌ EventPickerService: Raw response:', content);
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      console.log('⚠️ EventPickerService: Attempting to extract JSON from markdown...');
      pickerData = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  // 5. Minimal validation: ensure eventPickerModel is an array
  if (!pickerData.eventPickerModel || !Array.isArray(pickerData.eventPickerModel)) {
    console.error('❌ EventPickerService: eventPickerModel is not an array');
    console.error('❌ EventPickerService: Response structure:', pickerData);
    throw new Error('OpenAI response does not contain eventPickerModel array');
  }

  console.log(`✅ EventPickerService: Validated response, ${pickerData.eventPickerModel.length} events returned`);

  // 6. Return JSON directly - AS-IS
  return pickerData;
}
