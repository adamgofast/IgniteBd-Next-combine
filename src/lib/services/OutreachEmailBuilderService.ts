/**
 * OutreachEmailBuilderService
 *
 * Single path for building outreach emails: contact notes (or notesOverride) + persona hint
 * + relationship context + company context → AI-generated subject and body.
 * No snippet assembly, no template fetch; used by POST /api/contacts/[contactId]/build-email.
 *
 * Email type is derived from Contact engagement fields:
 *   - lastEngagementDate = null           → FIRST_TIME (initial outreach)
 *   - lastEngagementDate set              → FOLLOWUP
 *   - lastEngagementType CONTACT_RESPONSE → they replied; follow-up continues conversation
 *   - lastEngagementType OUTBOUND_EMAIL   → no reply yet; nudge follow-up
 *   - lastEngagementType MEETING          → post-meeting follow-up
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

function getSeasonalContext(month: number, day: number, year: number): string {
  const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December'];
  let season = 'Winter season';
  let weather = 'Winter weather (cold, holiday season)';
  if (month >= 2 && month <= 4)  { season = 'Spring season'; weather = 'Spring weather (warming up, flowers blooming)'; }
  if (month >= 5 && month <= 7)  { season = 'Summer season'; weather = 'Summer weather (warm, sunny)'; }
  if (month >= 8 && month <= 10) { season = 'Fall/Autumn season'; weather = 'Fall weather (cooling down, leaves changing)'; }

  const holidays: string[] = [];
  if (month === 0 && day <= 7)            holidays.push('Early January (post-New Year)');
  if (month === 10 && day >= 20)          holidays.push('Thanksgiving season');
  if (month === 11 && day >= 20)          holidays.push('Holiday season (December)');
  if (month === 6 && day === 4)           holidays.push('Independence Day (US)');

  return `Date: ${monthNames[month]} ${day}, ${year}
Season: ${season}${holidays.length ? ` | ${holidays.join(', ')}` : ''}
Weather: ${weather}
Note: Incorporate seasonal context naturally when it fits the relationship tone.`;
}

let openaiClient: OpenAI | null = null;
function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

export interface EmailBuildRequest {
  contactId: string;
  personaSlug?: string | null;
  /** When set, used as the notes/context in the contact block instead of contact.notes/contactSummary */
  notesOverride?: string | null;
  relationshipContext?: {
    contextOfRelationship?: string;
    relationshipRecency?: string;
    companyAwareness?: string;
    formerCompany?: string;
  };
  companyHQId?: string;
}

export interface EmailBuildResult {
  success: boolean;
  emailType?: 'FIRST_TIME' | 'FOLLOWUP';
  subject?: string;
  body?: string;
  reasoning?: string;
  error?: string;
}

export class OutreachEmailBuilderService {
  static async buildEmail(request: EmailBuildRequest): Promise<EmailBuildResult> {
    try {
      const { contactId, personaSlug, notesOverride, relationshipContext, companyHQId } = request;

      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          goesBy: true,
          email: true,
          title: true,
          notes: true,
          lastEngagementDate: true,
          lastEngagementType: true,
          contactSummary: true,
          companyName: true,
          companies: { select: { companyName: true } },
        },
      });

      if (!contact) return { success: false, error: 'Contact not found' };

      // ── Engagement state — derived entirely from Contact fields ──
      const contactEngaged   = !!contact.lastEngagementDate;
      const contactResponded = contact.lastEngagementType === 'CONTACT_RESPONSE';
      const hadMeeting       = contact.lastEngagementType === 'MEETING';
      const daysSince        = contact.lastEngagementDate
        ? Math.floor((Date.now() - new Date(contact.lastEngagementDate).getTime()) / 86400000)
        : null;
      const emailType: 'FIRST_TIME' | 'FOLLOWUP' = contactEngaged ? 'FOLLOWUP' : 'FIRST_TIME';

      // ── Last email subject for follow-up reference ──
      let lastSubject: string | null = null;
      if (emailType === 'FOLLOWUP') {
        const lastActivity = await prisma.email_activities.findFirst({
          where: { contact_id: contactId },
          orderBy: { createdAt: 'desc' },
          select: { subject: true },
        });
        lastSubject = lastActivity?.subject ?? null;
      }

      // ── Company context ──
      let companyContext = '';
      if (companyHQId) {
        const company = await prisma.company_hqs.findUnique({
          where: { id: companyHQId },
          select: { companyName: true, whatYouDo: true },
        });
        if (company) companyContext = `Our Company: ${company.companyName}\nWhat We Do: ${company.whatYouDo || 'Not specified'}`;
      }

      // ── Persona hydration — load name + description from DB ──
      let personaBlock = '';
      if (personaSlug) {
        const personaRow = await prisma.outreach_personas.findUnique({
          where: { slug: personaSlug },
          select: { name: true, description: true },
        });
        if (personaRow) {
          personaBlock = `Outreach Persona: ${personaRow.name}${personaRow.description ? `\nPersona Guidance: ${personaRow.description}` : ''}`;
        } else {
          personaBlock = `Outreach Persona: ${personaSlug}`;
        }
      }

      const contactCompany = contact.companyName || contact.companies?.companyName || null;

      // ── Seasonal context ──
      const now = new Date();
      const seasonalContext = getSeasonalContext(now.getMonth(), now.getDate(), now.getFullYear());

      // ── Build reasoning string (replaces the old service's output) ──
      let reasoning = emailType === 'FIRST_TIME'
        ? 'No prior engagement recorded — initial outreach.'
        : `Last engagement ${daysSince} day${daysSince !== 1 ? 's' : ''} ago (${contact.lastEngagementType ?? 'unknown type'}).`;
      if (contactResponded) reasoning += ' Contact responded — continuing the conversation.';
      if (hadMeeting)       reasoning += ' Met in person — following up post-meeting.';
      if (!contactResponded && !hadMeeting && emailType === 'FOLLOWUP') reasoning += ' No response yet — nudge follow-up.';
      if (daysSince !== null && daysSince >= 90) reasoning += ' Quarterly check-in cadence.';

      // ── Prompts ──
      const openai = getOpenAIClient();
      const systemPrompt = `You are an expert at writing personalized business development outreach emails. Write professional, authentic emails that feel natural and build relationships.

Guidelines:
- Be concise but warm
- Personalize based on relationship and engagement context
- For follow-ups, reference prior contact naturally — never robotic
- Avoid pushy or salesy language
- Match tone to the relationship type
- Incorporate seasonal context naturally when appropriate

You must respond with a JSON object containing exactly two string keys: "subject" (the email subject line) and "body" (the full email body). No other keys. No markdown fences.`;

      const notesOrSummary = (notesOverride != null && notesOverride.trim() !== '')
        ? notesOverride.trim()
        : [contact.notes, contact.contactSummary].filter(Boolean).join('\n\n') || '';
      const contactBlock = `Contact:
- Name: ${contact.goesBy || `${contact.firstName ?? ''} ${contact.lastName ?? ''}`.trim() || contact.email}
- Title: ${contact.title || 'Not specified'}
- Company: ${contactCompany || 'Not specified'}
${notesOrSummary ? `- Notes / context: ${notesOrSummary}` : ''}`;

      const contextBlock = [
        companyContext,
        personaBlock,
        relationshipContext ? `Relationship Context:\n${JSON.stringify(relationshipContext, null, 2)}` : '',
        `Current Date Context:\n${seasonalContext}`,
      ].filter(Boolean).join('\n\n');

      let userPrompt = '';

      if (emailType === 'FIRST_TIME') {
        userPrompt = `Write a FIRST-OUTBOUND outreach email for:

${contactBlock}

${contextBlock}

Generate a subject line and email body that:
- Introduces your company naturally
- References any relationship context (former colleague, prior conversation, referral, etc.)
- Opens a conversation with a soft call-to-action

Respond as a JSON object with keys "subject" and "body".`;
      } else {
        const followUpTone = contactResponded
          ? '- Acknowledge their response and continue the conversation naturally\n- Reference what they said'
          : hadMeeting
          ? '- Reference the meeting warmly and propose a clear next step'
          : daysSince !== null && daysSince >= 90
          ? '- Quarterly check-in tone: "Wanted to continue our conversation and see where things stand"'
          : daysSince !== null && daysSince >= 7
          ? '- Friendly nudge: "Just checking back — wanted to make sure this didn\'t get buried"'
          : '- Recent follow-up with appropriate tone';

        userPrompt = `Write a FOLLOWUP outreach email for:

${contactBlock}

${contextBlock}

Follow-up context:
- Days since last contact: ${daysSince ?? 'unknown'}
${lastSubject ? `- Previous email subject: "${lastSubject}"` : ''}
- Engagement type: ${contact.lastEngagementType ?? 'unknown'}
- Context: ${reasoning}

Generate a subject line and email body that:
${followUpTone}
- Continues the conversation without being pushy
- Has a soft call-to-action

Respond as a JSON object with keys "subject" and "body".`;
      }

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.7,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) return { success: false, error: 'No response from AI' };

      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch {
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[1]);
        else throw new Error('Could not parse AI response as JSON');
      }

      return {
        success: true,
        emailType,
        subject: parsedResponse.subject || '',
        body: parsedResponse.body || '',
        reasoning,
      };
    } catch (error: any) {
      console.error('Error building email:', error);
      return { success: false, error: error.message || 'Failed to build email' };
    }
  }
}
