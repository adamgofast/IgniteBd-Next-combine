/**
 * PersonaSuggestionService
 *
 * Analyzes a contact's full engagement history to extract TWO things and WRITE them to the DB:
 *
 * 1. RELATIONSHIP CONTEXT (source of truth) — factual signals extracted from engagement history:
 *    contextOfRelationship, relationshipRecency, companyAwareness, formerCompany
 *    → persisted to relationship_contexts table (upsert)
 *
 * 2. OUTREACH PERSONA — slug from outreach_personas table that best fits the relationship
 *    → persisted to contact.outreachPersonaSlug
 *
 * INPUT PRIORITY (engagement text used for AI):
 *   1. engagement_log entries (ordered chronologically) — single source of truth
 *   2. contact.notes — legacy fallback when no log entries exist
 *   3. contact.contactSummary — appended as extra context when present
 *
 * Together these drive the outreach build-email prompt and template matching.
 */

import { OpenAI } from 'openai';
import { prisma } from '@/lib/prisma';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (openaiClient) return openaiClient;
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is not configured');
  openaiClient = new OpenAI({ apiKey });
  return openaiClient;
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  INITIAL: 'Initial context (from import)',
  POST_CALL: 'After call',
  POST_MEETING: 'After meeting',
  EMAIL_RESPONSE: 'Email exchange',
};

export interface RelationshipContextInfo {
  contextOfRelationship?: string;
  relationshipRecency?: string;
  companyAwareness?: string;
  formerCompany?: string;
}

export interface PersonaSuggestionResult {
  success: boolean;
  relationshipContext?: RelationshipContextInfo;
  suggestedPersonaSlug?: string | null;
  confidence?: number;
  reasoning?: string;
  persisted?: boolean;
  error?: string;
}

export class PersonaSuggestionService {
  /**
   * Analyze a contact's full engagement history, suggest persona + relationship context,
   * and WRITE both to the database immediately.
   *
   * @param contactId  - Contact to analyze
   * @param noteOverride - Optional extra note text (e.g. from the UI's currently-editing field).
   *                       Prepended to engagement history when provided.
   */
  static async suggestPersona(
    contactId: string,
    noteOverride?: string,
  ): Promise<PersonaSuggestionResult> {
    try {
      // ── Load contact with full engagement data ────────────────────────────────
      const contact = await prisma.contact.findUnique({
        where: { id: contactId },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          title: true,
          companyName: true,
          notes: true,
          contactSummary: true,
          companies: { select: { companyName: true } },
          engagement_log: {
            orderBy: { loggedAt: 'asc' },
            select: { entryType: true, note: true, loggedAt: true },
          },
        },
      });

      if (!contact) {
        return { success: false, error: 'Contact not found' };
      }

      // ── Build engagement text (priority: log > notes fallback) ────────────────
      const logEntries = contact.engagement_log
        .map((entry) => {
          const dateStr = new Date(entry.loggedAt).toISOString().slice(0, 10);
          const label = ENTRY_TYPE_LABELS[entry.entryType] || entry.entryType;
          return `[${dateStr} — ${label}]\n${entry.note}`;
        })
        .join('\n\n');

      const legacyNotes = !logEntries && contact.notes ? `[Legacy notes]\n${contact.notes}` : '';

      const engagementBlob = [
        noteOverride?.trim() ? `[Current note]\n${noteOverride.trim()}` : '',
        logEntries,
        legacyNotes,
      ]
        .filter(Boolean)
        .join('\n\n');

      // Append contactSummary as supplementary context (labeled, not a substitute for raw history)
      const summaryBlock =
        contact.contactSummary?.trim()
          ? `[Synthesized summary — for context only]\n${contact.contactSummary.trim()}`
          : '';

      const fullText = [engagementBlob, summaryBlock].filter(Boolean).join('\n\n');

      if (!fullText.trim()) {
        return { success: false, error: 'No engagement history or notes available to analyze' };
      }

      // ── Load available personas ───────────────────────────────────────────────
      const availablePersonas = await prisma.outreach_personas.findMany({
        select: { slug: true, name: true, description: true },
        orderBy: { name: 'asc' },
      });

      const personaList = availablePersonas.length
        ? availablePersonas
            .map((p) => `- ${p.slug}: ${p.name}${p.description ? ` — ${p.description}` : ''}`)
            .join('\n')
        : '(no personas defined yet)';

      // ── Contact profile header ────────────────────────────────────────────────
      const name =
        [contact.firstName, contact.lastName].filter(Boolean).join(' ') || 'Contact';
      const company =
        contact.companyName || contact.companies?.companyName || null;
      const profileHeader = [
        `Name: ${name}`,
        contact.title ? `Title: ${contact.title}` : null,
        company ? `Company: ${company}` : null,
      ]
        .filter(Boolean)
        .join('\n');

      // ── AI call ───────────────────────────────────────────────────────────────
      const openai = getOpenAIClient();
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          {
            role: 'system',
            content: `You are an expert at analyzing business relationship history for a BD outreach tool. Your output is a JSON object.

Extract exactly THREE relationship signals and choose the best-matching outreach persona.

THREE SIGNALS ONLY — do not add extra fields:

1. contextOfRelationship — how does the user know this contact?
   Values: DONT_KNOW | PRIOR_CONVERSATION | PRIOR_COLLEAGUE | PRIOR_SCHOOLMATE | CURRENT_CLIENT | CONNECTED_LINKEDIN_ONLY | REFERRAL | REFERRAL_FROM_WARM_CONTACT | USED_TO_WORK_AT_TARGET_COMPANY

2. relationshipRecency — how recent/active is the relationship?
   Values: NEW | RECENT | STALE | LONG_DORMANT

3. companyAwareness — does the contact know the user's company/service?
   Values: DONT_KNOW | KNOWS_COMPANY | KNOWS_COMPANY_COMPETITOR | KNOWS_BUT_DISENGAGED

Also extract formerCompany (string) ONLY if a specific company is explicitly mentioned as a shared past employer or the place where they met. Set null if unclear.

Return JSON exactly:
{
  "relationshipContext": {
    "contextOfRelationship": "<value>",
    "relationshipRecency": "<value>",
    "companyAwareness": "<value>",
    "formerCompany": "<string or null>"
  },
  "suggestedPersonaSlug": "<must exactly match an available slug, or null if none fit>",
  "confidence": <0-100>,
  "reasoning": "<one sentence explaining the persona fit>"
}`,
          },
          {
            role: 'user',
            content: `Contact profile:\n${profileHeader}\n\nEngagement history:\n${fullText}\n\nAvailable Outreach Personas:\n${personaList}\n\nReturn JSON with the three relationship signals, formerCompany, suggestedPersonaSlug, confidence, and reasoning.`,
          },
        ],
        temperature: 0.3,
      });

      const responseContent = completion.choices[0]?.message?.content;
      if (!responseContent) {
        return { success: false, error: 'No response from AI' };
      }

      // ── Parse AI response ─────────────────────────────────────────────────────
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseContent);
      } catch {
        const jsonMatch = responseContent.match(/```(?:json)?\s*(\{[\s\S]*\})\s*```/);
        if (jsonMatch) parsedResponse = JSON.parse(jsonMatch[1]);
        else throw new Error('Could not parse AI response as JSON');
      }

      const { relationshipContext, suggestedPersonaSlug, confidence, reasoning } = parsedResponse;

      // Validate suggested persona exists
      const personaValid =
        suggestedPersonaSlug &&
        availablePersonas.some((p) => p.slug === suggestedPersonaSlug);

      if (suggestedPersonaSlug && !personaValid) {
        console.warn(
          `PersonaSuggestionService: suggested slug "${suggestedPersonaSlug}" not in available personas — will not persist`,
        );
      }

      // ── Persist to DB ─────────────────────────────────────────────────────────
      let persisted = false;
      try {
        await prisma.$transaction(async (tx) => {
          // 1. Upsert relationship_contexts
          if (relationshipContext && typeof relationshipContext === 'object') {
            const contextData = {
              contactId,
              contextOfRelationship: relationshipContext.contextOfRelationship || null,
              relationshipRecency: relationshipContext.relationshipRecency || null,
              companyAwareness: relationshipContext.companyAwareness || null,
              formerCompany: relationshipContext.formerCompany || null,
            };
            await tx.relationship_contexts.upsert({
              where: { contactId },
              update: contextData,
              create: contextData,
            });
          }

          // 2. Update outreachPersonaSlug on the contact (only when valid)
          if (personaValid) {
            await tx.contact.update({
              where: { id: contactId },
              data: { outreachPersonaSlug: suggestedPersonaSlug },
            });
          }
        });
        persisted = true;
      } catch (dbErr: any) {
        console.error('PersonaSuggestionService: failed to persist to DB:', dbErr);
        // Return result anyway — caller can decide whether to surface the error
      }

      return {
        success: true,
        relationshipContext: relationshipContext || {},
        suggestedPersonaSlug: personaValid ? suggestedPersonaSlug : null,
        confidence: typeof confidence === 'number' ? Math.max(0, Math.min(100, confidence)) : undefined,
        reasoning: reasoning || 'No reasoning provided',
        persisted,
      };
    } catch (error: any) {
      console.error('PersonaSuggestionService error:', error);
      return {
        success: false,
        error: error.message || 'Failed to analyze engagement history and suggest persona',
      };
    }
  }
}
