/**
 * NextEngagementPurpose — single source for valid values + UI labels (mirrors prisma enum).
 */

/** @type {readonly string[]} */
export const NEXT_ENGAGEMENT_PURPOSE_VALUES = [
  'GENERAL_CHECK_IN',
  'UNRESPONSIVE',
  'PERIODIC_CHECK_IN',
  'REFERRAL_NO_CONTACT',
  'POST_WARM_MEETING_NUDGE',
  'PURSUE_INTRO',
  'NO_INTRO_REASON_FOLLOW_UP',
  'ONE_MORE_TOUCH',
  'COMPETITOR_FOLLOW_UP',
  'MEETING_FOLLOW_UP',
  'SCHEDULED_MEETING',
  'DECLINED_NURTURE',
  'NEW_JOB_CHECK_IN',
];

/** @type {Record<string, string>} */
export const NEXT_ENGAGEMENT_PURPOSE_LABELS = {
  GENERAL_CHECK_IN: 'General check-in',
  UNRESPONSIVE: 'Unresponsive (re-engage after no reply)',
  PERIODIC_CHECK_IN: 'Periodic check-in',
  REFERRAL_NO_CONTACT: 'Referral (no contact yet)',
  POST_WARM_MEETING_NUDGE: 'Follow up — lock a meeting (after warm reply)',
  PURSUE_INTRO: 'Pursue an intro',
  NO_INTRO_REASON_FOLLOW_UP: 'No intro — check why',
  ONE_MORE_TOUCH: 'One more touch',
  COMPETITOR_FOLLOW_UP: 'Follow up — competitor / incumbent angle',
  MEETING_FOLLOW_UP: 'Meeting follow-up (post-meeting)',
  SCHEDULED_MEETING: 'Scheduled meeting (next touch is on calendar)',
  DECLINED_NURTURE:
    'Passed / not selected — still nurture (polite long-cycle check-in)',
  NEW_JOB_CHECK_IN: 'New firm / new role — fresh opportunity check-in',
};

export const NEXT_ENGAGEMENT_PURPOSE_SCHEDULED_MEETING = 'SCHEDULED_MEETING';

/** For AI prompts — exact enum tokens only. */
export const NEXT_ENGAGEMENT_PURPOSE_ENUM_FOR_PROMPT =
  NEXT_ENGAGEMENT_PURPOSE_VALUES.join(', ');

/**
 * @param {unknown} v
 * @returns {v is string}
 */
export function isValidNextEngagementPurpose(v) {
  if (v == null || v === '') return true;
  return typeof v === 'string' && NEXT_ENGAGEMENT_PURPOSE_VALUES.includes(v);
}

/**
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeAiNextEngagementPurpose(raw) {
  if (raw == null || raw === '') return null;
  if (typeof raw !== 'string') return null;
  const t = raw.trim();
  if (NEXT_ENGAGEMENT_PURPOSE_VALUES.includes(t)) return t;
  return null;
}
