/**
 * generateMeetingSummaryService
 *
 * Generates a 1-2 sentence AI summary from meeting notes.
 */

import { OpenAI } from 'openai';

export async function generateMeetingSummaryService(notes: string): Promise<string | null> {
  const trimmed = notes?.trim() || '';
  if (!trimmed || trimmed.length < 10) return null;

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const model = process.env.OPENAI_MODEL || 'gpt-4o';

  const completion = await openai.chat.completions.create({
    model,
    temperature: 0.3,
    messages: [
      {
        role: 'system',
        content: 'Summarize the meeting notes in 1-2 concise sentences. Focus on key outcomes, next steps, and relationship signals. Return only the summary text, no JSON.',
      },
      { role: 'user', content: trimmed },
    ],
  });

  const summary = completion.choices?.[0]?.message?.content?.trim();
  return summary || null;
}
