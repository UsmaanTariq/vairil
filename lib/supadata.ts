import { Supadata } from '@supadata/js';

// Supadata turns a video URL into a transcript. Small/native transcripts come
// back inline; longer ones (TikTok audio that has to be generated) return a
// jobId we poll. See https://docs.supadata.ai
const supadata = new Supadata({ apiKey: process.env.SUPADATA_API_KEY ?? '' });

export type TranscriptMode = 'native' | 'auto' | 'generate';

const POLL_INTERVAL_MS = 2_000;
const MAX_POLLS = 45; // ~90s ceiling for a generated transcript

function asText(content: unknown): string {
  if (typeof content === 'string') return content;
  // Timestamped chunks — we only ever request text:true, so this is a fallback.
  if (Array.isArray(content)) {
    return content.map((c) => (c as { text?: string }).text ?? '').join(' ').trim();
  }
  return '';
}

/**
 * Fetch a plain-text transcript for a single video URL (YouTube, TikTok,
 * Instagram, X). Resolves inline results immediately; polls async jobs to
 * completion. Throws on failure/timeout so callers can record a per-video error.
 */
export async function getTranscript(
  url: string,
  { mode = 'auto', lang }: { mode?: TranscriptMode; lang?: string } = {}
): Promise<string> {
  const result = await supadata.transcript({ url, text: true, mode, ...(lang ? { lang } : {}) });

  if (!('jobId' in result)) {
    return asText(result.content);
  }

  for (let i = 0; i < MAX_POLLS; i++) {
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
    const job = await supadata.transcript.getJobStatus(result.jobId);
    if (job.status === 'completed') {
      return asText(job.result?.content);
    }
    if (job.status === 'failed') {
      throw new Error(job.error?.message ?? 'Transcript job failed');
    }
  }
  throw new Error('Transcript job timed out');
}
