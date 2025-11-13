import { NextResponse } from 'next/server';
import { getFirebaseAdmin } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';

// CORS headers for client portal
const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://clientportal.ignitegrowth.biz',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Max-Age': '86400',
};

/**
 * OPTIONS /api/set-password
 * Handle CORS preflight requests
 */
export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

/**
 * POST /api/set-password
 * Set password for Firebase user and mark contact as activated
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const { uid, password, contactId } = body;

    if (!uid || !password) {
      return NextResponse.json(
        { success: false, error: 'uid and password are required' },
        { status: 400, headers: corsHeaders },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { success: false, error: 'Password must be at least 8 characters' },
        { status: 400, headers: corsHeaders },
      );
    }

    // Update Firebase user password
    const admin = getFirebaseAdmin();
    if (!admin) {
      throw new Error('Firebase admin not configured');
    }

    await admin.auth().updateUser(uid, { password });

    // Update contact as activated (find by firebaseUid or contactId)
    if (contactId) {
      await prisma.contact.update({
        where: { id: contactId },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    } else {
      // Find by firebaseUid (which is unique)
      await prisma.contact.update({
        where: { firebaseUid: uid },
        data: {
          isActivated: true,
          activatedAt: new Date(),
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password set successfully',
      },
      { headers: corsHeaders },
    );
  } catch (error) {
    console.error('❌ SetPassword error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to set password',
        details: error.message,
      },
      { status: 500, headers: corsHeaders },
    );
  }
}
