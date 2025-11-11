import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/outreach/recent
 * 
 * Get recent email activities for the current owner
 * Requires Firebase authentication
 * 
 * Query params:
 * - limit: Number of records to return (default: 5)
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
        emailActivities: [],
      });
    }

    // Get limit from query params
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '5', 10);

    // Fetch recent email activities
    const emailActivities = await prisma.emailActivity.findMany({
      where: {
        ownerId: owner.id,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
      select: {
        id: true,
        email: true,
        subject: true,
        event: true,
        contactId: true,
        tenantId: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      emailActivities,
    });
  } catch (error) {
    console.error('Get recent outreach error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to get recent emails',
      },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

