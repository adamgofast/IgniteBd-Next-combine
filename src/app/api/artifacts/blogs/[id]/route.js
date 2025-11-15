import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/artifacts/blogs/:id
 * Get a single blog
 */
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
        { success: false, error: 'Blog ID is required' },
        { status: 400 },
      );
    }

    const blog = await prisma.blog.findUnique({
      where: { id },
    });

    if (!blog) {
      return NextResponse.json(
        { success: false, error: 'Blog not found' },
        { status: 404 },
      );
    }

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ GetBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to get blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/artifacts/blogs/:id
 * Update a blog
 */
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
        { success: false, error: 'Blog ID is required' },
        { status: 400 },
      );
    }

    const body = await request.json();
    const { title, content, author, published } = body ?? {};

    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (author !== undefined) updateData.author = author;
    if (published !== undefined) {
      updateData.published = published;
      updateData.publishedAt = published ? new Date() : null;
    }

    const blog = await prisma.blog.update({
      where: { id },
      data: updateData,
    });

    console.log('✅ Blog updated:', blog.id);

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ UpdateBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/artifacts/blogs/:id
 * Delete a blog
 */
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
        { success: false, error: 'Blog ID is required' },
        { status: 400 },
      );
    }

    await prisma.blog.delete({
      where: { id },
    });

    console.log('✅ Blog deleted:', id);

    return NextResponse.json({
      success: true,
      message: 'Blog deleted successfully',
    });
  } catch (error) {
    console.error('❌ DeleteBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

