// Persistent savings counter in ~/.offload-mcp/stats.json so users see the benefit over time.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { t } from "./i18n.js";

const DIR = process.env.OFFLOAD_HOME || path.join(os.homedir(), ".offload-mcp");
const FILE = path.join(DIR, "stats.json");
// Rough value of a Claude token, for illustration only (blended Opus-class API price per token).
const USD_PER_TOKEN = Number(process.env.OFFLOAD_USD_PER_MTOK || 15) / 1e6;

let total = { tokens: 0, calls: 0, since: new Date().toISOString().slice(0, 10) };
try { total = { ...total, ...JSON.parse(readFileSync(FILE, "utf8")) }; } catch {}
const session = { tokens: 0, calls: 0 };

export const estimateTokens = (chars) => Math.max(0, Math.round(chars / 4));

export function record(tokens) {
  session.tokens += tokens; session.calls++;
  total.tokens += tokens; total.calls++;
  try { mkdirSync(DIR, { recursive: true }); writeFileSync(FILE, JSON.stringify(total)); } catch {}
}

const fmt = (n) => n.toLocaleString();
const usd = (n) => `$${(n * USD_PER_TOKEN).toFixed(2)}`;

export function footer(thisCall) {
  return `💰 ${t("footerThis")}: ~${fmt(thisCall)} · ${t("footerSession")}: ~${fmt(session.tokens)} · ${t("footerTotal")}: ~${fmt(total.tokens)} ${t("tokens")} (≈ ${usd(total.tokens)})`;
}

export function report() {
  const bar = (n, max) => "█".repeat(Math.max(1, Math.round((n / Math.max(max, 1)) * 20)));
  const max = Math.max(session.tokens, total.tokens);
  return [
    `## 💰 ${t("reportTitle")}`,
    ``,
    `${t("footerSession").padEnd(12)} ${bar(session.tokens, max)} ~${fmt(session.tokens)} ${t("tokens")} (${session.calls} ${t("calls")}, ≈ ${usd(session.tokens)})`,
    `${t("footerTotal").padEnd(12)} ${bar(total.tokens, max)} ~${fmt(total.tokens)} ${t("tokens")} (${total.calls} ${t("calls")}, ≈ ${usd(total.tokens)}) – ${t("since")} ${total.since}`,
    ``,
    `_${t("reportNote")}_`,
  ].join("\n");
}

export const totals = () => ({ session: { ...session }, total: { ...total } });
