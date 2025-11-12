import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken, getFirebaseAdmin } from '@/lib/firebaseAdmin';

/**
 * POST /api/contacts/:contactId/generate-portal-access
 * Generate portal access for Contact using Firebase
 * Creates Firebase account and generates password reset link
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

    // Create Firebase user account for this contact
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase admin not configured');
    }
    
    const auth = admin.auth();
    let firebaseUser;
    
    try {
      // Try to get existing user by email
      try {
        firebaseUser = await auth.getUserByEmail(contact.email);
        // User exists - we'll just generate a new reset link
      } catch (error) {
        // User doesn't exist - create new
        firebaseUser = await auth.createUser({
          email: contact.email,
          displayName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
          emailVerified: false,
          disabled: false,
        });
      }

      // Generate password reset link - handled on our client portal page
      // Client clicks link → Goes to our reset-password page → Sets password → Redirects to login
      const clientPortalUrl = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'http://localhost:3001';
      const resetLink = await auth.generatePasswordResetLink(contact.email, {
        url: `${clientPortalUrl}/reset-password`, // Our custom password reset page
        handleCodeInApp: true, // Handle on our page, not Firebase's hosted page
      });
      
      // Store Firebase UID in Contact (link Contact to Firebase user)
      const existingNotes = contact.notes ? JSON.parse(contact.notes) : {};
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          notes: JSON.stringify({
            ...existingNotes,
            clientPortalAuth: {
              firebaseUid: firebaseUser.uid,
              generatedAt: new Date().toISOString(),
              portalUrl: process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'http://localhost:3001',
            },
          }),
        },
      });

      // Return reset link
      return NextResponse.json({
        success: true,
        invite: {
          contactId,
          contactName: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email,
          contactEmail: contact.email,
          passwordResetLink: resetLink, // Firebase password reset link
          loginUrl: `${process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'http://localhost:3001'}/login`,
        },
        message: 'Portal access generated. Send the password reset link to the client to set their password.',
      });
    } catch (firebaseError) {
      console.error('Firebase user creation error:', firebaseError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create Firebase account',
          details: firebaseError.message,
        },
        { status: 500 },
      );
    }
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
