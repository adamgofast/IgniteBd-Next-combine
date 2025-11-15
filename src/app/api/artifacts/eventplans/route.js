import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/eventplans
 * Create a new eventplan
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
      eventname,
      date,
      location,
      agenda,
      description,
      published = false,
    } = body ?? {};

    if (!companyHQId || !eventname) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and eventname are required' },
        { status: 400 },
      );
    }

    const eventplan = await prisma.eventplan.create({
      data: {
        companyHQId,
        eventname: eventname || null,
        date: date || null,
        location: location || null,
        agenda: agenda || null,
        description: description || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ EventPlan created:', eventplan.id);

    return NextResponse.json({
      success: true,
      eventplan,
    });
  } catch (error) {
    console.error('❌ CreateEventPlan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create eventplan',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/eventplans
 * List eventplans
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

    const eventplans = await prisma.eventplan.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      eventplans,
    });
  } catch (error) {
    console.error('❌ ListEventPlans error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list eventplans',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
