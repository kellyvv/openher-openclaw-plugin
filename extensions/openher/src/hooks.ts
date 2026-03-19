/**
 * OpenHer Hook Registration — beforeAgentRun context injection.
 *
 * Injects the persona's current personality state into the OpenClaw
 * agent's system context before each run, so the agent is aware of
 * the persona's emotional state, drives, and relationship depth.
 */

import type { OpenHerClient } from "./client";

/**
 * Plugin context interface (matches OpenClaw SDK).
 */
interface PluginContext {
  config: Record<string, string>;
  registerHook(name: string, handler: (ctx: RunContext) => Promise<void>): void;
}

interface RunContext {
  userId?: string;
  systemMessage: string;
}

export function registerHooks(
  ctx: PluginContext,
  client: OpenHerClient
): void {
  ctx.registerHook("beforeAgentRun", async (runCtx: RunContext) => {
    const personaId = ctx.config.OPENHER_DEFAULT_PERSONA || "luna";
    const userId = runCtx.userId || "default";

    try {
      const status = await client.status(personaId, userId);
      if (!status.alive) return;

      // Build a concise state summary for the agent's context
      const signalStr = status.signals
        ? Object.entries(status.signals)
            .map(([k, v]) => `${k}=${(v as number).toFixed(2)}`)
            .join(", ")
        : "unknown";

      const rel = status.relationship;
      const relStr = rel
        ? `depth=${rel.depth.toFixed(2)} trust=${rel.trust.toFixed(2)} valence=${rel.valence.toFixed(2)}`
        : "unknown";

      runCtx.systemMessage += `

[OpenHer Persona Engine — Active State]
Persona: ${status.persona || personaId} | Temperature: ${status.temperature?.toFixed(3) ?? "?"}
Dominant Drive: ${status.dominant_drive || "unknown"}
Behavioral Signals: ${signalStr}
Relationship: ${relStr}
Age: ${status.age ?? 0} turns | Memory: ${status.memory_count ?? 0} entries`;
    } catch (err) {
      // Silently skip if backend is unreachable — don't break the agent
      console.error("[openher] Hook failed:", err);
    }
  });
}
