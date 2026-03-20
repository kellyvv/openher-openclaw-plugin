# OpenHer × OpenClaw Plugin

> **Personality is computed, not described.**

OpenClaw plugin that integrates the [OpenHer Persona Engine](https://github.com/kellyvv/OpenHer) into your OpenClaw agent. Every message passes through a full neural network lifecycle — producing personality that emerges from computation, not hardcoded prompts.

## Quick Start

```bash
# 1. Install the plugin
openclaw plugins install -l ./extensions/openher

# 2. Set a recommended model
openclaw config set agents.defaults.model "minimax/MiniMax-M2.7"

# 3. Start the OpenHer backend (in a separate terminal)
cd <openher-dir> && python -m uvicorn main:app --port 8800

# 4. Start the gateway
openclaw gateway start
```

## What It Does

```
User → OpenClaw → openher_chat tool → Persona Engine → Reply
```

The persona engine runs a full 13-step pipeline per message:

1. **Critic** (LLM) — Evaluates the user's emotional intent
2. **Drive Metabolism** — Updates 5D internal needs (connection, novelty, expression, safety, play)
3. **Neural Network** — 25D→24D→8D signal computation (directness, vulnerability, playfulness, etc.)
4. **KNN Memory** — Retrieves similar past interactions with gravitational weighting
5. **Actor** (LLM) — Generates reply conditioned on all computed state
6. **Hebbian Learning** — Adjusts neural weights based on interaction reward

## Configuration

| Key | Default | Description |
|-----|---------|-------------|
| `OPENHER_API_URL` | `http://localhost:8800` | OpenHer backend URL |
| `OPENHER_DEFAULT_PERSONA` | `luna` | Default persona ID |
| `OPENHER_MODE` | `hybrid` | `hybrid` = keep OpenClaw tools; `exclusive` = pure persona chat |

## Recommended Models

| Model | Quality | Notes |
|-------|---------|-------|
| **MiniMax M2.7** | ✅ Perfect | Recommended — zero narration |
| **Claude Sonnet 4.5** | ✅ Perfect | Excellent instruction following |
| **Gemini Flash Lite** | ❌ Poor | Adds "Luna replied:" narration |

See [extensions/openher/README.md](extensions/openher/README.md) for full documentation.

## License

[MPL-2.0](LICENSE)
