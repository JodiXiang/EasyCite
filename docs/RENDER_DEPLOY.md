# EasyCite on Render

This is the easiest way to get a stable API URL for the Google Docs add-on.

## What You Get

- A stable `https://...onrender.com` API URL
- No need to keep `npm run dev` open locally
- No need for `cloudflared` or temporary tunnel URLs

## Before You Start

- Push this repo to GitHub
- Keep your Google Docs Apps Script project ready

## Recommended Render Setup

Use a Render `Web Service`.

This repo already includes:

- [render.yaml](/Users/jodixiang/Desktop/reference/render.yaml)

## Deploy Steps

1. Go to [Render Dashboard](https://dashboard.render.com/).
2. Click `New` -> `Blueprint`.
3. Connect your GitHub repo.
4. Select this repo and deploy the blueprint.

Render should read `render.yaml` and create:

- `easycite-api`

## Important Environment Variables

- `OPENALEX_EMAIL`
  Use your email for polite OpenAlex API usage.

- `DOCUMENT_STORE_PATH`
  Defaults to `./data/document-store.json`.

## Important Limitation

By default, Render web services have an ephemeral filesystem. Render documents that the local filesystem is ephemeral unless you attach a persistent disk, and persistent disks are for paid services only. See [Deploy a Node Express app on Render](https://render.com/docs/deploy-node-express-app) and [Persistent Disks](https://render.com/docs/disks).

That means:

- local JSON citation state can reset after redeploy or restart
- this is acceptable for MVP demos
- for more stable persistence later, move document state to Postgres or attach a persistent disk on a paid plan

## After Deploy

Suppose Render gives you:

```text
https://easycite-api.onrender.com
```

Update your Apps Script add-on to use that URL.

If you want to update from the terminal:

```bash
npm run addon:configure -- --script-id YOUR_SCRIPT_ID --api-url https://easycite-api.onrender.com
npm run addon:deploy
```

Or inside Apps Script:

```js
setApiBaseUrl("https://easycite-api.onrender.com")
```

## Render Values Used

These values are based on Render's official docs:

- Build command can be your normal Node build command
- Start command can be your normal Node start command
- Node web services receive a `PORT` environment variable

References:

- [Deploy a Node Express App on Render](https://render.com/docs/deploy-node-express-app)
- [Default Environment Variables](https://render.com/docs/environment-variables)
- [Persistent Disks](https://render.com/docs/disks)
