/**
 * ENGAGEMENT SERVICE
 *
 * Two functions. That's it.
 *
 * lastEngagementDate + lastEngagementType — written directly by routes when
 * an event happens (send, respond, meeting, inbound parse). No service wrapper.
 *
 * nextEngagementDate — computed here. Manual UI overrides write directly.
 *
 * Disposition → cadence days:
 *   ADVOCATE / WARM / NEUTRAL / null  →  7 days  (AI-inferred preferred)
 *   WARM_WRONG_CONTACT                → 90 days  (quarterly)
 *   WARM_NO_NEED / COOLING            → 180 days (semi-annual)
 *   OPTED_OUT                         → null     (clears nextEngagementDate)
 */

import { prisma } from '../prisma.js';
import { OpenAI } from 'openai';

const DEFAULT_CADENCE_DAYS = 7;

export function cadenceDaysForDisposition(disposition) {
  switch (disposition) {
    case 'WARM_WRONG_CONTACT': return 90;
    case 'WARM_NO_NEED':
    case 'COOLING':            return 180;
    case 'OPTED_OUT':          return null;
    default:                   return DEFAULT_CADENCE_DAYS;
  }
}

function getTodayString() {
  return new Date().toISOString().slice(0, 10);
}

function toDateOnlyString(d) {
  if (!d) return null;
  return new Date(d).toISOString().slice(0, 10);
}

function addDays(dateStr, n) {
  const d = new Date(dateStr + 'T12:00:00.000Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * Full AI inference from email summaries.
 * Returns disposition, nextEngagementDate, pipelineStage — all in one call.
 * Called only when manually triggered (Calculate Engagement button).
 */
async function inferEngagementSignals(summaries, contact, todayStr) {
  if (!summaries || summaries.length === 0) return null;
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const summaryBlock = summaries
      .map((a) => {
        const date = (a.sentAt || a.createdAt);
        const dateStr = date ? new Date(date).toISOString().slice(0, 10) : 'unknown';
        const dir = a.emailSequenceOrder === 'CONTACT_SEND' ? '← contact' : '→ outbound';
        return `[${dateStr} ${dir}] ${a.summary}`;
      })
      .join('\n');

    const contactBlock = [
      contact.notes && `Owner notes: ${contact.notes}`,
      contact.contactDisposition && `Current disposition: ${contact.contactDisposition}`,
      contact.lastEngagementDate && `Last engagement: ${new Date(contact.lastEngagementDate).toISOString().slice(0, 10)}`,
    ].filter(Boolean).join('\n');

    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || 'gpt-4o',
      temperature: 0.1,
      max_tokens: 200,
      messages: [
        {
          role: 'system',
          content: `You analyze CRM email history and return structured engagement signals. Today is ${todayStr}.

DISPOSITION values (pick the best fit):
- ADVOCATE: champion, would make intros, actively helpful
- WARM: friendly, receptive, solid relationship
- WARM_WRONG_CONTACT: good relationship but not the buyer — useful for intro
- WARM_NO_NEED: friendly but has another vendor/service right now
- NEUTRAL: indifferent, not resistant but not enthusiastic
- COOLING: went cold, was put off, or is unresponsive
- OPTED_OUT: explicitly asked to stop contact

PIPELINE STAGE values (prospect pipeline):
- need-to-engage: never contacted
- interest: initial contact made, some engagement
- engaged-awaiting-response: outreach sent, waiting
- meeting: meeting scheduled or held
- proposal: proposal or detailed discussion stage
- contract: contract/agreement in progress
- contract-signed: closed

NEXT ENGAGEMENT DATE rules (be aggressive about inferring):
- "follow up later this year" / "in a few months" → ~5-6 months from today
- "follow up in 3-6 months" → midpoint ~4-5 months from today
- "not interested" / opted out → null
- "reach out next quarter" → first day of next quarter
- no explicit timing but warm → 14 days
- no explicit timing but cooling → 90 days

Return ONLY valid JSON:
{
  "disposition": "WARM",
  "nextEngagementDate": "YYYY-MM-DD or null",
  "pipelineStage": "stage-name or null",
  "reasoning": "one sentence"
}`,
        },
        {
          role: 'user',
          content: [
            contactBlock && `Contact context:\n${contactBlock}`,
            `Email history:\n${summaryBlock}`,
          ].filter(Boolean).join('\n\n'),
        },
      ],
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices?.[0]?.message?.content;
    if (!raw) return null;
    const parsed = JSON.parse(raw);

    const VALID_DISPOSITIONS = ['ADVOCATE','WARM','WARM_WRONG_CONTACT','WARM_NO_NEED','NEUTRAL','COOLING','OPTED_OUT'];
    const VALID_STAGES = ['need-to-engage','interest','engaged-awaiting-response','meeting','proposal','contract','contract-signed'];

    return {
      disposition: VALID_DISPOSITIONS.includes(parsed.disposition) ? parsed.disposition : null,
      nextEngagementDate: typeof parsed.nextEngagementDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(parsed.nextEngagementDate)
        ? parsed.nextEngagementDate : null,
      pipelineStage: VALID_STAGES.includes(parsed.pipelineStage) ? parsed.pipelineStage : null,
      reasoning: parsed.reasoning || null,
    };
  } catch (e) {
    console.warn('⚠️ inferEngagementSignals failed:', e?.message);
    return null;
  }
}

/**
 * Compute and persist nextEngagementDate (and optionally disposition + pipeline stage).
 *
 * options.force = true  → full AI inference: disposition + pipelineStage + nextEngagementDate
 *                         Triggered by the "Calculate Engagement" button. Always overwrites.
 * options.force = false → lightweight: only sets nextEngagementDate if not already set.
 *                         Used by automated post-send triggers. Does not touch disposition.
 *
 * @param {string} contactId
 * @param {{ force?: boolean }} options
 * @returns {{ updated: boolean, nextEngagementDate: string|null, source: string, disposition?: string, pipelineStage?: string }}
 */
export async function computeNextEngagement(contactId, options = {}) {
  const { force = false } = options;
  try {
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      select: {
        id: true,
        contactDisposition: true,
        lastEngagementDate: true,
        nextEngagementDate: true,
        notes: true,
      },
    });

    if (!contact) return { updated: false, error: 'Contact not found' };

    // Hard gate: OPTED_OUT always clears, regardless of force
    if (contact.contactDisposition === 'OPTED_OUT') {
      await prisma.contact.update({
        where: { id: contactId },
        data: { nextEngagementDate: null, nextEngagementPurpose: null },
      });
      return { updated: true, nextEngagementDate: null, source: 'opted_out' };
    }

    // Lightweight mode: skip if date already set
    if (!force && contact.nextEngagementDate) {
      return { updated: false, nextEngagementDate: contact.nextEngagementDate, source: 'already_set' };
    }

    const todayStr = getTodayString();

    // Full AI inference when force=true and we have email summaries
    if (force) {
      const summaries = await prisma.email_activities.findMany({
        where: { contact_id: contactId, summary: { not: null } },
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: { summary: true, sentAt: true, createdAt: true, emailSequenceOrder: true },
      });

      if (summaries.length > 0) {
        const signals = await inferEngagementSignals(summaries, contact, todayStr);

        if (signals) {
          const contactUpdate = {};
          const results = { source: 'ai_full_inference', reasoning: signals.reasoning };

          // Set disposition (unless OPTED_OUT — already handled above)
          if (signals.disposition && signals.disposition !== 'OPTED_OUT') {
            contactUpdate.contactDisposition = signals.disposition;
            results.disposition = signals.disposition;

            // If AI says OPTED_OUT, clear date too
          } else if (signals.disposition === 'OPTED_OUT') {
            contactUpdate.nextEngagementDate = null;
            contactUpdate.nextEngagementPurpose = null;
            await prisma.contact.update({ where: { id: contactId }, data: contactUpdate });
            return { updated: true, nextEngagementDate: null, source: 'opted_out_ai', disposition: 'OPTED_OUT' };
          }

          // Set next engagement date
          if (signals.nextEngagementDate) {
            contactUpdate.nextEngagementDate = signals.nextEngagementDate;
            results.nextEngagementDate = signals.nextEngagementDate;
            results.updated = true;
          } else if (!contact.nextEngagementDate && contact.lastEngagementDate) {
            // Fallback to cadence if AI didn't infer a date
            const cd = cadenceDaysForDisposition(signals.disposition || contact.contactDisposition);
            if (cd) {
              const fallbackDate = addDays(toDateOnlyString(contact.lastEngagementDate), cd);
              contactUpdate.nextEngagementDate = fallbackDate;
              results.nextEngagementDate = fallbackDate;
              results.source = 'ai_disposition_cadence';
              results.updated = true;
            }
          }

          if (Object.keys(contactUpdate).length > 0) {
            await prisma.contact.update({ where: { id: contactId }, data: contactUpdate });
          }

          // Update pipeline stage if inferred and contact has a pipeline
          if (signals.pipelineStage) {
            try {
              const pipeline = await prisma.pipelines.findUnique({ where: { contactId } });
              if (pipeline && pipeline.stage !== signals.pipelineStage) {
                await prisma.pipelines.update({
                  where: { contactId },
                  data: { stage: signals.pipelineStage },
                });
                const { snapPipelineOnContact } = await import('@/lib/services/pipelineService');
                await snapPipelineOnContact(contactId, pipeline.pipeline, signals.pipelineStage);
                results.pipelineStage = signals.pipelineStage;
              }
            } catch (pipeErr) {
              console.warn('⚠️ Pipeline stage update skipped:', pipeErr?.message);
            }
          }

          return { updated: !!results.updated, ...results };
        }
      }

      // force=true but no summaries — fall through to cadence logic below
    }

    // Lightweight fallback: cadence from lastEngagementDate
    if (!contact.lastEngagementDate) {
      return { updated: false, nextEngagementDate: null, source: 'no_engagement' };
    }

    const cadenceDays = cadenceDaysForDisposition(contact.contactDisposition);
    if (!cadenceDays) {
      return { updated: false, nextEngagementDate: null, source: 'no_cadence' };
    }

    const nextStr = addDays(toDateOnlyString(contact.lastEngagementDate), cadenceDays);
    await prisma.contact.update({ where: { id: contactId }, data: { nextEngagementDate: nextStr } });
    return { updated: true, nextEngagementDate: nextStr, source: 'disposition_cadence', cadenceDays };
  } catch (e) {
    if (e?.code === 'P2022' || e?.message?.includes('nextEngagementDate')) return { updated: false };
    throw e;
  }
}

/**
 * All contacts for a company that have a nextEngagementDate set.
 * OPTED_OUT contacts never appear because their date is always null.
 * Frontend buckets by date: today / this week / next month.
 *
 * @returns {Promise<Array>}
 */
export async function listContactsDue(companyHQId, options = {}) {
  const { limit = 500 } = options;

  const contacts = await prisma.contact.findMany({
    where: { crmId: companyHQId, nextEngagementDate: { not: null } },
    orderBy: { nextEngagementDate: 'asc' },
    take: limit,
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      goesBy: true,
      title: true,
      companyName: true,
      companies: { select: { companyName: true } },
      nextEngagementDate: true,
      nextEngagementPurpose: true,
      nextContactNote: true,
      lastEngagementDate: true,
      lastEngagementType: true,
      contactDisposition: true,
      pipelineSnap: true,
      pipelineStageSnap: true,
      engagementSummary: true,
    },
  });

  return contacts.map((c) => ({
    contactId: c.id,
    firstName: c.firstName,
    lastName: c.lastName,
    email: c.email,
    goesBy: c.goesBy,
    title: c.title ?? null,
    company: c.companyName || c.companies?.companyName || null,
    nextEngagementDate: c.nextEngagementDate ?? null,
    nextEngagementPurpose: c.nextEngagementPurpose ?? null,
    nextContactNote: c.nextContactNote ?? null,
    lastEngagementDate: c.lastEngagementDate ? c.lastEngagementDate.toISOString() : null,
    lastEngagementType: c.lastEngagementType ?? null,
    contactDisposition: c.contactDisposition ?? null,
    pipeline: c.pipelineSnap ?? null,
    stage: c.pipelineStageSnap ?? null,
    engagementSummary: c.engagementSummary ?? null,
  }));
}
