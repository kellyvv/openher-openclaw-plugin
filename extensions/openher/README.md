# OpenHer Persona Engine — OpenClaw Plugin

> **Personality is computed, not described.**

This plugin bridges the [OpenHer](https://github.com/kellyvv/OpenHer) Persona Engine to the OpenClaw ecosystem. Each persona runs through a full neural-network-driven lifecycle on every message:

```
User Message → Critic(LLM) → Metabolism(physics) → Signals(NN) → KNN(memory) → Actor(LLM) → Hebbian(learning)
```

## Installation

```bash
# From npm
npm install @openher/openclaw-plugin

# Or install locally
openclaw plugins install -l ./extensions/openher
```

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `OPENHER_API_URL` | `http://localhost:8800` | OpenHer backend URL |
| `OPENHER_DEFAULT_PERSONA` | `luna` | Default persona ID |
| `OPENHER_MODE` | `hybrid` | `hybrid` = preserve OpenClaw capabilities; `exclusive` = pure persona proxy |

### Proxy Modes

- **`hybrid`** (default) — Appends persona proxy instructions to OpenClaw's system prompt. The LLM retains all other capabilities (file editing, commands, etc.) while being told to present persona replies verbatim. Works great with MiniMax M2.7, Claude, and other strong models.

- **`exclusive`** — Completely overrides the system prompt. The LLM becomes a pure persona proxy — nothing else. Best persona fidelity, but other OpenClaw tools stop working. Use this for dedicated persona chat bots.

## Tools

| Tool | Description | LLM Cost |
|------|-------------|----------|
| `openher_chat` | Full 13-step engine conversation | ✅ 2 LLM calls (Critic + Actor) |
| `openher_status` | Query personality state | ❌ Zero |

## Features

- **Health check on startup** — Plugin verifies the OpenHer backend is reachable when the gateway starts. Shows a clear warning if not.
- **Friendly error messages** — If the backend goes down mid-conversation, the tool returns a human-readable message with instructions to restart it.
- **Request timeouts** — All HTTP calls have configurable timeouts with AbortController instead of hanging forever.

## Engine Architecture

The persona engine computes personality through:

- **25D→24D→8D Neural Network** — Random seed → deterministic weights (W1, W2), producing 8 behavioral signals (directness, vulnerability, playfulness, initiative, depth, warmth, defiance, curiosity)
- **5D Drive Metabolism** — Time-dependent frustration with cooling, hunger, and elastic baseline evolution (connection, novelty, expression, safety, play)
- **Hebbian Learning** — Reward-driven weight updates after each interaction
- **KNN Style Memory** — Retrieval with gravitational mass weighting and Hawking radiation decay
- **Genesis Seeds** — ~35 pre-computed innate style memories per persona for first-turn voice
- **Thermodynamic Noise** — Frustration-driven behavioral randomness

Different personas (Luna, Vivian, Kai, etc.) have different drive baselines, engine parameters, and genesis seeds — producing fundamentally different computed personalities from the same engine.

## Recommended Models

The OpenClaw LLM acts as a "proxy" that forwards user messages to the persona engine and presents its reply. **Stronger models follow the proxy instructions better**, producing clean first-person output instead of wrapping replies in narration like `"Luna said: ..."`.

| Model | Proxy Quality | Notes |
|-------|---------------|-------|
| **MiniMax M2.7** | ✅ Perfect | Recommended. Clean first-person, zero narration |
| **Claude Sonnet 4.5+** | ✅ Perfect | Excellent instruction following |
| **GPT-5.2+** | ✅ Good | Occasional minor formatting |
| **Gemini 2.5 Flash** | ⚠️ Good | Mostly follows, rare narration |
| **Gemini Flash Lite** | ❌ Poor | Frequently adds "Luna replied:" narration |

> **Quick recommendation:** Set your OpenClaw model to `minimax/MiniMax-M2.7` for the best persona experience:
> ```bash
> openclaw config set agents.defaults.model "minimax/MiniMax-M2.7"
> ```

## Requirements

- OpenHer backend running (`python main.py` or `uvicorn main:app`)
- Python 3.10+ with all OpenHer dependencies
