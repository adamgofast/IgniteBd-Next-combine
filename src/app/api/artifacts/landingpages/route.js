import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/landingpages
 * Create a new landingpage
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
      url,
      content,
      description,
      published = false,
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    const landingpage = await prisma.landingpage.create({
      data: {
        companyHQId,
        title: title || null,
        url: url || null,
        content: content || null,
        description: description || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ LandingPage created:', landingpage.id);

    return NextResponse.json({
      success: true,
      landingpage,
    });
  } catch (error) {
    console.error('❌ CreateLandingPage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create landingpage',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/landingpages
 * List landingpages
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

    const landingpages = await prisma.landingpage.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      landingpages,
    });
  } catch (error) {
    console.error('❌ ListLandingPages error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list landingpages',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
