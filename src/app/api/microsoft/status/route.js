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
      include: {
        microsoftAuth: true,
      },
    });

    if (!owner) {
      return NextResponse.json({
        success: true,
        microsoftAuth: null,
      });
    }

    // Return Microsoft auth status (without sensitive tokens)
    const microsoftAuth = owner.microsoftAuth
      ? {
          id: owner.microsoftAuth.id,
          email: owner.microsoftAuth.email,
          expiresAt: owner.microsoftAuth.expiresAt,
          createdAt: owner.microsoftAuth.createdAt,
          updatedAt: owner.microsoftAuth.updatedAt,
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

