const TAVILY_API_URL = 'https://api.tavily.com/search';

export interface TavilyResult {
  title: string;
  url: string;
  content: string;
  published_date?: string;
}

export async function search(query: string, maxResults = 5): Promise<TavilyResult[]> {
  const res = await fetch(TAVILY_API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      api_key: process.env.TAVILY_API_KEY,
      query,
      max_results: maxResults,
      search_depth: 'advanced',
    }),
  });

  if (!res.ok) {
    throw new Error(`Tavily search failed: ${res.statusText}`);
  }

  const data = await res.json();
  return data.results as TavilyResult[];
}

export async function searchMultiple(
  queries: string[],
  maxResultsEach = 5
): Promise<TavilyResult[]> {
  const batches = await Promise.all(
    queries.map((q) => search(q, maxResultsEach).catch(() => []))
  );
  const seen = new Set<string>();
  return batches.flat().filter((r) => {
    if (seen.has(r.url)) return false;
    seen.add(r.url);
    return true;
  });
}
