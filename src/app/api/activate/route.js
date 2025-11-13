import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

// CORS headers for client portal
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://clientportal.ignitegrowth.biz',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/activate
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/activate
 * Verify invite token and return redirect URL for password setup
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token is required' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Find invite token
    const invite = await prisma.inviteToken.findUnique({
      where: { token },
      include: { contact: true },
    });

    if (!invite) {
      return NextResponse.json(
        { success: false, error: 'Invalid token' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (invite.used) {
      return NextResponse.json(
        { success: false, error: 'Token has already been used' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (invite.expiresAt < new Date()) {
      return NextResponse.json(
        { success: false, error: 'Token has expired' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Mark token as used
    await prisma.inviteToken.update({
      where: { token },
      data: { used: true },
    });

    // Return redirect URL with Firebase UID
    const clientPortalUrl = 'https://clientportal.ignitegrowth.biz';
    const redirectUrl = `${clientPortalUrl}/set-password?uid=${invite.contact.firebaseUid}&email=${encodeURIComponent(invite.email)}&contactId=${invite.contactId}`;

    return NextResponse.json(
      {
        success: true,
        url: redirectUrl,
        uid: invite.contact.firebaseUid,
        email: invite.email,
        contactId: invite.contactId,
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('❌ Activate error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to activate token',
        details: error.message,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
