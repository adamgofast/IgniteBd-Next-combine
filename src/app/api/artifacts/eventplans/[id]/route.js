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
        { success: false, error: 'EventPlan ID is required' },
        { status: 400 },
      );
    }

    const eventplan = await prisma.eventplan.findUnique({
      where: { id },
    });

    if (!eventplan) {
      return NextResponse.json(
        { success: false, error: 'EventPlan not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      eventplan,
    });
  } catch (error) {
    console.error('❌ GetEventPlan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get eventplan',
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
        { success: false, error: 'EventPlan ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      eventname,
      date,
      location,
      agenda,
      description,
      published,
    } = body ?? {};

    const updateData = {};
    if (eventname !== undefined) updateData.eventname = eventname;
    if (date !== undefined) updateData.date = date;
    if (location !== undefined) updateData.location = location;
    if (agenda !== undefined) updateData.agenda = agenda;
    if (description !== undefined) updateData.description = description;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const eventplan = await prisma.eventplan.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ EventPlan updated:', eventplan.id);

    return NextResponse.json({
      success: true,
      eventplan,
    });
  } catch (error) {
    console.error('❌ UpdateEventPlan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update eventplan',
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
        { success: false, error: 'EventPlan ID is required' },
        { status: 400 },
      );
    }

    await prisma.eventplan.delete({
      where: { id },
    });

    console.log('✅ EventPlan deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'EventPlan deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteEventPlan error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete eventplan',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
