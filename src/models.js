// Auto-discovery: when a configured model is gone, ask the provider's /models endpoint and pick a good one.
// Results are cached in ~/.offload-mcp/models.json so this happens rarely.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DIR = process.env.OFFLOAD_HOME || path.join(os.homedir(), ".offload-mcp");
const FILE = path.join(DIR, "models.json");
const TTL = 3 * 24 * 3600 * 1000;

let cache = {};
try { cache = JSON.parse(readFileSync(FILE, "utf8")); } catch {}

export function cachedModel(id) {
  const c = cache[id];
  return c && Date.now() - c.at < TTL ? c.model : null;
}

function saveCache(id, model) {
  cache[id] = { model, at: Date.now() };
  try { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(cache, null, 2)); } catch {}
}

const BAD = /embed|whisper|tts|speech|audio|guard|moderation|image|vision|rerank|ocr|transcri|realtime|search|safety|reward|retriev|nemoretriever|parse|clip|deplot|kosmos|tool-use-preview|-8b|-1b|-3b|mini-?1b|nano|lite|preview-tts/i;

export function scoreModel(id, providerId) {
  const s = id.toLowerCase();
  if (BAD.test(s)) return -1;
  if (providerId === "openrouter" && !s.endsWith(":free")) return -1;
  let score = 0;
  const b = s.match(/(\d+(?:\.\d+)?)b\b/g);
  if (b) score += Math.min(Math.max(...b.map((x) => parseFloat(x))), 400) / 4; // bigger is better, capped
  const ver = s.match(/(\d+(?:\.\d+)?)/);
  if (ver) score += Math.min(parseFloat(ver[1]), 20) * 2; // newer generations
  if (/instruct|versatile|chat|flash|large|turbo/.test(s)) score += 15;
  if (/pro\b/.test(s) && providerId === "gemini") score -= 30; // pro has tiny free quota
  if (/thinking|reason|r1|qwq/.test(s)) score -= 10; // slow, verbose
  if (/exp|experimental|beta|preview/.test(s)) score -= 8;
  if (/llama|gemini|mistral|qwen|deepseek|gpt-oss|nemotron|kimi|glm/.test(s)) score += 10;
  return score;
}

export function pickModel(ids, providerId, exclude = []) {
  return ids
    .filter((id) => !exclude.includes(id))
    .map((id) => [id, scoreModel(id, providerId)])
    .filter(([, sc]) => sc >= 0)
    .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

export async function discoverModel(p, fetchFn, exclude = []) {
  const res = await fetchFn(`${p.baseUrl}/models`, {
    headers: { authorization: `Bearer ${p.apiKey}` },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`model list HTTP ${res.status}`);
  const data = await res.json();
  const ids = (data.data || data.models || []).map((m) => (m.id || m.name || "").replace(/^models\//, "")).filter(Boolean);
  const model = pickModel(ids, p.id, exclude);
  if (!model) throw new Error("no suitable model found");
  saveCache(p.id, model);
  return model;
}
