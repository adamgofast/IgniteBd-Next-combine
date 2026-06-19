/**
 * ToolLoopAgent for inbound SendGrid rows: lookup CRM contact context, then record activity via DB tools.
 * Falls back to interpretEngagement + applyInboundRecordingCore if the agent never calls recordActivity.
 */

import 'server-only';

import { ToolLoopAgent, stepCountIs, tool } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { z } from 'zod';
import type { PrismaClient } from '@prisma/client';
import type { OwnerContext, EngagementInterpretation, ActivityType } from '@/lib/services/aiEngagementInterpreter';
import { interpretEngagement } from '@/lib/services/aiEngagementInterpreter';
import {
  applyInboundRecordingCore,
  type InboundRecordingApplyOpts,
  type InboundRecordingApplySuccess,
  type InboundWithCompany,
  type UniversalParsedEmail,
} from '@/lib/services/inboundRecordingApply';

const activityTypeEnum = z.enum([
  'inbound_email',
  'outbound_email',
  'call_note',
  'meeting_note',
  'note',
]);

const recordActivityInputSchema = z.object({
  contactEmail: z.string(),
  contactName: z.string().nullable(),
  contactCompany: z.string().nullable().optional(),
  subject: z.string(),
  body: z.string(),
  summary: z.string(),
  activityType: activityTypeEnum,
  activityDate: z.string().nullable(),
  nextEngagementDate: z.string().nullable(),
  nextEngagementPurpose: z.string().nullable(),
  isResponse: z.boolean(),
  priorMeetingDetected: z.boolean().optional(),
  priorMeetingDate: z.string().nullable().optional(),
  referralSourceEmail: z.string().nullable().optional(),
  referralSourceName: z.string().nullable().optional(),
});

export type RecordActivityInput = z.infer<typeof recordActivityInputSchema>;

function mapRecordActivityToInterpretation(
  input: RecordActivityInput,
): EngagementInterpretation {
  const activityType = input.activityType as ActivityType;
  return {
    subject: input.subject,
    body: input.body,
    contactEmail: input.contactEmail,
    contactName: input.contactName,
    contactCompany: input.contactCompany ?? null,
    nextEngagementDate: input.nextEngagementDate,
    nextEngagementPurpose: input.nextEngagementPurpose,
    inReplyTo: null,
    references: null,
    isResponse: input.isResponse,
    summary: input.summary,
    activityType,
    activityDate: input.activityDate,
    priorMeetingDetected: input.priorMeetingDetected ?? false,
    priorMeetingDate: input.priorMeetingDate ?? null,
    referralSourceEmail: input.referralSourceEmail?.trim()
      ? input.referralSourceEmail.trim().toLowerCase()
      : null,
    referralSourceName: input.referralSourceName?.trim() ? input.referralSourceName.trim() : null,
  };
}

export type RunInboundAgentParams = {
  inboundEmailId: string;
  inbound: InboundWithCompany;
  parsed: UniversalParsedEmail;
  ownerContext: OwnerContext | null | undefined;
  ownerId: string;
  companyHQId: string;
  recordingOpts: InboundRecordingApplyOpts;
};

/**
 * Runs the agent; persists via recordActivity → applyInboundRecordingCore.
 * If the model stops without recording, falls back to legacy interpretEngagement + apply.
 */
export async function runInboundEmailAgentPipeline(
  prisma: PrismaClient,
  params: RunInboundAgentParams,
): Promise<InboundRecordingApplySuccess> {
  const {
    inboundEmailId,
    inbound,
    parsed,
    ownerContext,
    ownerId,
    companyHQId,
    recordingOpts,
  } = params;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is required for inbound email agent');
  }

  const modelId = process.env.OPENAI_MODEL || 'gpt-4o';
  const openaiProvider = createOpenAI({ apiKey });

  let recordingResult: InboundRecordingApplySuccess | null = null;

  const ownerBlock =
    ownerContext?.name || ownerContext?.email || ownerContext?.companyName
      ? `Owner (forwarded from — NOT the prospect): ${ownerContext?.name ?? ''} <${
          ownerContext?.email ?? ''
        }> @ ${ownerContext?.companyName ?? ''}`
      : 'Owner context unknown — infer prospect vs forwarder from headers and body.';

  const structuredParsed = JSON.stringify(
    {
      from: parsed.from,
      fromEmail: parsed.fromEmail,
      to: parsed.to,
      toEmail: parsed.toEmail,
      subject: parsed.subject,
      bodyPreview:
        typeof parsed.body === 'string' ? String(parsed.body).slice(0, 6000) : '',
      headersPreview:
        typeof parsed.headers === 'string' ? String(parsed.headers).slice(0, 2000) : '',
    },
    null,
    2,
  );

  const instructions = `You are an inbound-email CRM agent for tenant companyHQId="${companyHQId}".

${ownerBlock}

You MUST:
1. Call lookupContact for each plausible prospect email address (from parsed fromEmail/toEmail, quoted thread "From:", or owner annotation at top of body). Use normalized lowercase emails.
2. Use CRM rows returned (pipeline snapshots, next engagement, disposition) when choosing nextEngagementPurpose and nextEngagementDate.
3. Call recordActivity exactly ONCE with your final structured conclusions for this inbound message.

Rules:
- The CONTACT is the prospect/target — NOT the owner who forwarded to CRM.
- Classify activityType: inbound_email | outbound_email | call_note | meeting_note | note (same semantics as a CRM ingest pipeline).
- Set nextEngagementPurpose to a valid CRM token or null (e.g. UNRESPONSIVE, MEETING_FOLLOW_UP, GENERAL_CHECK_IN, SCHEDULED_MEETING, PURSUE_INTRO, POST_WARM_MEETING_NUDGE, DECLINED_NURTURE, etc.).
- Dates as YYYY-MM-DD where applicable; activityDate for when the described event occurred if explicit.

Parsed structural fields (already extracted — use as hints):
${structuredParsed}
`;

  const agent = new ToolLoopAgent({
    model: openaiProvider.chat(modelId),
    instructions,
    stopWhen: stepCountIs(15),
    tools: {
      lookupContact: tool({
        description:
          'Look up a contact by email for this tenant to read pipelineSnap, pipelineStageSnap, last/next engagement, disposition.',
        inputSchema: z.object({
          email: z.string().describe('Prospect email address'),
          companyHQId: z.string(),
        }),
        execute: async ({ email, companyHQId: hq }) => {
          const normalized = email.trim().toLowerCase();
          const contact = await prisma.contact.findFirst({
            where: {
              crmId: hq,
              email: { equals: normalized, mode: 'insensitive' },
            },
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
              fullName: true,
              companyName: true,
              pipelineSnap: true,
              pipelineStageSnap: true,
              lastEngagementDate: true,
              lastEngagementType: true,
              nextEngagementDate: true,
              nextEngagementPurpose: true,
              contactDisposition: true,
              contactSummary: true,
            },
          });
          if (!contact) {
            return {
              found: false as const,
              email: normalized,
              message: 'No matching Contact row for this tenant.',
            };
          }
          return { found: true as const, contact };
        },
      }),
      recordActivity: tool({
        description:
          'Persist this inbound interpretation: creates email_activities or Meeting, stamps Contact, updates pipeline, marks InboundEmail RECORDED.',
        inputSchema: recordActivityInputSchema,
        execute: async (input) => {
          if (recordingResult) {
            return {
              ok: false as const,
              error: 'recordActivity already executed for this inbound run',
            };
          }
          const interpreted = mapRecordActivityToInterpretation(input);
          recordingResult = await applyInboundRecordingCore(prisma, {
            inboundEmailId,
            inbound,
            parsed,
            interpreted,
            ownerId,
            companyHQId,
            opts: recordingOpts,
          });
          return {
            ok: true as const,
            recordId: recordingResult.recordId,
            recordType: recordingResult.recordType,
          };
        },
      }),
    },
  });

  await agent.generate({
    prompt: `Process inboundEmailId="${inboundEmailId}" and complete the CRM record.`,
  });

  if (recordingResult) {
    return recordingResult;
  }

  console.warn(
    '⚠️ inboundEmailAgent: recordActivity was not called; falling back to legacy interpretEngagement',
  );

  const interpreted = await interpretEngagement(
    {
      from: typeof parsed.from === 'string' ? parsed.from : null,
      fromEmail: typeof parsed.fromEmail === 'string' ? parsed.fromEmail : null,
      fromName: typeof parsed.fromName === 'string' ? parsed.fromName : null,
      to: typeof parsed.to === 'string' ? parsed.to : null,
      toEmail: typeof parsed.toEmail === 'string' ? parsed.toEmail : null,
      toName: typeof parsed.toName === 'string' ? parsed.toName : null,
      subject: typeof parsed.subject === 'string' ? parsed.subject : null,
      body: typeof parsed.body === 'string' ? parsed.body : null,
      headers: typeof parsed.headers === 'string' ? parsed.headers : null,
      raw: typeof parsed.raw === 'string' ? parsed.raw : null,
    },
    ownerContext ?? null,
  );

  return applyInboundRecordingCore(prisma, {
    inboundEmailId,
    inbound,
    parsed,
    interpreted,
    ownerId,
    companyHQId,
    opts: recordingOpts,
  });
}
