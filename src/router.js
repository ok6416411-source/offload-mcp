import { activeProviders } from "./providers.js";
import { t } from "./i18n.js";

// Providers that hit a rate limit are skipped until their cooldown ends.
const cooldown = new Map();
export const stats = new Map(); // id -> { calls, failures, inChars, outChars }

function bump(id, key, n = 1) {
  const s = stats.get(id) || { calls: 0, failures: 0, inChars: 0, outChars: 0 };
  s[key] += n;
  stats.set(id, s);
}

export async function complete({ prompt, system, provider, maxTokens = 2048 }, deps = {}) {
  const fetchFn = deps.fetch || globalThis.fetch;
  let list = activeProviders(deps.env);
  if (!list.length) {
    throw new Error(t("noProvider"));
  }
  if (provider) list = list.filter((p) => p.id === provider);
  const now = Date.now();
  const ready = list.filter((p) => (cooldown.get(p.id) || 0) <= now);
  const candidates = ready.length ? ready : list;

  const errors = [];
  for (const p of candidates) {
    try {
      const res = await fetchFn(`${p.baseUrl}/chat/completions`, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${p.apiKey}` },
        body: JSON.stringify({
          model: p.model,
          max_tokens: maxTokens,
          messages: [
            ...(system ? [{ role: "system", content: system }] : []),
            { role: "user", content: prompt },
          ],
        }),
        signal: AbortSignal.timeout(120_000),
      });
      if (res.status === 429 || res.status >= 500) {
        const retry = Number(res.headers.get("retry-after")) || 60;
        cooldown.set(p.id, Date.now() + retry * 1000);
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content ?? "";
      bump(p.id, "calls");
      bump(p.id, "inChars", prompt.length + (system?.length || 0));
      bump(p.id, "outChars", text.length);
      return { text, provider: p.id, model: p.model };
    } catch (e) {
      bump(p.id, "failures");
      errors.push(`${p.id}: ${e.message}`);
    }
  }
  throw new Error(`${t("allFailed")} → ${errors.join(" | ")}`);
}
