/**
 * Email Address Parser
 * 
 * Parses email addresses from SendGrid Inbound Parse webhook payloads.
 * Handles various formats:
 * - "Display Name" <email@domain.com>
 * - email@domain.com
 * - Multiple addresses: "Name" <email@domain.com>, another@domain.com
 * - With quotes, tabs, whitespace
 * 
 * Returns clean email addresses extracted from the input string.
 */

/**
 * Parse email addresses from a string (RFC 5322 compliant)
 * Handles formats like:
 * - "Display Name" <email@domain.com>
 * - email@domain.com
 * - Multiple addresses separated by commas
 * 
 * @param addressString - Raw address string from SendGrid
 * @returns Array of clean email addresses
 */
export function parseEmailAddresses(addressString) {
  if (!addressString || typeof addressString !== 'string') {
    return [];
  }

  const emails = [];
  
  // Split by comma first (handles multiple addresses)
  const parts = addressString.split(',').map(p => p.trim());
  
  for (const part of parts) {
    // Try to extract from angle brackets first: <email@domain.com>
    const angleBracketMatch = part.match(/<([^>]+)>/);
    if (angleBracketMatch) {
      const email = angleBracketMatch[1].trim();
      if (isValidEmail(email)) {
        emails.push(email.toLowerCase());
        continue;
      }
    }
    
    // If no angle brackets, try direct email match
    // Match email pattern: word@domain.tld (handles quoted strings too)
    const emailMatch = part.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
    if (emailMatch) {
      const email = emailMatch[1].trim();
      // Remove surrounding quotes if present
      const cleanEmail = email.replace(/^["']+|["']+$/g, '').trim();
      if (isValidEmail(cleanEmail)) {
        emails.push(cleanEmail.toLowerCase());
      }
    }
  }
  
  return emails;
}

/**
 * Extract company slug from recipient email address
 * Pattern: {companySlug}@crm.ignitestrategies.co
 *
 * @param addressString - Raw "to" field from SendGrid
 * @returns Company slug or null if not found
 */
export function extractCompanySlugFromAddress(addressString) {
  const emails = parseEmailAddresses(addressString);

  for (const email of emails) {
    // Match pattern: {slug}@crm.{domain}
    const slugMatch = email.match(/^([^@]+)@crm\.(.+)$/);
    if (slugMatch) {
      const slug = slugMatch[1]
        .toLowerCase()
        .replace(/^["']+|["']+$/g, '') // Remove quotes
        .replace(/\s+/g, '') // Remove whitespace
        .trim();

      if (slug) {
        return slug;
      }
    }
  }

  return null;
}

/**
 * Parse inbound recipient to get company slug and type (meeting vs email).
 * Convention: {companySlug}.meeting@crm.{domain} → meeting ingest;
 *             {companySlug}@crm.{domain} → email ingest.
 *
 * @param addressString - Raw "to" field from SendGrid
 * @returns { companySlug: string, inboundType: 'meeting' | 'email' } or null
 */
export function parseInboundRecipient(addressString) {
  const emails = parseEmailAddresses(addressString);

  for (const email of emails) {
    if (!email.includes('@crm.')) continue;

    // meeting: {slug}.meeting@crm.{domain}
    const meetingMatch = email.match(/^(.+)\.meeting@crm\.(.+)$/);
    if (meetingMatch) {
      const companySlug = meetingMatch[1]
        .toLowerCase()
        .replace(/^["']+|["']+$/g, '')
        .replace(/\s+/g, '')
        .trim();
      if (companySlug) {
        return { companySlug, inboundType: 'meeting' };
      }
      continue;
    }

    // email: {slug}@crm.{domain}
    const emailMatch = email.match(/^([^@]+)@crm\.(.+)$/);
    if (emailMatch) {
      const companySlug = emailMatch[1]
        .toLowerCase()
        .replace(/^["']+|["']+$/g, '')
        .replace(/\s+/g, '')
        .trim();
      if (companySlug) {
        return { companySlug, inboundType: 'email' };
      }
    }
  }

  return null;
}

/**
 * Basic email validation
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  // Basic RFC 5322 compliant regex (simplified)
  const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return emailRegex.test(email.trim());
}
