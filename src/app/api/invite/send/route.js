import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { ensureFirebaseUser } from '@/lib/firebaseUser';
import { randomBytes } from 'crypto';

/**
 * POST /api/invite/send
 * Generate invite token and send activation email
 */
export async function POST(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const body = await request.json();
    const { contactId, email } = body;

    if (!contactId || !email) {
      return NextResponse.json(
        { success: false, error: 'contactId and email are required' },
        { status: 400 },
      );
    }

    // Get contact
    const contact = await prisma.contact.findUnique({
      where: { id: contactId },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404 },
      );
    }

    if (contact.email !== email) {
      return NextResponse.json(
        { success: false, error: 'Email mismatch' },
        { status: 400 },
      );
    }

    // Check if contact is already activated
    if (contact.isActivated) {
      return NextResponse.json({
        success: true,
        alreadyActivated: true,
        message: 'Contact is already activated. They can login with their password.',
        invite: {
          contactId,
          email,
          firebaseUid: contact.firebaseUid,
          isActivated: true,
          activatedAt: contact.activatedAt,
        },
      });
    }

    // Check for existing unused, non-expired invite token
    const existingToken = await prisma.inviteToken.findFirst({
      where: {
        contactId,
        used: false,
        expiresAt: {
          gt: new Date(), // Not expired
        },
      },
      orderBy: {
        createdAt: 'desc', // Get most recent
      },
    });

    // If valid token exists, return it instead of creating new
    if (existingToken) {
      const clientPortalUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://clientportal.ignitegrowth.biz';
      const activationLink = `${clientPortalUrl}/activate?token=${existingToken.token}`;

      console.log('✅ Using existing invite token:', {
        contactId,
        email,
        tokenId: existingToken.id,
        expiresAt: existingToken.expiresAt,
      });

      return NextResponse.json({
        success: true,
        existingToken: true,
        invite: {
          contactId,
          email,
          firebaseUid: contact.firebaseUid,
          token: existingToken.token,
          tokenId: existingToken.id,
          activationLink,
          expiresAt: existingToken.expiresAt.toISOString(),
        },
        message: 'Active invite token found. Use this link to activate.',
      });
    }

    // Ensure Firebase user exists (upsert - creates if doesn't exist, gets if exists)
    const { user: firebaseUser, wasCreated: firebaseUserWasCreated } = await ensureFirebaseUser(email);

    const clientPortalUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://clientportal.ignitegrowth.biz';
    
    // Update contact with Firebase UID and portal URL (NOT in notes!)
    await prisma.contact.update({
      where: { id: contactId },
      data: {
        firebaseUid: firebaseUser.uid,
        clientPortalUrl: clientPortalUrl,
      },
    });

    // Generate invite token (16 hex characters = 8 bytes)
    const token = randomBytes(8).toString('hex');
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24 hours

    // Create invite token
    const inviteToken = await prisma.inviteToken.create({
      data: {
        contactId,
        email,
        token,
        expiresAt,
      },
    });

    const activationLink = `${clientPortalUrl}/activate?token=${token}`;

    console.log('✅ Invite created:', {
      contactId,
      email,
      firebaseUid: firebaseUser.uid,
      firebaseUserStatus: firebaseUserWasCreated ? 'CREATED' : 'EXISTING',
      inviteTokenId: inviteToken.id,
      tokenPreview: token.substring(0, 8) + '...', // Log partial token for security
      clientPortalUrl,
    });

    // TODO: Send branded email with activationLink
    // For now, return the link

    return NextResponse.json({
      success: true,
      invite: {
        contactId,
        email,
        firebaseUid: firebaseUser.uid,
        firebaseUserStatus: firebaseUserWasCreated ? 'created' : 'existing',
        token,
        tokenId: inviteToken.id,
        activationLink,
        expiresAt: expiresAt.toISOString(),
      },
      message: `✅ Portal access ready! ${firebaseUserWasCreated ? 'Created new Firebase user' : 'Using existing Firebase user'} and generated invite token.`,
    });
  } catch (error) {
    console.error('❌ Invite send error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to send invite',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

