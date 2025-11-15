import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/cledecks
 * Create a new cledeck
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
    const {
      companyHQId,
      title,
      slides,
      presenter,
      description,
      published = false,
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    const cledeck = await prisma.cledeck.create({
      data: {
        companyHQId,
        title: title || null,
        slides: slides || null,
        presenter: presenter || null,
        description: description || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ CleDeck created:', cledeck.id);

    return NextResponse.json({
      success: true,
      cledeck,
    });
  } catch (error) {
    console.error('❌ CreateCleDeck error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create cledeck',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/cledecks
 * List cledecks
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
    const { searchParams } = request.nextUrl;
    const companyHQId = searchParams.get('companyHQId');
    const published = searchParams.get('published');

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;
    if (published !== null) where.published = published === 'true';

    const cledecks = await prisma.cledeck.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      cledecks,
    });
  } catch (error) {
    console.error('❌ ListCleDecks error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list cledecks',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
