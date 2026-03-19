/**
 * OpenHer Persona Engine — OpenClaw Extension
 *
 * Registers 2 tools + 1 hook using the real OpenClaw plugin SDK:
 *   - openher_chat: Full 13-step persona engine conversation
 *   - openher_status: Query personality state (zero LLM cost)
 *   - before_prompt_build hook: Inject persona state into agent context
 */

import { Type } from "@sinclair/typebox";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/agent-runtime";
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";

// ── HTTP client ──

async function openherFetch(
  apiUrl: string,
  path: string,
  opts?: { method?: string; body?: unknown },
): Promise<unknown> {
  const res = await fetch(`${apiUrl}${path}`, {
    method: opts?.method ?? "GET",
    headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
    body: opts?.body ? JSON.stringify(opts.body) : undefined,
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`OpenHer ${path} failed (${res.status}): ${detail.slice(0, 200)}`);
  }
  return res.json();
}

// ── Tool: openher_chat ──

const ChatToolSchema = Type.Object(
  {
    message: Type.String({ description: "The user message to send to the persona" }),
    persona_id: Type.Optional(
      Type.String({ description: 'Persona ID (e.g., "luna", "iris", "vivian", "kai")' }),
    ),
  },
  { additionalProperties: false },
);

function createChatTool(api: OpenClawPluginApi) {
  const apiUrl =
    (api.pluginConfig?.OPENHER_API_URL as string) || "http://127.0.0.1:8800";
  const defaultPersona =
    (api.pluginConfig?.OPENHER_DEFAULT_PERSONA as string) || "luna";

  return {
    name: "openher_chat",
    label: "OpenHer Chat",
    description:
      "Send a message through OpenHer's persona engine. Each persona has a " +
      "neural network (seed→W1/W2→8D signals), drive metabolism, Hebbian learning, " +
      "KNN memory retrieval, and thermodynamic noise. Returns the persona's reply, " +
      "8D behavioral signals, 5D drives, temperature, reward, and relationship state. " +
      "IMPORTANT: The 'reply' field IS the persona's actual spoken words. Present it " +
      "directly to the user verbatim — do NOT paraphrase, add narration like " +
      "'she said' or 'Luna replied', or wrap it in any way. The persona speaks for itself.",
    parameters: ChatToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const message = readStringParam(rawParams, "message", { required: true });
      const personaId = readStringParam(rawParams, "persona_id") || defaultPersona;

      const result = await openherFetch(apiUrl, "/api/v1/engine/chat", {
        method: "POST",
        body: {
          persona_id: personaId,
          user_id: "openclaw-agent",
          message,
        },
      });

      const r = result as Record<string, unknown>;
      // NOTE: monologue is intentionally excluded — it is the persona's
      // internal Feel-phase thought and must not be exposed to end users.
      return jsonResult({
        reply: r.reply,
        modality: r.modality,
        signals: r.signals,
        drives: r.drive_state,
        temperature: r.temperature,
        reward: r.reward,
        relationship: r.relationship,
        phase_transition: r.phase_transition,
        age: r.age,
      });
    },
  };
}

// ── Tool: openher_status ──

const StatusToolSchema = Type.Object(
  {
    persona_id: Type.Optional(
      Type.String({ description: "Persona ID to query status for" }),
    ),
  },
  { additionalProperties: false },
);

function createStatusTool(api: OpenClawPluginApi) {
  const apiUrl =
    (api.pluginConfig?.OPENHER_API_URL as string) || "http://127.0.0.1:8800";
  const defaultPersona =
    (api.pluginConfig?.OPENHER_DEFAULT_PERSONA as string) || "luna";

  return {
    name: "openher_status",
    label: "OpenHer Status",
    description:
      "Query a persona's current personality state without consuming LLM tokens. " +
      "Returns drives, signals, temperature, frustration, relationship depth, " +
      "and memory statistics.",
    parameters: StatusToolSchema,
    execute: async (_toolCallId: string, rawParams: Record<string, unknown>) => {
      const personaId = readStringParam(rawParams, "persona_id") || defaultPersona;
      const result = await openherFetch(
        apiUrl,
        `/api/v1/engine/status?persona_id=${personaId}&user_id=openclaw-agent`,
      );
      return jsonResult(result);
    },
  };
}

// ── Hook: before_prompt_build — inject persona state ──

function registerPersonaHook(api: OpenClawPluginApi) {
  const apiUrl =
    (api.pluginConfig?.OPENHER_API_URL as string) || "http://127.0.0.1:8800";
  const defaultPersona =
    (api.pluginConfig?.OPENHER_DEFAULT_PERSONA as string) || "luna";

  api.on("before_prompt_build", async () => {
    try {
      const status = (await openherFetch(
        apiUrl,
        `/api/v1/engine/status?persona_id=${defaultPersona}&user_id=openclaw-agent`,
      )) as Record<string, unknown>;

      if (!status.alive) return {};

      const signals = status.signals as Record<string, number> | undefined;
      const sigStr = signals
        ? Object.entries(signals)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(", ")
        : "unknown";

      const rel = status.relationship as Record<string, number> | undefined;
      const relStr = rel
        ? `depth=${rel.depth?.toFixed(2)} trust=${rel.trust?.toFixed(2)} valence=${rel.valence?.toFixed(2)}`
        : "unknown";

      return {
        appendSystemContext:
          `\n[OpenHer Persona Engine — Active State]\n` +
          `Persona: ${status.persona || defaultPersona} | Temperature: ${status.temperature ?? "?"}\n` +
          `Dominant Drive: ${status.dominant_drive || "unknown"}\n` +
          `Behavioral Signals: ${sigStr}\n` +
          `Relationship: ${relStr}`,
      };
    } catch {
      // Silently skip if backend is unreachable
      return {};
    }
  });
}

// ── Plugin Entry ──

export default definePluginEntry({
  id: "openher-persona-engine",
  name: "OpenHer Persona Engine",
  description:
    "AI Being engine — personality computed from neural networks, " +
    "drive metabolism, and Hebbian learning. Adds openher_chat and " +
    "openher_status tools.",
  register(api) {
    api.registerTool(createChatTool(api) as AnyAgentTool);
    api.registerTool(createStatusTool(api) as AnyAgentTool);
    registerPersonaHook(api);

    api.logger.info(
      `[openher] Plugin initialized — ` +
        `API: ${(api.pluginConfig?.OPENHER_API_URL as string) || "http://127.0.0.1:8800"}, ` +
        `persona: ${(api.pluginConfig?.OPENHER_DEFAULT_PERSONA as string) || "luna"}`,
    );
  },
});
