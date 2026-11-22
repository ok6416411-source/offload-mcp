# offload-mcp 🪶

🇩🇪 [Deutsche Anleitung](README.de.md) · ⭐ If this saves you tokens, please star the repo!

**Stretch your Claude limits.** An MCP server that lets Claude Desktop / Claude Code hand bulky, routine work to **free LLM APIs** — Groq, Google Gemini, Cerebras, Mistral, NVIDIA NIM, OpenRouter — and read back only the short result.

- 📄 **`offload_files`** – "summarize this 8 MB log" → the file goes to Gemini, Claude only sees the 20-line answer. *This is where most tokens are saved.*
- ✍️ **`offload`** – drafts, translations, boilerplate, simple code.
- 🔁 **`offload_batch`** – the same instruction over 50 items in parallel.
- 📊 **`list_providers`** – what's configured, usage, tokens saved.
- 🔀 Automatic fallback: provider rate-limited? Next one takes over.
- 📦 **Zero dependencies.** Node ≥ 18, that's it.
- 🌍 Messages in your system language (English, German – more welcome).

## How it saves tokens

Without it, Claude reads a 100k-token file into its context. With it, a free model reads the file and Claude gets a ~500-token answer. Your Claude usage goes to *thinking*, not to *reading*.

## ⚡ Quick setup (1 command)

Requires [Node.js](https://nodejs.org). Open a terminal (Windows: `cmd`) and run:

```bash
npx -y github:ok6416411-source/offload-mcp setup
```

A window opens in your browser → paste your free API keys → **Save**. Restart Claude Desktop. Done.
(Claude Code is configured automatically too, if installed.)

Or just tell Claude Code: *"Run `npx -y github:ok6416411-source/offload-mcp setup` for me."*

## Manual setup

### 1. Get at least one free API key
| Provider | Get a key | Good at |
|---|---|---|
| Groq | https://console.groq.com/keys | very fast |
| Google Gemini | https://aistudio.google.com/apikey | huge context (whole files) |
| Cerebras | https://cloud.cerebras.ai | very fast |
| Mistral | https://console.mistral.ai/api-keys | multilingual |
| NVIDIA NIM | https://build.nvidia.com | many open models |
| OpenRouter | https://openrouter.ai/keys | many `:free` models |

More keys = more free capacity and better fallback. Free-tier limits are set by each provider and change over time.

### 2. Add to Claude Desktop
Open *Settings → Developer → Edit Config* (`claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "offload": {
      "command": "npx",
      "args": ["-y", "github:ok6416411-source/offload-mcp"],
      "env": {
        "GEMINI_API_KEY": "...",
        "GROQ_API_KEY": "..."
      }
    }
  }
}
```
Restart Claude Desktop. Ask: *"list your offload providers"*.

**Claude Code:** `claude mcp add offload -e GEMINI_API_KEY=... -- npx -y github:ok6416411-source/offload-mcp`

### 3. Tell Claude to use it (optional but recommended)
Add to your project instructions / `CLAUDE.md`:
> For large files, logs or bulk text tasks, use the offload tools instead of reading content yourself.

## Configuration
| Env var | Effect |
|---|---|
| `OFFLOAD_ORDER` | Provider priority, e.g. `gemini,groq,cerebras` |
| `OFFLOAD_<ID>_MODEL` | Override a model, e.g. `OFFLOAD_GROQ_MODEL=...` |
| `OFFLOAD_MAX_FILE_CHARS` | Cap for `offload_files` input (default 400000) |
| `OFFLOAD_LANG` | Message language (`en`, `de`). Default: your system language |
| `OFFLOAD_NO_STAR=1` | Hide the one-time ⭐ reminder |

## Honest notes
- Free models are weaker than Claude. Offload *grunt work*, keep reasoning with Claude.
- Files you offload are sent to that provider. Don't offload secrets; check each provider's data policy (some free tiers may use data for training).
- Respect each provider's terms — one account per provider, no key farming.

## Development
```bash
npm test
```
PRs welcome — especially new providers (any OpenAI-compatible endpoint is a ~8-line addition in `src/providers.js`).

## License
MIT
