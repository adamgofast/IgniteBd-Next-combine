import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/status
 * 
 * Get Microsoft OAuth connection status for the current user
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication
    const firebaseUser = await verifyFirebaseToken(request);

    // Get Owner record
    const owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      return NextResponse.json({
        success: true,
        microsoftAuth: null,
      });
    }

    // Return Microsoft auth status (without sensitive tokens)
    const microsoftAuth = owner.microsoftAccessToken
      ? {
          email: owner.microsoftEmail,
          displayName: owner.microsoftDisplayName,
          expiresAt: owner.microsoftExpiresAt,
        }
      : null;

    return NextResponse.json({
      success: true,
      microsoftAuth,
    });
  } catch (error) {
    console.error('Microsoft status error:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to get Microsoft status' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

