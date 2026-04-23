# EasyCite + Supabase

EasyCite now supports two storage modes:

- `DATABASE_URL` set: use Postgres
- no `DATABASE_URL`: fall back to local JSON store

## Recommended Stack

- API hosting: Vercel
- Database: Supabase Postgres

## Why This Works

Vercel gives you a stable URL. Supabase gives you durable Postgres storage.

This avoids the main problem with local JSON files on serverless hosting.

## Create a Supabase Project

1. Go to [Supabase](https://supabase.com/).
2. Create a new project.
3. Open the project dashboard.
4. Click `Connect`.
5. Copy a Postgres connection string.

For serverless environments, Supabase recommends a transaction pooler connection string. For persistent backends, direct connections are ideal. See [Supabase connection strings](https://supabase.com/docs/reference/postgres/connection-strings).

## Set Environment Variables

In Vercel, add:

```text
DATABASE_URL=your_supabase_postgres_connection_string
DATABASE_SSL=true
OPENALEX_EMAIL=your_email@example.com
CORS_ORIGIN=*
```

## Tables

EasyCite auto-creates these tables on startup:

- `papers`
- `document_citations`

No manual migration is required for the MVP.

## What Is Stored

- canonical paper metadata
- inserted document citations
- citation numbering
- bibliography reconstruction inputs

## Current Scope

This stores citation state durably, but it does not yet add:

- user accounts
- row-level security
- team sharing

Those can come later if you want EasyCite to become multi-user.

## Official References

- [Supabase Postgres connection strings](https://supabase.com/docs/reference/postgres/connection-strings)
- [Supabase Database overview](https://supabase.com/docs/guides/database/overview)
- [Vercel external Postgres guidance](https://vercel.com/docs/postgres)
