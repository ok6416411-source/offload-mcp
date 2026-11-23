// Offload Cloud – each user stores their OWN free-tier provider keys (AES-GCM encrypted) and
// creates personal offload access keys (ofk_…) from them. Exposes an OpenAI-compatible API.
// The request body (system prompt, roles, tools, …) is passed through untouched: Offload never adds instructions.
import { createClient } from "npm:@supabase/supabase-js@2";

const PROVIDERS: Record<string, { name: string; baseUrl: string; model: string; signup: string }> = {
  groq: { name: "Groq", baseUrl: "https://api.groq.com/openai/v1", model: "openai/gpt-oss-120b", signup: "https://console.groq.com/keys" },
  gemini: { name: "Google Gemini", baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai", model: "gemini-3.8-flash", signup: "https://aistudio.google.com/apikey" },
  cerebras: { name: "Cerebras", baseUrl: "https://api.cerebras.ai/v1", model: "llama-3.3-70b", signup: "https://cloud.cerebras.ai" },
  mistral: { name: "Mistral", baseUrl: "https://api.mistral.ai/v1", model: "mistral-small-latest", signup: "https://console.mistral.ai/api-keys" },
  nvidia: { name: "NVIDIA NIM", baseUrl: "https://integrate.api.nvidia.com/v1", model: "meta/llama-3.3-70b-instruct", signup: "https://build.nvidia.com" },
  openrouter: { name: "OpenRouter (free)", baseUrl: "https://openrouter.ai/api/v1", model: "meta-llama/llama-3.3-70b-instruct:free", signup: "https://openrouter.ai/keys" },
};

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

const CORS = {
  "access-control-allow-origin": "*",
  "access-control-allow-headers": "authorization, content-type, apikey, x-client-info",
  "access-control-allow-methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "access-control-expose-headers": "x-offload-provider, x-offload-model",
};
const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { ...CORS, "content-type": "application/json" } });
const oaiError = (message: string, status: number, type = "invalid_request_error") => json({ error: { message, type } }, status);

// ---------- crypto ----------
const enc = new TextEncoder();
const b64 = (u: Uint8Array) => btoa(String.fromCharCode(...u));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
let aesKey: CryptoKey | null = null;
async function getAesKey() {
  if (aesKey) return aesKey;
  // Prefer a dedicated secret; fall back to the project's service-role key (always present, never public).
  // NOTE: if the fallback is used and the service-role key is ever rotated, stored provider keys must be re-uploaded.
  const secret = Deno.env.get("OFFLOAD_ENC_KEY") || Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!secret || secret.length < 32) throw new Error("Server not configured: no encryption secret");
  const raw = await crypto.subtle.digest("SHA-256", enc.encode(secret));
  aesKey = await crypto.subtle.importKey("raw", raw, "AES-GCM", false, ["encrypt", "decrypt"]);
  return aesKey;
}
async function encrypt(plain: string) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await getAesKey(), enc.encode(plain)));
  const out = new Uint8Array(iv.length + ct.length);
  out.set(iv); out.set(ct, iv.length);
  return b64(out);
}
async function decrypt(data: string) {
  const u = unb64(data);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: u.slice(0, 12) }, await getAesKey(), u.slice(12));
  return new TextDecoder().decode(pt);
}
async function sha256(s: string) {
  return [...new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function randomKey(prefix = "ofk_") {
  const alphabet = "abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(40));
  return prefix + [...bytes].map((b) => alphabet[b % alphabet.length]).join("");
}

// ---------- model discovery (same idea as the MCP: survive retired models) ----------
const BAD = /embed|whisper|tts|speech|audio|guard|moderation|image|vision|rerank|ocr|transcri|realtime|search|safety|reward|retriev|parse|clip|-8b|-1b|-3b|nano|lite/i;
function scoreModel(id: string, provider: string) {
  const s = id.toLowerCase();
  if (BAD.test(s)) return -1;
  if (provider === "openrouter" && !s.endsWith(":free")) return -1;
  let score = 0;
  const b = s.match(/(\d+(?:\.\d+)?)b\b/g);
  if (b) score += Math.min(Math.max(...b.map((x) => parseFloat(x))), 400) / 4;
  const ver = s.match(/(\d+(?:\.\d+)?)/);
  if (ver) score += Math.min(parseFloat(ver[1]), 20) * 2;
  if (/instruct|versatile|chat|flash|large|turbo/.test(s)) score += 15;
  if (/pro\b/.test(s) && provider === "gemini") score -= 30;
  if (/exp|experimental|beta|preview/.test(s)) score -= 8;
  if (/llama|gemini|mistral|qwen|deepseek|gpt-oss|nemotron|kimi|glm/.test(s)) score += 10;
  return score;
}
const modelCache = new Map<string, string>(); // `${userId}:${provider}` -> model
async function discoverModel(provider: string, apiKey: string, exclude: string) {
  const res = await fetch(`${PROVIDERS[provider].baseUrl}/models`, { headers: { authorization: `Bearer ${apiKey}` } });
  if (!res.ok) throw new Error(`model list HTTP ${res.status}`);
  const data = await res.json();
  const ids: string[] = (data.data || data.models || []).map((m: any) => (m.id || m.name || "").replace(/^models\//, "")).filter(Boolean);
  const best = ids.filter((i) => i !== exclude).map((i) => [i, scoreModel(i, provider)] as const).filter(([, s]) => s >= 0).sort((a, b) => b[1] - a[1])[0];
  if (!best) throw new Error("no suitable model");
  return best[0];
}
const isModelError = (status: number, body: string) =>
  [400, 403, 404, 410, 422].includes(status) && /model|not.?found|decommission|deprecat|no longer|not available|does not exist|unsupported/i.test(body);

// ---------- auth helpers ----------
// Accounts have no email: the account key (ofa_…) lives on the user's PC; only its hash is stored.
async function accountFromReq(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token.startsWith("ofa_")) return null;
  const { data } = await db.from("offload_accounts").select("id").eq("key_hash", await sha256(token)).maybeSingle();
  if (data) db.from("offload_accounts").update({ last_seen_at: new Date().toISOString() }).eq("id", data.id).then(() => {});
  return data?.id ?? null;
}
async function accessKeyFromReq(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!token.startsWith("ofk_")) return null;
  const { data } = await db.from("offload_access_keys").select("*").eq("key_hash", await sha256(token)).eq("revoked", false).maybeSingle();
  return data;
}

// ---------- OpenAI-compatible proxy ----------
async function chatCompletions(req: Request, ak: any) {
  let body: any;
  try { body = await req.json(); } catch { return oaiError("Invalid JSON body", 400); }
  if (!Array.isArray(body.messages)) return oaiError("`messages` is required", 400);

  const { data: rows } = await db.from("offload_provider_keys").select("provider, enc_key").eq("user_id", ak.user_id);
  let keys = (rows || []).filter((r) => PROVIDERS[r.provider]);
  if (ak.providers?.length) keys = keys.filter((r) => ak.providers.includes(r.provider));
  // Optional routing: model "groq" or "groq:<model>" forces a provider; "auto"/empty = fallback over all.
  const requested: string = body.model || "auto";
  const [forcedProvider, forcedModel] = requested.includes(":") && PROVIDERS[requested.split(":")[0]]
    ? [requested.split(":")[0], requested.split(":").slice(1).join(":")]
    : PROVIDERS[requested] ? [requested, ""] : ["", requested === "auto" ? "" : requested];
  if (forcedProvider) keys = keys.filter((r) => r.provider === forcedProvider);
  if (!keys.length) return oaiError("No provider keys available for this offload key. Add keys in the Offload Cloud dashboard.", 400);

  const inChars = JSON.stringify(body.messages).length;
  const errors: string[] = [];
  for (const row of keys) {
    const p = PROVIDERS[row.provider];
    let apiKey: string;
    try { apiKey = await decrypt(row.enc_key); } catch { errors.push(`${row.provider}: cannot decrypt key`); continue; }
    const cacheKey = `${ak.user_id}:${row.provider}`;
    let model = forcedModel || modelCache.get(cacheKey) || p.model;

    for (let attempt = 0; attempt < 2; attempt++) {
      const upstream = await fetch(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ ...body, model }), // everything else passed through unchanged
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e), body: null, headers: new Headers() }) as any);

      if (upstream.ok) {
        db.from("offload_access_keys").update({ last_used_at: new Date().toISOString() }).eq("id", ak.id).then(() => {});
        if (body.stream) {
          db.from("offload_usage").insert({ user_id: ak.user_id, access_key_id: ak.id, provider: row.provider, model, in_chars: inChars }).then(() => {});
          return new Response(upstream.body, { headers: { ...CORS, "content-type": "text/event-stream", "x-offload-provider": row.provider, "x-offload-model": model } });
        }
        const data = await upstream.json();
        const outChars = (data.choices?.[0]?.message?.content || "").length;
        db.from("offload_usage").insert({ user_id: ak.user_id, access_key_id: ak.id, provider: row.provider, model, in_chars: inChars, out_chars: outChars }).then(() => {});
        data.offload = { provider: row.provider, model };
        return json(data);
      }
      const text = await upstream.text().catch(() => "");
      // Model retired, or this model is overloaded/rate-limited → try another model of the same provider once.
      if (attempt === 0 && !forcedModel && (isModelError(upstream.status, text) || upstream.status === 503 || upstream.status === 429)) {
        try { model = await discoverModel(row.provider, apiKey, model); modelCache.set(cacheKey, model); continue; } catch { /* fall through */ }
      }
      errors.push(`${row.provider} (${model}): HTTP ${upstream.status} ${text.slice(0, 120)}`);
      break;
    }
  }
  return oaiError(`All providers failed → ${errors.join(" | ")}`, 502, "upstream_error");
}

// ---------- dashboard / CLI API (account key ofa_…) ----------
async function api(req: Request, path: string[], userId: string) {
  const [resource, id] = path;
  if (req.method === "GET" && resource === "state") {
    const [pk, ak, usage] = await Promise.all([
      db.from("offload_provider_keys").select("provider, hint, created_at").eq("user_id", userId),
      db.from("offload_access_keys").select("id, name, prefix, providers, docs, revoked, created_at, last_used_at").eq("user_id", userId).order("created_at"),
      db.from("offload_usage").select("access_key_id, in_chars, out_chars").eq("user_id", userId).limit(10000),
    ]);
    const perKey: Record<string, { calls: number; tokens: number }> = {};
    let calls = 0, tokens = 0;
    for (const u of usage.data || []) {
      const t = Math.round((u.in_chars + u.out_chars) / 4);
      calls++; tokens += t;
      const k = (perKey[u.access_key_id || "-"] ||= { calls: 0, tokens: 0 });
      k.calls++; k.tokens += t;
    }
    return json({
      providers: Object.entries(PROVIDERS).map(([id, p]) => ({ id, name: p.name, signup: p.signup, ...(pk.data || []).find((r) => r.provider === id) && { saved: true, hint: (pk.data || []).find((r) => r.provider === id)!.hint } })),
      accessKeys: (ak.data || []).map((k) => ({ ...k, usage: perKey[k.id] || { calls: 0, tokens: 0 } })),
      usage: { calls, tokens },
    });
  }
  if (resource === "provider-keys" && req.method === "PUT") {
    const { provider, key } = await req.json();
    if (!PROVIDERS[provider]) return json({ error: "unknown provider" }, 400);
    if (typeof key !== "string" || key.trim().length < 10) return json({ error: "invalid key" }, 400);
    const test = await fetch(`${PROVIDERS[provider].baseUrl}/models`, { headers: { authorization: `Bearer ${key.trim()}` } });
    if (test.status === 401 || test.status === 403) return json({ error: "The provider rejected this key" }, 400);
    const { error } = await db.from("offload_provider_keys").upsert(
      { user_id: userId, provider, enc_key: await encrypt(key.trim()), hint: key.trim().slice(-4) },
      { onConflict: "user_id,provider" },
    );
    return error ? json({ error: error.message }, 500) : json({ ok: true });
  }
  if (resource === "provider-keys" && req.method === "DELETE" && id) {
    await db.from("offload_provider_keys").delete().eq("user_id", userId).eq("provider", id);
    return json({ ok: true });
  }
  if (resource === "access-keys" && req.method === "POST") {
    const { name, providers = [], docs = "" } = await req.json();
    const key = randomKey();
    const { data, error } = await db.from("offload_access_keys").insert({
      user_id: userId, name: String(name || "My key").slice(0, 80), prefix: key.slice(0, 10),
      key_hash: await sha256(key), providers: providers.filter((p: string) => PROVIDERS[p]), docs: String(docs).slice(0, 20000),
    }).select("id").single();
    return error ? json({ error: error.message }, 500) : json({ id: data.id, key }); // plaintext key shown exactly once
  }
  if (resource === "access-keys" && req.method === "PATCH" && id) {
    const b = await req.json();
    const patch: Record<string, unknown> = {};
    if (typeof b.name === "string") patch.name = b.name.slice(0, 80);
    if (typeof b.docs === "string") patch.docs = b.docs.slice(0, 20000);
    if (Array.isArray(b.providers)) patch.providers = b.providers.filter((p: string) => PROVIDERS[p]);
    if (typeof b.revoked === "boolean") patch.revoked = b.revoked;
    await db.from("offload_access_keys").update(patch).eq("user_id", userId).eq("id", id);
    return json({ ok: true });
  }
  if (resource === "access-keys" && req.method === "DELETE" && id) {
    await db.from("offload_access_keys").delete().eq("user_id", userId).eq("id", id);
    return json({ ok: true });
  }
  return json({ error: "not found" }, 404);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  const url = new URL(req.url);
  const parts = url.pathname.split("/").filter(Boolean);
  const i = parts.indexOf("offload-cloud");
  const path = i >= 0 ? parts.slice(i + 1) : parts;

  try {
    if (path[0] === "v1") {
      const ak = await accessKeyFromReq(req);
      if (!ak) return oaiError("Invalid or revoked offload key", 401, "authentication_error");
      if (path[1] === "chat" && path[2] === "completions" && req.method === "POST") return await chatCompletions(req, ak);
      if (path[1] === "models") {
        const { data } = await db.from("offload_provider_keys").select("provider").eq("user_id", ak.user_id);
        const ids = ["auto", ...(data || []).map((r) => r.provider).filter((p) => !ak.providers?.length || ak.providers.includes(p))];
        return json({ object: "list", data: ids.map((id) => ({ id, object: "model", owned_by: "offload" })) });
      }
      if (path[1] === "key-info") return json({ name: ak.name, docs: ak.docs, providers: ak.providers });
      return oaiError("Not found", 404);
    }
    if (path[0] === "api") {
      if (path[1] === "register" && req.method === "POST") {
        const accountKey = randomKey("ofa_");
        const { data, error } = await db.from("offload_accounts").insert({ key_hash: await sha256(accountKey) }).select("id").single();
        return error ? json({ error: error.message }, 500) : json({ accountKey, id: data.id });
      }
      const userId = await accountFromReq(req);
      if (!userId) return json({ error: "unauthorized" }, 401);
      return await api(req, path.slice(1), userId);
    }
    return json({ service: "offload-cloud", docs: "https://github.com/ok6416411-source/offload-mcp/blob/main/cloud/README.md" });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});
