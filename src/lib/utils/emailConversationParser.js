/**
 * Parse a single email block (headers + body) in Gmail/Outlook style.
 * Used by both single-email and conversation parsing.
 * @param {string} blob - Raw text of one message (From:, To:, Sent:, Subject:, body)
 * @returns {{ from: string, fromEmail: string, to: string, toEmail: string, sent: string, subject: string, body: string }}
 */
export function parseSingleEmailBlock(blob) {
  const result = {
    from: '',
    fromEmail: '',
    to: '',
    toEmail: '',
    sent: '',
    subject: '',
    body: '',
  };

  if (!blob || !blob.trim()) return result;

  // Extract From
  const fromMatch = blob.match(/From:\s*(.+?)(?:\n|$)/i);
  if (fromMatch) {
    const fromLine = fromMatch[1].trim();
    const emailMatch = fromLine.match(/<([^>]+)>/);
    if (emailMatch) {
      result.fromEmail = emailMatch[1].trim();
      result.from = fromLine.replace(/<[^>]+>/, '').trim();
    } else {
      result.from = fromLine;
      if (fromLine.includes('@')) result.fromEmail = fromLine;
    }
  }

  // Extract Sent date
  const sentMatch = blob.match(/Sent:\s*(.+?)(?:\n|$)/i) || blob.match(/Date:\s*(.+?)(?:\n|$)/i);
  if (sentMatch) {
    const sentLine = sentMatch[1].trim();
    const dateMatch = sentLine.match(/(\w+day,?\s+)?(\w+\s+\d+,?\s+\d{4})/i) ||
      sentLine.match(/(\d{1,2}\/\d{1,2}\/\d{4})/) ||
      sentLine.match(/(\d{4}-\d{2}-\d{2})/) ||
      sentLine.match(/\d{1,2}\s+[A-Za-z]+\s+\d{4}/);
    if (dateMatch) {
      try {
        const d = new Date(dateMatch[0]);
        if (!isNaN(d.getTime())) result.sent = d.toISOString().split('T')[0];
      } catch (_) {}
    }
    if (!result.sent) result.sent = sentLine;
  }

  // Extract To
  const toMatch = blob.match(/To:\s*(.+?)(?:\n|$)/i);
  if (toMatch) {
    const toLine = toMatch[1].trim();
    const emailMatch = toLine.match(/<([^>]+)>/);
    if (emailMatch) {
      result.toEmail = emailMatch[1].trim();
      result.to = toLine.replace(/<[^>]+>/, '').trim();
    } else {
      result.to = toLine;
      if (toLine.includes('@')) result.toEmail = toLine;
    }
  }

  // Extract Subject
  const subjectMatch = blob.match(/Subject:\s*(.+?)(?:\n|$)/i);
  if (subjectMatch) result.subject = subjectMatch[1].trim();

  // Body: after last header (From|To|Sent|Date|Subject), trimmed; stop at obvious signature
  const lines = blob.split('\n');
  let lastHeaderIndex = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].match(/^(From|To|Sent|Date|Subject):\s*/i)) lastHeaderIndex = i;
  }
  if (lastHeaderIndex >= 0) {
    let start = lastHeaderIndex + 1;
    while (start < lines.length && !lines[start].trim()) start++;
    const bodyLines = [];
    for (let i = start; i < lines.length; i++) {
      const line = lines[i];
      const next = lines[i + 1] || '';
      const nextNext = lines[i + 2] || '';
      if (line.match(/^(Best|Regards|Sincerely|Thanks|Thank you|Cheers),?\s*$/i) && next.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/i)) break;
      if (line.match(/^[A-Z][a-z]+(\s+[A-Z][a-z]+)?$/i) && (next.match(/@/) || nextNext.match(/@/)) && bodyLines.length > 0) break;
      bodyLines.push(line);
    }
    result.body = bodyLines.join('\n').trim();
  } else {
    result.body = blob.trim();
  }

  return result;
}

/**
 * Split a pasted email thread into separate message blocks.
 * Handles Gmail "On ... wrote:", Outlook "-----Original Message-----", and inline From:/Sent: blocks.
 * @param {string} blob - Full pasted conversation
 * @returns {string[]} Array of raw message strings (newest first)
 */
function splitConversationBlocks(blob) {
  if (!blob || !blob.trim()) return [];

  const normalized = blob.replace(/\r\n/g, '\n').trim();
  const blocks = [];

  // Outlook: -----Original Message-----
  const outlookSplit = normalized.split(/\n\s*-----Original Message-----/i);
  if (outlookSplit.length > 1) {
    outlookSplit.forEach((chunk, i) => {
      const t = chunk.trim();
      if (t) blocks.push(t);
    });
    return blocks;
  }

  // Gmail/Apple: "On ... wrote:" (whole line, so "On" in body doesn't match)
  const gmailPattern = /\n\s*On\s+[^\n]+wrote:\s*\n/gi;
  const parts = normalized.split(gmailPattern);
  if (parts.length > 1) {
    parts.forEach((p) => {
      const t = p.trim();
      if (t) blocks.push(t);
    });
    return blocks;
  }

  // Fallback: try split on "From:" at start of line when followed by "Sent:" within a few lines (new message block)
  const fromBlockPattern = /\n(?=From:\s*.+\n(?:.*\n){0,3}Sent:)/gi;
  const fromParts = normalized.split(fromBlockPattern);
  if (fromParts.length > 1) {
    fromParts.forEach((p) => {
      const t = p.trim();
      if (t) blocks.push(t);
    });
    return blocks;
  }

  // Single message
  return [normalized];
}

/**
 * Parse a full email conversation (back-and-forth) into an array of messages.
 * @param {string} blob - Pasted thread (Gmail, Outlook, or single email)
 * @param {{ ourEmails?: string[], contactEmail?: string }} options - ourEmails = addresses we send from (outbound); contactEmail = contact's email (From: contact = inbound, To: contact = outbound)
 * @returns {{ messages: Array<{ from: string, fromEmail: string, to: string, toEmail: string, sent: string, subject: string, body: string, direction: 'outbound'|'inbound'|'unknown', index: number }>, contactEmail: string|null, ourOutbound: typeof messages[0]|null, lastReply: typeof messages[0]|null }}
 */
export function parseEmailConversation(blob, options = {}) {
  const { ourEmails = [], contactEmail: contactEmailHint } = options;
  const normalizedOur = ourEmails.map((e) => e.toLowerCase().trim()).filter(Boolean);
  const contactLower = (contactEmailHint || '').toLowerCase().trim() || null;

  const rawBlocks = splitConversationBlocks(blob);
  const parsed = rawBlocks.map((raw, index) => {
    const p = parseSingleEmailBlock(raw);
    let direction = 'unknown';
    const fromLower = (p.fromEmail || '').toLowerCase();
    const toLower = (p.toEmail || '').toLowerCase();

    if (normalizedOur.length) {
      direction = normalizedOur.some((e) => fromLower === e) ? 'outbound' : 'inbound';
    } else if (contactLower) {
      if (fromLower === contactLower) direction = 'inbound';
      else if (toLower === contactLower) direction = 'outbound';
    }

    return {
      ...p,
      direction,
      index,
    };
  });

  const outbound = parsed.filter((m) => m.direction === 'outbound');
  const inbound = parsed.filter((m) => m.direction === 'inbound');
  const ourOutbound = outbound[0] || null;
  const lastReply = inbound[0] || null;

  let contactEmail = contactLower;
  if (!contactEmail && lastReply?.fromEmail) contactEmail = lastReply.fromEmail.toLowerCase();
  else if (!contactEmail && ourOutbound?.toEmail) contactEmail = ourOutbound.toEmail.toLowerCase();

  return {
    messages: parsed,
    contactEmail: contactEmail || null,
    ourOutbound,
    lastReply,
  };
}
