import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { sendOutreachEmail } from '@/lib/services/outreachSendService';

/**
 * POST /api/outreach/send
 * 
 * Send 1-to-1 outreach email via SendGrid
 * Requires Firebase authentication
 * 
 * Request body:
 * {
 *   "to": "prospect@example.com",
 *   "subject": "Quick intro",
 *   "body": "Hey, saw your work on...",
 *   "contactId": "c_123", (optional)
 *   "tenantId": "t_001" (optional)
 * }
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get or find Owner record
    let owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      // Create owner if it doesn't exist
      owner = await prisma.owner.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: firebaseUser.email || null,
          name: firebaseUser.name || null,
        },
      });
    }

    const ownerId = owner.id;

    // Parse request body
    const body = await request.json();
    const { to, subject, body: emailBody, contactId, tenantId, toName } = body;

    // Validation
    if (!to || !subject || !emailBody) {
      return NextResponse.json(
        { success: false, error: 'to, subject, and body are required' },
        { status: 400 }
      );
    }

    // Send email via SendGrid
    const { statusCode, messageId } = await sendOutreachEmail({
      to,
      toName,
      subject,
      body: emailBody,
      ownerId,
      contactId,
      tenantId,
    });

    // Log email activity in database
    const emailActivity = await prisma.emailActivity.create({
      data: {
        ownerId,
        contactId: contactId || null,
        tenantId: tenantId || null,
        email: to,
        subject,
        body: emailBody,
        messageId,
        event: 'sent', // Initial state
      },
    });

    console.log(`✅ Email activity logged: ${emailActivity.id}`);

    return NextResponse.json({
      success: true,
      messageId,
      statusCode,
      emailActivityId: emailActivity.id,
    });
  } catch (error) {
    console.error('Outreach send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to send outreach email',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

