/**
 * AI Engagement Interpreter
 *
 * Interprets parsed email content for engagement meaning — what the contact is saying,
 * disposition, next steps. Does NOT do structural parsing (use universalEmailParser for that).
 *
 * Input: Parsed email (from universal parser) + owner context
 * Output: summary, isResponse, nextEngagementDate, nextEngagementPurpose, contactEmail, contactName
 */

import { OpenAI } from 'openai';
import {
  NEXT_ENGAGEMENT_PURPOSE_ENUM_FOR_PROMPT,
  normalizeAiNextEngagementPurpose,
} from '@/lib/constants/nextEngagementPurpose';

export interface ParsedEmailInput {
  from?: string | null;
  fromEmail?: string | null;
  fromName?: string | null;
  to?: string | null;
  toEmail?: string | null;
  toName?: string | null;
  subject?: string | null;
  body?: string | null;
  headers?: string | null;
  raw?: string | null;
}

export interface OwnerContext {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
}

export type ActivityType =
  | 'inbound_email'   // An actual email FROM the contact TO the owner
  | 'outbound_email'  // An email FROM the owner TO the contact (forwarded to CRM)
  | 'call_note'       // Owner logging a phone call they had with the contact
  | 'meeting_note'    // Owner logging an in-person or video meeting
  | 'note';           // General update/note with no specific activity type

/** Default next-touch offset for forwarded proof-of-send outbound (no explicit timing in email). */
const OUTBOUND_PROOF_DEFAULT_FOLLOWUP_DAYS = 7;

/** Add calendar days to an ISO date string (YYYY-MM-DD), UTC-safe for CRM date-only fields. */
function addDaysIsoDate(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** Infer outbound/received email calendar day from RFC Date header (UTC date slice). */
function extractDateHeaderIso(parsedEmail: ParsedEmailInput): string | null {
  const h = parsedEmail.headers;
  if (!h) return null;
  const m = /^Date:\s*(.+)$/im.exec(h);
  if (!m) return null;
  const d = new Date(m[1].trim());
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

function warnIfNextEngagementDateInPast(
  nextEngagementDate: string | null,
  todayStr: string,
): void {
  if (!nextEngagementDate) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(nextEngagementDate)) return;
  if (nextEngagementDate < todayStr) {
    console.warn('⚠️ nextEngagementDate is in the past (explicit date preserved):', {
      nextEngagementDate,
      todayStr,
    });
  }
}

export interface EngagementInterpretation {
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  /** Company/firm name for the contact when visible (e.g. signature line). */
  contactCompany: string | null;
  nextEngagementDate: string | null; // ISO date "YYYY-MM-DD" or null
  /** Suggested next touch purpose — must be one of NextEngagementPurpose or null. */
  nextEngagementPurpose: string | null;
  inReplyTo: string | null;
  references: string[] | null;
  isResponse: boolean;
  summary: string; // 1-2 sentence summary of the interaction
  activityType: ActivityType; // What kind of activity this email describes
  activityDate: string | null; // ISO date "YYYY-MM-DD" of when the activity actually happened (may differ from email date)
  /** True when the thread body contains signals a meeting/call already occurred before this email. */
  priorMeetingDetected: boolean;
  /** ISO date of the prior meeting if inferrable from the thread (e.g. "2026-03-26"), else null. */
  priorMeetingDate: string | null;
  /**
   * Email of the connector / referral source in the thread (e.g. who made the intro), if distinct
   * from the primary contact and the owner. Not the EA or CC for scheduling.
   */
  referralSourceEmail: string | null;
  /** Name of the referral source when extractable. */
  referralSourceName: string | null;
}

/**
 * Interpret engagement meaning from a parsed email.
 * Uses AI to determine: contact identity, disposition, next steps, summary.
 */
export async function interpretEngagement(
  parsedEmail: ParsedEmailInput,
  ownerContext?: OwnerContext | null,
): Promise<EngagementInterpretation> {
  const body =
    (parsedEmail.body || '').trim() ||
    (parsedEmail.raw || '').trim().slice(0, 8000);

  if (!body && !parsedEmail.subject) {
    throw new Error('No content to interpret');
  }

  let headersContext = '';
  if (parsedEmail.headers) {
    const inReplyToMatch = parsedEmail.headers.match(/In-Reply-To:\s*(.+)/i);
    const referencesMatch = parsedEmail.headers.match(/References:\s*(.+)/i);
    if (inReplyToMatch) headersContext += `In-Reply-To: ${inReplyToMatch[1]}\n`;
    if (referencesMatch) headersContext += `References: ${referencesMatch[1]}\n`;
  }

  let ownerBlock = '';
  if (ownerContext?.name || ownerContext?.email || ownerContext?.companyName) {
    ownerBlock = '\nOWNER/CLIENT CONTEXT (the person who forwarded this to the CRM — they are NOT the contact):\n';
    if (ownerContext.name) ownerBlock += `  Owner name: ${ownerContext.name}\n`;
    if (ownerContext.email) ownerBlock += `  Owner email: ${ownerContext.email}\n`;
    if (ownerContext.companyName) ownerBlock += `  Owner company: ${ownerContext.companyName}\n`;
    ownerBlock +=
      '\nThe CONTACT is the OTHER person in the conversation — the prospect/target. Do NOT return the owner as the contact.\n';
    ownerBlock +=
      '\nFORWARDED EMAILS: If the From: header is the owner (they forwarded this), the REAL contact is INSIDE the body. ';
    ownerBlock +=
      'Scan the body for: "From: name <email>", "----- Original Message -----", "Begin forwarded message", "From:", etc. ';
    ownerBlock +=
      'Extract the contact email and contact name from the FIRST/original sender block (the person the owner is corresponding with), NOT the forwarder.\n';
  }

  const todayStr = new Date().toISOString().slice(0, 10);
  const emailSendHintStr = extractDateHeaderIso(parsedEmail) || todayStr;
  const oneWeekFromSendHint = addDaysIsoDate(
    emailSendHintStr,
    OUTBOUND_PROOF_DEFAULT_FOLLOWUP_DAYS,
  );
  const purposeList = NEXT_ENGAGEMENT_PURPOSE_ENUM_FOR_PROMPT;

  const contentBlock = [
    parsedEmail.subject ? `Subject: ${parsedEmail.subject}` : null,
    parsedEmail.from ? `From: ${parsedEmail.from}` : null,
    parsedEmail.to ? `To: ${parsedEmail.to}` : null,
    headersContext ? `Headers:\n${headersContext}` : null,
    body ? `Body:\n${body}` : null,
  ]
    .filter(Boolean)
    .join('\n\n');

  const systemPrompt = `You are an engagement interpreter for a CRM. The email has ALREADY been parsed (headers, from, to, subject, body). Your job is to INTERPRET the engagement meaning.

${ownerBlock}
CRITICAL: The CONTACT is the prospect/target the owner is corresponding with — NOT the owner.

IMPORTANT: If no contact email appears in the body or headers, the subject line may contain the contact's full name — extract it as contactName even if contactEmail must be left empty string.

ACTIVITY TYPE — Determine what kind of activity this email actually describes:
- "inbound_email": An actual email FROM the contact TO the owner (a real received email)
- "outbound_email": An email the OWNER sent TO the contact, forwarded to CRM for logging
- "call_note": The owner is logging/reporting a phone call they had with the contact. Signals: "I spoke with", "called", "on the phone", "spoke to him/her", "had a call"
- "meeting_note": The owner is logging an in-person or video meeting. Signals: "met with", "had a meeting", "sat down with", "meeting with"
- "note": A general update or context note with no specific email/call/meeting

OUTBOUND PROOF / RECEIPT (VERY COMMON) — Someone on the team (often the same person) forwards to the CRM inbox a copy of THEIR OWN outbound to a prospect — to log "I sent this" / proof of initial outreach (Fwd:, "see below", "my send to X", original message shows FROM sender TO prospect, no prospect reply in this thread). For this pattern:
- classify as activityType "outbound_email" (the substantive activity is the outbound to the prospect).
- isResponse MUST be false (the prospect has not replied in what this thread shows).
- The contact is the prospect (recipient of that outbound), not the forwarder.
- If there is no explicit follow-up timing in the email, set nextEngagementDate to ${oneWeekFromSendHint} (7 calendar days after the outbound SEND date — use activityDate when it reflects that send, otherwise use the email Date header day ${emailSendHintStr}, never "today when someone parses in the UI") and nextEngagementPurpose to UNRESPONSIVE — meaning "we assume the prospect may not have replied yet; next touch is a check-in / chase after ~1 week from send." If the email explicitly says a different follow-up window (e.g. 2 weeks), use that instead.
- If the thread clearly shows the prospect already replied, this is NOT outbound proof — use inbound_email and isResponse true.

FORWARDER ANNOTATION — When someone forwards a thread to the CRM, they often prepend a short note BEFORE the first "From: [name]" / "Sent:" / "-----Original Message-----" block. That text is the OWNER'S instruction and takes highest priority over default 7-day outbound rules when it contains dates or activity intent.

Identify the annotation as any text appearing before the first clear "From:" / "Sent:" / "-----Original Message-----" in the body (not part of a signature at the bottom).

Date and follow-up from the annotation:
- Explicit calendar date ("let's follow up on 4/23", "follow up April 23", "FYI – follow up on 4/23", "Pls set follow up for 5/12", "set a follow-up for 6/1", "schedule for 3/15", "pls follow up on/for [date]", "follow up [month]/[day]") → set nextEngagementDate to that day in YYYY-MM-DD (infer the year from the thread or use the email year from ${emailSendHintStr}). Treat "for [date]" and "on [date]" identically — both are explicit calendar anchors. Use it even if that date is already in the past — do NOT replace it with the 7-day default.
- Relative timing ("one-month follow up", "follow up in 2 weeks", "check in next month", "let's set a one-month follow up", "follow up in six months", "set a follow up for 3 months", "let's set a follow up for 3 months") → compute nextEngagementDate from the EMAIL SEND DATE ${emailSendHintStr} (from the message Date: header or quoted "Sent:"), NOT from "today" when someone parses the email in the UI (e.g. one month = same calendar day one month after send; six months = ~183 days after send; two weeks = +14 days from send day; three months = same calendar day three months after send).
- Range ("1-2 months", "3-6 months") → use midpoint from ${emailSendHintStr} as the anchor, not the parse date.
- Purpose when annotation provides timing: when the annotation gives any explicit date or relative window, set nextEngagementPurpose to GENERAL_CHECK_IN or PERIODIC_CHECK_IN — NOT UNRESPONSIVE — unless the full thread contains zero replies from the prospect (i.e. this is a cold first-touch with no response at all). UNRESPONSIVE means you are cold-chasing a contact who has never replied; it must not be used when the owner is simply scheduling a future keep-warm touch, even if the most recent message in the chain is an owner outbound.

Activity type from the annotation (overrides a bare quoted email when the annotation is clearly the owner logging):
- "I spoke with X today", "Per the below, I spoke/talked/met with X", "Had a call with X", "I spoke with X" at the top → set activityType to "call_note" (the logged event is the call; not proof-of-send outbound).
- "Met with X", "Had a meeting with X" at the top → set activityType to "meeting_note".
- If the annotation only says "FYI" or a date with no "I spoke/met", you may still use outbound_email / inbound_email per the thread.

Contact identification from the annotation:
- If the annotation names a specific person ("I spoke with Lakshmi", "follow up with Joel"), treat that name as the primary contact and match their email from the thread below when multiple non-owner people appear (ignore EAs schedulers unless they are the only path — prefer the decision-maker the owner names).

PRIOR MEETING / CALL IN THREAD — When the email being parsed is a proof-of-send outbound (or any message where the full quoted thread is visible), scan the FULL body (including quoted/forwarded sections) for signals that a prior meeting or call already occurred between the owner and the contact. Positive signals include: "it was a pleasure catching up", "great talking today", "per our discussion", "enjoyed our call", "as discussed", "following our meeting", "following up on our call", "our conversation", "catching up today", "spoke today", "talked today", "thanks for your time today" (in the right sender→recipient context), and similar.

Negative signals — these mean a meeting has NOT yet occurred (parties are still trying to schedule):
"let me know a good time", "is there a good time", "let's find time", "lets catch up this week", "how about [day/time]", "would you be available", "are you free", "my calendar is open", "happy to suggest some windows", "find us 10 minutes next week" (scheduling, not a completed call). If the only meeting-related language in the thread is scheduling like this, set priorMeetingDetected to false (unless a FORWARDER ANNOTATION or other line explicitly says the owner already spoke/met the contact).

If you find a positive prior-meeting signal (and not negated by scheduling-only), set priorMeetingDetected to true and attempt to extract priorMeetingDate (the calendar day of that meeting/call) from the nearby "Sent:" line or date headers in the quoted block (YYYY-MM-DD).
When priorMeetingDetected is true, prefer nextEngagementPurpose MEETING_FOLLOW_UP over UNRESPONSIVE — a meeting already occurred; the owner is chasing an agreed next step, not cold-chasing a no-reply to first outreach.

REFERRAL SOURCE — When the thread shows a third-party who introduced the owner to the contact (e.g. "I'd like to introduce you to [owner]", "Intro ||| A & B", "Moving [Name] to BCC", a formal double-intro email to both parties, PE/colleague vouching for the owner to the target):
- Set referralSourceEmail to the connector's email address (the person who made the intro — NOT the primary prospect, NOT the owner, not a generic noreply).
- Set referralSourceName to their name if visible.
- If the thread is a direct 1:1 and no intro party appears, set both to null. Do not confuse the target contact with the referral source.

ACTIVITY DATE — If the email describes an event that happened on a DIFFERENT date than today (e.g. "I spoke with him on Monday 3/2"), extract THAT date as activityDate. Today is ${todayStr}. If the event is happening now or no date is mentioned, set null.
For activityType "outbound_email" (proof-of-send): when the thread is logging an outbound the owner already sent, set activityDate to the calendar day that outbound was sent when inferrable (Date header, "Sent: …", or forwarded metadata), so follow-up dates can anchor to send time — not to when someone later parses the email.

NEXT ENGAGEMENT PURPOSE — For activityType "inbound_email" or "outbound_email" (when there is a meaningful next touch), pick exactly ONE token from this list, OR null if no follow-up date / not applicable:
${purposeList}

Definitions (pick the best single match; use null if unsure or no next touch). Every token must be one of: ${purposeList}

- GENERAL_CHECK_IN — generic next touch; nothing more specific fits.
- UNRESPONSIVE — chase / no reply yet (usually outbound context).
- PERIODIC_CHECK_IN — routine keep-warm / relationship maintenance on a cadence.
- REFERRAL_NO_CONTACT — referral path; no direct contact with the target yet.
- POST_WARM_MEETING_NUDGE — contact replied warmly; next step is to lock a meeting (not vague "catch up").
- PURSUE_INTRO — the contact is acting as a connector/forwarder rather than the economic buyer. They have passed (or will pass) the owner's name or materials to someone else. Signals: "I sent your name around", "I passed along your info", "I forwarded your details to X", "I mentioned you to our team / our GC / a few people", "I shared your info with", "I'll forward this", "I'll pass this along", "I know someone who might need this", "let me make an intro", "I put you in touch with". The next touch is to follow up on the referral path, not to re-pitch this contact as a direct buyer. (Use REFERRAL_NO_CONTACT only when there is no direct contact with the final target yet.)
- NO_INTRO_REASON_FOLLOW_UP — intro did not happen or stalled; next touch is to understand why / unblock.
- ONE_MORE_TOUCH — one deliberate extra attempt before backing off.
- COMPETITOR_FOLLOW_UP — they are "all set" with an incumbent or happy with current provider; long-cycle re-engage with a competitor/displacement angle (months out). NOT for "they picked another firm over us."
- MEETING_FOLLOW_UP — a meeting already occurred and the next touch is normal post-meeting follow-through (status, materials, agreed next step). Do NOT use this when the substance of the message is "they passed / went with someone else."
- SCHEDULED_MEETING — concrete future meeting/call on the calendar; nextEngagementDate must be that day.
- DECLINED_NURTURE — they explicitly passed on your firm, chose another provider, or are not moving forward with you, BUT the owner still wants a polite relationship touch later (e.g. 3–6 months). Use with an aggressive nextEngagementDate (midpoint if a range is given). If they asked for no further contact or hard stop, use null for purpose and date.
- NEW_JOB_CHECK_IN — contact shows a new employer, new role, or "joined X" signal in signature or body; treat next touch as a fresh opportunity at the new firm (not a routine GENERAL_CHECK_IN).

For call_note / meeting_note / note, set nextEngagementPurpose to null unless the note clearly implies one of the above for the NEXT touch.

If activityType is not inbound_email, SCHEDULED_MEETING is almost always wrong (owner logs are not "contact scheduled a meeting" in the same sense).

Interpret:
1. Contact email — who is the prospect/target? (NOT the owner)
2. Contact name — the prospect's name if visible. If the subject line looks like a person's name (short, no colon, not a typical email topic), treat it as the contact's name.
2b. Contact company — employer/firm name from signature or visible headers (e.g. "Acme Corp"), or null if unknown.
3. Subject — use parsed subject (may clean up Re:/Fwd:)
4. Body — CONTEXTUAL summary: what the contact actually said (key points, tone, or short quotes). Include buyer/forwarding signals (e.g. "I'll forward your stuff", "not the right person", "happy to connect", "we're not looking now"). Then the immediate next step. Not just the action — include context so we can see if they're a buyer or a pass-through.
5. Next engagement date — be AGGRESSIVE. Anchor ALL relative and range-based windows to the email send day ${emailSendHintStr} (Date header or quoted "Sent:"), never to "today" when someone later parses the email. Examples (anchor = ${emailSendHintStr}):
   - "follow up in 3-6 months" → midpoint (~4.5 months after send)
   - "later this year" → ~6 months after send
   - "next quarter" → 3 months after send
   - "follow up in six months" or "in 6 months" → six months after send, not after parse time
   - Any specific date mentioned for a meeting or callback → use that date
   - Hard "stop / unsubscribe / do not contact" → null date and null purpose
   - They declined you but a future polite check-in is implied → pick a future date and set nextEngagementPurpose to DECLINED_NURTURE
6. isResponse — is the contact responding to the owner's outreach?
7. Summary — 1-2 sentences WITH CONTEXT: what the contact said (e.g. buyer vs will-forward, interested vs not), disposition, and next steps.
8. activityType — one of: "inbound_email", "outbound_email", "call_note", "meeting_note", "note"
9. activityDate — "YYYY-MM-DD" if the described event happened on a specific past date, else null
10. priorMeetingDetected — true if the full thread shows a prior meeting/call between owner and contact (see PRIOR MEETING / CALL IN THREAD above), else false
11. priorMeetingDate — "YYYY-MM-DD" if that prior meeting/call day is inferrable from the thread, else null
12. nextEngagementPurpose — EXACTLY one of the listed tokens, or null. Must align with nextEngagementDate when a date is set (e.g. SCHEDULED_MEETING only with a concrete meeting day).
13. referralSourceEmail — connector email or null (see REFERRAL SOURCE)
14. referralSourceName — connector name or null (see REFERRAL SOURCE)

Return EXACTLY this JSON:
{
  "subject": "...",
  "body": "contextual summary: what contact said + signals + next step",
  "contactEmail": "prospect email, NOT owner",
  "contactName": "prospect name" or null,
  "contactCompany": "firm from signature" or null,
  "nextEngagementDate": "YYYY-MM-DD" or null,
  "nextEngagementPurpose": "TOKEN_FROM_LIST" or null,
  "inReplyTo": "Message-ID" or null,
  "references": ["Message-ID1"] or null,
  "isResponse": true or false,
  "summary": "1-2 sentences with context (what they said, buyer/forward, next step)",
  "activityType": "inbound_email" | "outbound_email" | "call_note" | "meeting_note" | "note",
  "activityDate": "YYYY-MM-DD" or null,
  "priorMeetingDetected": true or false,
  "priorMeetingDate": "YYYY-MM-DD" or null,
  "referralSourceEmail": "connector@email" or null,
  "referralSourceName": "Connector Name" or null
}

Return JSON only.`;

  const userPrompt = `Interpret this parsed email:\n\n${contentBlock}`;

  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) throw new Error('No response from OpenAI');

    const result = parseResponse(content);
    if (result.priorMeetingDetected && result.nextEngagementPurpose === 'UNRESPONSIVE') {
      result.nextEngagementPurpose = 'MEETING_FOLLOW_UP';
    }
    // UNRESPONSIVE is semantically wrong when the prospect has replied in this thread.
    if (result.isResponse && result.nextEngagementPurpose === 'UNRESPONSIVE') {
      result.nextEngagementPurpose = 'GENERAL_CHECK_IN';
    }
    const proofBaseDate =
      result.activityDate ||
      extractDateHeaderIso(parsedEmail) ||
      todayStr;
    applyOutboundProofFollowUpDefaults(result, proofBaseDate);
    warnIfNextEngagementDateInPast(result.nextEngagementDate, todayStr);

    // Fallback: if AI didn't return contactEmail, use parsed from/to + owner
    if (!result.contactEmail && ownerContext?.email) {
      const ownerLower = ownerContext.email.toLowerCase();
      if (parsedEmail.fromEmail?.toLowerCase() !== ownerLower) {
        result.contactEmail = parsedEmail.fromEmail || '';
      } else if (parsedEmail.toEmail?.toLowerCase() !== ownerLower) {
        result.contactEmail = parsedEmail.toEmail || '';
      }
    }
    if (!result.contactEmail) {
      result.contactEmail = parsedEmail.fromEmail || parsedEmail.toEmail || '';
    }
    if (!result.subject && parsedEmail.subject) {
      result.subject = parsedEmail.subject;
    }

    console.log('✅ AI Engagement Interpreter:', {
      contactEmail: result.contactEmail,
      contactName: result.contactName,
      contactCompany: result.contactCompany,
      activityType: result.activityType,
      activityDate: result.activityDate,
      hasNextEngagementDate: !!result.nextEngagementDate,
      nextEngagementPurpose: result.nextEngagementPurpose,
      isResponse: result.isResponse,
      priorMeetingDetected: result.priorMeetingDetected,
      priorMeetingDate: result.priorMeetingDate,
      referralSourceEmail: result.referralSourceEmail,
      referralSourceName: result.referralSourceName,
    });

    return result;
  } catch (error: unknown) {
    console.error('❌ aiEngagementInterpreter error:', error);
    throw new Error(
      `Failed to interpret engagement: ${error instanceof Error ? error.message : 'Unknown error'}`,
    );
  }
}

/**
 * Forwarded "proof of send" outbound emails often omit a next date. Default: +7d + UNRESPONSIVE
 * from the outbound send date (activityDate or Date header), not from "today" at parse time.
 *
 * Skips when nextEngagementPurpose is already something specific (e.g. MEETING_FOLLOW_UP after
 * prior-meeting-in-thread detection) so we do not overwrite with UNRESPONSIVE.
 */
function applyOutboundProofFollowUpDefaults(
  result: EngagementInterpretation,
  baseIsoDate: string,
): void {
  if (result.activityType !== 'outbound_email') return;
  if (result.isResponse) return;
  if (result.nextEngagementDate) return;
  const p = result.nextEngagementPurpose;
  if (p && p !== 'GENERAL_CHECK_IN' && p !== 'UNRESPONSIVE') return;
  result.nextEngagementDate = addDaysIsoDate(baseIsoDate, OUTBOUND_PROOF_DEFAULT_FOLLOWUP_DAYS);
  result.nextEngagementPurpose = 'UNRESPONSIVE';
}

function parseResponse(content: string): EngagementInterpretation {
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) parsed = JSON.parse(jsonMatch[0]);
    else throw new Error('Invalid JSON from AI');
  }

  const d = (parsed.email as Record<string, unknown>) || parsed;

  const VALID_ACTIVITY_TYPES = [
    'inbound_email',
    'outbound_email',
    'call_note',
    'meeting_note',
    'note',
  ] as const;

  const rawActivityType = d.activityType ?? parsed.activityType;
  const activityType: ActivityType = VALID_ACTIVITY_TYPES.includes(rawActivityType as ActivityType)
    ? (rawActivityType as ActivityType)
    : 'inbound_email';

  const rawActivityDate = d.activityDate ?? parsed.activityDate;
  const activityDate =
    typeof rawActivityDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawActivityDate)
      ? rawActivityDate
      : null;

  const rawPurpose = d.nextEngagementPurpose ?? parsed.nextEngagementPurpose;
  let nextEngagementPurpose = normalizeAiNextEngagementPurpose(rawPurpose);
  if (
    nextEngagementPurpose === 'SCHEDULED_MEETING' &&
    activityType !== 'inbound_email'
  ) {
    nextEngagementPurpose = null;
  }

  const cc = d.contactCompany ?? parsed.contactCompany;
  const contactCompany =
    typeof cc === 'string' && cc.trim() ? cc.trim() : null;

  const rawPriorMeetingDate = d.priorMeetingDate ?? parsed.priorMeetingDate;
  const priorMeetingDate =
    typeof rawPriorMeetingDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawPriorMeetingDate)
      ? rawPriorMeetingDate
      : null;

  const rawPriorMeetingDetected = d.priorMeetingDetected ?? parsed.priorMeetingDetected;
  const priorMeetingDetected =
    typeof rawPriorMeetingDetected === 'boolean' ? rawPriorMeetingDetected : false;

  const rawNext = d.nextEngagementDate ?? parsed.nextEngagementDate;
  let nextEngagementDate: string | null =
    typeof rawNext === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(rawNext.trim())
      ? rawNext.trim()
      : null;

  const rawRefEmail = d.referralSourceEmail ?? parsed.referralSourceEmail;
  const rawRefName = d.referralSourceName ?? parsed.referralSourceName;
  const refEmailStr =
    typeof rawRefEmail === 'string' && rawRefEmail.trim().includes('@')
      ? rawRefEmail.trim().toLowerCase()
      : null;
  const refNameStr =
    typeof rawRefName === 'string' && rawRefName.trim() ? rawRefName.trim() : null;

  return {
    subject: String(d.subject ?? parsed.subject ?? ''),
    body: String(d.body ?? parsed.body ?? ''),
    contactEmail: String(d.contactEmail ?? parsed.contactEmail ?? ''),
    contactName:
      typeof (d.contactName ?? parsed.contactName) === 'string'
        ? (d.contactName ?? parsed.contactName) as string
        : null,
    contactCompany,
    nextEngagementDate,
    nextEngagementPurpose,
    inReplyTo:
      typeof (d.inReplyTo ?? parsed.inReplyTo) === 'string'
        ? (d.inReplyTo ?? parsed.inReplyTo) as string
        : null,
    references: Array.isArray(d.references ?? parsed.references)
      ? (d.references ?? parsed.references) as string[]
      : null,
    isResponse:
      typeof (d.isResponse ?? parsed.isResponse) === 'boolean'
        ? (d.isResponse ?? parsed.isResponse) as boolean
        : false,
    summary: String(d.summary ?? parsed.summary ?? ''),
    activityType,
    activityDate,
    priorMeetingDetected,
    priorMeetingDate,
    referralSourceEmail: refEmailStr,
    referralSourceName: refNameStr,
  };
}
