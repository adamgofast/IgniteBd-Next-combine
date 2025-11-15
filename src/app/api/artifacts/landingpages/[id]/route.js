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
        { success: false, error: 'LandingPage ID is required' },
        { status: 400 },
      );
    }

    const landingpage = await prisma.landingpage.findUnique({
      where: { id },
    });

    if (!landingpage) {
      return NextResponse.json(
        { success: false, error: 'LandingPage not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      landingpage,
    });
  } catch (error) {
    console.error('❌ GetLandingPage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get landingpage',
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
        { success: false, error: 'LandingPage ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const {
      title,
      url,
      content,
      description,
      published,
    } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (url !== undefined) updateData.url = url;
    if (content !== undefined) updateData.content = content;
    if (description !== undefined) updateData.description = description;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const landingpage = await prisma.landingpage.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ LandingPage updated:', landingpage.id);

    return NextResponse.json({
      success: true,
      landingpage,
    });
  } catch (error) {
    console.error('❌ UpdateLandingPage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update landingpage',
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
        { success: false, error: 'LandingPage ID is required' },
        { status: 400 },
      );
    }

    await prisma.landingpage.delete({
      where: { id },
    });

    console.log('✅ LandingPage deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'LandingPage deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteLandingPage error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete landingpage',
        details: error.message,
      },
      { status: 500 },
    );
  }
}
