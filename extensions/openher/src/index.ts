/**
 * OpenHer Persona Engine — OpenClaw Plugin Entry Point.
 *
 * Bridges the OpenHer Python backend (neural network persona engine)
 * to the OpenClaw ecosystem via HTTP. The plugin registers:
 *
 *   - Hook: beforeAgentRun — injects personality state into context
 *   - Tool: openher_chat — full 13-step engine conversation
 *   - Tool: openher_status — query personality state
 *   - Tool: openher_switch — switch active persona
 *   - Tool: openher_proactive_tick — drive-driven autonomous messaging
 *
 * The engine computes personality from:
 *   - Random neural network (seed → W1/W2 → 8D behavioral signals)
 *   - Drive metabolism (time-dependent frustration, cooling, hunger)
 *   - Hebbian learning (reward-driven weight updates)
 *   - KNN style memory (genesis seeds + crystallized interactions)
 *   - Thermodynamic noise (frustration → behavioral randomness)
 *
 * Personality is computed, not described.
 */

import { OpenHerClient } from "./client";
import { registerHooks } from "./hooks";
import { registerTools } from "./tools";

interface PluginContext {
  config: Record<string, string>;
  registerHook(name: string, handler: (ctx: any) => Promise<void>): void;
  registerTool(name: string, def: any): void;
}

export default function openherPlugin(ctx: PluginContext): void {
  const apiUrl = ctx.config.OPENHER_API_URL || "http://localhost:8800";
  const client = new OpenHerClient(apiUrl);

  registerHooks(ctx, client);
  registerTools(ctx, client);

  console.log(
    `[openher] Plugin initialized — backend: ${apiUrl}, ` +
    `default persona: ${ctx.config.OPENHER_DEFAULT_PERSONA || "luna"}`
  );
}

// Named export for CommonJS compatibility
export { openherPlugin };
