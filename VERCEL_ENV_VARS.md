# Vercel Environment Variables Checklist

This document lists all environment variables that need to be configured in Vercel for the application to work properly.

## 🔴 Critical - Required for Build/Deploy

### Database
- `DATABASE_URL` - PostgreSQL connection string
  - Example: `postgresql://user:password@host:5432/database?schema=public`

### Redis (Upstash) - TEMPORARILY DISABLED
- `UPSTASH_REDIS_REST_URL` - Upstash Redis REST URL (OPTIONAL - Currently disabled)
- `UPSTASH_REDIS_REST_TOKEN` - Upstash Redis REST Token (OPTIONAL - Currently disabled)
  - ⚠️ **Redis is currently commented out in the code** - these are NOT required for deployment
  - Redis functionality is temporarily disabled to get the app live
  - Can be re-enabled later by uncommenting Redis code in `lushaService.js` and `hydration/run/route.js`

### Firebase
- `FIREBASE_SERVICE_ACCOUNT_KEY` - Firebase service account JSON (as string)
  - Required for server-side Firebase auth verification
  - Format: JSON string of the service account key

---

## 🟡 Important - Required for Features

### Microsoft/Azure Integration
- `AZURE_CLIENT_ID` - Azure AD Application Client ID
  - Default: `c94ab2b5-daf8-4fab-970a-f42358bbae34`
- `AZURE_CLIENT_SECRET` - Azure AD Application Client Secret
- `AZURE_TENANT_ID` - Azure AD Tenant ID (optional, but recommended)
  - Default: `39d16fb8-1702-491b-8626-35bba0215ae5`
- `MICROSOFT_REDIRECT_URI` - OAuth callback URL
  - Production: `https://ignitegrowth.biz/api/microsoft/callback`
- `APP_URL` - Application base URL
  - Production: `https://ignitegrowth.biz`

### Client-Side Microsoft Config (NEXT_PUBLIC_*)
- `NEXT_PUBLIC_AZURE_CLIENT_ID` - Azure Client ID for client-side (optional)
- `NEXT_PUBLIC_AZURE_AUTHORITY` - Azure Authority URL (optional)
  - Default: `https://login.microsoftonline.com/common`

### SendGrid Email
- `SENDGRID_API_KEY` - SendGrid API key
- `SENDGRID_FROM_EMAIL` - Default sender email
  - Default: `noreply@ignitegrowth.biz`
- `SENDGRID_FROM_NAME` - Default sender name
  - Default: `IgniteGrowth`
- `SENDGRID_SIGNING_KEY` - Webhook signing key (for SendGrid webhooks)
- `NEXT_PUBLIC_SENDGRID_FROM_EMAIL` - Client-side sender email (optional)
- `NEXT_PUBLIC_SENDGRID_FROM_NAME` - Client-side sender name (optional)

### OpenAI
- `OPENAI_API_KEY` - OpenAI API key
- `OPENAI_MODEL` - OpenAI model to use (optional)
  - Default: `gpt-4o`

### Lusha Integration
- `LUSHA_API_KEY` - Lusha API key for contact enrichment

### Client Portal
- `NEXT_PUBLIC_CLIENT_PORTAL_URL` - Client portal URL
  - Example: `https://portal.ignitegrowth.biz` or `http://localhost:3001`

---

## 🟢 Optional - Business Logic

### Company/Default Settings
- `DEFAULT_COMPANY_HQ_ID` - Default company HQ ID
- `NEXT_PUBLIC_DEFAULT_COMPANY_HQ_ID` - Default company HQ ID (client-side)

### API Configuration
- `NEXT_PUBLIC_BACKEND_URL` - Backend API URL
  - Production: Usually empty (uses same domain) or `https://ignitegrowth.biz`

---

## 📋 Quick Copy-Paste for Vercel

### Production Environment Variables

```bash
# Database
DATABASE_URL=postgresql://...

# Redis (Upstash) - TEMPORARILY DISABLED
# UPSTASH_REDIS_REST_URL=https://...
# UPSTASH_REDIS_REST_TOKEN=...

# Firebase
FIREBASE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}

# Microsoft/Azure
AZURE_CLIENT_ID=c94ab2b5-daf8-4fab-970a-f42358bbae34
AZURE_CLIENT_SECRET=...
AZURE_TENANT_ID=39d16fb8-1702-491b-8626-35bba0215ae5
MICROSOFT_REDIRECT_URI=https://ignitegrowth.biz/api/microsoft/callback
APP_URL=https://ignitegrowth.biz

# SendGrid
SENDGRID_API_KEY=SG...
SENDGRID_FROM_EMAIL=noreply@ignitegrowth.biz
SENDGRID_FROM_NAME=IgniteGrowth
SENDGRID_SIGNING_KEY=...

# OpenAI
OPENAI_API_KEY=sk-...

# Lusha
LUSHA_API_KEY=...

# Client Portal
NEXT_PUBLIC_CLIENT_PORTAL_URL=https://portal.ignitegrowth.biz

# Optional
DEFAULT_COMPANY_HQ_ID=...
OPENAI_MODEL=gpt-4o
```

---

## 🔍 Verification Steps

1. **Check Build Logs**: Look for errors about missing environment variables
2. **Test Features**:
   - ✅ Microsoft OAuth login
   - ✅ Email sending (SendGrid)
   - ✅ Contact enrichment (Lusha)
   - ✅ Redis operations (if used)
   - ✅ OpenAI features
   - ✅ Client portal links

3. **Common Issues**:
   - ✅ Build succeeds: Redis is disabled (no longer required)
   - ❌ Microsoft OAuth fails: Missing `AZURE_CLIENT_SECRET` or `AZURE_TENANT_ID`
   - ❌ Email fails: Missing `SENDGRID_API_KEY`
   - ❌ Firebase auth fails: Missing `FIREBASE_SERVICE_ACCOUNT_KEY`

---

## 📝 Notes

- **NEXT_PUBLIC_*** variables are exposed to the browser - don't put secrets here
- **Redis variables** are NOT required (Redis is temporarily disabled in code)
- **Firebase Service Account Key** must be a JSON string, not a file path
- **Azure Tenant ID** is recommended but not required (will default to 'common')
- After adding/updating variables in Vercel, **redeploy** the application

---

## 🚀 After Adding Variables

1. Go to Vercel Dashboard → Your Project → Settings → Environment Variables
2. Add all required variables (see list above)
3. Make sure to set them for the correct environment (Production, Preview, Development)
4. **Redeploy** the application
5. Test the features that depend on the new variables

