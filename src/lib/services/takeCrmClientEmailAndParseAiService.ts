/**
 * takeCrmClientEmailAndParseAiService
 * 
 * Parses raw email content from client (forwarded chains, pasted content).
 * Extracts: contact name, contact email, next engagement date, threading headers.
 */

import { OpenAI } from 'openai';

export interface ParsedEmailData {
  subject: string;
  body: string;
  contactEmail: string;
  contactName: string | null;
  nextEngagementDate: string | null;  // ISO date "YYYY-MM-DD" or null
  inReplyTo: string | null;           // Message-ID from In-Reply-To header
  references: string[] | null;        // Message-IDs from References header
  isResponse: boolean;                 // AI-detected: is this likely a response?
  summary: string;                     // 1-2 sentence AI summary of the interaction
}

export interface ParseEmailInput {
  /** Plain text body (preferred for body extraction) */
  text?: string | null;
  /** HTML body (use for contact/signature extraction when present) */
  html?: string | null;
  /** Raw MIME or combined content (fallback when text/html empty) */
  raw?: string | null;
}

export interface OwnerContext {
  name?: string | null;
  email?: string | null;
  companyName?: string | null;
}

export async function takeCrmClientEmailAndParseAiService(
  emailRawTextOrInput: string | ParseEmailInput,
  headers?: string,  // Raw headers string from SendGrid
  ownerContext?: OwnerContext | null,
): Promise<ParsedEmailData> {
  const input: ParseEmailInput =
    typeof emailRawTextOrInput === 'string'
      ? { raw: emailRawTextOrInput }
      : emailRawTextOrInput;

  const text = (input.text || '').trim();
  const html = (input.html || '').trim();
  const raw = (input.raw || '').trim();

  const emailRawText =
    text && html
      ? `PLAIN TEXT (use for body extraction):\n${text}\n\nHTML (use for contact/signature - tags stripped):\n${html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}`
      : text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : raw) || raw;

  if (!emailRawText) {
    throw new Error('No content to parse');
  }
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Extract headers info for context
    let headersContext = '';
    if (headers) {
      // Try to extract In-Reply-To and References from headers
      const inReplyToMatch = headers.match(/In-Reply-To:\s*(.+)/i);
      const referencesMatch = headers.match(/References:\s*(.+)/i);
      
      if (inReplyToMatch) {
        headersContext += `In-Reply-To: ${inReplyToMatch[1]}\n`;
      }
      if (referencesMatch) {
        headersContext += `References: ${referencesMatch[1]}\n`;
      }
    }

    // Build owner context block for the prompt
    let ownerBlock = '';
    if (ownerContext?.name || ownerContext?.email || ownerContext?.companyName) {
      ownerBlock = '\nOWNER/CLIENT CONTEXT (the person who forwarded this email to us — they are NOT the contact):\n';
      if (ownerContext.name) ownerBlock += `  Owner name: ${ownerContext.name}\n`;
      if (ownerContext.email) ownerBlock += `  Owner email: ${ownerContext.email}\n`;
      if (ownerContext.companyName) ownerBlock += `  Owner company: ${ownerContext.companyName}\n`;
      ownerBlock += '\nThe CONTACT is the OTHER person in the conversation — the prospect/target the owner is corresponding with. Do NOT return the owner as the contact.\n';
    }

    const todayStr = new Date().toISOString().slice(0, 10);

    const systemPrompt = `You are an email parsing assistant for a CRM. Extract structured data from raw email content.

The email was forwarded to us by the OWNER (our client) — it contains their correspondence with a CONTACT (the prospect/target).
${ownerBlock}
CRITICAL RULES:
1. The CONTACT is the OTHER person in the conversation — NOT the owner/client who forwarded it.
2. In a forwarded email chain, identify who the owner is corresponding WITH. That person is the contact.
3. If there are multiple people, pick the primary correspondent (the one the owner is doing business development with).

Extract:
1. Contact name — the prospect/target (NOT the owner). Look at all participants and exclude the owner.
2. Contact email — the prospect/target's email address
3. Next engagement date — be AGGRESSIVE about extracting this. Today is ${todayStr}. Examples:
   - "follow up in 3-6 months" → pick the midpoint (~4.5 months from today)
   - "later this year" → approximately 6 months from today
   - "next quarter" → 3 months from today
   - "follow up in a few weeks" → 3 weeks from today
   - Any specific date mentioned → use that date
   - "not interested" with no follow-up mentioned → null
4. Threading headers (In-Reply-To, References) if present
5. Response detection — is the contact responding to the owner's outreach?
6. Summary — a 1-2 sentence summary of the interaction that captures: what happened, the contact's disposition (interested, not interested, deferred, forwarding), and any actionable next steps. This summary will be used by downstream logic to determine engagement cadence.

Return EXACTLY this JSON structure:
{
  "subject": "...",
  "body": "the most recent message body (brief summary of the exchange)",
  "contactEmail": "the prospect/target email, NOT the owner",
  "contactName": "the prospect/target name" or null,
  "nextEngagementDate": "YYYY-MM-DD" or null,
  "inReplyTo": "Message-ID" or null,
  "references": ["Message-ID1", "Message-ID2"] or null,
  "isResponse": true or false,
  "summary": "1-2 sentence summary of the interaction"
}

Return JSON only.`;

    const userPrompt = `Parse this raw email:

${headersContext ? `Headers:\n${headersContext}\n` : ''}
Raw email content:
${emailRawText}

Extract the structured data and return JSON only.`;

    console.log(`🤖 takeCrmClientEmailAndParseAiService: Parsing email (${model})...`);

    const completion = await openai.chat.completions.create({
      model,
      temperature: 0.3, // Lower temperature for more consistent parsing
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    const content = completion.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse response
    const parsed = parseResponse(content);

    console.log('✅ Email parsed:', {
      contactEmail: parsed.contactEmail,
      contactName: parsed.contactName,
      hasNextEngagementDate: !!parsed.nextEngagementDate,
      isResponse: parsed.isResponse,
    });

    return parsed;
  } catch (error: any) {
    console.error('❌ takeCrmClientEmailAndParseAiService error:', error);
    throw new Error(`Failed to parse email: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Parse OpenAI response
 */
function parseResponse(content: string): ParsedEmailData {
  let parsed: any;
  try {
    parsed = JSON.parse(content);
  } catch (parseError) {
    // Try to extract JSON from markdown code blocks
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error('Invalid JSON response from OpenAI');
    }
  }

  // Extract data (could be nested or flat)
  const data = parsed.email || parsed;

  return {
    subject: data.subject || parsed.subject || '',
    body: data.body || parsed.body || '',
    contactEmail: data.contactEmail || parsed.contactEmail || '',
    contactName: data.contactName || parsed.contactName || null,
    nextEngagementDate: data.nextEngagementDate || parsed.nextEngagementDate || null,
    inReplyTo: data.inReplyTo || parsed.inReplyTo || null,
    references: Array.isArray(data.references || parsed.references) 
      ? (data.references || parsed.references) 
      : null,
    isResponse: data.isResponse !== undefined ? data.isResponse : parsed.isResponse !== undefined ? parsed.isResponse : false,
    summary: data.summary || parsed.summary || '',
  };
}
