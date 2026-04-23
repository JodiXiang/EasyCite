# Google Docs Quickstart

This is the shortest path to try EasyCite inside Google Docs.

Modes:

- `EasyCite Basic`: no LLM API key required
- `EasyCite AI`: user supplies an OpenAI API key for better query rewrite and reranking

## You Need

- A public HTTPS API URL, usually from ngrok or Cloudflare Tunnel.
- A Google Apps Script project attached to your Google Doc.
- The Apps Script `Script ID`.

## 1. Start API

```bash
cd /Users/jodixiang/Desktop/reference
npm run dev
```

## 2. Expose API

Expose local port `8787`.

Example with ngrok:

```bash
ngrok http 8787
```

Copy the HTTPS URL, for example:

```text
https://abc123.ngrok-free.app
```

## 3. Login To clasp

```bash
npm run addon:login
```

## 4. Configure

Replace both values:

```bash
npm run addon:configure -- --script-id YOUR_SCRIPT_ID --api-url https://abc123.ngrok-free.app
```

## 5. Deploy

```bash
npm run addon:deploy
```

## 6. Try In Google Docs

Reload the Google Doc, then open:

```text
EasyCite -> Open sidebar
```

Demo flow:

```text
Select a sentence -> Find for selected text -> Insert citation -> Check References
```
