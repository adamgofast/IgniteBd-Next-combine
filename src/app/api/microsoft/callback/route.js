import { NextResponse } from 'next/server';
import { ConfidentialClientApplication } from '@azure/msal-node';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/microsoft/callback
 * 
 * Handles Microsoft OAuth callback
 * Exchanges authorization code for tokens and stores them in database
 */
export async function GET(req) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const errorDescription = searchParams.get('error_description');

    // Check for OAuth errors
    const appUrl = process.env.APP_URL || 'https://ignitegrowth.biz';
    if (error) {
      console.error('OAuth error:', error, errorDescription);
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=${encodeURIComponent(error)}`
      );
    }

    if (!code) {
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=missing_code`
      );
    }

    // Decode state to get ownerId
    let ownerId;
    try {
      const stateData = JSON.parse(Buffer.from(state || '', 'base64url').toString());
      ownerId = stateData.ownerId;
      
      // Verify state is recent (within 10 minutes)
      if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
        throw new Error('State expired');
      }
    } catch (err) {
      console.error('Invalid state parameter:', err);
      const appUrl = process.env.APP_URL || 'https://ignitegrowth.biz';
      return NextResponse.redirect(
        `${appUrl}/settings/integrations?error=invalid_state`
      );
    }

    // MSAL configuration for server-side token exchange
    const msalConfig = {
      auth: {
        clientId: process.env.AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${process.env.AZURE_TENANT_ID || 'common'}`,
        clientSecret: process.env.AZURE_CLIENT_SECRET,
      },
    };

    const cca = new ConfidentialClientApplication(msalConfig);

    // Exchange authorization code for tokens
    const redirectUri = process.env.MICROSOFT_REDIRECT_URI || 'https://ignitegrowth.biz/api/microsoft/callback';
    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes: ['https://graph.microsoft.com/.default', 'offline_access'],
      redirectUri,
    });

    if (!tokenResponse) {
      throw new Error('Failed to acquire tokens');
    }

    // Get user's email from Microsoft Graph
    let microsoftEmail = null;
    try {
      const graphResponse = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: {
          Authorization: `Bearer ${tokenResponse.accessToken}`,
        },
      });
      
      if (graphResponse.ok) {
        const userData = await graphResponse.json();
        microsoftEmail = userData.mail || userData.userPrincipalName;
      }
    } catch (err) {
      console.warn('Failed to fetch user email from Graph:', err);
      // Continue without email - not critical
    }

    // Calculate token expiration
    const expiresAt = new Date(Date.now() + (tokenResponse.expiresIn || 3600) * 1000);

    // Store or update tokens in database
    await prisma.microsoftAuth.upsert({
      where: { ownerId },
      update: {
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken || '',
        expiresAt,
        email: microsoftEmail,
      },
      create: {
        ownerId,
        accessToken: tokenResponse.accessToken,
        refreshToken: tokenResponse.refreshToken || '',
        expiresAt,
        email: microsoftEmail,
      },
    });

    console.log('✅ Microsoft OAuth tokens stored for owner:', ownerId);

    // Redirect to success page
    const appUrl = process.env.APP_URL || 'https://ignitegrowth.biz';
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?success=1`
    );
  } catch (err) {
    console.error('OAuth callback error:', err);
    const appUrl = process.env.APP_URL || 'https://ignitegrowth.biz';
    return NextResponse.redirect(
      `${appUrl}/settings/integrations?error=${encodeURIComponent(err.message || 'oauth_failed')}`
    );
  }
}

