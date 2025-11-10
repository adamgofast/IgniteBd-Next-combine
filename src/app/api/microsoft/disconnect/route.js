import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * DELETE /api/microsoft/disconnect
 * 
 * Disconnect Microsoft OAuth connection for the current user
 */
export async function DELETE(request) {
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

    // Clear Microsoft auth fields from Owner
    await prisma.owner.update({
      where: { id: owner.id },
      data: {
        microsoftAccessToken: null,
        microsoftRefreshToken: null,
        microsoftExpiresAt: null,
        microsoftEmail: null,
        microsoftDisplayName: null,
      },
    });

    console.log('✅ Microsoft OAuth disconnected for owner:', owner.id);

    return NextResponse.json({
      success: true,
      message: 'Microsoft account disconnected successfully',
    });
  } catch (error) {
    console.error('Microsoft disconnect error:', error);
    
    // If record doesn't exist, that's okay
    if (error.code === 'P2025') {
      return NextResponse.json({
        success: true,
        message: 'Microsoft account already disconnected',
      });
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to disconnect Microsoft account' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

