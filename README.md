# EasyCite

Lightweight AI citation copilot MVP for Google Docs.

Modes:

- `EasyCite Basic`: retrieval + rules, no AI key required
- `EasyCite AI`: user-provided OpenAI API key, AI-assisted query rewrite and reranking

Start here:

- Product and engineering blueprint: `docs/BLUEPRINT.md`
- Demo runbook: `docs/RUNBOOK.md`
- Short Google Docs setup: `docs/GOOGLE_DOCS_QUICKSTART.md`
- Render deploy guide: `docs/RENDER_DEPLOY.md`
- API skeleton: `apps/api`
- Google Docs add-on skeleton: `apps/docs-addon`
- Shared citation utilities: `packages/citation-core`

## Quick Start

```bash
npm install
npm run dev
```

The API starts on `http://localhost:8787` by default.
