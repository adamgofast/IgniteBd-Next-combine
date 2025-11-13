import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { optionallyVerifyFirebaseToken } from '@/lib/firebaseAdmin';
import { handleCorsPreflight, corsResponse } from '@/lib/cors';

/**
 * OPTIONS /api/contacts/by-email
 * Handle CORS preflight requests
 */
export async function OPTIONS(request) {
  return handleCorsPreflight(request);
}

/**
 * GET /api/contacts/by-email
 * Get contact by email (for client portal login)
 * Query param: email (required)
 */
export async function GET(request) {
  try {
    // Log request for debugging
    console.log('📥 GET /api/contacts/by-email - Request received');
    
    // Optionally verify Firebase token (doesn't throw if missing)
    try {
      await optionallyVerifyFirebaseToken(request);
    } catch (authError) {
      // Log but don't fail - this endpoint allows unauthenticated access
      console.warn('⚠️ Auth verification failed (optional):', authError.message);
    }
    
    if (!request || !request.nextUrl) {
      throw new Error('Invalid request object');
    }
    
    const { searchParams } = request.nextUrl;
    const email = searchParams.get('email');
    
    console.log('📧 Email from query:', email);

    if (!email) {
      return corsResponse(
        { success: false, error: 'email is required' },
        400,
        request,
      );
    }

    console.log('🔍 Searching for contact with email:', email.toLowerCase().trim());
    
    // Use findUnique since email is unique - faster and more accurate
    const contact = await prisma.contact.findUnique({
      where: {
        email: email.toLowerCase().trim(),
      },
    });
    
    console.log('✅ Contact found:', contact ? contact.id : 'null');

    if (!contact) {
      return corsResponse(
        { success: false, error: 'Contact not found' },
        404,
        request,
      );
    }

    // Return only the essential fields - don't try to access relations that might not exist
    return corsResponse(
      {
        success: true,
        contact: {
          id: contact.id,
          firstName: contact.firstName || null,
          lastName: contact.lastName || null,
          email: contact.email,
          crmId: contact.crmId,
          contactCompanyId: contact.contactCompanyId || null,
          // Don't include relations - they can be fetched separately if needed
        },
      },
      200,
      request,
    );
  } catch (error) {
    console.error('❌ GetContactByEmail error:', error);
    console.error('Error stack:', error.stack);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    
    // Ensure we always return a CORS-enabled response, even on error
    try {
      return corsResponse(
        {
          success: false,
          error: 'Failed to get contact',
          details: process.env.NODE_ENV === 'development' ? error.message : undefined,
        },
        500,
        request,
      );
    } catch (corsError) {
      // Fallback if CORS utility fails
      console.error('❌ CORS utility error:', corsError);
      return NextResponse.json(
        {
          success: false,
          error: 'Internal server error',
        },
        { status: 500 },
      );
    }
  }
}

