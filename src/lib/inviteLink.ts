import crypto from 'crypto';
import { prisma } from '@/lib/prisma';

/**
 * Generate invite link for contact
 * Creates a unique token and returns branded activation URL
 */
export async function generateInviteLink(contactId: string, email: string) {
  const token = crypto.randomBytes(8).toString('hex'); // short unique string (16 chars)
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24); // 24h

  await prisma.inviteToken.create({
    data: { contactId, email, token, expiresAt },
  });

  const base = process.env.NEXT_PUBLIC_CLIENT_PORTAL_URL || 'https://clientportal.ignitegrowth.biz';
  return `${base}/activate?token=${token}`;
}

