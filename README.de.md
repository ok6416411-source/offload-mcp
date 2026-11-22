# offload-mcp 🪶 – Deutsche Anleitung

**Mehr aus deinem Claude-Limit holen.** Claude gibt Routinearbeit an kostenlose KI-Anbieter ab (Groq, Gemini, Cerebras, Mistral, NVIDIA, OpenRouter) und liest nur noch die kurze Antwort. Dadurch verbraucht Claude deutlich weniger Tokens.

## Einrichtung (ca. 5 Minuten)

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

## Werkzeuge
- **offload_files**: Große Dateien liest ein Gratis-Modell, Claude bekommt nur die Antwort. Spart am meisten.
- **offload**: Entwürfe, Übersetzungen, Boilerplate.
- **offload_batch**: Eine Anweisung auf viele Einträge gleichzeitig.
- **list_providers**: Übersicht und gesparte Tokens.

## Wichtig
- Gratis-Modelle sind schwächer als Claude. Für Fleißarbeit nutzen, das Denken bleibt bei Claude.
- Ausgelagerte Dateien gehen an den jeweiligen Anbieter. Keine Geheimnisse auslagern und die Datenschutzregeln der Anbieter beachten (manche Gratis-Angebote nutzen Daten zum Training).
- Nutzungsbedingungen der Anbieter einhalten: ein Konto pro Anbieter.
- Sprache: automatisch Systemsprache, sonst `OFFLOAD_LANG=de`. Star-Hinweis ausblenden: `OFFLOAD_NO_STAR=1`.

⭐ Wenn dir das Tokens spart, gib dem Projekt gern einen Stern auf GitHub!
