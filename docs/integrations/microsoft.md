# Microsoft Integration Guide

Complete guide for Microsoft OAuth, Microsoft Graph API, and Azure AD integration with IgniteGrowth.

## Table of Contents

1. [Overview](#overview)
2. [Quick Setup](#quick-setup)
3. [Azure AD App Registration](#azure-ad-app-registration)
4. [Environment Variables](#environment-variables)
5. [Multi-Tenant Configuration](#multi-tenant-configuration)
6. [GoDaddy Workspace Email](#godaddy-workspace-email)
7. [OAuth Flow](#oauth-flow)
8. [Token Management](#token-management)
9. [API Usage](#api-usage)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The Microsoft integration allows users to:
- Connect their Microsoft 365 accounts (including GoDaddy Workspace Email)
- Send emails via Microsoft Graph API
- Sync contacts from Microsoft 365
- Access calendar events
- Use multi-tenant authentication (any organization can connect)

### Architecture

- **Server-side OAuth flow** - Tokens stored in database
- **Multi-tenant support** - Works with any Microsoft 365 organization
- **Automatic token refresh** - Tokens refreshed when expired
- **Tenant isolation** - Each user's tokens scoped to their organization

---

## Quick Setup

### 1. Azure AD App Registration

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Click **New registration**
4. Fill in:
   - **Name**: `IgniteGrowth Outreach`
   - **Supported account types**: `Accounts in any organizational directory and personal Microsoft accounts (Common)` ✅
   - **Redirect URI**: `https://ignitegrowth.biz/api/microsoft/callback` (Platform: **Web**)
5. Click **Register**
6. Note your **Application (client) ID**

### 2. Configure API Permissions

1. Go to **API permissions**
2. Add Microsoft Graph **Delegated permissions**:
   - ✅ `User.Read` - Sign in and read user profile
   - ✅ `Mail.Send` - Send mail as user
   - ✅ `Mail.Read` - Read user mail
   - ✅ `Contacts.Read` - Read user contacts
   - ✅ `Contacts.ReadWrite` - Read and write user contacts
   - ✅ `Calendars.Read` - Read user calendars
   - ✅ `Calendars.ReadWrite` - Read and write user calendars
   - ✅ `offline_access` - Maintain access to resources (required for refresh tokens)

3. **Grant admin consent** (if you're an admin) to skip individual user consent

### 3. Create Client Secret

1. Go to **Certificates & secrets**
2. Click **New client secret**
3. Copy the secret value (you won't see it again)
4. Add to environment variables as `AZURE_CLIENT_SECRET`

---

## Environment Variables

### Required Variables

```bash
# Azure AD Configuration
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-client-secret-here>

# Application URLs
APP_URL=https://ignitegrowth.biz
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
```

### Important Notes

- **`AZURE_TENANT_ID` is NOT needed** for multi-tenant apps
- The code uses `common` endpoint automatically for multi-tenant support
- For single-tenant apps, you can set `AZURE_TENANT_ID` to your specific tenant ID

---

## Multi-Tenant Configuration

### How Multi-Tenant Works

The app is configured for **multi-tenant** authentication:
- ✅ Uses `common` endpoint (allows any organization)
- ✅ Users from any Microsoft 365 organization can connect
- ✅ GoDaddy Workspace Email users can connect
- ✅ Personal Microsoft accounts can connect
- ✅ Each user's tokens are tenant-scoped automatically

### Tenant ID Extraction

For multi-tenant apps:
- Tenant ID is extracted from the ID token (`tid` claim)
- Stored in `Owner.microsoftTenantId` (optional)
- Used for tenant-specific token refresh (more efficient)

### Configuration

**Azure AD App Registration:**
- Set **Supported account types** to: `Accounts in any organizational directory and personal Microsoft accounts (Common)`

**Code:**
- Uses `common` endpoint for all OAuth operations
- No tenant-specific configuration needed

---

## GoDaddy Workspace Email

### Understanding GoDaddy Email

GoDaddy Workspace Email uses **Microsoft 365** under the hood:
- ✅ Uses Microsoft Graph API
- ✅ Same OAuth flow as regular Microsoft 365
- ✅ Just need to find your GoDaddy tenant ID

### Finding Your GoDaddy Tenant ID

1. Go to [Azure Portal](https://portal.azure.com)
2. Sign in with your GoDaddy email: `adam@ignitestrategies.co`
3. Use your GoDaddy Workspace password
4. Navigate to **Azure Active Directory** > **Overview**
5. Copy the **Tenant ID** (GUID format)

**Note:** For multi-tenant apps, you don't need to set this - the app works automatically!

### Verifying Your Setup

1. Check your email login:
   - If you login at `outlook.office365.com` → **Microsoft 365** ✅
   - If you login at `webmail.godaddy.com` → **GoDaddy Webmail** ❌ (not compatible)

2. If using Microsoft 365 through GoDaddy:
   - Our integration works automatically
   - Just connect your Microsoft account
   - No special configuration needed

---

## OAuth Flow

### User Flow

1. **User clicks "Connect with Microsoft"**
   - Redirects to: `https://login.microsoftonline.com/common/oauth2/v2.0/authorize`
   - Microsoft shows organization picker
   - User selects their organization

2. **User authenticates**
   - User signs in with their organization credentials
   - User grants consent for permissions

3. **Authorization code returned**
   - Redirects to: `/api/microsoft/callback?code=xxx&state=xxx`
   - Code is exchanged for tokens

4. **Tokens stored**
   - Access token stored in `Owner.microsoftAccessToken`
   - Refresh token stored in `Owner.microsoftRefreshToken`
   - Expiration stored in `Owner.microsoftExpiresAt`
   - Email stored in `Owner.microsoftEmail`
   - Display name stored in `Owner.microsoftDisplayName`

### API Routes

**GET `/api/microsoft/login`**
- Initiates OAuth flow
- Requires Firebase authentication
- Redirects to Microsoft OAuth

**GET `/api/microsoft/callback`**
- Handles OAuth callback
- Exchanges code for tokens
- Stores tokens in database
- Redirects to settings page

**GET `/api/microsoft/status`**
- Returns connection status
- Returns email, expiration (no sensitive tokens)

**DELETE `/api/microsoft/disconnect`**
- Disconnects Microsoft account
- Removes tokens from database

---

## Token Management

### Automatic Token Refresh

Tokens are automatically refreshed when:
- Token is expired or about to expire (5 minute buffer)
- `getValidAccessToken()` is called
- `sendMail()`, `getContacts()`, etc. are called

### Token Refresh Flow

```javascript
// Token refresh uses user's tenant-specific endpoint
const tenantId = owner.microsoftTenantId || 'common';
const msalConfig = {
  auth: {
    clientId: process.env.AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    clientSecret: process.env.AZURE_CLIENT_SECRET,
  },
};

// Refresh token
const tokenResponse = await cca.acquireTokenByRefreshToken({
  refreshToken: owner.microsoftRefreshToken,
  scopes: [...],
});
```

### Database Schema

```prisma
model Owner {
  // Microsoft OAuth integration
  microsoftAccessToken  String?   // Access token
  microsoftRefreshToken String?   // Refresh token
  microsoftExpiresAt    DateTime? // Token expiration
  microsoftEmail        String?   // User's Microsoft email
  microsoftDisplayName  String?   // User's display name
  microsoftTenantId     String?   // Tenant ID from ID token (optional)
}
```

---

## API Usage

### Sending Emails

```javascript
import { sendMail } from '@/lib/microsoftGraphClient';

// In an API route or server action
await sendMail(ownerId, {
  subject: 'Test Email',
  body: '<p>This is a test email</p>',
  toRecipients: ['recipient@example.com'],
  ccRecipients: ['cc@example.com'], // optional
  bccRecipients: ['bcc@example.com'], // optional
  contentType: 'HTML', // or 'Text'
  replyTo: 'reply@example.com', // optional
  saveToSentItems: true, // optional, default: true
});
```

### Fetching Contacts

```javascript
import { getContacts } from '@/lib/microsoftGraphClient';

const contacts = await getContacts(ownerId, {
  limit: 100,
  // ... other options
});
```

### Checking Connection Status

```javascript
import { isMicrosoftConnected } from '@/lib/microsoftGraphClient';

const connected = await isMicrosoftConnected(ownerId);
if (connected) {
  // Microsoft account is connected and tokens are valid
}
```

### Using the API Route

```javascript
// Client-side
const response = await api.post('/api/microsoft/send-mail', {
  subject: 'Test Email',
  body: '<p>This is a test email</p>',
  toRecipients: ['recipient@example.com'],
  contentType: 'HTML',
});
```

---

## Troubleshooting

### "Microsoft account not connected" Error

**Cause:** User hasn't connected their Microsoft account  
**Fix:** User needs to connect their Microsoft account in Settings → Integrations

### "Failed to refresh token" Error

**Cause:** Refresh token expired or invalid  
**Fix:** User needs to reconnect their Microsoft account

### "Invalid redirect URI" Error

**Cause:** Redirect URI doesn't match Azure AD configuration  
**Fix:** 
- Ensure redirect URI matches exactly in Azure AD app registration
- Check that `MICROSOFT_REDIRECT_URI` environment variable is set correctly
- Default: `https://ignitegrowth.biz/api/microsoft/callback`

### "Invalid tenant" Error

**Cause:** App not configured for multi-tenant  
**Fix:** 
- Set **Supported account types** to `Accounts in any organizational directory and personal Microsoft accounts (Common)` in Azure AD
- Code uses `common` endpoint automatically

### "App not found" Error

**Cause:** App not registered in user's tenant  
**Fix:** App must be multi-tenant (supports "common" tenant)

### "Consent required" Error

**Cause:** User hasn't granted consent  
**Fix:** User needs to complete OAuth flow and grant consent (this is normal)

### "Unverified app" Warning

**Status:** This is normal for new Azure AD app registrations  
**Impact:** Doesn't prevent the app from working  
**Fix (Optional):** 
- Add app logo, terms of service URL, privacy policy URL
- Grant admin consent to skip user consent
- Submit for verification (optional, takes time)

### OAuth Flow Errors

**Check:**
- Azure AD app registration configuration
- API permissions are granted (admin consent may be required)
- Browser console and server logs for detailed error messages

---

## App Verification (Optional)

### Quick Setup (Improve Consent Screen)

1. Go to **Branding & properties** in Azure Portal
2. Configure:
   - **Name**: `IgniteGrowth Outreach`
   - **Logo**: Upload square logo (240x240px)
   - **Home page URL**: `https://ignitegrowth.biz`
   - **Terms of service URL**: `https://ignitegrowth.biz/terms` (if available)
   - **Privacy statement URL**: `https://ignitegrowth.biz/privacy` (if available)

3. **Grant admin consent** (if you're an admin):
   - Go to **API permissions**
   - Click **Grant admin consent for [Your Organization]**
   - This removes the need for users to consent individually

### Full Verification Process (Optional)

If you want to remove the "unverified" warning:

1. Complete all branding information
2. Submit for verification in Azure Portal
3. Microsoft reviews your app (can take several days/weeks)
4. Once verified, the "unverified" warning disappears

**Note:** Verification is optional - the app works fine without it!

---

## Security Considerations

1. **Token Storage**: Tokens are stored encrypted in the database (ensure database encryption at rest)
2. **HTTPS Only**: OAuth flow requires HTTPS in production
3. **State Parameter**: OAuth state is validated to prevent CSRF attacks
4. **Token Expiration**: Tokens expire and are automatically refreshed
5. **Firebase Authentication**: All API routes require Firebase authentication
6. **Tenant Isolation**: Each user's tokens are scoped to their organization

---

## Database Migration

Run Prisma migration to add Microsoft fields:

```bash
npx prisma migrate dev --name add_microsoft_auth
```

Or push the schema:

```bash
npx prisma db push
```

---

## File Structure

```
src/
  ├── app/
  │   └── api/
  │       └── microsoft/
  │           ├── login/route.js          # OAuth login initiation
  │           ├── callback/route.js       # OAuth callback handler
  │           ├── status/route.js         # Connection status
  │           ├── disconnect/route.js     # Disconnect account
  │           └── send-mail/route.js      # Send email API
  └── lib/
      └── microsoftGraphClient.js         # Graph API client utilities

prisma/
  └── schema.prisma                       # MicrosoftAuth model
```

---

## Summary

### Key Points

- ✅ **Multi-tenant**: Works with any Microsoft 365 organization
- ✅ **GoDaddy compatible**: Works with GoDaddy Workspace Email
- ✅ **Automatic refresh**: Tokens refreshed automatically
- ✅ **Tenant isolation**: Each user's tokens scoped to their organization
- ✅ **Simple setup**: Just configure Azure AD app and environment variables

### Quick Checklist

- [ ] Azure AD app registered (multi-tenant)
- [ ] API permissions configured (Delegated)
- [ ] Client secret created
- [ ] Environment variables set
- [ ] Database migration run
- [ ] Test OAuth flow
- [ ] Verify tokens stored
- [ ] Test email sending

---

**Last Updated**: November 2025  
**Status**: ✅ Fully Implemented  
**Multi-Tenant**: Yes (uses `common` endpoint)


