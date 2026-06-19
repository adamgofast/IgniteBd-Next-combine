import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';

/**
 * GET /api/contacts/lookup-by-email
 * Look up a contact by email within a tenant (for "Introduced by" flow).
 * Query params: email (required), crmId (required - scope to tenant)
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
    const url = request.nextUrl ?? new URL(request.url);
    const { searchParams } = url;
    const email = searchParams.get('email');
    const crmId = searchParams.get('crmId');

    if (!email?.trim()) {
      return NextResponse.json(
        { success: false, error: 'email is required' },
        { status: 400 },
      );
    }

    if (!crmId) {
      return NextResponse.json(
        { success: false, error: 'crmId is required to scope lookup' },
        { status: 400 },
      );
    }

    const trimmedEmail = email.trim();

    const contact = await prisma.contact.findFirst({
      where: {
        crmId,
        email: { equals: trimmedEmail, mode: 'insensitive' },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        goesBy: true,
        fullName: true,
        email: true,
        companyName: true,
        title: true,
        pipelineSnap: true,
        contactDisposition: true,
      },
    });

    if (!contact) {
      return NextResponse.json({ success: true, contact: null });
    }

    const displayName =
      contact.goesBy ||
      [contact.firstName, contact.lastName].filter(Boolean).join(' ') ||
      contact.fullName ||
      contact.email ||
      'Unknown';

    return NextResponse.json({
      success: true,
      contact: {
        id: contact.id,
        name: displayName,
        displayName,
        email: contact.email,
        company: contact.companyName ?? null,
        title: contact.title ?? null,
        pipeline: contact.pipelineSnap ?? null,
        optedOut: contact.contactDisposition === 'OPTED_OUT',
      },
    });
  } catch (error) {
    console.error('Lookup by email error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to lookup contact',
        details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 },
    );
  }
}
