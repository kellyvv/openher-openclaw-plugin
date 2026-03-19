/**
 * OpenHer Persona Engine — Type definitions.
 *
 * Maps exactly to the Python engine's internal data structures:
 *   - 8D behavioral signals (directness → curiosity)
 *   - 5D drives (connection → play)
 *   - Full engine response from /api/v1/engine/chat
 */

// ──────────────────────────────────────────────────────────────
// 8D Behavioral Signals — output of the 25D→24D→8D neural network
// ──────────────────────────────────────────────────────────────

export interface Signals {
  directness: number;    // 🎯 0=indirect → 1=blunt
  vulnerability: number; // 💧 0=guarded → 1=exposed
  playfulness: number;   // 🎪 0=serious → 1=playful
  initiative: number;    // 🚀 0=passive → 1=leading
  depth: number;         // 🌊 0=small talk → 1=deep dive
  warmth: number;        // 🔥 0=distant → 1=warm
  defiance: number;      // ⚡ 0=agreeable → 1=defiant
  curiosity: number;     // 🔍 0=indifferent → 1=probing
}

// ──────────────────────────────────────────────────────────────
// 5D Drives — internal needs that evolve with time and interaction
// ──────────────────────────────────────────────────────────────

export interface Drives {
  connection: number;  // 🔗 Desire to bond (E↑ / I↓)
  novelty: number;     // ✨ Curiosity for new ideas (N↑ / S↓)
  expression: number;  // 💬 Urge to communicate (F↑ / T↓)
  safety: number;      // 🛡️ Need for control (J↑ / P↓)
  play: number;        // 🎭 Playfulness & spontaneity (P↑ / J↓)
}

// ──────────────────────────────────────────────────────────────
// Relationship EMA — semi-emergent relationship state
// ──────────────────────────────────────────────────────────────

export interface Relationship {
  depth: number;    // 0→1: how deep the relationship is
  trust: number;    // 0→1: trust level
  valence: number;  // -1→1: emotional tone of the relationship
}

// ──────────────────────────────────────────────────────────────
// Style Recall — KNN-retrieved subconscious slices
// ──────────────────────────────────────────────────────────────

export interface StyleRecallEntry {
  text: string;      // The recalled monologue + reply
  distance: number;  // Effective distance (lower = closer match)
  mass: number;      // Gravitational mass (genesis=1.0, crystallized=2.0+)
}

// ──────────────────────────────────────────────────────────────
// Engine Response — full return from /api/v1/engine/chat
// ──────────────────────────────────────────────────────────────

export interface EngineResponse {
  // Conversation result
  reply: string;
  modality: string;
  monologue: string;

  // 8D behavioral signals
  signals: Signals;

  // 5D drives
  drive_state: Drives;
  drive_baseline: Drives;

  // Temperature & frustration
  temperature: number;
  frustration: number;
  reward: number;

  // Relationship EMA
  relationship: Relationship;

  // Neural network internals
  hidden_activations: number[];  // 24D hidden layer
  input_vector: number[];        // 25D input (5 drives + 12 context + 8 recurrent)

  // Memory
  style_recall: StyleRecallEntry[];
  memory_count: number;
  personal_memories: number;

  // Skill outputs (conditionally present)
  image_url?: string;
  audio_available?: boolean;
  segments?: string[];
  delays_ms?: number[];

  // Metadata
  age: number;
  turn_count: number;
  phase_transition: boolean;
  session_id: string;
}

// ──────────────────────────────────────────────────────────────
// Persona Info — from /api/v1/engine/personas
// ──────────────────────────────────────────────────────────────

export interface PersonaInfo {
  persona_id: string;
  name: string;
  name_zh?: string;
  gender: string;
  age?: number;
  lang: string;
  mbti?: string;
  tags: string[];
  tags_zh: string[];
  drive_baseline: Drives;
  engine_params: Record<string, number>;
  genesis_seed_count: number;
}

// ──────────────────────────────────────────────────────────────
// Status Response — from /api/v1/engine/status
// ──────────────────────────────────────────────────────────────

export interface StatusResponse {
  alive: boolean;
  // Present when alive=true (active session)
  persona?: string;
  dominant_drive?: string;
  drive_state?: Drives;
  drive_baseline?: Drives;
  signals?: Record<string, number>;
  temperature?: number;
  frustration?: number;
  relationship?: Relationship;
  age?: number;
  turn_count?: number;
  memory_count?: number;
  personal_memories?: number;
  // Present when alive=false (persisted state only)
  last_active?: number;
  interaction_cadence?: number;
  state_version?: number;
  message?: string;
}

// ──────────────────────────────────────────────────────────────
// Proactive Tick Response
// ──────────────────────────────────────────────────────────────

export interface ProactiveResponse {
  proactive: boolean;
  reason?: string;
  reply?: string;
  modality?: string;
  monologue?: string;
  drive_id?: string;
  tick_id?: string;
  session_id?: string;
}
