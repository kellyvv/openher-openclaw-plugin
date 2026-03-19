/**
 * OpenHer Tool Registration — 4 tools for OpenClaw agents.
 *
 *   openher_chat          — Full 13-step engine conversation
 *   openher_status        — Query personality state (no LLM cost)
 *   openher_switch        — Switch active persona
 *   openher_proactive_tick — Trigger drive-driven autonomous message
 */

import type { OpenHerClient } from "./client";

/**
 * Plugin/Tool context interfaces (matches OpenClaw SDK).
 */
interface PluginContext {
  config: Record<string, string>;
  registerTool(name: string, def: ToolDefinition): void;
}

interface ToolDefinition {
  description: string;
  parameters: Record<string, ParameterDef>;
  execute: (params: Record<string, string>, runCtx: RunContext) => Promise<unknown>;
}

interface ParameterDef {
  type: string;
  description: string;
  required?: boolean;
}

interface RunContext {
  userId?: string;
}

export function registerTools(
  ctx: PluginContext,
  client: OpenHerClient
): void {
  // ── openher_chat: Full 13-step persona engine conversation ──
  ctx.registerTool("openher_chat", {
    description:
      "Send a message through OpenHer's persona engine. The reply is generated " +
      "by a neural network (seed→W1/W2→8D signals) with drive metabolism, " +
      "Hebbian learning, KNN memory retrieval, and thermodynamic noise. " +
      "Each persona has unique drive baselines, engine parameters, and " +
      "~35 genesis seeds that define its innate personality.",
    parameters: {
      persona_id: {
        type: "string",
        description: "Persona ID (e.g., luna, vivian, kai, mia)",
      },
      message: {
        type: "string",
        description: "The user message to send to the persona",
      },
    },
    execute: async (params, runCtx) => {
      const personaId = params.persona_id || ctx.config.OPENHER_DEFAULT_PERSONA || "luna";
      const userId = runCtx.userId || "default";
      const res = await client.chat(personaId, userId, params.message);
      return {
        reply: res.reply,
        monologue: res.monologue,
        modality: res.modality,
        signals: res.signals,
        drives: res.drive_state,
        temperature: res.temperature,
        reward: res.reward,
        phase_transition: res.phase_transition,
        relationship: res.relationship,
        style_recall_count: res.style_recall?.length ?? 0,
        image_url: res.image_url,
        audio_available: res.audio_available,
        segments: res.segments,
      };
    },
  });

  // ── openher_status: Query personality state (zero LLM cost) ──
  ctx.registerTool("openher_status", {
    description:
      "Query a persona's current personality state: drives, signals, " +
      "temperature, frustration, relationship depth, genesis seed count, " +
      "and memory statistics. Does not consume LLM tokens.",
    parameters: {
      persona_id: {
        type: "string",
        description: "Persona ID to query",
      },
    },
    execute: async (params, runCtx) => {
      const personaId = params.persona_id || ctx.config.OPENHER_DEFAULT_PERSONA || "luna";
      const userId = runCtx.userId || "default";
      return client.status(personaId, userId);
    },
  });

  // ── openher_switch: Switch active persona ──
  ctx.registerTool("openher_switch", {
    description:
      "Switch the active persona. Each persona has different neural network " +
      "weights (from its seed), drive baselines (from SOUL.md genome_seed), " +
      "engine parameters (learning rate, phase threshold, memory decay), " +
      "and genesis seeds (innate behavioral references).",
    parameters: {
      persona_id: {
        type: "string",
        description: "Target persona ID to switch to",
      },
    },
    execute: async (params) => {
      const personaId = params.persona_id;
      ctx.config.OPENHER_DEFAULT_PERSONA = personaId;
      try {
        const result = await client.personas();
        const target = result.personas.find((p) => p.persona_id === personaId);
        if (target) {
          return {
            switched: true,
            persona: target.name,
            mbti: target.mbti,
            drive_baseline: target.drive_baseline,
            genesis_seeds: target.genesis_seed_count,
          };
        }
        return { switched: false, error: `Persona '${personaId}' not found` };
      } catch (err) {
        return { switched: false, error: String(err) };
      }
    },
  });

  // ── openher_proactive_tick: Trigger drive-driven autonomous message ──
  ctx.registerTool("openher_proactive_tick", {
    description:
      "Trigger a proactive tick — the persona checks if any drive impulse " +
      "is strong enough to initiate conversation. Uses FROZEN learning " +
      "(no relationship/baseline updates). The persona may choose to " +
      "speak or stay silent based on its internal state.",
    parameters: {
      persona_id: {
        type: "string",
        description: "Persona ID to trigger proactive tick for",
      },
    },
    execute: async (params, runCtx) => {
      const personaId = params.persona_id || ctx.config.OPENHER_DEFAULT_PERSONA || "luna";
      const userId = runCtx.userId || "default";
      return client.proactiveTick(personaId, userId);
    },
  });
}
