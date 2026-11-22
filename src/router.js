import { activeProviders } from "./providers.js";
import { cachedModel, discoverModel } from "./models.js";
import { t } from "./i18n.js";

// Providers that hit a rate limit are skipped until their cooldown ends.
const cooldown = new Map();
export const stats = new Map(); // id -> { calls, failures, inChars, outChars }

function bump(id, key, n = 1) {
  const s = stats.get(id) || { calls: 0, failures: 0, inChars: 0, outChars: 0 };
  s[key] += n;
  stats.set(id, s);
}

// Errors that mean "this model is gone / not allowed", so another model may work.
const isModelError = (status, body) =>
  [400, 403, 404, 410, 422].includes(status) && /model|not.?found|decommission|deprecat|no longer|not available|does not exist|unsupported|access/i.test(body);

async function callOnce(p, model, { prompt, system, maxTokens }, fetchFn) {
  const res = await fetchFn(`${p.baseUrl}/chat/completions`, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      messages: [...(system ? [{ role: "system", content: system }] : []), { role: "user", content: prompt }],
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (res.ok) {
    const data = await res.json();
    return { text: data.choices?.[0]?.message?.content ?? "" };
  }
  const body = await res.text().catch(() => "");
  if (res.status === 429 || res.status >= 500) {
    const retry = Number(res.headers.get("retry-after")) || 60;
    cooldown.set(p.id, Date.now() + retry * 1000);
    return { error: `HTTP ${res.status}` };
  }
  return { error: `HTTP ${res.status}: ${body.slice(0, 160)}`, modelGone: isModelError(res.status, body) };
}

export async function complete({ prompt, system, provider, maxTokens = 2048 }, deps = {}) {
  const fetchFn = deps.fetch || globalThis.fetch;
  let list = activeProviders(deps.env);
  if (!list.length) throw new Error(t("noProvider"));
  if (provider) list = list.filter((p) => p.id === provider);
  const now = Date.now();
  const ready = list.filter((p) => (cooldown.get(p.id) || 0) <= now);
  const candidates = ready.length ? ready : list;

  const errors = [];
  for (const p of candidates) {
    let model = (!p.pinned && cachedModel(p.id)) || p.model;
    try {
      let r = await callOnce(p, model, { prompt, system, maxTokens }, fetchFn);
      if (r.modelGone && !p.pinned) {
        // Model was removed or renamed → find a current one and retry once.
        model = await discoverModel(p, fetchFn, [model]);
        r = await callOnce(p, model, { prompt, system, maxTokens }, fetchFn);
      }
      if (r.error) throw new Error(r.error);
      bump(p.id, "calls");
      bump(p.id, "inChars", prompt.length + (system?.length || 0));
      bump(p.id, "outChars", r.text.length);
      return { text: r.text, provider: p.id, model };
    } catch (e) {
      bump(p.id, "failures");
      errors.push(`${p.id} (${model}): ${e.message}`);
    }
  }
  throw new Error(`${t("allFailed")} → ${errors.join(" | ")}`);
}
