import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import { promoteToOwner } from '@/lib/services/promotion';

// CORS headers for client portal
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://clientportal.ignitegrowth.biz',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/promote-to-owner
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/promote-to-owner
 * Promote the authenticated contact to owner of their own CompanyHQ
 * Called from client portal when contact clicks "I'm Ready For My Stack"
 */
export async function POST(request) {
  try {
    // Verify Firebase token (contact must be authenticated)
    const decodedToken = await verifyFirebaseToken(request);
    const firebaseUid = decodedToken.uid;

    // Get contact by Firebase UID
    const contact = await prisma.contact.findUnique({
      where: { firebaseUid },
    });

    if (!contact) {
      return NextResponse.json(
        { success: false, error: 'Contact not found' },
        { status: 404, headers: corsHeaders },
      );
    }

    if (contact.role === 'owner') {
      return NextResponse.json(
        { success: false, error: 'Contact is already an owner' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (!contact.firebaseUid) {
      return NextResponse.json(
        { success: false, error: 'Contact must be activated to become an owner' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Promote to owner
    const newHq = await promoteToOwner(contact.id);

    return NextResponse.json(
      {
        success: true,
        message: 'Successfully promoted to owner',
        companyHQ: {
          id: newHq.id,
          companyName: newHq.companyName,
        },
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('❌ Promote to owner error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to promote to owner',
        details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}

