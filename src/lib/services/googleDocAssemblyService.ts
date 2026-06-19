/**
 * Google Doc Assembly Service
 * 
 * Pure service for assembling blog content and executing Google Docs API calls.
 * No auth. No Prisma. No routing logic.
 */

import 'server-only';

import { google } from 'googleapis';
import { assembleBlogText } from '@/lib/utils/blogTextAssembly';

export type GoogleDocAssemblyInput = {
  title: string | null;
  subtitle?: string | null;
  body?: string | null;
  parentFolderId: string;
};

export type GoogleDocAssemblyResult = {
  documentId: string;
  documentUrl: string;
  textLength: number;
};

/**
 * Assemble blog content and create Google Doc
 * 
 * @param input - Blog content to assemble
 * @param authClient - Authenticated Google API client
 * @returns Result with document ID and URL
 * @throws Error if Google API calls fail
 */
export async function assembleAndCreateGoogleDoc(
  input: GoogleDocAssemblyInput,
  authClient: any, // google.auth.JWT
): Promise<GoogleDocAssemblyResult> {
  // 🧠 ASSEMBLY: Use shared utility
  const safeText = assembleBlogText({
    title: input.title,
    subtitle: input.subtitle,
    body: input.body,
  });
  
  const documentTitle = input.title || 'Untitled Blog';
  
  // 🧪 OBSERVABILITY: Log what we're sending
  console.log('🧾 GoogleDocAssembly payload', {
    length: safeText.length,
    preview: safeText.slice(0, 200),
  });
  
  // Get Google API clients
  const drive = google.drive({ version: 'v3', auth: authClient });
  const docs = google.docs({ version: 'v1', auth: authClient });
  
  // 📄 DRIVE API: Create the document (minimum contract)
  const createResponse = await drive.files.create({
    requestBody: {
      name: documentTitle,
      mimeType: 'application/vnd.google-apps.document',
      parents: [input.parentFolderId],
    },
    supportsAllDrives: true,
    fields: 'id',
  });
  
  const documentId = createResponse.data.id;
  if (!documentId) {
    throw new Error('Failed to create document: No document ID returned');
  }
  
  // 📄 DOCS API: Insert text (single operation, no formatting)
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        {
          insertText: {
            location: { index: 1 },
            text: safeText,
          },
        },
      ],
    },
  });
  
  // 📤 RETURN VALUE: Clean success payload
  const documentUrl = `https://docs.google.com/document/d/${documentId}/edit`;
  
  return {
    documentId,
    documentUrl,
    textLength: safeText.length,
  };
}
