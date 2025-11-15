import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * POST /api/artifacts/blogs
 * Create a new blog
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
      content,
      author,
      published = false,
    } = body ?? {};

    if (!companyHQId || !title) {
      return NextResponse.json(
        { success: false, error: 'companyHQId and title are required' },
        { status: 400 },
      );
    }

    const blog = await prisma.blog.create({
      data: {
        companyHQId,
        title,
        content: content || null,
        author: author || null,
        published,
        publishedAt: published ? new Date() : null,
      },
    });

    console.log('✅ Blog created:', blog.id);

    return NextResponse.json({
      success: true,
      blog,
    });
  } catch (error) {
    console.error('❌ CreateBlog error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create blog',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/artifacts/blogs
 * List blogs (with optional filters)
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

    const blogs = await prisma.blog.findMany({
      where,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      blogs,
    });
  } catch (error) {
    console.error('❌ ListBlogs error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to list blogs',
        details: error.message,
      },
      { status: 500 },
    );
  }
}

