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
        { success: false, error: 'CleDeck ID is required' },
        { status: 400 },
      );
    }

    const cledeck = await prisma.cledeck.findUnique({
      where: { id },
    });

    if (!cledeck) {
      return NextResponse.json(
        { success: false, error: 'CleDeck not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      cledeck,
    });
  } catch (error) {
    console.error('❌ GetCleDeck error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get cledeck',
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
        { success: false, error: 'CleDeck ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      title,
      slides,
      presenter,
      description,
      published,
    } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (slides !== undefined) updateData.slides = slides;
    if (presenter !== undefined) updateData.presenter = presenter;
    if (description !== undefined) updateData.description = description;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const cledeck = await prisma.cledeck.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ CleDeck updated:', cledeck.id);

    return NextResponse.json({
      success: true,
      cledeck,
    });
  } catch (error) {
    console.error('❌ UpdateCleDeck error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update cledeck',
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
        { success: false, error: 'CleDeck ID is required' },
        { status: 400 },
      );
    }

    await prisma.cledeck.delete({
      where: { id },
    });

    console.log('✅ CleDeck deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'CleDeck deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteCleDeck error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete cledeck',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
