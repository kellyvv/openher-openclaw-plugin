<div align="center">

<img src="docs/assets/logo_header.png" alt="OpenHer" height="80">

### OpenHer Persona Engine — OpenClaw Plugin

> **Personality is computed, not described.**

[![npm](https://img.shields.io/npm/v/@openher/openclaw-plugin?style=flat-square&color=FF6B6B)](https://www.npmjs.com/package/@openher/openclaw-plugin)
[![OpenClaw](https://img.shields.io/badge/OpenClaw-Plugin-blue?style=flat-square)](https://openclaw.ai)
[![License](https://img.shields.io/badge/License-MPL%202.0-blue?style=flat-square)](LICENSE)

</div>

---

## Install

```bash
# 1. Install the plugin
openclaw plugins install @openher/openclaw-plugin

# 2. Start the OpenHer backend (see Backend Setup below)
python main.py

# 3. Set a recommended model
openclaw config set agents.defaults.model "minimax/MiniMax-M2.7"

# 4. Start the gateway
openclaw gateway start
```

That's it. Every message now passes through a full neural-network personality engine.

---

## What This Plugin Does

```
User → OpenClaw → openher_chat tool → Persona Engine (13-step pipeline) → Reply
```

The plugin provides two tools to OpenClaw:

| Tool | Description |
|------|-------------|
| `openher_chat` | Send a message through the full persona engine lifecycle |
| `openher_status` | Query a persona's current emotional state (zero-cost, no LLM call) |

Plus a **persona proxy mode** via `before_prompt_build` hook — the persona's personality state is injected into every OpenClaw response, making even normal chat feel like talking to a living character.

---

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `OPENHER_API_URL` | `http://localhost:8800` | OpenHer backend URL |
| `OPENHER_DEFAULT_PERSONA` | `luna` | Default persona ID |
| `OPENHER_MODE` | `hybrid` | `hybrid` = keep OpenClaw tools; `exclusive` = pure persona chat |

---

## Recommended Models

| Model | Quality | Notes |
|-------|:-------:|-------|
| **MiniMax M2.7** | ✅ | Recommended — zero narration, perfect proxy |
| **Claude Sonnet 4.5** | ✅ | Excellent instruction following |
| **Gemini Flash Lite** | ❌ | Adds "Luna replied:" narration |

---

## Available Personas

| Character | Type | Highlights |
|:----------|:-----|:-----------|
| 🌸 **Luna** (陆暖) | ENFP | Freelance illustrator, curious about everything |
| 📝 **Iris** (苏漫) | INFP | Poetry major, quiet but devastatingly perceptive |
| 💼 **Vivian** (顾霆微) | INTJ | Tech executive, logic 10/10 |
| 🔧 **Kai** (沈凯) | ISTP | Few words, reliable hands |
| 🗡️ **Kelly** (柯砺) | ENTP | Sharp-tongued, will debate anything |
| 🔥 **Ember** | INFP | Speaks through silence and poetry |
| 🌊 **Sora** (顾清) | INFJ | Sees through you before you finish |
| 🎉 **Mia** | ESFP | Pure energy, drags you out of your shell |
| 👑 **Rex** | ENTJ | The room changes when he walks in |
| ✨ **Nova** (诺瓦) | ENFP | Her mind works in colors you haven't seen |

> Personalities **emerge** from each character's neural network seed and drive baseline — not from prompt descriptions.

→ Create your own: [Persona Creation Guide](docs/persona_creation_guide.md)

---

## How the Engine Works

<div align="center">
<img src="docs/assets/architecture.png" alt="Architecture" width="85%">
</div>

Each message triggers a 13-step pipeline:

1. **Critic** (LLM) — Evaluates the user's emotional intent into 8D context
2. **Drive Metabolism** — Updates 5 internal needs (connection, novelty, expression, safety, play) with real-time decay
3. **Neural Network** — 25D→24D→8D signal computation (directness, vulnerability, playfulness, warmth, etc.)
4. **KNN Memory** — Retrieves similar past interactions with gravitational weighting
5. **Actor** (LLM) — Generates reply conditioned on all computed state
6. **Hebbian Learning** — Adjusts neural weights based on interaction reward

**No line of prompt describes her personality.** It emerges from drives × neural weights × lived experience.

---

## Backend Setup

The plugin connects to an OpenHer backend server. This repo includes the full backend:

```bash
# Clone and install
git clone https://github.com/kellyvv/openher-openclaw-plugin.git
cd openher-openclaw-plugin
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# Configure (set at least one LLM provider key)
cp .env.example .env

# Start
python main.py
# → Uvicorn running on http://0.0.0.0:8800
```

Supported LLM providers: Gemini · Claude · Qwen · GPT · MiniMax · Moonshot · StepFun · Ollama

---

## License

[MPL-2.0](LICENSE)

<div align="center">

**Built with 🧬 by the OpenHer team**

*Personality is not a prompt. It's a living process.*

</div>
