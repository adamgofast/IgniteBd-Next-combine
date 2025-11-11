import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import crypto from 'crypto';

/**
 * POST /api/webhooks/sendgrid
 * 
 * Receives signed events from SendGrid webhook
 * Verifies signature using SENDGRID_SIGNING_KEY
 * Updates EmailActivity records based on messageId
 * 
 * SendGrid webhook events:
 * - processed, delivered, opened, clicked, bounce, dropped, etc.
 */
export async function POST(request) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text();
    const body = JSON.parse(rawBody);

    // Verify webhook signature (if SENDGRID_SIGNING_KEY is configured)
    const signingKey = process.env.SENDGRID_SIGNING_KEY;
    if (signingKey) {
      const signature = request.headers.get('x-twilio-email-event-webhook-signature');
      const timestamp = request.headers.get('x-twilio-email-event-webhook-timestamp');

      if (signature && timestamp) {
        const verified = verifySignature(rawBody, signature, timestamp, signingKey);
        if (!verified) {
          console.warn('⚠️ SendGrid webhook signature verification failed');
          return NextResponse.json(
            { success: false, error: 'Invalid signature' },
            { status: 401 }
          );
        }
      }
    } else {
      console.warn('⚠️ SENDGRID_SIGNING_KEY not configured - skipping signature verification');
    }

    // Process webhook events
    if (!Array.isArray(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid webhook payload - expected array' },
        { status: 400 }
      );
    }

    const results = [];

    for (const event of body) {
      const {
        email,
        event: eventType,
        sg_message_id: messageId,
        timestamp,
        custom_arg_owner_id: ownerId,
        custom_arg_contact_id: contactId,
        custom_arg_tenant_id: tenantId,
      } = event;

      // Extract messageId from sg_message_id (format: <messageId@domain>)
      const cleanMessageId = messageId?.split('@')[0] || messageId;

      if (!cleanMessageId) {
        console.warn('⚠️ Webhook event missing messageId:', event);
        continue;
      }

      try {
        // Find email activity by messageId
        const emailActivity = await prisma.emailActivity.findUnique({
          where: { messageId: cleanMessageId },
        });

        if (emailActivity) {
          // Update event state
          await prisma.emailActivity.update({
            where: { messageId: cleanMessageId },
            data: {
              event: eventType, // delivered, opened, clicked, bounce, etc.
              updatedAt: timestamp ? new Date(timestamp * 1000) : new Date(),
            },
          });

          console.log(`✅ Updated email activity ${emailActivity.id}: ${eventType}`);
          results.push({ messageId: cleanMessageId, event: eventType, status: 'updated' });
        } else {
          // If activity doesn't exist, create it (in case webhook arrives before DB write)
          if (ownerId) {
            const newActivity = await prisma.emailActivity.create({
              data: {
                ownerId,
                contactId: contactId || null,
                tenantId: tenantId || null,
                email: email || 'unknown',
                subject: 'Unknown', // Webhook doesn't include subject
                body: '', // Webhook doesn't include body
                messageId: cleanMessageId,
                event: eventType,
              },
            });

            console.log(`✅ Created email activity ${newActivity.id} from webhook: ${eventType}`);
            results.push({ messageId: cleanMessageId, event: eventType, status: 'created' });
          } else {
            console.warn(`⚠️ Webhook event missing ownerId, cannot create activity: ${cleanMessageId}`);
            results.push({ messageId: cleanMessageId, event: eventType, status: 'skipped' });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing webhook event for ${cleanMessageId}:`, error);
        results.push({ messageId: cleanMessageId, event: eventType, status: 'error', error: error.message });
      }
    }

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('SendGrid webhook error:', error);
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'Failed to process webhook',
      },
      { status: 500 }
    );
  }
}

/**
 * Verify SendGrid webhook signature
 * @param {string} payload - Raw request body
 * @param {string} signature - Signature from header
 * @param {string} timestamp - Timestamp from header
 * @param {string} publicKey - Public key from SENDGRID_SIGNING_KEY
 * @returns {boolean} - True if signature is valid
 */
function verifySignature(payload, signature, timestamp, publicKey) {
  try {
    // SendGrid uses ECDSA signature verification
    // Format: timestamp + payload
    const signedPayload = timestamp + payload;

    // Decode signature (base64)
    const signatureBuffer = Buffer.from(signature, 'base64');

    // Verify using public key
    const verify = crypto.createVerify('SHA256');
    verify.update(signedPayload);
    verify.end();

    // Parse public key (PEM format)
    const key = publicKey.startsWith('-----BEGIN') 
      ? publicKey 
      : `-----BEGIN PUBLIC KEY-----\n${publicKey}\n-----END PUBLIC KEY-----`;

    return verify.verify(key, signatureBuffer);
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

