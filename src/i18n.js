// Language follows OFFLOAD_LANG, then the OS locale. English is the fallback.
const STRINGS = {
  en: {
    noProvider: "No provider configured. Set at least one API key, e.g. GEMINI_API_KEY. See README.",
    allFailed: "All providers failed",
    getKey: "get a key",
    calls: "calls",
    failures: "failures",
    saved: "Claude tokens saved",
    totalSaved: "Estimated input tokens kept out of Claude",
    truncated: "truncated",
    footerThis: "this call", footerSession: "session", footerTotal: "total", tokens: "Claude tokens",
    reportTitle: "Claude tokens saved by offload-mcp", since: "since",
    reportNote: "Estimate: ~4 characters per token. $ value assumes Claude API pricing (OFFLOAD_USD_PER_MTOK) – on a subscription it means more room before you hit your limit.",
    star: "⭐ offload-mcp has saved you ~{n} Claude tokens so far. If it helps, a GitHub star keeps it going: {url}",
  },
  de: {
    noProvider: "Kein Anbieter eingerichtet. Setze mindestens einen API-Key, z. B. GEMINI_API_KEY. Siehe README.",
    allFailed: "Alle Anbieter sind fehlgeschlagen",
    getKey: "Key holen",
    calls: "Aufrufe",
    failures: "Fehler",
    saved: "Claude-Tokens gespart",
    totalSaved: "Geschätzte Eingabe-Tokens, die Claude nicht lesen musste",
    truncated: "gekürzt",
    footerThis: "dieser Aufruf", footerSession: "Sitzung", footerTotal: "gesamt", tokens: "Claude-Tokens",
    reportTitle: "Durch offload-mcp gesparte Claude-Tokens", since: "seit",
    reportNote: "Schätzung: ~4 Zeichen pro Token. Der $-Wert basiert auf Claude-API-Preisen (OFFLOAD_USD_PER_MTOK) – im Abo heißt das: mehr Luft bis zum Limit.",
    star: "⭐ offload-mcp hat dir bisher ~{n} Claude-Tokens gespart. Wenn es dir hilft, freut sich das Projekt über einen GitHub-Star: {url}",
  },
};

export function detectLang(env = process.env) {
  const raw =
    env.OFFLOAD_LANG ||
    env.LC_ALL || env.LC_MESSAGES || env.LANG ||
    Intl.DateTimeFormat().resolvedOptions().locale || "en";
  const code = raw.toLowerCase().slice(0, 2);
  return STRINGS[code] ? code : "en";
}

const lang = detectLang();
export function t(key, vars = {}) {
  let s = STRINGS[lang][key] ?? STRINGS.en[key];
  for (const [k, v] of Object.entries(vars)) s = s.replace(`{${k}}`, v);
  return s;
}
