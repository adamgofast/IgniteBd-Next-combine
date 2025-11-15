import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

export async function GET(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Persona ID is required' },
        { status: 400 },
      );
    }

    const persona = await prisma.persona.findUnique({
      where: { id },
    });

    if (!persona) {
      return NextResponse.json(
        { success: false, error: 'Persona not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      persona,
    });
  } catch (error) {
    console.error('❌ GetPersona error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function PATCH(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Persona ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      name,
      role,
      title,
      industry,
      goals,
      painPoints,
      desiredOutcome,
      valuePropToPersona,
    } = body ?? {};

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (role !== undefined) updateData.role = role;
    if (title !== undefined) updateData.title = title;
    if (industry !== undefined) updateData.industry = industry;
    if (goals !== undefined) updateData.goals = goals;
    if (painPoints !== undefined) updateData.painPoints = painPoints;
    if (desiredOutcome !== undefined) updateData.desiredOutcome = desiredOutcome;
    if (valuePropToPersona !== undefined) updateData.valuePropToPersona = valuePropToPersona;

    const persona = await prisma.persona.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Persona updated:', persona.id);

    return NextResponse.json({
      success: true,
      persona,
    });
  } catch (error) {
    console.error('❌ UpdatePersona error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    await verifyFirebaseToken(request);
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 },
    );
  }

  try {
    const { id } = params || {};
    if (!id) {
      return NextResponse.json(
        { success: false, error: 'Persona ID is required' },
        { status: 400 },
      );
    }

    await prisma.persona.delete({
      where: { id },
    });

    console.log('✅ Persona deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Persona deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeletePersona error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete persona',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

