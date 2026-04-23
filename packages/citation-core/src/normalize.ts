import type { Paper } from "./types.js";

export function normalizeDoi(doi?: string): string | undefined {
  return doi?.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").trim().toLowerCase();
}

export function normalizeTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function canonicalPaperKey(paper: Pick<Paper, "doi" | "title" | "year" | "sourceIds">): string {
  const doi = normalizeDoi(paper.doi);
  if (doi) return `doi:${doi}`;

  const openAlexId = paper.sourceIds?.openalex;
  if (openAlexId) return `openalex:${openAlexId}`;

  return `title:${normalizeTitle(paper.title)}:${paper.year ?? "unknown"}`;
}
