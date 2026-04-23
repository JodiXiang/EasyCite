import { Pool } from "pg";

let pool: Pool | null = null;
let initialized = false;

export function hasDatabaseUrl() {
  return Boolean(process.env.DATABASE_URL);
}

export function getPool() {
  if (!process.env.DATABASE_URL) return null;
  if (pool) return pool;

  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: shouldUseSsl() ? { rejectUnauthorized: false } : false,
    max: 3
  });

  return pool;
}

export async function initializeDatabase() {
  const activePool = getPool();
  if (!activePool || initialized) return;

  await activePool.query(`
    create table if not exists papers (
      canonical_key text primary key,
      source_paper_id text not null,
      title text not null,
      authors_json jsonb not null,
      publication_year integer,
      doi text,
      url text,
      venue text,
      volume text,
      issue text,
      page_first text,
      page_last text,
      abstract text,
      source text not null,
      source_ids_json jsonb,
      cited_by_count integer,
      why_relevant text,
      raw_json jsonb,
      created_at timestamptz default now()
    );
  `);

  await activePool.query(`
    create table if not exists document_citations (
      id uuid primary key,
      document_id text not null,
      paper_key text not null references papers(canonical_key) on delete cascade,
      style text not null,
      mode text,
      citation_number integer,
      inserted_text text not null,
      anchor_id text,
      created_at timestamptz not null
    );
  `);

  await activePool.query(`
    create index if not exists document_citations_document_id_created_at_idx
    on document_citations (document_id, created_at);
  `);

  await activePool.query(`
    create index if not exists document_citations_document_id_paper_key_idx
    on document_citations (document_id, paper_key);
  `);

  initialized = true;
}

function shouldUseSsl() {
  if (process.env.DATABASE_SSL === "false") return false;
  return process.env.NODE_ENV === "production" || String(process.env.DATABASE_URL).includes("supabase");
}
