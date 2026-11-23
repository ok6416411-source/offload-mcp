// `npx -y github:ok6416411-source/offload-mcp cloud`
// 1. creates an Offload Cloud account (no email – a secret account key stored on this PC)
// 2. uploads the provider keys you already have in Claude Desktop's config (encrypted server-side)
// 3. creates your first offload key and opens the dashboard, already signed in
// `... cloud key "Name"` creates another offload key.
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PROVIDERS, CLOUD_URL, DASHBOARD_URL } from "./providers.js";
import { configPath } from "./setup.js";
import { detectLang } from "./i18n.js";

const API = (process.env.OFFLOAD_CLOUD_URL || CLOUD_URL).replace(/\/v1$/, "") + "/api";
const DIR = process.env.OFFLOAD_HOME || path.join(os.homedir(), ".offload-mcp");
const ACCOUNT_FILE = path.join(DIR, "account.json");
const de = detectLang() === "de";
const say = (d, e) => console.log(de ? d : e);

async function readJson(f) { try { return JSON.parse(await readFile(f, "utf8")); } catch { return null; } }

async function call(pathname, { method = "GET", body, token } = {}) {
  const res = await fetch(`${API}/${pathname}`, {
    method,
    headers: { "content-type": "application/json", ...(token && { authorization: `Bearer ${token}` }) },
    body: body && JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

export function collectLocalKeys(cfg, env = process.env) {
  const fromCfg = cfg?.mcpServers?.offload?.env || {};
  const out = {};
  for (const p of PROVIDERS) {
    if (p.id === "cloud") continue;
    const v = fromCfg[p.keyEnv] || env[p.keyEnv];
    if (v) out[p.id] = v;
  }
  return out;
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url.replace(/&/g, "^&")] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch {}
}

export async function runCloud(args = []) {
  await mkdir(DIR, { recursive: true });
  let account = (await readJson(ACCOUNT_FILE)) || {};

  if (!account.accountKey) {
    const r = await call("register", { method: "POST" });
    account = { accountKey: r.accountKey, createdAt: new Date().toISOString() };
    await writeFile(ACCOUNT_FILE, JSON.stringify(account, null, 2), { mode: 0o600 });
    say("✅ Offload-Cloud-Konto erstellt (ohne E-Mail). Der Konto-Schlüssel liegt nur auf diesem PC:", "✅ Offload Cloud account created (no email). The account key is stored only on this PC:");
    console.log(`   ${ACCOUNT_FILE}`);
  }
  const token = account.accountKey;

  // `cloud key "Name"` → just create another offload key
  if (args[0] === "key") {
    const name = args.slice(1).join(" ") || `Key ${new Date().toLocaleDateString()}`;
    const r = await call("access-keys", { method: "POST", token, body: { name } });
    say(`\n🔑 Neuer Offload-Key „${name}“ (wird nur jetzt angezeigt):\n\n   ${r.key}\n`, `\n🔑 New offload key "${name}" (shown only now):\n\n   ${r.key}\n`);
    return;
  }

  // Upload the keys you already have
  const keys = collectLocalKeys(await readJson(configPath()));
  const ids = Object.keys(keys);
  if (!ids.length) {
    say("⚠️  In deiner Claude-Konfiguration wurden keine API-Keys gefunden. Führ zuerst `... setup` aus.", "⚠️  No API keys found in your Claude config. Run `... setup` first.");
  }
  for (const id of ids) {
    try {
      await call("provider-keys", { method: "PUT", token, body: { provider: id, key: keys[id] } });
      say(`   ☁️  ${id} übertragen (verschlüsselt)`, `   ☁️  ${id} uploaded (encrypted)`);
    } catch (e) {
      say(`   ⚠️  ${id}: ${e.message}`, `   ⚠️  ${id}: ${e.message}`);
    }
  }

  // First offload key for this PC
  if (!account.firstKeyCreated) {
    const r = await call("access-keys", { method: "POST", token, body: { name: os.hostname() } });
    account.firstKeyCreated = true;
    await writeFile(ACCOUNT_FILE, JSON.stringify(account, null, 2), { mode: 0o600 });
    say(`\n🔑 Dein erster Offload-Key (wird nur jetzt angezeigt – kopieren!):\n\n   ${r.key}\n`, `\n🔑 Your first offload key (shown only now – copy it!):\n\n   ${r.key}\n`);
  }

  // Open the dashboard signed in. The key travels in the URL fragment, which is never sent to any server.
  const url = `${DASHBOARD_URL}#account=${token}`;
  say("🌐 Öffne das Dashboard (du bist dort automatisch angemeldet)…", "🌐 Opening the dashboard (you're signed in automatically)…");
  say(`   Falls nichts aufgeht: ${DASHBOARD_URL} und dort den Konto-Schlüssel aus ${ACCOUNT_FILE} einfügen.`, `   If nothing opens: ${DASHBOARD_URL} and paste the account key from ${ACCOUNT_FILE}.`);
  openBrowser(url);
}
