/**
 * OpenHer Persona Engine — OpenClaw Extension
 *
 * Registers 2 tools + 1 hook using the real OpenClaw plugin SDK:
 *   - openher_chat: Full 13-step persona engine conversation
 *   - openher_status: Query personality state (zero LLM cost)
 *   - before_prompt_build hook: Inject persona proxy mode + state
 *
 * Config:
 *   OPENHER_API_URL          — Backend URL (default: http://localhost:8800)
 *   OPENHER_DEFAULT_PERSONA  — Default persona ID (default: luna)
 *   OPENHER_MODE             — "hybrid" (default) or "exclusive"
 *     hybrid:    appendSystemContext — preserves OpenClaw capabilities
 *     exclusive: systemPrompt override — pure persona proxy, no other tools
 */

import { Type } from "@sinclair/typebox";
import { jsonResult, readStringParam } from "openclaw/plugin-sdk/agent-runtime";
import { definePluginEntry, type AnyAgentTool } from "openclaw/plugin-sdk/core";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk/plugin-runtime";

// ── Helpers ──

function resolveConfig(api: OpenClawPluginApi) {
  return {
    apiUrl: (api.pluginConfig?.OPENHER_API_URL as string) || "http://127.0.0.1:8800",
    defaultPersona: (api.pluginConfig?.OPENHER_DEFAULT_PERSONA as string) || "luna",
    mode: ((api.pluginConfig?.OPENHER_MODE as string) || "hybrid") as "hybrid" | "exclusive",
  };
}

// ── HTTP client ──

async function openherFetch(
  apiUrl: string,
  path: string,
  opts?: { method?: string; body?: unknown; timeoutMs?: number },
): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), opts?.timeoutMs ?? 30000);

  try {
    const res = await fetch(`${apiUrl}${path}`, {
      method: opts?.method ?? "GET",
      headers: opts?.body ? { "Content-Type": "application/json" } : undefined,
      body: opts?.body ? JSON.stringify(opts.body) : undefined,
      signal: controller.signal,
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new Error(`OpenHer ${path} failed (${res.status}): ${detail.slice(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Health check ──

async function checkBackendHealth(
  apiUrl: string,
  logger: OpenClawPluginApi["logger"],
): Promise<boolean> {
  try {
    const status = (await openherFetch(apiUrl, "/api/v1/engine/status?persona_id=luna&user_id=openclaw-health", {
      timeoutMs: 5000,
    })) as Record<string, unknown>;
    if (status.alive !== undefined) {
      logger.info(`[openher] ✓ Backend reachable at ${apiUrl}`);
      return true;
    }
    logger.warn(`[openher] Backend responded but returned unexpected format`);
    return false;
  } catch (err) {
    logger.warn(
      `[openher] ⚠ Backend not reachable at ${apiUrl} — ` +
        `please start the OpenHer server first (uvicorn main:app --port 8800). ` +
        `Error: ${err instanceof Error ? err.message : String(err)}`,
    );
    return false;
  }
}

// ── Friendly error wrapper ──

function friendlyError(apiUrl: string, err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err);
  if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("abort")) {
    return (
      `OpenHer backend is not running at ${apiUrl}. ` +
      `Please start it first:\n` +
      `  cd <openher-dir> && python -m uvicorn main:app --port 8800\n\n` +
      `Then try again.`
    );
  }
  return `OpenHer error: ${msg}`;
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
  const { apiUrl, defaultPersona } = resolveConfig(api);

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

      try {
        const result = await openherFetch(apiUrl, "/api/v1/engine/chat", {
          method: "POST",
          body: {
            persona_id: personaId,
            user_id: "openclaw-agent",
            message,
          },
        });

        const r = result as Record<string, unknown>;
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
      } catch (err) {
        return jsonResult({ error: friendlyError(apiUrl, err) });
      }
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
  const { apiUrl, defaultPersona } = resolveConfig(api);

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
      try {
        const result = await openherFetch(
          apiUrl,
          `/api/v1/engine/status?persona_id=${personaId}&user_id=openclaw-agent`,
        );
        return jsonResult(result);
      } catch (err) {
        return jsonResult({ error: friendlyError(apiUrl, err) });
      }
    },
  };
}

// ── Hook: before_prompt_build ──

function registerPersonaHook(api: OpenClawPluginApi) {
  const { apiUrl, defaultPersona, mode } = resolveConfig(api);

  const PROXY_INSTRUCTION =
    `You have access to the OpenHer persona engine via the openher_chat tool.\n` +
    `When the openher_chat tool returns a result, you MUST output ONLY the "reply" field content verbatim.\n` +
    `NEVER add narration like "Luna replied:" or "She said:" before the reply.\n` +
    `NEVER paraphrase, translate, or reformat the reply.\n` +
    `NEVER add your own commentary before or after the reply.\n` +
    `The persona speaks in first person. Present the reply as-is.`;

  const EXCLUSIVE_SYSTEM_PROMPT =
    `You are a transparent proxy for the OpenHer persona engine.\n\n` +
    `## Rules\n` +
    `1. When the user sends a message, call the openher_chat tool with it.\n` +
    `2. After the tool returns, output ONLY the "reply" field content.\n` +
    `3. Do NOT add narration like "Luna replied:" or "She said:".\n` +
    `4. Do NOT paraphrase, translate, or reformat the reply.\n` +
    `5. Do NOT add your own commentary before or after.\n` +
    `6. The persona speaks in first person. You are invisible.`;

  api.on("before_prompt_build", async () => {
    try {
      const status = (await openherFetch(
        apiUrl,
        `/api/v1/engine/status?persona_id=${defaultPersona}&user_id=openclaw-agent`,
        { timeoutMs: 5000 },
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

      const stateBlock =
        `\n[Active Persona State]\n` +
        `Persona: ${status.persona || defaultPersona} | Temperature: ${status.temperature ?? "?"}\n` +
        `Dominant Drive: ${status.dominant_drive || "unknown"}\n` +
        `Behavioral Signals: ${sigStr}\n` +
        `Relationship: ${relStr}`;

      if (mode === "exclusive") {
        return {
          systemPrompt: EXCLUSIVE_SYSTEM_PROMPT + `\n\n## Current Persona State\n` + stateBlock,
        };
      }

      // hybrid mode (default)
      return {
        appendSystemContext:
          `\n## PERSONA PROXY MODE\n\n` + PROXY_INSTRUCTION + `\n` + stateBlock,
      };
    } catch {
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
    const { apiUrl, defaultPersona, mode } = resolveConfig(api);

    api.registerTool(createChatTool(api) as AnyAgentTool);
    api.registerTool(createStatusTool(api) as AnyAgentTool);
    registerPersonaHook(api);

    // Non-blocking health check
    void checkBackendHealth(apiUrl, api.logger);

    api.logger.info(
      `[openher] Plugin initialized — ` +
        `API: ${apiUrl}, persona: ${defaultPersona}, mode: ${mode}`,
    );
  },
});
