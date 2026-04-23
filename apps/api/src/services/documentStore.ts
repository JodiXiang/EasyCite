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

type DocumentState = {
  papers: Map<string, Paper>;
  citations: DocumentCitation[];
};

const documents = new Map<string, DocumentState>();
const storePath = resolve(process.cwd(), process.env.DOCUMENT_STORE_PATH ?? "./data/document-store.json");

loadFromDisk();

export function getNextCitationOrder(documentId: string, paper: Paper): number {
  const state = getState(documentId);
  const paperKey = canonicalPaperKey(paper);
  const existingKeys = Array.from(new Set(state.citations.map((citation) => citation.paperKey)));
  const existingIndex = existingKeys.indexOf(paperKey);
  return existingIndex >= 0 ? existingIndex + 1 : existingKeys.length + 1;
}

export function addCitation(
  documentId: string,
  paper: Paper,
  style: CitationStyle,
  insertedText: string,
  citationNumber?: number,
  mode?: CitationMode
): DocumentCitation {
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

export function getBibliography(documentId: string, style: CitationStyle): BibliographyEntry[] {
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
