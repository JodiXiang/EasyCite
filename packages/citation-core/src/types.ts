export type CitationStyle = "apa" | "ieee" | "vancouver";

export type CitationMode = "auto" | "parenthetical" | "narrative" | "year-only";
export type ProviderMode = "basic" | "ai";

export type PaperSource = "openalex" | "crossref" | "semantic_scholar" | "mock";

export type Author = {
  given?: string;
  family: string;
  displayName?: string;
  orcid?: string;
};

export type Paper = {
  id: string;
  canonicalKey: string;
  title: string;
  authors: Author[];
  year?: number;
  doi?: string;
  url?: string;
  venue?: string;
  volume?: string;
  issue?: string;
  pageFirst?: string;
  pageLast?: string;
  abstract?: string;
  source: PaperSource;
  sourceIds?: Record<string, string>;
  citedByCount?: number;
  whyRelevant?: string;
  raw?: unknown;
};

export type DocumentCitation = {
  id: string;
  documentId: string;
  paperKey: string;
  style: CitationStyle;
  mode?: CitationMode;
  citationNumber?: number;
  insertedText: string;
  anchorId?: string;
  createdAt: string;
};

export type BibliographyEntry = {
  paperKey: string;
  style: CitationStyle;
  order: number;
  formattedText: string;
};

export type SearchRequest = {
  query?: string;
  selectedText?: string;
  surroundingText?: string;
  limit?: number;
  providerMode?: ProviderMode;
  openAIApiKey?: string;
  openAIModel?: string;
};

export type SearchResponse = {
  papers: Paper[];
};

export type CitationFormatOptions = {
  mode?: CitationMode;
  contextText?: string;
};
