/**
 * Organizer Matcher Service
 * Fuzzy match organizer names to EcosystemOrg records
 */

import { prisma } from '@/lib/prisma';

/**
 * Simple fuzzy match using Levenshtein distance
 */
function levenshteinDistance(str1: string, str2: string): number {
  const s1 = str1.toLowerCase().trim();
  const s2 = str2.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const matrix: number[][] = [];

  for (let i = 0; i <= s2.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= s1.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= s2.length; i++) {
    for (let j = 1; j <= s1.length; j++) {
      if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[s2.length][s1.length];
}

/**
 * Calculate similarity score (0-1, higher = more similar)
 */
function similarityScore(str1: string, str2: string): number {
  const distance = levenshteinDistance(str1, str2);
  const maxLength = Math.max(str1.length, str2.length);
  if (maxLength === 0) return 1;
  return 1 - distance / maxLength;
}

/**
 * Find or create EcosystemOrg for an organizer name
 * @param organizerName Raw organizer name from event
 * @param threshold Similarity threshold (0-1), default 0.85
 * @returns EcosystemOrg record (existing or newly created)
 */
export async function findOrCreateOrganizer(
  organizerName: string,
  threshold: number = 0.85
): Promise<{ org: any; wasCreated: boolean }> {
  if (!organizerName || organizerName.trim().length === 0) {
    throw new Error('Organizer name is required');
  }

  const normalizedName = organizerName.trim();

  // First, try exact match (case-insensitive)
  let existing = await prisma.ecosystemOrg.findFirst({
    where: {
      normalizedName: {
        equals: normalizedName,
        mode: 'insensitive',
      },
    },
  });

  if (existing) {
    return { org: existing, wasCreated: false };
  }

  // Try fuzzy match
  const allOrgs = await prisma.ecosystemOrg.findMany({
    select: {
      id: true,
      normalizedName: true,
    },
  });

  let bestMatch: { id: string; normalizedName: string; score: number } | null = null;

  for (const org of allOrgs) {
    const score = similarityScore(normalizedName, org.normalizedName);
    if (score >= threshold) {
      if (!bestMatch || score > bestMatch.score) {
        bestMatch = {
          id: org.id,
          normalizedName: org.normalizedName,
          score,
        };
      }
    }
  }

  if (bestMatch) {
    // Found a match, return it
    existing = await prisma.ecosystemOrg.findUnique({
      where: { id: bestMatch.id },
    });
    return { org: existing!, wasCreated: false };
  }

  // No match found, create new org (will need inference later)
  const newOrg = await prisma.ecosystemOrg.create({
    data: {
      sourceType: 'EVENT',
      rawName: normalizedName,
      normalizedName: normalizedName,
      organizationType: 'COMMERCIAL', // Default, can be updated with inference
      industryTags: [],
      memberTypes: [],
    },
  });

  return { org: newOrg, wasCreated: true };
}

