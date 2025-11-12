import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { ensureFirebaseUser } from '@/lib/firebaseUser';
import { generateInviteLink } from '@/lib/inviteLink';

/**
 * POST /api/contacts/:contactId/generate-portal-access
 * Generate portal access for Contact using InviteToken flow
 * Creates Firebase account and generates branded activation link
 * 
 * Universal personhood - same Contact, now has portal access
 */
export async function POST(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    // Await params in Next.js App Router
    const resolvedParams = await params;
    const { contactId } = resolvedParams || {};
    if (!contactId) {
      return NextResponse.json(
        { success: false, error: 'contactId is required' },
        { status: 400 },
      );
    }

    // Get contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
      include: {
        contactCompany: true,
        companyHQ: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    if (!contact.email) {
      return NextResponse.json(
        { success: false, error: 'Contact must have an email address to access client portal' },
        { status: 400 },
      );
    }

    // Ensure Firebase user exists
    const { user: firebaseUser, wasCreated } = await ensureFirebaseUser(contact.email);
    
    const clientPortalUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://clientportal.ignitegrowth.biz';
    
    // Update contact with Firebase UID if needed
    if (contact.firebaseUid !== firebaseUser.uid) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          firebaseUid: firebaseUser.uid,
          clientPortalUrl,
        },
      });
    }

    // Generate invite link (creates InviteToken)
    const activationLink = await generateInviteLink(contactId, contact.email);

    // Return activation link (NOT password!)
    return NextResponse.json({
      success: true,
      invite: {
        contactId,
        contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
        contactEmail: contact.email,
        firebaseUid: firebaseUser.uid,
        activationLink,
        passwordResetLink: activationLink, // For backwards compatibility
        loginUrl: `${clientPortalUrl}/login`,
      },
      message: 'Portal access generated. Send the activation link to the client.',
    });
  } catch (error) {
    console.error('❌ GeneratePortalAccess error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate portal access',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
