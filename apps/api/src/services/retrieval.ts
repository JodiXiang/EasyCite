import { canonicalPaperKey, normalizeDoi, type Paper, type ProviderMode } from "@citepilot/citation-core";
import { rerankPapersWithAi, rewriteQueriesWithAi } from "./ai.js";

type ContextSearchInput = {
  selectedText: string;
  surroundingText?: string;
  limit: number;
  providerMode?: ProviderMode;
  openAIApiKey?: string;
  openAIModel?: string;
};

type ManualSearchOptions = {
  providerMode?: ProviderMode;
  openAIApiKey?: string;
  openAIModel?: string;
};

export async function searchByManualQuery(query: string, limit: number, options: ManualSearchOptions = {}): Promise<Paper[]> {
  if (!query.trim()) return mockPapers(limit, "Try entering a title, DOI, or keywords.");

  const doi = extractDoi(query);
  if (doi) {
    const byDoi = await searchOpenAlex(`doi:${doi}`, limit);
      if (byDoi.length > 0) return byDoi;
  }

  const aiQueries = options.providerMode === "ai"
    ? await rewriteQueriesWithAi({
      query,
      openAIApiKey: options.openAIApiKey,
      openAIModel: options.openAIModel
    })
    : [];

  const results = await searchAcrossQueries(uniqueQueries([...buildManualQueries(query), ...aiQueries]), query, limit);
  const reranked = options.providerMode === "ai"
    ? await rerankPapersWithAi({
      query,
      openAIApiKey: options.openAIApiKey,
      openAIModel: options.openAIModel
    }, results)
    : results;

  return reranked.length > 0 ? reranked.slice(0, limit) : mockPapers(limit, "Mock fallback because no source results were available.");
}

export async function searchByContext(input: ContextSearchInput): Promise<Paper[]> {
  const query = buildContextQuery(input.selectedText, input.surroundingText);
  const aiQueries = input.providerMode === "ai"
    ? await rewriteQueriesWithAi({
      selectedText: input.selectedText,
      surroundingText: input.surroundingText,
      openAIApiKey: input.openAIApiKey,
      openAIModel: input.openAIModel
    })
    : [];

  const results = await searchAcrossQueries(
    uniqueQueries([...buildContextQueries(input.selectedText, input.surroundingText), ...aiQueries]),
    query,
    input.limit
  );
  const reranked = input.providerMode === "ai"
    ? await rerankPapersWithAi({
      selectedText: input.selectedText,
      surroundingText: input.surroundingText,
      openAIApiKey: input.openAIApiKey,
      openAIModel: input.openAIModel
    }, results)
    : results;

  return reranked.length > 0 ? reranked.slice(0, input.limit) : mockPapers(input.limit, "Mock fallback for context search.");
}

function buildContextQuery(selectedText: string, surroundingText?: string): string {
  const combined = `${selectedText} ${surroundingText ?? ""}`;
  const stopwords = new Set(["the", "and", "or", "of", "to", "in", "a", "an", "for", "with", "that", "this", "have", "has", "can"]);
  const tokens = combined
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((token) => token.length > 3 && !stopwords.has(token));

  return Array.from(new Set(tokens)).slice(0, 8).join(" ") || selectedText;
}

async function searchOpenAlex(query: string, limit: number): Promise<Paper[]> {
  const email = process.env.OPENALEX_EMAIL;
  const params = new URLSearchParams({
    search: query,
    per_page: String(limit),
    sort: "relevance_score:desc"
  });

  if (email) params.set("mailto", email);

  try {
    const response = await fetch(`https://api.openalex.org/works?${params.toString()}`);
    if (!response.ok) return [];
    const payload = await response.json() as { results?: unknown[] };
    return (payload.results ?? []).map(mapOpenAlexWork).filter(Boolean).slice(0, limit) as Paper[];
  } catch {
    return [];
  }
}

async function searchAcrossQueries(queries: string[], rankingText: string, limit: number): Promise<Paper[]> {
  const resultGroups = await Promise.all(queries.map((query) => searchOpenAlex(query, Math.max(limit * 2, 8))));
  const merged = new Map<string, Paper>();

  for (const papers of resultGroups) {
    for (const paper of papers) {
      const existing = merged.get(paper.canonicalKey);
      if (!existing || scorePaper(paper, rankingText) > scorePaper(existing, rankingText)) {
        merged.set(paper.canonicalKey, paper);
      }
    }
  }

  return Array.from(merged.values())
    .sort((left, right) => scorePaper(right, rankingText) - scorePaper(left, rankingText))
    .slice(0, limit);
}

function buildManualQueries(query: string): string[] {
  const normalized = normalizeQuery(query);
  const longestTokens = extractKeywords(query).slice(0, 8).join(" ");

  return uniqueQueries([
    query,
    normalized,
    longestTokens,
    normalized.replace(/\b(and|for|with|from|using|based)\b/g, " ").replace(/\s+/g, " ").trim()
  ]);
}

function buildContextQueries(selectedText: string, surroundingText?: string): string[] {
  const base = buildContextQuery(selectedText, surroundingText);
  const selectedKeywords = extractKeywords(selectedText).slice(0, 8).join(" ");
  const surroundingKeywords = extractKeywords(surroundingText ?? "").slice(0, 5).join(" ");
  return uniqueQueries([base, selectedKeywords, `${selectedKeywords} ${surroundingKeywords}`.trim()]);
}

function uniqueQueries(queries: string[]): string[] {
  return Array.from(new Set(queries.map((query) => query.trim()).filter(Boolean)));
}

function normalizeQuery(text: string): string {
  return text
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractKeywords(text: string): string[] {
  const stopwords = new Set(["the", "and", "or", "of", "to", "in", "a", "an", "for", "with", "that", "this", "have", "has", "can", "from", "using", "used", "use", "into"]);
  return normalizeQuery(text)
    .toLowerCase()
    .split(/\s+/)
    .filter((token) => token.length > 2 && !stopwords.has(token))
    .sort((left, right) => right.length - left.length);
}

function scorePaper(paper: Paper, rankingText: string): number {
  const queryTokens = new Set(extractKeywords(rankingText));
  const titleTokens = new Set(extractKeywords(paper.title));
  const abstractTokens = new Set(extractKeywords(paper.abstract ?? ""));
  const overlapTitle = intersectSize(queryTokens, titleTokens);
  const overlapAbstract = intersectSize(queryTokens, abstractTokens);
  const doiBonus = paper.doi ? 4 : 0;
  const abstractBonus = paper.abstract ? 2 : 0;
  const citationBonus = Math.min((paper.citedByCount ?? 0) / 500, 5);
  return overlapTitle * 8 + overlapAbstract * 2 + doiBonus + abstractBonus + citationBonus;
}

function intersectSize(left: Set<string>, right: Set<string>): number {
  let count = 0;
  for (const item of left) {
    if (right.has(item)) count += 1;
  }
  return count;
}

function mapOpenAlexWork(work: any): Paper | null {
  const title = work.title as string | undefined;
  if (!title) return null;

  const authors = (work.authorships ?? []).map((authorship: any) => {
    const displayName = authorship.author?.display_name ?? "Unknown";
    const parts = displayName.split(" ");
    return {
      given: parts.slice(0, -1).join(" ") || undefined,
      family: parts.at(-1) ?? displayName,
      displayName,
      orcid: authorship.author?.orcid
    };
  });

  const paper: Paper = {
    id: work.id ?? work.doi ?? title,
    canonicalKey: "",
    title,
    authors,
    year: work.publication_year,
    doi: normalizeDoi(work.doi),
    url: work.primary_location?.landing_page_url ?? work.doi ?? work.id,
    venue: work.primary_location?.source?.display_name,
    volume: work.biblio?.volume ? String(work.biblio.volume) : undefined,
    issue: work.biblio?.issue ? String(work.biblio.issue) : undefined,
    pageFirst: work.biblio?.first_page ? String(work.biblio.first_page) : undefined,
    pageLast: work.biblio?.last_page ? String(work.biblio.last_page) : undefined,
    abstract: invertOpenAlexAbstract(work.abstract_inverted_index),
    source: "openalex",
    sourceIds: { openalex: work.id },
    citedByCount: work.cited_by_count,
    whyRelevant: "Matched by OpenAlex scholarly search against the selected context or query.",
    raw: work
  };

  return { ...paper, canonicalKey: canonicalPaperKey(paper) };
}

function invertOpenAlexAbstract(index?: Record<string, number[]>): string | undefined {
  if (!index) return undefined;
  const words: string[] = [];
  for (const [word, positions] of Object.entries(index)) {
    for (const position of positions) words[position] = word;
  }
  return words.join(" ");
}

function extractDoi(text: string): string | undefined {
  return text.match(/\b10\.\d{4,9}\/[-._;()/:A-Z0-9]+\b/i)?.[0].toLowerCase();
}

function mockPapers(limit: number, whyRelevant: string): Paper[] {
  const papers: Paper[] = [
    {
      id: "mock:brown-2020",
      canonicalKey: "doi:10.5555/mock-brown-2020",
      title: "Language Models are Few-Shot Learners",
      authors: [{ given: "Tom", family: "Brown", displayName: "Tom Brown" }],
      year: 2020,
      doi: "10.5555/mock-brown-2020",
      url: "https://arxiv.org/abs/2005.14165",
      venue: "NeurIPS",
      abstract: "Introduces GPT-3 and evaluates few-shot, one-shot, and zero-shot learning from prompts.",
      source: "mock",
      sourceIds: { mock: "brown-2020" },
      citedByCount: 10000,
      whyRelevant
    }
  ];

  return papers.slice(0, limit);
}
