import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/personas
 * Create a new persona
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
      role,
      title,
      industry,
      goals,
      painPoints,
      desiredOutcome,
      valuePropToPersona,
      published = false,
    } = body ?? {};

    if (!companyHQId || !name) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and name are required' },
        { status: 400 },
      );
    }

    // Note: Persona model doesn't have published field yet, but we'll add it if needed
    const persona = await prisma.persona.create({
      data: {
        companyHQId,
        name,
        role: role || null,
        title: title || null,
        industry: industry || null,
        goals: goals || null,
        painPoints: painPoints || null,
        desiredOutcome: desiredOutcome || null,
        valuePropToPersona: valuePropToPersona || null,
      },
    });

    console.log('✅ Persona created:', persona.id);

    return NextResponse.json({
      success: true,
      persona,
    });
  } catch (error) {
    console.error('❌ CreatePersona error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/personas
 * List personas
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

    const where = {};
    if (companyHQId) where.companyHQId = companyHQId;

    const personas = await prisma.persona.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      personas,
    });
  } catch (error) {
    console.error('❌ ListPersonas error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list personas',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

