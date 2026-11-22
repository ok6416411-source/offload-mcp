// Setup wizard: `npx -y github:ok6416411-source/offload-mcp setup`
// Opens a local page to paste API keys, then writes them into Claude Desktop's config (and Claude Code, if installed).
import http from "node:http";
import { readFile, writeFile, mkdir, copyFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { spawn, spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { PROVIDERS } from "./providers.js";

const REPO = "github:ok6416411-source/offload-mcp";
const REPO_URL = "https://github.com/ok6416411-source/offload-mcp";

export function configPath() {
  const home = os.homedir();
  if (process.platform === "win32") return path.join(process.env.APPDATA || path.join(home, "AppData", "Roaming"), "Claude", "claude_desktop_config.json");
  if (process.platform === "darwin") return path.join(home, "Library", "Application Support", "Claude", "claude_desktop_config.json");
  return path.join(home, ".config", "Claude", "claude_desktop_config.json");
}

async function readConfig(file) {
  try { return JSON.parse(await readFile(file, "utf8")); } catch { return {}; }
}

export function mergeConfig(cfg, env) {
  const out = { ...cfg, mcpServers: { ...(cfg.mcpServers || {}) } };
  out.mcpServers.offload = { command: "npx", args: ["-y", REPO], env };
  return out;
}

async function save(keys) {
  const env = {};
  for (const p of PROVIDERS) if (keys[p.keyEnv]?.trim()) env[p.keyEnv] = keys[p.keyEnv].trim();
  if (!Object.keys(env).length) throw new Error("no-keys");
  const file = configPath();
  await mkdir(path.dirname(file), { recursive: true });
  if (existsSync(file)) await copyFile(file, file + ".backup");
  const cfg = await readConfig(file);
  // keep existing keys if a field was left empty on re-run
  const prev = cfg.mcpServers?.offload?.env || {};
  await writeFile(file, JSON.stringify(mergeConfig(cfg, { ...prev, ...env }), null, 2));

  let claudeCode = false;
  const shell = process.platform === "win32";
  if (spawnSync("claude", ["--version"], { shell, stdio: "ignore" }).status === 0) {
    spawnSync("claude", ["mcp", "remove", "offload", "-s", "user"], { shell, stdio: "ignore" });
    const args = ["mcp", "add", "offload", "-s", "user"];
    for (const [k, v] of Object.entries({ ...prev, ...env })) args.push("-e", `${k}=${v}`);
    args.push("--", "npx", "-y", REPO);
    claudeCode = spawnSync("claude", args, { shell, stdio: "ignore" }).status === 0;
  }
  return { file, claudeCode };
}

function page(existing) {
  const rows = PROVIDERS.map((p) => `
    <label><span><b>${p.name}</b> <a href="${p.signup}" target="_blank" data-t="get">Key holen ↗</a></span>
    <input name="${p.keyEnv}" type="password" autocomplete="off" placeholder="${existing[p.keyEnv] ? "••••••• (gespeichert)" : p.keyEnv}"></label>`).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>offload-mcp setup</title>
<style>
body{font:15px system-ui,sans-serif;background:#141414;color:#eee;display:flex;justify-content:center;padding:40px 16px}
main{max-width:520px;width:100%}h1{margin:0 0 4px}p{color:#aaa}
label{display:flex;flex-direction:column;gap:6px;margin:14px 0}label span{display:flex;justify-content:space-between}
a{color:#d97757}input{padding:10px;border-radius:8px;border:1px solid #333;background:#1e1e1e;color:#eee;font:inherit}
button{margin-top:16px;width:100%;padding:12px;border:0;border-radius:8px;background:#d97757;color:#fff;font:600 16px system-ui;cursor:pointer}
#msg{margin-top:18px;padding:12px;border-radius:8px;display:none}.ok{background:#1d3b25}.err{background:#4a1f1f}
</style></head><body><main>
<h1>🪶 offload-mcp</h1>
<p data-t="intro">Trag mindestens einen kostenlosen API-Key ein. Empfohlen: Google Gemini. Mehr Keys = mehr Gratis-Kapazität.</p>
<form id="f">${rows}<button data-t="save">Speichern & einrichten</button></form>
<div id="msg"></div>
<p style="margin-top:28px;font-size:13px"><span data-t="star">Gefällt es dir? Gib dem Projekt einen ⭐ auf</span> <a href="${REPO_URL}" target="_blank">GitHub</a></p>
</main><script>
const de = (navigator.language||"en").startsWith("de");
const EN = {get:"Get key ↗",intro:"Enter at least one free API key. Recommended: Google Gemini. More keys = more free capacity.",save:"Save & set up",star:"Like it? Give the project a ⭐ on"};
if(!de){document.documentElement.lang="en";document.querySelectorAll("[data-t]").forEach(e=>e.textContent=EN[e.dataset.t]);
document.querySelectorAll("input").forEach(i=>i.placeholder=i.placeholder.replace("(gespeichert)","(saved)"));}
f.onsubmit=async e=>{e.preventDefault();
 const r=await fetch("/save",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify(Object.fromEntries(new FormData(f)))});
 const d=await r.json();msg.style.display="block";
 if(d.ok){msg.className="ok";msg.innerHTML=(de?"✅ Fertig! Beende Claude Desktop komplett (auch im Tray) und starte es neu. Dann frag Claude: <i>„Zeig mir deine Offload-Anbieter“</i>.":"✅ Done! Fully quit Claude Desktop (also from the tray) and restart it. Then ask Claude: <i>“list your offload providers”</i>.")+(d.claudeCode?(de?"<br>Claude Code wurde auch eingerichtet.":"<br>Claude Code was set up too."):"")+"<br><small>"+d.file+"</small>";f.style.display="none";}
 else{msg.className="err";msg.textContent=d.error==="no-keys"?(de?"Bitte mindestens einen Key eintragen.":"Please enter at least one key."):d.error;}
};
</script></body></html>`;
}

function openBrowser(url) {
  const cmd = process.platform === "win32" ? "cmd" : process.platform === "darwin" ? "open" : "xdg-open";
  const args = process.platform === "win32" ? ["/c", "start", "", url] : [url];
  try { spawn(cmd, args, { stdio: "ignore", detached: true }).unref(); } catch {}
}

export async function runSetup() {
  const existing = (await readConfig(configPath())).mcpServers?.offload?.env || {};
  const server = http.createServer(async (req, res) => {
    if (req.method === "POST" && req.url === "/save") {
      let body = "";
      for await (const c of req) body += c;
      try {
        const result = await save(JSON.parse(body));
        res.end(JSON.stringify({ ok: true, ...result }));
        console.log(`✅ Saved to ${result.file}`);
        setTimeout(() => process.exit(0), 1500);
      } catch (e) {
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
      return;
    }
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.end(page(existing));
  });
  server.listen(0, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${server.address().port}`;
    console.log(`\n🪶 offload-mcp setup → ${url}\n(Opening your browser… if not, open the link above.)\n`);
    openBrowser(url);
  });
}
