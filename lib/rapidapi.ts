// Shared resilient fetch for the RapidAPI scraper endpoints (TikTok + Instagram).
//
// Those endpoints intermittently return a 429 ("Too many requests"), a 5xx, or
// even a 200 with an empty/truncated body — which makes `res.json()` throw
// "Unexpected end of JSON input". Previously a single such blip rejected an
// account's whole daily refresh, so no snapshot was written and a day of data was
// silently lost (whichever account happened to draw the bad response that night).
//
// This retries transient failures with backoff (longer for rate limits) so one
// flaky response no longer costs a day of tracking. Genuine 4xx (e.g. a bad
// handle) fail fast without burning retries.

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

class PermanentError extends Error {}

export async function fetchJsonWithRetry(
  url: string,
  headers: Record<string, string>,
  { retries = 3, label = 'API' }: { retries?: number; label?: string } = {},
) {
  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url, { headers });

      // Permanent client errors (bad handle, not found…) — don't retry.
      if (res.status >= 400 && res.status < 500 && res.status !== 429) {
        const body = await res.text().catch(() => '');
        throw new PermanentError(`${label} failed (${res.status}): ${body.slice(0, 200)}`);
      }

      if (res.ok) {
        const text = await res.text();
        if (text.trim()) return JSON.parse(text); // may throw on a truncated body → caught + retried
      }

      // Transient: 429 / 5xx / empty body. Back off (longer for rate limits) and retry.
      lastErr = new Error(`${label} ${res.ok ? 'returned an empty body' : `transient ${res.status}`}`);
      if (attempt < retries) await sleep((res.status === 429 ? 1500 : 500) * (attempt + 1));
    } catch (err) {
      if (err instanceof PermanentError) throw err;
      lastErr = err; // network error or JSON parse failure → retry
      if (attempt < retries) await sleep(500 * (attempt + 1));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(`${label} failed after ${retries} retries`);
}
