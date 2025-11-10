import { NextResponse } from 'next/server';
import { verifyFirebaseToken } from '@/lib/firebaseAdmin';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * GET /api/microsoft/login
 * 
 * Initiates Microsoft OAuth flow
 * Requires Firebase authentication to identify the user
 */
export async function GET(request) {
  try {
    // Verify Firebase authentication to get the user
    const firebaseUser = await verifyFirebaseToken(request);
    
    // Get or create Owner record
    let owner = await prisma.owner.findUnique({
      where: { firebaseId: firebaseUser.uid },
    });

    if (!owner) {
      // Create owner if it doesn't exist
      owner = await prisma.owner.create({
        data: {
          firebaseId: firebaseUser.uid,
          email: firebaseUser.email || null,
          name: firebaseUser.name || null,
        },
      });
    }

    // Generate state parameter to verify callback
    const state = crypto.randomBytes(32).toString('base64url');
    
    // Store state and ownerId in a simple in-memory cache (in production, use Redis or session store)
    // For now, we'll encode the ownerId in the state parameter
    const stateData = {
      ownerId: owner.id,
      timestamp: Date.now(),
    };
    const encodedState = Buffer.from(JSON.stringify(stateData)).toString('base64url');

    // Build OAuth URL
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://ignitegrowth.biz/api/microsoft/callback';
    const params = new URLSearchParams({
      client_id: process.env.AZURE_CLIENT_ID,
      response_type: 'code',
      redirect_uri: redirectUri,
      response_mode: 'query',
      scope: 'https://graph.microsoft.com/.default offline_access',
      state: encodedState,
    });

    const authUrl = `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}/oauth2/v2.0/authorize?${params}`;

    return NextResponse.redirect(authUrl);
  } catch (error) {
    console.error('Microsoft OAuth login error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate OAuth flow' },
      { status: error.message?.includes('Unauthorized') ? 401 : 500 }
    );
  }
}

