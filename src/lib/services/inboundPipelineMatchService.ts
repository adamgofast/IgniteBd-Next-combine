/**
 * Optional second pass: suggest pipeline/stage from inbound interpretation (referral / connector).
 * Validates proposals against pipelineConfig. Separate from interpretEngagement.
 */

import OpenAI from 'openai';
import {
  isValidPipeline,
  isValidStageForPipeline,
} from '@/lib/config/pipelineConfig';
import { prisma } from '@/lib/prisma';
import { snapPipelineOnContact } from '@/lib/services/pipelineService';

export type InboundEngagementPipelineDTO = {
  activityType: string;
  summary: string;
  hasScheduledMeeting: boolean;
  nextEngagementDate: string | null;
  subject?: string | null;
  bodySnippet?: string | null;
};

export type InboundPipelineMatchSignals = {
  referralIntroduced: boolean;
  introducedNameEmail: string | null;
  roleHint: 'buyer' | 'connector' | 'unknown';
  connectorHelpingDeal: boolean | null;
};

export type InboundPipelineMatchProposal = {
  targetPipeline: string;
  targetStage: string;
  confidence: number;
  rationale: string;
};

export type InboundPipelineMatchResult = {
  signals: InboundPipelineMatchSignals;
  proposal: InboundPipelineMatchProposal | null;
};

function defaultSignals(): InboundPipelineMatchSignals {
  return {
    referralIntroduced: false,
    introducedNameEmail: null,
    roleHint: 'unknown',
    connectorHelpingDeal: null,
  };
}

function validateProposal(
  pipeline: string,
  stage: string,
): { targetPipeline: string; targetStage: string } | null {
  if (!isValidPipeline(pipeline)) return null;
  if (!isValidStageForPipeline(stage, pipeline)) return null;
  return { targetPipeline: pipeline, targetStage: stage };
}

/**
 * Suggest pipeline match from engagement text + current pipeline row (read-only; no DB writes).
 */
export async function suggestInboundPipelineMatch(input: {
  contactId: string;
  engagement: InboundEngagementPipelineDTO;
}): Promise<InboundPipelineMatchResult> {
  const pipe = await prisma.pipelines.findUnique({
    where: { contactId: input.contactId },
  });
  const currentPipeline = pipe?.pipeline || 'prospect';
  const currentStage = pipe?.stage || null;

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { signals: defaultSignals(), proposal: null };
  }

  const snippet = [
    input.engagement.subject ? `Subject: ${input.engagement.subject}` : null,
    `Activity type: ${input.engagement.activityType}`,
    `Summary: ${input.engagement.summary}`,
    input.engagement.bodySnippet
      ? `Body excerpt: ${input.engagement.bodySnippet.slice(0, 1200)}`
      : null,
    `Current CRM pipeline: ${currentPipeline}, stage: ${currentStage ?? '(none)'}`,
  ]
    .filter(Boolean)
    .join('\n');

  const system = `You classify CRM pipeline transitions for ONE contact based on email/meeting context.

Rules:
- If the contact is clearly passing the deal to someone else, introducing another person, or saying "not the buyer" / "talk to X" / "I'll forward" with a referral path → referralIntroduced true, roleHint often "connector", propose pipeline "connector" with stage:
  - "forwarded" if they said they'd forward or pass along but intro not confirmed yet
  - "introduction-made" if an introduction to the buyer already happened or they clearly connected the parties
- If the contact is the economic buyer / decision path and no referral → roleHint "buyer", referralIntroduced false, proposal null (keep existing pipeline; do not guess prospect stages).
- connectorHelpingDeal: true if a connector is actively helping advance the deal, false if blocking, null if unknown.

Return ONLY JSON:
{
  "referralIntroduced": boolean,
  "introducedNameEmail": string or null,
  "roleHint": "buyer" | "connector" | "unknown",
  "connectorHelpingDeal": boolean or null,
  "targetPipeline": string or null,
  "targetStage": string or null,
  "confidence": number 0-100,
  "rationale": short string
}

If no pipeline change is justified, set targetPipeline and targetStage to null.`;

  try {
    const openai = new OpenAI({ apiKey });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';
    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.2,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: snippet },
      ],
      response_format: { type: 'json_object' },
    });
    const raw = completion.choices[0]?.message?.content?.trim();
    if (!raw) {
      return { signals: defaultSignals(), proposal: null };
    }
    const parsed = JSON.parse(raw) as {
      referralIntroduced?: boolean;
      introducedNameEmail?: string | null;
      roleHint?: string;
      connectorHelpingDeal?: boolean | null;
      targetPipeline?: string | null;
      targetStage?: string | null;
      confidence?: number;
      rationale?: string;
    };

    const roleHint =
      parsed.roleHint === 'buyer' || parsed.roleHint === 'connector'
        ? parsed.roleHint
        : 'unknown';

    const signals: InboundPipelineMatchSignals = {
      referralIntroduced: !!parsed.referralIntroduced,
      introducedNameEmail:
        typeof parsed.introducedNameEmail === 'string'
          ? parsed.introducedNameEmail.trim() || null
          : null,
      roleHint,
      connectorHelpingDeal:
        typeof parsed.connectorHelpingDeal === 'boolean'
          ? parsed.connectorHelpingDeal
          : null,
    };

    const tp = parsed.targetPipeline?.trim() || '';
    const ts = parsed.targetStage?.trim() || '';
    if (!tp || !ts) {
      return { signals, proposal: null };
    }

    const validated = validateProposal(tp, ts);
    if (!validated) {
      return { signals, proposal: null };
    }

    return {
      signals,
      proposal: {
        ...validated,
        confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 0)),
        rationale: (parsed.rationale || '').trim() || 'Model suggestion',
      },
    };
  } catch (e) {
    console.warn('inboundPipelineMatchService:', (e as Error)?.message);
    return { signals: defaultSignals(), proposal: null };
  }
}

/**
 * Apply validated proposal: update pipelines + snap. Returns false if validation fails or no change.
 */
export async function applyInboundPipelineMatchProposal(
  contactId: string,
  proposal: InboundPipelineMatchProposal,
): Promise<boolean> {
  const v = validateProposal(proposal.targetPipeline, proposal.targetStage);
  if (!v) return false;

  await prisma.pipelines.update({
    where: { contactId },
    data: {
      pipeline: v.targetPipeline,
      stage: v.targetStage,
      updatedAt: new Date(),
    },
  });
  await snapPipelineOnContact(contactId, v.targetPipeline, v.targetStage);
  return true;
}
