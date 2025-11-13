/**
 * Infer domain from email address
 * @param email - Email address (e.g., "joel@businesspointlaw.com")
 * @returns Domain string (e.g., "businesspointlaw.com") or null if invalid
 */
export const inferDomainFromEmail = (email: string | null | undefined): string | null => {
  if (!email || typeof email !== 'string') {
    return null;
  }
  
  if (!email.includes('@')) {
    return null;
  }
  
  const domain = email.split('@')[1]?.toLowerCase().trim();
  return domain || null;
};

