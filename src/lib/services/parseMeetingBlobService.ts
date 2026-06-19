/**
 * parseMeetingBlobService
 *
 * Parses free-text meeting notes (from user or VA) to extract structured data.
 * Example: "Joel has an upcoming meeting with x, a former client. This person
 * reached out via the website and is from Acme Corp."
 */

import { OpenAI } from 'openai';

export interface ParsedMeetingBlob {
  contactName: string | null;
  contactEmail: string | null;
  companyName: string | null;
  meetingContext: string | null;   // e.g. "upcoming meeting", "former client"
  relationshipHints: string | null; // e.g. "former client", "reached out via website"
  suggestedMeetingType: string | null; // INTRO | FOLLOW_UP | PROPOSAL_REVIEW | CHECK_IN | OTHER
  suggestedDisposition: string | null;  // WARM | NEUTRAL | etc.
  rawNotes: string | null;         // cleaned version of the blob for notes field
}

const MEETING_TYPES = ['INTRO', 'FOLLOW_UP', 'PROPOSAL_REVIEW', 'CHECK_IN', 'OTHER'];
const DISPOSITIONS = ['ADVOCATE', 'WARM', 'WARM_WRONG_CONTACT', 'WARM_NO_NEED', 'NEUTRAL', 'COOLING'];

export async function parseMeetingBlobService(blob: string): Promise<ParsedMeetingBlob> {
  const trimmed = blob?.trim() || '';
  if (!trimmed) {
    throw new Error('No content to parse');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const systemPrompt = `You are a CRM assistant. Parse free-text meeting notes (from a user or VA) into structured data.

The text may describe:
- An upcoming meeting (pre-meeting)
- A meeting that just happened (post-meeting)
- Contact cues: name, email, company
- Relationship context: "former client", "reached out via website", "cold outreach", etc.

Extract:
1. contactName — the prospect/contact (may be "x" or placeholder; extract what you can)
2. contactEmail — if mentioned
3. companyName — company or org if mentioned
4. meetingContext — brief context: "upcoming intro meeting", "follow-up after proposal", etc.
5. relationshipHints — relationship/lead-source cues: "former client", "website inquiry", "referral"
6. suggestedMeetingType — one of: INTRO, FOLLOW_UP, PROPOSAL_REVIEW, CHECK_IN, OTHER
7. suggestedDisposition — one of: ADVOCATE, WARM, WARM_WRONG_CONTACT, WARM_NO_NEED, NEUTRAL, COOLING
8. rawNotes — a cleaned version of the text suitable for the meeting notes field (preserve key details)

Return JSON only:
{
  "contactName": string or null,
  "contactEmail": string or null,
  "companyName": string or null,
  "meetingContext": string or null,
  "relationshipHints": string or null,
  "suggestedMeetingType": "INTRO"|"FOLLOW_UP"|"PROPOSAL_REVIEW"|"CHECK_IN"|"OTHER" or null,
  "suggestedDisposition": "ADVOCATE"|"WARM"|"WARM_WRONG_CONTACT"|"WARM_NO_NEED"|"NEUTRAL"|"COOLING" or null,
  "rawNotes": string or null
}`;

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Parse this meeting note:\n\n${trimmed}` },
    ],
    response_format: { type: 'json_object' },
  });

  const content = completion.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error('No response from OpenAI');
  }

  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch {
    const match = content.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  }

  const p = parsed.parsed || parsed;

  return {
    contactName: p.contactName ?? null,
    contactEmail: p.contactEmail ?? null,
    companyName: p.companyName ?? null,
    meetingContext: p.meetingContext ?? null,
    relationshipHints: p.relationshipHints ?? null,
    suggestedMeetingType: MEETING_TYPES.includes(p.suggestedMeetingType) ? p.suggestedMeetingType : null,
    suggestedDisposition: DISPOSITIONS.includes(p.suggestedDisposition) ? p.suggestedDisposition : null,
    rawNotes: p.rawNotes ?? trimmed,
  };
}
