/**
 * EMAIL TO LOG SERVICE
 *
 * Bridges email_activities.summary → contact_engagement_log.
 * Creates an EMAIL_RESPONSE entry in the engagement log whenever an
 * email activity gets its summary written. Idempotent — uses emailActivityId
 * as a unique key so it can never create duplicate entries.
 *
 * Call this anywhere email_activities.summary is written.
 */

import { prisma } from '../prisma.js';

/**
 * Create an EMAIL_RESPONSE engagement log entry from an email activity summary.
 * Safe to call multiple times — will silently no-op if entry already exists.
 *
 * @param {string} emailActivityId
 * @returns {Promise<void>}
 */
export async function syncEmailSummaryToLog(emailActivityId) {
  if (!emailActivityId) return;

  try {
    const activity = await prisma.email_activities.findUnique({
      where: { id: emailActivityId },
      select: {
        id: true,
        contact_id: true,
        summary: true,
        sentAt: true,
        createdAt: true,
      },
    });

    if (!activity?.summary || !activity?.contact_id) return;

    // Idempotent — unique constraint on emailActivityId prevents duplicates
    await prisma.contact_engagement_log.upsert({
      where: { emailActivityId: activity.id },
      update: {
        // Update the note if the summary changed (re-summarized)
        note: activity.summary,
      },
      create: {
        contactId: activity.contact_id,
        entryType: 'EMAIL_RESPONSE',
        note: activity.summary,
        emailActivityId: activity.id,
        loggedAt: activity.sentAt ?? activity.createdAt,
      },
    });
  } catch (err) {
    // Non-fatal — log but don't throw. This runs fire-and-forget in most callers.
    console.error('emailToLogService error:', err);
  }
}
