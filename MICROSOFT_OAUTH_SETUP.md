# Microsoft OAuth Integration Setup

This document describes the Microsoft OAuth integration for IgniteGrowth, which allows users to connect their Microsoft accounts to send outreach emails via Microsoft Graph API.

## Overview

The integration uses server-side OAuth flow with Microsoft Azure AD:
- Users connect their Microsoft account in Settings → Integrations
- Tokens (access + refresh) are stored in the database
- Tokens are automatically refreshed when expired
- Users can send emails via Microsoft Graph API

## Architecture

### Database Model

The `MicrosoftAuth` model stores OAuth tokens:
- `ownerId`: Links to Owner (unique)
- `accessToken`: Microsoft Graph access token
- `refreshToken`: Refresh token for getting new access tokens
- `expiresAt`: Token expiration timestamp
- `email`: Microsoft account email (for display)

### API Routes

1. **GET `/api/microsoft/login`**
   - Initiates OAuth flow
   - Requires Firebase authentication
   - Redirects to Microsoft OAuth authorization page

2. **GET `/api/microsoft/callback`**
   - Handles OAuth callback from Microsoft
   - Exchanges authorization code for tokens
   - Stores tokens in database
   - Redirects to settings page

3. **GET `/api/microsoft/status`**
   - Returns Microsoft connection status for current user
   - Returns connection info (email, expiration) without sensitive tokens

4. **DELETE `/api/microsoft/disconnect`**
   - Disconnects Microsoft account
   - Removes tokens from database

5. **POST `/api/microsoft/send-mail`**
   - Sends email via Microsoft Graph
   - Automatically refreshes token if expired
   - Requires Microsoft account to be connected

### Client Utilities

**`/lib/microsoftGraphClient.js`**
- `getValidAccessToken(ownerId)`: Gets valid access token (refreshes if needed)
- `refreshAccessToken(ownerId)`: Refreshes access token
- `sendMail(ownerId, mailData)`: Sends email via Microsoft Graph
- `getContacts(ownerId, options)`: Fetches contacts from Microsoft Graph
- `getUserProfile(ownerId)`: Gets user profile from Microsoft Graph
- `getCalendarEvents(ownerId, options)`: Gets calendar events
- `isMicrosoftConnected(ownerId)`: Checks if Microsoft account is connected

## Environment Variables

Add these to your `.env.local` (development) and production environment:

```bash
# Azure AD App Registration
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=<your-secret-here>
AZURE_TENANT_ID=39d16fb8-1702-491b-8626-35bba0215ae5

# Application URL
APP_URL=https://ignitegrowth.biz

# Microsoft OAuth Redirect URI (optional - defaults to https://ignitegrowth.biz/api/microsoft/callback)
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
```

## Azure AD App Registration Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** > **App registrations**
3. Find your app (Client ID: `c94ab2b5-daf8-4fab-970a-f42358bbae34`)
4. Configure the following:

### Redirect URIs
- Add redirect URI: `https://ignitegrowth.biz/api/microsoft/callback`
- Platform: **Web**

### API Permissions
Add the following Microsoft Graph **Delegated permissions**:
- `User.Read` - Read user profile
- `Mail.Send` - Send mail as user
- `Mail.Read` - Read user mail
- `Contacts.Read` - Read user contacts
- `Contacts.ReadWrite` - Read and write user contacts
- `Calendars.Read` - Read user calendars
- `Calendars.ReadWrite` - Read and write user calendars
- `offline_access` - Maintain access to resources (required for refresh tokens)

**Important**: Admin consent may be required for some permissions.

### Client Secret
1. Go to **Certificates & secrets**
2. Create a new client secret
3. Copy the secret value (you won't see it again)
4. Add it to `AZURE_CLIENT_SECRET` environment variable

## Database Migration

Run the Prisma migration to create the `MicrosoftAuth` table:

```bash
npx prisma migrate dev --name add_microsoft_auth
```

Or push the schema changes:

```bash
npx prisma db push
```

## Usage

### Connecting Microsoft Account

1. User navigates to Settings → Integrations
2. Clicks "Connect Microsoft Account"
3. Redirected to Microsoft OAuth login
4. User authorizes the application
5. Redirected back to settings page with success message

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

## Token Refresh

Tokens are automatically refreshed when:
- Token is expired or about to expire (5 minute buffer)
- `getValidAccessToken()` is called
- `sendMail()`, `getContacts()`, etc. are called

The refresh token is used to get a new access token without user interaction.

## Security Considerations

1. **Token Storage**: Tokens are stored encrypted in the database (ensure database encryption at rest)
2. **HTTPS Only**: OAuth flow requires HTTPS in production
3. **State Parameter**: OAuth state is validated to prevent CSRF attacks
4. **Token Expiration**: Tokens expire and are automatically refreshed
5. **Firebase Authentication**: All API routes require Firebase authentication

## Troubleshooting

### "Microsoft account not connected" Error
- User needs to connect their Microsoft account in Settings → Integrations
- Check that tokens exist in database for the user

### "Failed to refresh token" Error
- Refresh token may be expired or invalid
- User needs to reconnect their Microsoft account
- Check that `AZURE_CLIENT_SECRET` is correct

### "Invalid redirect URI" Error
- Ensure redirect URI matches exactly in Azure AD app registration
- Check that `MICROSOFT_REDIRECT_URI` environment variable is set correctly
- Default: `https://ignitegrowth.biz/api/microsoft/callback`

### OAuth Flow Errors
- Check Azure AD app registration configuration
- Verify API permissions are granted (admin consent may be required)
- Check browser console and server logs for detailed error messages

## File Structure

```
src/
  ├── app/
  │   ├── (authenticated)/
  │   │   └── settings/
  │   │       └── integrations/
  │   │           └── page.jsx          # Settings integrations UI
  │   └── api/
  │       └── microsoft/
  │           ├── login/
  │           │   └── route.js          # OAuth login initiation
  │           ├── callback/
  │           │   └── route.js          # OAuth callback handler
  │           ├── status/
  │           │   └── route.js          # Connection status
  │           ├── disconnect/
  │           │   └── route.js          # Disconnect account
  │           └── send-mail/
  │               └── route.js          # Send email API
  └── lib/
      └── microsoftGraphClient.js       # Graph API client utilities

prisma/
  └── schema.prisma                     # MicrosoftAuth model
```

## Next Steps

1. Run database migration
2. Set environment variables
3. Configure Azure AD app registration
4. Test OAuth flow in development
5. Deploy to production
6. Connect Microsoft account in production
7. Test email sending functionality

