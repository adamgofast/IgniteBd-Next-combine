import sgMail from '@sendgrid/mail';

// Initialize SendGrid
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
if (SENDGRID_API_KEY) {
  sgMail.setApiKey(SENDGRID_API_KEY);
  console.log('✅ SendGrid initialized for outreach');
} else {
  console.warn('⚠️ SENDGRID_API_KEY not found - outreach email sending will fail');
}

/**
 * Send outreach email via SendGrid
 * Uses verified sender (default: adam@ignitestrategies.co)
 * Includes customArgs for webhook mapping
 * 
 * @param {Object} params - Email parameters
 * @param {string} params.to - Recipient email address
 * @param {string} params.toName - Recipient name (optional)
 * @param {string} params.subject - Email subject
 * @param {string} params.body - Email body (HTML)
 * @param {string} params.ownerId - Owner ID for webhook mapping
 * @param {string} params.contactId - Contact ID (optional)
 * @param {string} params.tenantId - Tenant ID (optional)
 * @param {string} params.from - Sender email (optional, defaults to adam@ignitestrategies.co)
 * @param {string} params.fromName - Sender name (optional)
 * @returns {Promise<Object>} { statusCode, messageId }
 */
export async function sendOutreachEmail({
  to,
  toName,
  subject,
  body,
  ownerId,
  contactId = null,
  tenantId = null,
  from = null,
  fromName = null,
}) {
  if (!SENDGRID_API_KEY) {
    throw new Error('SendGrid API key not configured. Set SENDGRID_API_KEY environment variable.');
  }

  if (!to || !subject || !body || !ownerId) {
    throw new Error('to, subject, body, and ownerId are required');
  }

  // Use verified sender (adam@ignitestrategies.co) as default
  const fromEmail = from || process.env.SENDGRID_FROM_EMAIL || 'adam@ignitestrategies.co';
  const fromNameValue = fromName || process.env.SENDGRID_FROM_NAME || 'Adam - Ignite Strategies';

  // Prepare email message with customArgs for webhook mapping
  const msg = {
    to: {
      email: to,
      name: toName || to.split('@')[0],
    },
    from: {
      email: fromEmail,
      name: fromNameValue,
    },
    subject,
    html: body,
    // Custom arguments for webhook event mapping
    customArgs: {
      ownerId: ownerId.toString(),
      ...(contactId && { contactId: contactId.toString() }),
      ...(tenantId && { tenantId: tenantId.toString() }),
    },
    trackingSettings: {
      clickTracking: { enable: true },
      openTracking: { enable: true },
    },
  };

  try {
    console.log(`📧 Sending outreach email to ${to}...`);
    console.log(`   Subject: ${subject}`);
    console.log(`   OwnerId: ${ownerId}`);
    console.log(`   ContactId: ${contactId || 'none'}`);
    console.log(`   TenantId: ${tenantId || 'none'}`);

    const response = await sgMail.send(msg);
    const messageId = response[0].headers['x-message-id'];
    const statusCode = response[0].statusCode;

    console.log(`✅ Outreach email sent successfully`);
    console.log(`   MessageId: ${messageId}`);
    console.log(`   StatusCode: ${statusCode}`);

    return {
      statusCode,
      messageId,
    };
  } catch (error) {
    console.error('❌ SendGrid outreach error:', error);
    
    if (error.response) {
      const { body, statusCode } = error.response;
      const errorMessage = body?.errors?.[0]?.message || JSON.stringify(body);
      throw new Error(`SendGrid API error (${statusCode}): ${errorMessage}`);
    }
    
    throw error;
  }
}

