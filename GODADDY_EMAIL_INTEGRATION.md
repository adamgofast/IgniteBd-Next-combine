# GoDaddy Email Integration Guide

## Understanding Your Email Setup

If you're using GoDaddy, there are a few possibilities:

### Option 1: GoDaddy Workspace Email (Microsoft 365) ✅
- **What it is**: GoDaddy resells Microsoft 365/Outlook
- **API**: Still uses Microsoft Graph API
- **Solution**: Use Microsoft OAuth, but with GoDaddy's tenant ID
- **Status**: Our current integration should work!

### Option 2: GoDaddy Webmail (cPanel/IMAP) ❌
- **What it is**: Traditional email hosting
- **API**: No standard API (would need IMAP/SMTP)
- **Solution**: Would need different integration approach
- **Status**: Not compatible with Microsoft Graph

### Option 3: GoDaddy Business Email (Separate API) ❌
- **What it is**: GoDaddy's own email service
- **API**: GoDaddy Email API (if it exists)
- **Solution**: Would need GoDaddy-specific integration
- **Status**: Not compatible with Microsoft Graph

## How to Check What You're Using

1. **Check your email login**:
   - If you login at `outlook.office365.com` or `portal.office.com` → **Microsoft 365** ✅
   - If you login at `webmail.godaddy.com` or cPanel → **GoDaddy Webmail** ❌
   - If you have a GoDaddy Workspace account → **Microsoft 365** ✅

2. **Check your email domain**:
   - If your email is `@ignitestrategies.co` and it's managed by GoDaddy Workspace → **Microsoft 365** ✅

## If You're Using Microsoft 365 Through GoDaddy

### Good News! 🎉
Our Microsoft Graph integration should still work! You just need:

1. **Find Your GoDaddy Tenant ID**:
   - Go to [Azure Portal](https://portal.azure.com)
   - Sign in with your GoDaddy Workspace email (`adam@ignitestrategies.co`)
   - Go to **Azure Active Directory** > **Overview**
   - Copy the **Tenant ID** (this is different from a regular Microsoft account)

2. **Update Environment Variables**:
   ```bash
   AZURE_TENANT_ID=<your-godaddy-tenant-id>
   AZURE_CLIENT_ID=<your-app-client-id>
   AZURE_CLIENT_SECRET=<your-client-secret>
   ```

3. **Verify App Registration**:
   - Make sure your Azure AD app is registered in your GoDaddy tenant
   - Or register it in the "common" tenant (multi-tenant)

### Getting Your GoDaddy Tenant ID

1. Sign in to [Azure Portal](https://portal.azure.com) with `adam@ignitestrategies.co`
2. Go to **Azure Active Directory** > **Overview**
3. Copy the **Tenant ID** (looks like: `39d16fb8-1702-491b-8626-35bba0215ae5`)
4. Update your `AZURE_TENANT_ID` environment variable

## If You're Using GoDaddy Webmail (IMAP)

If you're using traditional GoDaddy webmail (not Microsoft 365), you have two options:

### Option A: Switch to Microsoft 365
- Upgrade to GoDaddy Workspace Email (Microsoft 365)
- Then use our Microsoft Graph integration

### Option B: Use IMAP/SMTP Integration
- Would need to implement IMAP/SMTP email sending
- Less secure (requires storing email passwords)
- More complex to implement
- Not recommended for production

## Current Setup Status

Based on your consent screen showing Microsoft OAuth, it looks like you **are using Microsoft 365** through GoDaddy! ✅

### Next Steps:

1. **Verify Your Tenant ID**:
   - The tenant ID you're using might be correct
   - Or you might need to use GoDaddy's specific tenant ID

2. **Check Azure AD App Registration**:
   - Make sure the app is registered in the correct tenant
   - GoDaddy tenants are separate from personal Microsoft accounts

3. **Test the Integration**:
   - Accept the consent screen
   - See if tokens are stored correctly
   - Test sending an email

## Troubleshooting

### "Invalid tenant" Error
- **Cause**: Using wrong tenant ID
- **Fix**: Get the correct tenant ID from Azure Portal when signed in with your GoDaddy email

### "App not found" Error
- **Cause**: App registered in different tenant
- **Fix**: Register the app in your GoDaddy tenant, or use "common" tenant for multi-tenant

### OAuth Works but Emails Fail
- **Cause**: Permissions not granted in GoDaddy tenant
- **Fix**: Grant admin consent in your GoDaddy Azure AD

## Recommended Action

1. **Accept the consent screen** (it should work!)
2. **Check if tokens are stored** in the database
3. **Test sending an email** via Microsoft Graph
4. **If it works**: You're all set! ✅
5. **If it doesn't**: We'll need to debug the tenant ID or permissions

## Questions to Answer

1. What email service are you actually using? (Microsoft 365 or GoDaddy Webmail?)
2. Can you access [Azure Portal](https://portal.azure.com) with `adam@ignitestrategies.co`?
3. What does your email login page look like? (outlook.office365.com or webmail.godaddy.com?)

Let me know and we can adjust the integration accordingly!

