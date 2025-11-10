import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { sendMail } from '@/lib/microsoftGraphClient';

/**
 * POST /api/microsoft/send-mail
 * 
 * Send email via Microsoft Graph
 * Requires Microsoft account to be connected
 */
export async function POST(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json(
        { success: false, error: 'Owner not found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { subject, body: emailBody, toRecipients, ccRecipients, bccRecipients, contentType, replyTo, saveToSentItems } = body;

    // Validate required fields
    if (!subject || !emailBody || !toRecipients || !Array.isArray(toRecipients) || toRecipients.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Subject, body, and toRecipients are required' },
        { status: 400 }
      );
    }

    // Send email via Microsoft Graph
    await sendMail(owner.id, {
      subject,
      body: emailBody,
      toRecipients,
      ccRecipients,
      bccRecipients,
      contentType: contentType || 'HTML',
      replyTo,
      saveToSentItems: saveToSentItems !== undefined ? saveToSentItems : true,
    });

    return NextResponse.json({
      success: true,
      message: 'Email sent successfully',
    });
  } catch (error) {
    console.error('Send mail error:', error);
    
    if (error.message?.includes('not connected')) {
      return NextResponse.json(
        { success: false, error: 'Microsoft account not connected. Please connect your account in Settings → Integrations.' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send email' },
      { status: 500 }
    );
  }
}

