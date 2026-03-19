/**
 * OpenHerClient — HTTP bridge to the OpenHer Python backend.
 *
 * All methods call the /api/v1/engine/ endpoints which run the
 * full 13-step persona engine lifecycle.
 */

import type {
  EngineResponse,
  PersonaInfo,
  StatusResponse,
  ProactiveResponse,
} from "./types";

export class OpenHerClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    // Strip trailing slash
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  /**
   * Send a message through the full 13-step persona engine.
   *
   * Lifecycle: Critic → Metabolism → Signals → KNN → Prompt →
   * Actor → Hebbian Learning → Memory Store/Search.
   */
  async chat(
    personaId: string,
    userId: string,
    message: string,
    userName?: string
  ): Promise<EngineResponse> {
    const body: Record<string, string> = {
      persona_id: personaId,
      user_id: userId,
      message,
    };
    if (userName) {
      body.user_name = userName;
    }

    const res = await fetch(`${this.baseUrl}/api/v1/engine/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const detail = await res.text();
      throw new Error(`OpenHer engine/chat failed (${res.status}): ${detail}`);
    }

    return res.json() as Promise<EngineResponse>;
  }

  /**
   * Query current personality state without consuming LLM tokens.
   */
  async status(personaId: string, userId: string): Promise<StatusResponse> {
    const params = new URLSearchParams({ persona_id: personaId, user_id: userId });
    const res = await fetch(`${this.baseUrl}/api/v1/engine/status?${params}`);

    if (!res.ok) {
      throw new Error(`OpenHer engine/status failed (${res.status})`);
    }

    return res.json() as Promise<StatusResponse>;
  }

  /**
   * List all available personas with engine parameters and genesis seed counts.
   */
  async personas(): Promise<{ personas: PersonaInfo[] }> {
    const res = await fetch(`${this.baseUrl}/api/v1/engine/personas`);

    if (!res.ok) {
      throw new Error(`OpenHer engine/personas failed (${res.status})`);
    }

    return res.json() as Promise<{ personas: PersonaInfo[] }>;
  }

  /**
   * Trigger a proactive tick — persona checks if any drive impulse
   * is strong enough to initiate conversation autonomously.
   */
  async proactiveTick(
    personaId: string,
    userId: string
  ): Promise<ProactiveResponse> {
    const params = new URLSearchParams({ persona_id: personaId, user_id: userId });
    const res = await fetch(`${this.baseUrl}/api/v1/engine/proactive?${params}`, {
      method: "POST",
    });

    if (!res.ok) {
      throw new Error(`OpenHer engine/proactive failed (${res.status})`);
    }

    return res.json() as Promise<ProactiveResponse>;
  }

  /**
   * Health check — verify the OpenHer backend is reachable.
   */
  async ping(): Promise<boolean> {
    try {
      const res = await fetch(`${this.baseUrl}/api/status`);
      return res.ok;
    } catch {
      return false;
    }
  }
}
