# Included AI

Tabby 1.0.4 defaults to the shared DeepSeek service at `https://tabby-pi.vercel.app/api/tabby`. Install the ZIP and click **Enable AI**. Users do not need an account, API key, pairing token or local server. Consent stays off until that click; visible page text and site permissions remain separate opt-ins.

The project owner pays for AI during the hackathon preview. The GPT Tunnel credential is stored as the production-only secret `TABBY_CLOUD_GPTUNNEL_KEY`. It is never included in JavaScript shipped to browsers, the ZIP or Git. Do not use a `VITE_` prefix for secrets. The function fixes the provider endpoint and model to GPT Tunnel / `deepseek-v3.2`; clients cannot choose a model, endpoint or arbitrary upstream request.

`api/tabby.ts` exposes only `POST ?op=status` and `POST ?op=ai`. `src/server/cloud.ts` enforces the stable extension Origin, JSON/schema validation, 120 KB input, fixed output bounds through the existing provider, sanitized errors and request cancellation. Origin is a browser boundary, **not authentication**: this is a public shared demo service.

Production protection: the **Tabby shared AI rate limit** Vercel WAF rule limits `POST /api/tabby` to 60 requests per minute per IP. Vercel counts per region. The function adds process-local limits of 30 requests/minute/IP and eight concurrent requests. These are rate limits, not a durable account-wide spending cap. Monitor the GPT Tunnel balance and hosted usage. Set `TABBY_CLOUD_ENABLED=0` and redeploy to disable the shared service. The server caches catalog checks for five minutes.

The old authenticated loopback server is unchanged. **Settings → Connected tools & advanced settings** contains local AI, MCP and companion credentials. Google/Ambiguous OAuth remains local; its pairing token is never sent to Tabby Cloud. Existing paired installations retain their local AI selection until the user chooses **Use included AI**.

Verification:

```bash
npm run build
npm test
npm run test:cloud
node scripts/package-extension.mjs --landing
node scripts/verify-download.mjs
npm run build:landing
```

The cloud browser test uses an actual Chromium extension and HTTP boundary with explicit model fixtures. It checks zero requests before consent, token-free connection, AI chat, confirmed task creation, persistence and a narrow settings layout. A real production model check is reported separately in the release handoff.

To explicitly run one paid production completion from the downloaded ZIP: `node --import tsx tests/cloud-live-browser.ts --live`. This passed for 1.0.4: real DeepSeek response, reviewed task creation and persistence in a fresh Chrome profile, without credentials or loopback calls. Report: `artifacts/tabby-cloud-live.json`.

Hosting uses the existing Vercel project. Deploy the reviewed repository with `api/`, `src/server/` and `src/shared/` available to the function builder; `.vercelignore` excludes local secrets, profiles and artifacts. Keep the WAF rule enabled and production secret configured before publishing the AI-enabled ZIP.
