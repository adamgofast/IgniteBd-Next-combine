import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// CORS headers for client portal
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://clientportal.ignitegrowth.biz',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/contacts/by-firebase-uid
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * GET /api/contacts/by-firebase-uid
 * Get contact by Firebase UID (for client portal)
 * Returns contact info including role
 */
export async function GET(request) {
  try {
    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(request);
    const firebaseUid = decodedToken.uid;

    // Get contact by Firebase UID
    const contact = await prisma.contact.findUnique({
      where: { firebaseUid },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        ownerId: true,
        crmId: true,
        isActivated: true,
      },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    return NextResponse.json(
      {
        success: true,
        contact,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('❌ GetContactByFirebaseUid error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message?.includes('Unauthorized') ? 'Unauthorized' : 'Failed to get contact',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      {
        status: error.message?.includes('Unauthorized') ? 401 : 500,
        headers: corsHeaders,
      },
    );
  }
}

