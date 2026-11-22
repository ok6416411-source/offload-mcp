# ☁️ Offload Cloud

Store **your own** free-tier API keys once (encrypted), then create personal **offload keys** (`ofk_…`) that bundle them.
Use one offload key in Claude Desktop on every device, or in your own apps and websites – OpenAI-compatible.

**Dashboard:** https://ok6416411-source.github.io/offload-mcp/

## What it is – and isn't
- ✅ Your keys, used only by you. Each offload key can be limited to certain providers, revoked any time, and has its own notes/docs.
- ✅ No instructions are injected. Your app's system prompt, roles, tools and parameters are passed through **unchanged**.
- ❌ Not a key-sharing pool. Keys are never shared between users – that would break every provider's terms.

## Use in Claude Desktop / Claude Code
```json
"offload": {
  "command": "npx",
  "args": ["-y", "github:ok6416411-source/offload-mcp"],
  "env": { "OFFLOAD_CLOUD_KEY": "ofk_..." }
}
```
Or run the setup wizard (`npx -y github:ok6416411-source/offload-mcp setup`) and paste the key into the **Offload Cloud** field.

## Use in your own app (OpenAI-compatible)
```
Base URL: https://hwxrfawfnyigtsheemol.supabase.co/functions/v1/offload-cloud/v1
API key:  ofk_...
```
```js
// server-side only!
import OpenAI from "openai";
const client = new OpenAI({ baseURL: "https://hwxrfawfnyigtsheemol.supabase.co/functions/v1/offload-cloud/v1", apiKey: process.env.OFFLOAD_KEY });
const r = await client.chat.completions.create({
  model: "auto",
  messages: [{ role: "system", content: "You are my custom AI ..." }, { role: "user", content: "Hi!" }],
});
```
| `model` | Behaviour |
|---|---|
| `auto` | Tries all providers of this key, with fallback and self-healing model choice |
| `groq` | Only Groq, best current model |
| `groq:<model>` | Exactly that model |

Streaming (`"stream": true`) is supported. Responses include `offload: { provider, model }`.
Other endpoints: `GET /v1/models`, `GET /v1/key-info` (name, your docs, providers).

> ⚠️ **Never put an offload key in browser JavaScript.** Anyone can read it in DevTools. Call the API from your backend / serverless function.

## Security
- Provider keys: verified on save, encrypted with AES-256-GCM (server secret `OFFLOAD_ENC_KEY`), never returned to any client.
- Offload keys: only a SHA-256 hash is stored; the key is shown once.
- Database: row-level security; clients can only read their own metadata, all writes go through the edge function.

## Self-hosting
Everything is in this folder: `functions/offload-cloud/index.ts` (Supabase Edge Function, deploy with `verify_jwt = false`) and `migrations/`. Set the secret `OFFLOAD_ENC_KEY` (≥ 32 random chars) and point `OFFLOAD_CLOUD_URL` at your deployment.
