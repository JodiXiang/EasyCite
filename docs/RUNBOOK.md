# EasyCite MVP Runbook

## Local API

```bash
npm install
npm run build
npm run dev
```

By default, document citation state is persisted to:

```text
./data/document-store.json
```

Health check:

```bash
curl http://127.0.0.1:8787/health
```

API demo:

```bash
node scripts/demo-api.mjs
```

## Google Docs Add-on Demo

Google Apps Script cannot call `localhost` from Google servers. For a real Docs demo, expose the API with one of:

- Cloudflare Tunnel
- ngrok
- a small hosted Node service

## Simplest Deploy Path

1. Start the local API:

```bash
npm run dev
```

2. Expose the API with ngrok or Cloudflare Tunnel.

Example target:

```text
http://127.0.0.1:8787
```

You need the final HTTPS URL, for example:

```text
https://abc123.ngrok-free.app
```

3. Log in to clasp once:

```bash
npm run addon:login
```

4. Create or open an Apps Script project attached to your Google Doc, then copy its Script ID from Project Settings.

5. Configure this repo:

```bash
npm run addon:configure -- --script-id YOUR_SCRIPT_ID --api-url https://abc123.ngrok-free.app
```

6. Deploy files to Apps Script:

```bash
npm run addon:deploy
```

7. Reload the Google Doc and open:

```text
EasyCite -> Open sidebar
```

If you do not bake the API URL into the build, you can also set it manually in Apps Script:

```js
setApiBaseUrl("https://your-public-api-url")
```

## Build Apps Script Files

```bash
npm run build
npm run build:addon
```

Upload the files from:

```text
apps/docs-addon/build/
```

Files:

- `Code.js`
- `Sidebar.html`
- `appsscript.json`

## Optional clasp Push

If you prefer manual `clasp` config, copy the example config and paste your Apps Script project id:

```bash
cp apps/docs-addon/.clasp.example.json apps/docs-addon/.clasp.json
```

Then push:

```bash
npm run build
npm run build:addon
npm run push -w apps/docs-addon
```

## Demo Script

1. Open a Google Doc.
2. Add the Apps Script files.
3. Run `onOpen` once or reload the Doc.
4. Open `EasyCite -> Open sidebar`.
5. Enter a keyword query or select a sentence and click `Find for selected text`.
6. Pick a result and click `Insert citation`.
7. Confirm the in-text citation appears and `References` is created/updated.
