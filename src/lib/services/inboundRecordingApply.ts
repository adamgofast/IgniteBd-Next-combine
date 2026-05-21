/**
 * Persists interpreted inbound email → email_activities / Meeting, CRM stamps, pipeline.
 * Shared by inboundAutoProcessService and the ToolLoopAgent recordActivity tool.
 */

import { Prisma, type PrismaClient } from '@prisma/client';
import type { MeetingType, NextEngagementPurpose } from '@prisma/client';
import type { EngagementInterpretation } from '@/lib/services/aiEngagementInterpreter';
import {
  NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING,
  isValidNextEngagementPurpose,
  normalizeAiNextEngagementPurpose,
} from '@/lib/constants/nextEngagementPurpose';
import { generateMeetingSummaryService } from '@/lib/services/generateMeetingSummaryService';
import { syncEmailSummaryToLog } from '@/lib/services/emailToLogService';
import { bumpProspectNeedToEngageToEngaged } from '@/lib/services/inboundProspectBump';
import {
  applyInboundPipelineMatchProposal,
  suggestInboundPipelineMatch,
} from '@/lib/services/inboundPipelineMatchService';
import { coerceNextEngagementPurposeForPostgres } from '@/lib/services/nextEngagementPurposeDb';
import { isValidStageForPipeline } from '@/lib/config/pipelineConfig';

/** Same shape as AutoProcessInboundSuccess in inboundAutoProcessService.ts */
export type InboundRecordingApplySuccess = {
  success: true;
  recordId: string;
  recordType: string;
  contactId: string | null;
  pipelineMatch: {
    signals: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchSignals;
    proposal: import('@/lib/services/inboundPipelineMatchService').InboundPipelineMatchProposal | null;
    applied: boolean;
  } | null;
  connectorIntroductionMadeBump: { contactId: string; email: string } | null;
  parsed: {
    contactEmail: string | undefined;
    contactName: string | null;
    nextEngagementDate: string | null;
    nextEngagementPurpose: string | null;
    isResponse: boolean;
    summary: string;
    activityType: string;
    activityDate: string | null;
    referralSourceEmail: string | null;
    referralSourceName: string | null;
  };
};

export type InboundRecordingApplyOpts = {
  contactEmailOverride?: string | null;
  contactIdOverride?: string | null;
  nextEngagementDateOverride?: string | null;
  nextEngagementPurposeTopLevel?: string | null;
  generatePipelineMatch?: boolean;
  applyPipelineMatch?: boolean;
  updateContactProfile?: boolean;
  newContactEmail?: string | null;
  newCompanyName?: string | null;
  markAutoProcessed?: boolean;
};

export const inboundEmailCompanyInclude = Prisma.validator<Prisma.InboundEmailInclude>()({
  company_hqs: {
    select: {
      id: true,
      companyName: true,
      ownerId: true,
      contactOwnerId: true,
      owners_company_hqs_ownerIdToowners: { select: { name: true, email: true } },
    },
  },
});

export type InboundWithCompany = Prisma.InboundEmailGetPayload<{
  include: typeof inboundEmailCompanyInclude;
}>;

/** Parsed email blob from universalEmailParser (untyped JS module). */
export type UniversalParsedEmail = Record<string, unknown>;

export async function applyInboundRecordingCore(
  prisma: PrismaClient,
  params: {
    inboundEmailId: string;
    inbound: InboundWithCompany;
    parsed: UniversalParsedEmail;
    interpreted: EngagementInterpretation;
    ownerId: string;
    companyHQId: string;
    opts: InboundRecordingApplyOpts;
  },
): Promise<InboundRecordingApplySuccess> {
  const {
    inboundEmailId,
    inbound,
    parsed,
    interpreted,
    ownerId,
    companyHQId,
    opts,
  } = params;

  const contactEmailOverride =
    typeof opts.contactEmailOverride === 'string' && opts.contactEmailOverride.trim()
      ? opts.contactEmailOverride.trim()
      : null;
  const contactIdOverride =
    typeof opts.contactIdOverride === 'string' && opts.contactIdOverride.trim()
      ? opts.contactIdOverride.trim()
      : null;
  const nextEngagementDateOverride =
    typeof opts.nextEngagementDateOverride === 'string' &&
    opts.nextEngagementDateOverride.trim()
      ? opts.nextEngagementDateOverride.trim()
      : null;
  const nextEngagementPurposeTopLevel =
    typeof opts.nextEngagementPurposeTopLevel === 'string' &&
    opts.nextEngagementPurposeTopLevel.trim()
      ? opts.nextEngagementPurposeTopLevel.trim()
      : null;
  const generatePipelineMatch = opts.generatePipelineMatch === true;
  const applyPipelineMatch = opts.applyPipelineMatch === true;
  const updateContactProfile = opts.updateContactProfile === true;
  const newContactEmail = opts.newContactEmail ?? null;
  const newCompanyName = opts.newCompanyName ?? null;
  const markAutoProcessed = opts.markAutoProcessed === true;

  const activityType = interpreted.activityType || 'inbound_email';
  const activityDate = interpreted.activityDate || null;

  const effectiveContactEmail = contactEmailOverride || interpreted.contactEmail;

  let contactId: string | null = null;

  if (contactIdOverride) {
    contactId = contactIdOverride;
    console.log(`✅ push-to-ai: using contactIdOverride ${contactId}`);
  } else if (effectiveContactEmail && companyHQId) {
    const normalizedEmail = effectiveContactEmail.trim().toLowerCase();
    const existing = await prisma.contact.findFirst({
      where: {
        crmId: companyHQId,
        email: { equals: normalizedEmail, mode: 'insensitive' },
      },
      select: { id: true },
    });
    if (existing) {
      contactId = existing.id;
    }
  }

  try {
    if (contactId) {
      await bumpProspectNeedToEngageToEngaged(contactId);
    }
  } catch (bump2) {
    console.warn('⚠️ Wave1 prospect bump (post-resolve):', (bump2 as Error)?.message);
  }

  const effectiveNextEngagementDate =
    nextEngagementDateOverride || interpreted.nextEngagementDate || null;

  const purposeFromInterpretation = normalizeAiNextEngagementPurpose(
    interpreted.nextEngagementPurpose,
  );
  const purposeFromBodyTop = normalizeAiNextEngagementPurpose(nextEngagementPurposeTopLevel);
  let effectiveNextEngagementPurpose =
    purposeFromBodyTop || purposeFromInterpretation || null;

  if (
    effectiveNextEngagementPurpose &&
    !isValidNextEngagementPurpose(effectiveNextEngagementPurpose)
  ) {
    effectiveNextEngagementPurpose = null;
  }

  if (effectiveNextEngagementDate && !effectiveNextEngagementPurpose) {
    effectiveNextEngagementPurpose =
      activityType === 'inbound_email'
        ? 'POST_WARM_MEETING_NUDGE'
        : 'GENERAL_CHECK_IN';
  }

  const isScheduledMeetingPurpose =
    effectiveNextEngagementPurpose === NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING &&
    !!effectiveNextEngagementDate;

  const purposeForContactEmailPath = effectiveNextEngagementPurpose
    ? await coerceNextEngagementPurposeForPostgres(prisma, effectiveNextEngagementPurpose)
    : null;

  let nextEngagementPurposeForResponse: string | null = purposeForContactEmailPath;

  const isMeetingOrCall =
    activityType === 'call_note' || activityType === 'meeting_note';

  let recordId: string;
  let recordType: string;

  if (isMeetingOrCall && contactId) {
    const meetingDateParsed = activityDate
      ? new Date(activityDate)
      : inbound.createdAt;

    const meetingTypeMap: Record<string, MeetingType> = {
      call_note: 'CHECK_IN',
      meeting_note: 'FOLLOW_UP',
    };
    const meetingType = meetingTypeMap[activityType] ?? ('OTHER' as MeetingType);

    const noteText =
      inbound.text || inbound.html?.replace(/<[^>]+>/g, ' ').trim() || null;

    const meeting = await prisma.meeting.create({
      data: {
        contactId,
        ownerId,
        crmId: companyHQId,
        meetingDate: meetingDateParsed,
        meetingType,
        notes: noteText,
        nextAction: interpreted.summary || null,
        nextEngagementDate: effectiveNextEngagementDate,
      },
    });

    if (noteText && noteText.length >= 20) {
      try {
        const summary = await generateMeetingSummaryService(noteText);
        if (summary) {
          await prisma.meeting.update({
            where: { id: meeting.id },
            data: { summary },
          });
        }
      } catch (err) {
        console.warn('⚠️ Meeting summary generation failed:', (err as Error)?.message);
      }
    }

    const meetingFollowUpPurpose = await coerceNextEngagementPurposeForPostgres(
      prisma,
      'MEETING_FOLLOW_UP',
    );
    nextEngagementPurposeForResponse = meetingFollowUpPurpose;

    await prisma.contact.update({
      where: { id: contactId },
      data: {
        lastEngagementDate: meetingDateParsed,
        lastEngagementType: 'MEETING',
        ...(meetingFollowUpPurpose
          ? {
              nextEngagementPurpose:
                meetingFollowUpPurpose as NextEngagementPurpose,
            }
          : {}),
        ...(effectiveNextEngagementDate
          ? { nextEngagementDate: effectiveNextEngagementDate }
          : {}),
      },
    });

    recordId = meeting.id;
    recordType = activityType === 'call_note' ? 'Meeting (Call)' : 'Meeting';
    console.log(`✅ push-to-ai: created Meeting record ${recordId} for ${activityType}`);
  } else {
    const emailSequenceOrder =
      activityType === 'inbound_email'
        ? ('CONTACT_SEND' as const)
        : ('OWNER_SEND' as const);

    const sentAt = activityDate ? new Date(activityDate) : inbound.createdAt;

    const emailActivity = await prisma.email_activities.create({
      data: {
        owner_id: ownerId,
        contact_id: contactId,
        tenant_id: companyHQId,
        email: effectiveContactEmail || inbound.from || null,
        subject: interpreted.subject || inbound.subject || null,
        body: interpreted.body || null,
        event: activityType === 'inbound_email' ? 'received' : 'sent',
        source: 'OFF_PLATFORM',
        platform: 'sendgrid_inbound',
        emailSequenceOrder,
        emailRawText: inbound.text || inbound.html || inbound.email || null,
        summary: interpreted.summary || null,
        sentAt,
      },
    });

    if (contactId) {
      const engagementType =
        activityType === 'inbound_email' ? 'CONTACT_RESPONSE' : 'OUTBOUND_EMAIL';
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          lastEngagementDate: sentAt,
          lastEngagementType: engagementType,
        },
      });

      if (effectiveNextEngagementDate && purposeForContactEmailPath) {
        await prisma.contact.update({
          where: { id: contactId },
          data: {
            nextEngagementDate: effectiveNextEngagementDate,
            nextEngagementPurpose:
              purposeForContactEmailPath as NextEngagementPurpose,
          },
        });
      } else {
        const contactRow = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { nextEngagementDate: true },
        });
        const nextStr = contactRow?.nextEngagementDate;
        const nextDate = nextStr ? new Date(nextStr) : null;
        if (nextDate && nextDate < sentAt) {
          await prisma.contact.update({
            where: { id: contactId },
            data: { nextEngagementDate: null, nextEngagementPurpose: null },
          });
        }
      }

      if (updateContactProfile) {
        const rawProfEmail = (
          typeof newContactEmail === 'string' && newContactEmail.trim()
            ? newContactEmail
            : effectiveContactEmail || ''
        )
          .trim()
          .toLowerCase();
        if (rawProfEmail.includes('@')) {
          const at = rawProfEmail.indexOf('@');
          const derivedDomain = at > 0 ? rawProfEmail.slice(at + 1) : null;
          const explicitCompany =
            typeof newCompanyName === 'string' && newCompanyName.trim()
              ? newCompanyName.trim()
              : null;
          const fromInterpretation =
            typeof interpreted.contactCompany === 'string' &&
            interpreted.contactCompany.trim()
              ? interpreted.contactCompany.trim()
              : null;
          const resolvedCompanyName = explicitCompany || fromInterpretation;

          await prisma.contact.update({
            where: { id: contactId },
            data: {
              email: rawProfEmail,
              ...(resolvedCompanyName ? { companyName: resolvedCompanyName } : {}),
              ...(derivedDomain ? { companyDomain: derivedDomain } : {}),
              recentJobChange: true,
              numberOfJobChanges: { increment: 1 },
            },
          });
        }
      }
    }

    if (
      contactId &&
      isScheduledMeetingPurpose &&
      activityType === 'inbound_email' &&
      effectiveNextEngagementDate
    ) {
      const dateStr = effectiveNextEngagementDate.slice(0, 10);
      const dayStart = new Date(`${dateStr}T00:00:00.000Z`);
      const dayEnd = new Date(`${dateStr}T23:59:59.999Z`);
      const existingMeet = await prisma.meeting.findFirst({
        where: {
          contactId,
          meetingDate: { gte: dayStart, lte: dayEnd },
        },
        select: { id: true },
      });
      if (!existingMeet) {
        const noteText =
          inbound.text || inbound.html?.replace(/<[^>]+>/g, ' ').trim() || null;
        const meetingDateParsed = new Date(`${dateStr}T12:00:00.000Z`);
        const m = await prisma.meeting.create({
          data: {
            contactId,
            ownerId,
            crmId: companyHQId,
            meetingDate: meetingDateParsed,
            meetingType: 'FOLLOW_UP',
            notes: noteText,
            nextAction: interpreted.summary || null,
            nextEngagementDate: effectiveNextEngagementDate,
          },
        });
        if (noteText && noteText.length >= 20) {
          try {
            const summary = await generateMeetingSummaryService(noteText);
            if (summary) {
              await prisma.meeting.update({
                where: { id: m.id },
                data: { summary },
              });
            }
          } catch (err) {
            console.warn(
              '⚠️ Meeting summary generation failed:',
              (err as Error)?.message,
            );
          }
        }
        console.log(`✅ push-to-ai: created Meeting ${m.id} from scheduled-meeting detect`);
      }
    }

    if (
      activityType === 'outbound_email' &&
      contactId &&
      (interpreted.subject?.trim() || interpreted.body?.trim()) &&
      (interpreted.body?.trim()?.length ?? 0) >= 20
    ) {
      try {
        const contactRow = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { outreachPersonaSlug: true },
        });
        const subject = (interpreted.subject || inbound.subject || 'No subject').trim();
        const body = (interpreted.body || '').trim();
        await prisma.templates.create({
          data: {
            companyHQId,
            ownerId,
            title: subject.slice(0, 200) || 'From inbound',
            subject,
            body,
            ...(contactRow?.outreachPersonaSlug
              ? { personaSlug: contactRow.outreachPersonaSlug }
              : {}),
          },
        });
      } catch (templateErr) {
        console.warn('⚠️ push-to-ai: template save skipped:', (templateErr as Error)?.message);
      }
    }

    if (interpreted.summary && contactId) {
      syncEmailSummaryToLog(emailActivity.id).catch(() => {});
    }

    recordId = emailActivity.id;
    recordType = 'EmailActivity';
  }

  let pipe = contactId
    ? await prisma.pipelines.findUnique({ where: { contactId } })
    : null;
  const meetingSignaled =
    isScheduledMeetingPurpose ||
    isMeetingOrCall ||
    effectiveNextEngagementPurpose === 'MEETING_FOLLOW_UP';
  if (contactId) {
    try {
      const { snapPipelineOnContact } = await import('@/lib/services/pipelineService');
      if (meetingSignaled) {
        const contactQuick = await prisma.contact.findUnique({
          where: { id: contactId },
          select: { contactDisposition: true },
        });
        const allowedStages = [
          'need-to-engage',
          'engaged-awaiting-response',
          'interest',
        ];
        if (
          pipe?.pipeline === 'prospect' &&
          pipe.stage &&
          allowedStages.includes(pipe.stage) &&
          contactQuick?.contactDisposition !== 'OPTED_OUT'
        ) {
          await prisma.pipelines.update({
            where: { contactId },
            data: { stage: 'meeting', updatedAt: new Date() },
          });
          await snapPipelineOnContact(contactId, pipe.pipeline, 'meeting');
          pipe = { ...pipe, stage: 'meeting' };
          console.log('✅ push-to-ai: prospect pipeline → meeting (engagement signals)');
        }
      }

      const connectorForwardSignaled =
        !meetingSignaled &&
        (effectiveNextEngagementPurpose === 'PURSUE_INTRO' ||
          effectiveNextEngagementPurpose === 'REFERRAL_NO_CONTACT');
      if (connectorForwardSignaled && pipe?.pipeline === 'prospect' && pipe.stage) {
        const protectedStages = ['contract', 'contract-signed', 'proposal'];
        if (
          !protectedStages.includes(pipe.stage) &&
          isValidStageForPipeline('forwarded', 'connector')
        ) {
          await prisma.pipelines.update({
            where: { contactId },
            data: {
              pipeline: 'connector',
              stage: 'forwarded',
              updatedAt: new Date(),
            },
          });
          await snapPipelineOnContact(contactId, 'connector', 'forwarded');
          pipe = { ...pipe, pipeline: 'connector', stage: 'forwarded' };
          console.log('✅ push-to-ai: prospect → connector/forwarded (PURSUE_INTRO / referral)');
        }
      }
    } catch (e) {
      console.warn('⚠️ Pipeline shift skipped:', (e as Error)?.message);
    }
  }

  let pipelineMatch: InboundRecordingApplySuccess['pipelineMatch'] = null;

  if (contactId && generatePipelineMatch) {
    try {
      const hasSchedFlag =
        isScheduledMeetingPurpose && activityType === 'inbound_email';
      const match = await suggestInboundPipelineMatch({
        contactId,
        engagement: {
          activityType,
          summary: interpreted.summary || '',
          hasScheduledMeeting: hasSchedFlag,
          nextEngagementDate: effectiveNextEngagementDate,
          subject: interpreted.subject || inbound.subject,
          bodySnippet:
            (typeof interpreted.body === 'string' ? interpreted.body : null) ||
            (typeof parsed.body === 'string' ? parsed.body : null),
        },
      });
      let applied = false;
      if (applyPipelineMatch && match.proposal) {
        const fresh = await prisma.pipelines.findUnique({
          where: { contactId },
        });
        const pipelineChanged = match.proposal.targetPipeline !== fresh?.pipeline;
        if (pipelineChanged) {
          applied = await applyInboundPipelineMatchProposal(contactId, match.proposal);
        }
      }
      pipelineMatch = { ...match, applied };
    } catch (pmErr) {
      console.warn('⚠️ pipelineMatch:', (pmErr as Error)?.message);
    }
  }

  let connectorIntroductionMadeBump: {
    contactId: string;
    email: string;
  } | null = null;
  const referralRef = interpreted.referralSourceEmail;
  if (companyHQId && isMeetingOrCall && referralRef) {
    const refEmail = String(referralRef).trim().toLowerCase();
    if (refEmail) {
      try {
        const { snapPipelineOnContact } = await import('@/lib/services/pipelineService');
        const primaryEmail = contactId
          ? (
              await prisma.contact.findUnique({
                where: { id: contactId },
                select: { email: true },
              })
            )?.email?.toLowerCase()
          : null;
        if (!(primaryEmail && primaryEmail === refEmail)) {
          const connectorRow = await prisma.contact.findFirst({
            where: {
              crmId: companyHQId,
              email: { equals: refEmail, mode: 'insensitive' },
            },
            select: { id: true },
          });
          if (connectorRow && (!contactId || connectorRow.id !== contactId)) {
            const connectorPipe = await prisma.pipelines.findUnique({
              where: { contactId: connectorRow.id },
            });
            if (
              connectorPipe?.pipeline === 'connector' &&
              connectorPipe.stage &&
              connectorPipe.stage !== 'introduction-made' &&
              isValidStageForPipeline('introduction-made', 'connector')
            ) {
              await prisma.pipelines.update({
                where: { contactId: connectorRow.id },
                data: { stage: 'introduction-made', updatedAt: new Date() },
              });
              await snapPipelineOnContact(
                connectorRow.id,
                'connector',
                'introduction-made',
              );
              connectorIntroductionMadeBump = {
                contactId: connectorRow.id,
                email: refEmail,
              };
              console.log(
                '✅ push-to-ai: connector → introduction-made for referral source',
                refEmail,
              );
            }
          }
        }
      } catch (connErr) {
        console.warn(
          '⚠️ connector introduction-made bump:',
          (connErr as Error)?.message,
        );
      }
    }
  }

  await prisma.inboundEmail.update({
    where: { id: inboundEmailId },
    data: {
      ingestionStatus: 'RECORDED',
      inboundType: 'OUTREACH',
      processingError: null,
      parsedContactEmail: effectiveContactEmail || null,
      parsedContactName: interpreted.contactName || null,
      ...(markAutoProcessed ? { autoProcessed: true } : {}),
    },
  });

  return {
    success: true,
    recordId,
    recordType,
    contactId,
    pipelineMatch,
    connectorIntroductionMadeBump,
    parsed: {
      contactEmail: effectiveContactEmail,
      contactName: interpreted.contactName,
      nextEngagementDate: effectiveNextEngagementDate,
      nextEngagementPurpose:
        nextEngagementPurposeForResponse ?? effectiveNextEngagementPurpose,
      isResponse: interpreted.isResponse,
      summary: interpreted.summary,
      activityType,
      activityDate,
      referralSourceEmail: interpreted.referralSourceEmail ?? null,
      referralSourceName: interpreted.referralSourceName ?? null,
    },
  };
}
