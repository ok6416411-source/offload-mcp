# offload-mcp 🪶 – Deutsche Anleitung

**Mehr aus deinem Claude-Limit holen.** Claude gibt Routinearbeit an kostenlose KI-Anbieter ab (Groq, Gemini, Cerebras, Mistral, NVIDIA, OpenRouter) und liest nur noch die kurze Antwort. Dadurch verbraucht Claude deutlich weniger Tokens.

## ⚡ Schnelleinrichtung (1 Befehl)

Voraussetzung: [Node.js](https://nodejs.org) (LTS). Dann ein Terminal öffnen (Windows: `Win + R` → `cmd` → Enter) und eingeben:

```bash
npx -y github:ok6416411-source/offload-mcp setup
```

Im Browser öffnet sich ein Fenster → kostenlose API-Keys einfügen → **Speichern**. Claude Desktop komplett beenden und neu starten. Fertig!
(Claude Code wird automatisch mit eingerichtet, falls installiert.)

Oder sag einfach Claude Code: *„Führ `npx -y github:ok6416411-source/offload-mcp setup` für mich aus.“*

## Manuelle Einrichtung

### 1. Node.js installieren
Falls noch nicht vorhanden: https://nodejs.org (LTS-Version).

### 2. Mindestens einen kostenlosen API-Key holen
| Anbieter | Key holen |
|---|---|
| Google Gemini (empfohlen, liest ganze Dateien) | https://aistudio.google.com/apikey |
| Groq | https://console.groq.com/keys |
| Cerebras | https://cloud.cerebras.ai |
| Mistral | https://console.mistral.ai/api-keys |
| NVIDIA NIM | https://build.nvidia.com |
| OpenRouter | https://openrouter.ai/keys |

Je mehr Keys, desto mehr Gratis-Kapazität. Ist ein Anbieter am Limit, übernimmt automatisch der nächste.

### 3. In Claude Desktop eintragen
*Einstellungen → Entwickler → Konfiguration bearbeiten* öffnet `claude_desktop_config.json`. Dort einfügen:

```json
{
  "mcpServers": {
    "offload": {
      "command": "npx",
      "args": ["-y", "github:ok6416411-source/offload-mcp"],
      "env": {
        "GEMINI_API_KEY": "dein-key",
        "GROQ_API_KEY": "dein-key",
        "NVIDIA_API_KEY": "dein-key"
      }
    }
  }
}
```
Nicht genutzte Zeilen einfach weglassen. Claude Desktop neu starten und testen mit: *„Zeig mir deine Offload-Anbieter“*.

**Claude Code:** `claude mcp add offload -e GEMINI_API_KEY=dein-key -- npx -y github:ok6416411-source/offload-mcp`

### 4. Claude sagen, dass es das nutzen soll
In die Projekt-Anweisungen bzw. `CLAUDE.md`:
> Nutze für große Dateien, Logs und Massen-Textaufgaben die Offload-Tools, statt die Inhalte selbst zu lesen.

## ☁️ Offload Cloud (optional)

Speichere deine eigenen Keys einmal verschlüsselt im [Offload-Cloud-Dashboard](https://ok6416411-source.github.io/offload-mcp/) und nutze dann **einen `ofk_…`-Key** auf allen Geräten, auch in eigenen Apps oder auf deiner Website (OpenAI-kompatibel). Rolle und Systemanweisung bestimmt deine App, Offload fügt nichts hinzu. Wichtig: Den Key nur serverseitig verwenden, nie im Browser-Code. → [Doku](cloud/README.md)

## So siehst du, was es bringt 💰

Unter jeder ausgelagerten Aufgabe zeigt Claude dir die Ersparnis:

```
Zusammenfassung: 3 Fehler in auth.log gefunden (Zeilen 812, 1440, 2977) …
— via gemini/gemini-2.5-flash
💰 dieser Aufruf: ~11.723 · Sitzung: ~18.402 · gesamt: ~240.118 Claude-Tokens (≈ $3.60)
```

Frag Claude *„Wie viel hat mir offload gespart?“*, dann bekommst du einen kompletten Bericht. Der Gesamtzähler wird in `~/.offload-mcp/stats.json` gespeichert.

## Werkzeuge
- **offload_files**: Große Dateien liest ein Gratis-Modell, Claude bekommt nur die Antwort. Spart am meisten.
- **offload**: Entwürfe, Übersetzungen, Boilerplate.
- **offload_batch**: Eine Anweisung auf viele Einträge gleichzeitig.
- **list_providers**: Übersicht der Anbieter.
- **savings_report**: Wie viele Claude-Tokens bisher gespart wurden.

## Modelle aktualisieren sich selbst
Wenn ein Anbieter ein Modell abschaltet oder umbenennt, sucht offload-mcp automatisch ein aktuelles Gratis-Modell beim selben Anbieter. Du musst nichts tun.

## Wichtig
- Gratis-Modelle sind schwächer als Claude. Für Fleißarbeit nutzen, das Denken bleibt bei Claude.
- Ausgelagerte Dateien gehen an den jeweiligen Anbieter. Keine Geheimnisse auslagern und die Datenschutzregeln der Anbieter beachten (manche Gratis-Angebote nutzen Daten zum Training).
- Nutzungsbedingungen der Anbieter einhalten: ein Konto pro Anbieter.
- Sprache: automatisch Systemsprache, sonst `OFFLOAD_LANG=de`. Star-Hinweis ausblenden: `OFFLOAD_NO_STAR=1`.

⭐ Wenn dir das Tokens spart, gib dem Projekt gern einen Stern auf GitHub!
