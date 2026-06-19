/**
 * Universal Email Parser
 *
 * Dumb extraction — no AI. Extracts structured fields from raw email content.
 * Works with: SendGrid InboundEmail (from/to/subject/text/html), pasted blobs, MIME.
 */

const { parseSingleEmailBlock } = require('@/lib/utils/emailConversationParser');

/**
 * Extract email address from "Name <email@domain.com>" or plain address
 */
function extractEmail(str) {
  if (!str || typeof str !== 'string') return null;
  const trimmed = str.trim();
  const angleMatch = trimmed.match(/<([^>]+)>/);
  if (angleMatch) return angleMatch[1].trim().toLowerCase();
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return null;
}

/**
 * Extract display name from "Name <email@domain.com>"
 */
function extractName(str) {
  if (!str || typeof str !== 'string') return null;
  const match = str.match(/^([^<]+)</);
  return match ? match[1].trim() : null;
}

/**
 * Parse from SendGrid-style input (pre-extracted from webhook)
 * @param {{ from?: string, to?: string, subject?: string, text?: string, html?: string, headers?: string }}
 */
function parseFromSendGrid(input) {
  const from = (input.from || '').trim();
  const to = (input.to || '').trim();
  const subject = (input.subject || '').trim();
  const text = (input.text || '').trim();
  const html = (input.html || '').trim();
  const headers = (input.headers || '').trim() || null;

  const body = text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');

  return {
    from,
    fromEmail: extractEmail(from) || null,
    fromName: extractName(from) || null,
    to,
    toEmail: extractEmail(to) || null,
    toName: extractName(to) || null,
    subject: subject || null,
    body: body || null,
    headers,
    raw: null,
  };
}

/**
 * Parse from raw blob (pasted Gmail/Outlook style)
 * Uses emailConversationParser for structure extraction
 * @param {string} blob - Raw pasted email text
 */
function parseFromBlob(blob) {
  if (!blob || typeof blob !== 'string') {
    throw new Error('No content to parse');
  }
  const parsed = parseSingleEmailBlock(blob.trim());
  const fromFull = parsed.fromEmail ? `${parsed.from || ''} <${parsed.fromEmail}>`.trim() : (parsed.from || '');
  const toFull = parsed.toEmail ? `${parsed.to || ''} <${parsed.toEmail}>`.trim() : (parsed.to || '');
  return {
    from: fromFull,
    fromEmail: (parsed.fromEmail || '').trim() || null,
    fromName: extractName(fromFull) || (parsed.from && !parsed.from.includes('@') ? parsed.from.trim() : null),
    to: toFull,
    toEmail: (parsed.toEmail || '').trim() || null,
    toName: extractName(toFull) || (parsed.to && !parsed.to.includes('@') ? parsed.to.trim() : null),
    subject: (parsed.subject || '').trim() || null,
    body: (parsed.body || '').trim() || null,
    headers: null,
    raw: blob.trim(),
  };
}

/**
 * Universal parse — accepts multiple input shapes
 *
 * @param {object} input
 * @param {string} [input.from] - Pre-extracted from (SendGrid)
 * @param {string} [input.to] - Pre-extracted to (SendGrid)
 * @param {string} [input.subject] - Pre-extracted subject (SendGrid)
 * @param {string} [input.text] - Plain text body
 * @param {string} [input.html] - HTML body
 * @param {string} [input.email] - Raw MIME (SendGrid "email" field)
 * @param {string} [input.headers] - Raw headers string
 * @param {string} [input.raw] - Pasted blob (no pre-extracted fields)
 * @returns {{ from: string, fromEmail: string|null, fromName: string|null, to: string, toEmail: string|null, toName: string|null, subject: string|null, body: string|null, headers: string|null, raw: string|null }}
 */
function universalEmailParser(input) {
  const text = (input.text || '').trim();
  const html = (input.html || '').trim();
  const raw = (input.raw || input.email || '').trim();

  // SendGrid-style: we have from, to, subject (from webhook)
  if (input.from !== undefined && input.from !== null && String(input.from).trim()) {
    return parseFromSendGrid({
      from: input.from,
      to: input.to,
      subject: input.subject,
      text: text || null,
      html: html || null,
      headers: input.headers,
    });
  }

  // Raw blob: use structure parser (Gmail/Outlook paste format)
  if (raw) {
    return parseFromBlob(raw);
  }

  // Text or HTML only (no headers) — treat as body-only, minimal extraction
  const body = text || (html ? html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() : '');
  if (!body) {
    throw new Error('No content to parse (text, html, and raw are all empty)');
  }

  // Try to extract From:/To:/Subject: from the text if it looks like a forwarded email
  const lines = body.split('\n');
  let from = '';
  let to = '';
  let subject = '';
  for (const line of lines.slice(0, 30)) {
    const mFrom = line.match(/^From:\s*(.+)$/i);
    const mTo = line.match(/^To:\s*(.+)$/i);
    const mSubj = line.match(/^Subject:\s*(.+)$/i);
    if (mFrom) from = mFrom[1].trim();
    if (mTo) to = mTo[1].trim();
    if (mSubj) subject = mSubj[1].trim();
  }

  if (from || to || subject) {
    return parseFromSendGrid({
      from: from || null,
      to: to || null,
      subject: subject || null,
      text: body,
      html: null,
      headers: input.headers,
    });
  }

  // Pure body, no structure — minimal result
  return {
    from: '',
    fromEmail: null,
    fromName: null,
    to: '',
    toEmail: null,
    toName: null,
    subject: null,
    body,
    headers: input.headers || null,
    raw: body,
  };
}

module.exports = {
  universalEmailParser,
  parseFromSendGrid,
  parseFromBlob,
  extractEmail,
  extractName,
};
