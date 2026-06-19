import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { autoProcessInboundEmail } from '@/lib/services/inboundAutoProcessService';

/**
 * POST /api/inbound-parse/push-to-ai
 *
 * Record: Parse (universal) → Interpret (AI, once) → Log activity → Stamp engagement.
 * Accepts optional preInterpreted to avoid double AI when UI already ran interpret.
 *
 * Body: { inboundEmailId, contactEmail?, contactIdOverride?, nextEngagementDate?, nextEngagementPurpose?, interpretation?, generatePipelineMatch?, applyPipelineMatch? }
 *
 * contactIdOverride: if provided, skips email-based find-or-create and directly links
 * the specified contact. Used when the user selected a name-match candidate in the UI.
 *
 * Routes based on AI-detected activityType:
 *   call_note | meeting_note → creates a Meeting record (correct date, correct model)
 *   inbound_email | outbound_email | note → creates email_activities (existing path)
 */
export async function POST(request: Request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();
    const inboundEmailId = body?.inboundEmailId;

    if (!inboundEmailId || typeof inboundEmailId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing inboundEmailId' },
        { status: 400 },
      );
    }

    const result = await autoProcessInboundEmail(prisma, {
      inboundEmailId,
      nextEngagementDateOverride: body?.nextEngagementDate,
      contactEmailOverride: body?.contactEmail,
      contactIdOverride: body?.contactIdOverride,
      nextEngagementPurposeTopLevel: body?.nextEngagementPurpose,
      preInterpreted: body?.interpretation ?? null,
      generatePipelineMatch: body?.generatePipelineMatch === true,
      applyPipelineMatch: body?.applyPipelineMatch === true,
      updateContactProfile: body?.updateContactProfile === true,
      newContactEmail: body?.newContactEmail,
      newCompanyName: body?.newCompanyName,
      manualOverride: body?.manualOverride === true,
    });

    if (result.success === false) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: result.status },
      );
    }

    return NextResponse.json({
      success: true,
      recordId: result.recordId,
      recordType: result.recordType,
      contactId: result.contactId,
      pipelineMatch: result.pipelineMatch,
      connectorIntroductionMadeBump: result.connectorIntroductionMadeBump,
      parsed: result.parsed,
    });
  } catch (error) {
    console.error('❌ Record activity error:', error);
    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error ? error.message : 'Failed to record activity',
      },
      { status: 500 },
    );
  }
}
