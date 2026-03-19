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

## Tools

| Tool | Description | LLM Cost |
|------|-------------|----------|
| `openher_chat` | Full 13-step engine conversation | ✅ 2 LLM calls (Critic + Actor) |
| `openher_status` | Query personality state | ❌ Zero |
| `openher_switch` | Switch active persona | ❌ Zero |
| `openher_proactive_tick` | Trigger autonomous message | ✅ 2 LLM calls (frozen learning) |

## Engine Architecture

The persona engine computes personality through:

- **25D→24D→8D Neural Network** — Random seed → deterministic weights (W1, W2), producing 8 behavioral signals (directness, vulnerability, playfulness, initiative, depth, warmth, defiance, curiosity)
- **5D Drive Metabolism** — Time-dependent frustration with cooling, hunger, and elastic baseline evolution (connection, novelty, expression, safety, play)
- **Hebbian Learning** — Reward-driven weight updates after each interaction
- **KNN Style Memory** — Retrieval with gravitational mass weighting and Hawking radiation decay
- **Genesis Seeds** — ~35 pre-computed innate style memories per persona for first-turn voice
- **Thermodynamic Noise** — Frustration-driven behavioral randomness

Different personas (Luna, Vivian, Kai, etc.) have different drive baselines, engine parameters, and genesis seeds — producing fundamentally different computed personalities from the same engine.

## Requirements

- OpenHer backend running (`python main.py` or `uvicorn main:app`)
- Python 3.10+ with all OpenHer dependencies
