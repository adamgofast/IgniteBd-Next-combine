import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/uploads
 * Get uploads for a specific owner
 * Query params: ownerId
 */
export async function GET(request) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const ownerId = searchParams.get('ownerId');

    if (!ownerId) {
      return NextResponse.json(
        { success: false, error: 'ownerId is required' },
        { status: 400 },
      );
    }

    const uploads = await prisma.clientUpload.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      success: true,
      uploads,
    });
  } catch (error) {
    console.error('❌ GetUploads error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch uploads',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

