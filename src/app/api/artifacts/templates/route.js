import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/templates
 * Create a new template
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
      name,
      subject,
      body,
      type,
      published = false,
    } = body ?? {};

    if (!companyHQId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and name are required' },
        { status: 400 },
      );
    }

    const template = await prisma.template.create({
      data: {
        companyHQId,
        name: name || null,
        subject: subject || null,
        body: body || null,
        type: type || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ Template created:', template.id);

    return NextResponse.json({
      success: true,
      template,
    });
  } catch (error) {
    console.error('❌ CreateTemplate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create template',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/templates
 * List templates
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

    const templates = await prisma.template.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      templates,
    });
  } catch (error) {
    console.error('❌ ListTemplates error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list templates',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
