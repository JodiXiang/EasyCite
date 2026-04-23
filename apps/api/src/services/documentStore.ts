import {
  canonicalPaperKey,
  formatBibliographyEntry,
  type BibliographyEntry,
  type CitationMode,
  type CitationStyle,
  type DocumentCitation,
  type Paper
} from "@citepilot/citation-core";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { getPool, hasDatabaseUrl, initializeDatabase } from "./db.js";

type DocumentState = {
  papers: Map<string, Paper>;
  citations: DocumentCitation[];
};

const documents = new Map<string, DocumentState>();
const storePath = resolve(process.cwd(), process.env.DOCUMENT_STORE_PATH ?? "./data/document-store.json");

loadFromDisk();

export async function getNextCitationOrder(documentId: string, paper: Paper): Promise<number> {
  if (hasDatabaseUrl()) return getNextCitationOrderFromDb(documentId, paper);

  const state = getState(documentId);
  const paperKey = canonicalPaperKey(paper);
  const existingKeys = Array.from(new Set(state.citations.map((citation) => citation.paperKey)));
  const existingIndex = existingKeys.indexOf(paperKey);
  return existingIndex >= 0 ? existingIndex + 1 : existingKeys.length + 1;
}

export async function addCitation(
  documentId: string,
  paper: Paper,
  style: CitationStyle,
  insertedText: string,
  citationNumber?: number,
  mode?: CitationMode
): Promise<DocumentCitation> {
  if (hasDatabaseUrl()) {
    return addCitationToDb(documentId, paper, style, insertedText, citationNumber, mode);
  }

  const state = getState(documentId);
  const canonicalKey = canonicalPaperKey(paper);
  const normalizedPaper = { ...paper, canonicalKey };
  state.papers.set(canonicalKey, normalizedPaper);

  const citation: DocumentCitation = {
    id: randomUUID(),
    documentId,
    paperKey: canonicalKey,
    style,
    mode,
    citationNumber,
    insertedText,
    createdAt: new Date().toISOString()
  };

  state.citations.push(citation);
  saveToDisk();
  return citation;
}

export async function getBibliography(documentId: string, style: CitationStyle): Promise<BibliographyEntry[]> {
  if (hasDatabaseUrl()) return getBibliographyFromDb(documentId, style);

  const state = getState(documentId);
  const orderedKeys = Array.from(new Set(state.citations.map((citation) => citation.paperKey)));

  return orderedKeys.flatMap((paperKey, index) => {
    const paper = state.papers.get(paperKey);
    return paper ? [formatBibliographyEntry(paper, style, index + 1)] : [];
  });
}

function getState(documentId: string): DocumentState {
  const existing = documents.get(documentId);
  if (existing) return existing;

  const created = { papers: new Map<string, Paper>(), citations: [] };
  documents.set(documentId, created);
  return created;
}

function loadFromDisk() {
  if (!existsSync(storePath)) return;

  try {
    const payload = JSON.parse(readFileSync(storePath, "utf8")) as Record<string, { papers: Paper[]; citations: DocumentCitation[] }>;
    for (const [documentId, state] of Object.entries(payload)) {
      documents.set(documentId, {
        papers: new Map(state.papers.map((paper) => [paper.canonicalKey, paper])),
        citations: state.citations
      });
    }
  } catch (error) {
    console.warn(`Could not load document store from ${storePath}`, error);
  }
}

function saveToDisk() {
  mkdirSync(dirname(storePath), { recursive: true });
  const payload = Object.fromEntries(
    Array.from(documents.entries()).map(([documentId, state]) => [
      documentId,
      {
        papers: Array.from(state.papers.values()),
        citations: state.citations
      }
    ])
  );

  writeFileSync(storePath, JSON.stringify(payload, null, 2));
}

async function getNextCitationOrderFromDb(documentId: string, paper: Paper): Promise<number> {
  await initializeDatabase();
  const pool = getPool();
  if (!pool) throw new Error("Database pool is not available.");

  const paperKey = canonicalPaperKey(paper);
  const existingResult = await pool.query<{ citation_number: number | null }>(
    `
      select citation_number
      from document_citations
      where document_id = $1 and paper_key = $2
      order by created_at asc
      limit 1
    `,
    [documentId, paperKey]
  );

  const existing = existingResult.rows[0]?.citation_number;
  if (existing) return existing;

  const countResult = await pool.query<{ count: string }>(
    `
      select count(*)::text as count
      from (
        select distinct paper_key
        from document_citations
        where document_id = $1
      ) deduped
    `,
    [documentId]
  );

  return Number(countResult.rows[0]?.count ?? "0") + 1;
}

async function addCitationToDb(
  documentId: string,
  paper: Paper,
  style: CitationStyle,
  insertedText: string,
  citationNumber?: number,
  mode?: CitationMode
): Promise<DocumentCitation> {
  await initializeDatabase();
  const pool = getPool();
  if (!pool) throw new Error("Database pool is not available.");

  const canonicalKey = canonicalPaperKey(paper);
  const normalizedPaper = { ...paper, canonicalKey };
  const citation: DocumentCitation = {
    id: randomUUID(),
    documentId,
    paperKey: canonicalKey,
    style,
    mode,
    citationNumber,
    insertedText,
    createdAt: new Date().toISOString()
  };

  await pool.query(
    `
      insert into papers (
        canonical_key, source_paper_id, title, authors_json, publication_year, doi, url, venue,
        volume, issue, page_first, page_last, abstract, source, source_ids_json,
        cited_by_count, why_relevant, raw_json
      )
      values (
        $1, $2, $3, $4::jsonb, $5, $6, $7, $8,
        $9, $10, $11, $12, $13, $14, $15::jsonb,
        $16, $17, $18::jsonb
      )
      on conflict (canonical_key) do update set
        source_paper_id = excluded.source_paper_id,
        title = excluded.title,
        authors_json = excluded.authors_json,
        publication_year = excluded.publication_year,
        doi = excluded.doi,
        url = excluded.url,
        venue = excluded.venue,
        volume = excluded.volume,
        issue = excluded.issue,
        page_first = excluded.page_first,
        page_last = excluded.page_last,
        abstract = excluded.abstract,
        source = excluded.source,
        source_ids_json = excluded.source_ids_json,
        cited_by_count = excluded.cited_by_count,
        why_relevant = excluded.why_relevant,
        raw_json = excluded.raw_json
    `,
    [
      canonicalKey,
      normalizedPaper.id,
      normalizedPaper.title,
      JSON.stringify(normalizedPaper.authors),
      normalizedPaper.year ?? null,
      normalizedPaper.doi ?? null,
      normalizedPaper.url ?? null,
      normalizedPaper.venue ?? null,
      normalizedPaper.volume ?? null,
      normalizedPaper.issue ?? null,
      normalizedPaper.pageFirst ?? null,
      normalizedPaper.pageLast ?? null,
      normalizedPaper.abstract ?? null,
      normalizedPaper.source,
      JSON.stringify(normalizedPaper.sourceIds ?? {}),
      normalizedPaper.citedByCount ?? null,
      normalizedPaper.whyRelevant ?? null,
      JSON.stringify(normalizedPaper.raw ?? {})
    ]
  );

  await pool.query(
    `
      insert into document_citations (
        id, document_id, paper_key, style, mode, citation_number, inserted_text, anchor_id, created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `,
    [
      citation.id,
      citation.documentId,
      citation.paperKey,
      citation.style,
      citation.mode ?? null,
      citation.citationNumber ?? null,
      citation.insertedText,
      citation.anchorId ?? null,
      citation.createdAt
    ]
  );

  return citation;
}

async function getBibliographyFromDb(documentId: string, style: CitationStyle): Promise<BibliographyEntry[]> {
  await initializeDatabase();
  const pool = getPool();
  if (!pool) throw new Error("Database pool is not available.");

  const result = await pool.query<{
    paper_key: string;
    title: string;
    authors_json: string;
    publication_year: number | null;
    doi: string | null;
    url: string | null;
    venue: string | null;
    volume: string | null;
    issue: string | null;
    page_first: string | null;
    page_last: string | null;
    abstract: string | null;
    source: Paper["source"];
    source_ids_json: string | null;
    cited_by_count: number | null;
    why_relevant: string | null;
    raw_json: string | null;
    citation_number: number;
    source_paper_id: string;
  }>(
    `
      select
        p.canonical_key as paper_key,
        p.source_paper_id,
        p.title,
        p.authors_json::text,
        p.publication_year,
        p.doi,
        p.url,
        p.venue,
        p.volume,
        p.issue,
        p.page_first,
        p.page_last,
        p.abstract,
        p.source,
        p.source_ids_json::text,
        p.cited_by_count,
        p.why_relevant,
        p.raw_json::text,
        min(dc.citation_number) as citation_number
      from document_citations dc
      join papers p on p.canonical_key = dc.paper_key
      where dc.document_id = $1
      group by
        p.canonical_key, p.source_paper_id, p.title, p.authors_json, p.publication_year, p.doi,
        p.url, p.venue, p.volume, p.issue, p.page_first, p.page_last, p.abstract, p.source,
        p.source_ids_json, p.cited_by_count, p.why_relevant, p.raw_json
      order by min(dc.citation_number) asc nulls last, min(dc.created_at) asc
    `,
    [documentId]
  );

  return result.rows.map((row, index) => {
    const paper: Paper = {
      id: row.source_paper_id,
      canonicalKey: row.paper_key,
      title: row.title,
      authors: JSON.parse(row.authors_json),
      year: row.publication_year ?? undefined,
      doi: row.doi ?? undefined,
      url: row.url ?? undefined,
      venue: row.venue ?? undefined,
      volume: row.volume ?? undefined,
      issue: row.issue ?? undefined,
      pageFirst: row.page_first ?? undefined,
      pageLast: row.page_last ?? undefined,
      abstract: row.abstract ?? undefined,
      source: row.source,
      sourceIds: row.source_ids_json ? JSON.parse(row.source_ids_json) : undefined,
      citedByCount: row.cited_by_count ?? undefined,
      whyRelevant: row.why_relevant ?? undefined,
      raw: row.raw_json ? JSON.parse(row.raw_json) : undefined
    };

    return formatBibliographyEntry(paper, style, row.citation_number ?? index + 1);
  });
}
