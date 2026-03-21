#!/usr/bin/env python3
"""
OpenClaw REST API — 3-Layer E2E Benchmark

Tests the /api/v1/engine/ endpoints with the same 3-layer methodology:

  Layer 1: Structural correctness
    - Reply + 8D signals + 5D drives + 24D hidden + 25D input present
    - Signals in [0,1], drives in [0,1], temperature > 0
    - reply length > 5 chars

  Layer 2: Personality differentiation
    - 2 personas (luna ENTP, iris INFP) × 3 scenarios (daily, emotion, conflict)
    - Monologue + reply output for human review
    - Drive state + signals comparison across personas

  Layer 3: Multi-turn state evolution
    - 3-turn conversation, verify temperature/signals/drives change
    - Relationship depth should increase (or stay ≥ 0)
    - Age should increment

Usage:
    # Start backend: .venv/bin/python -m uvicorn main:app --port 8800
    # Then:
    .venv/bin/python3 tests/test_openclaw_api_e2e.py
"""

import json
import sys
import time
import urllib.request
import urllib.error

API_BASE = "http://127.0.0.1:8800"
TIMEOUT = 60


def engine_chat(persona_id: str, user_id: str, message: str) -> dict:
    """POST /api/v1/engine/chat"""
    data = json.dumps({
        "persona_id": persona_id,
        "user_id": user_id,
        "message": message,
    }).encode("utf-8")
    req = urllib.request.Request(
        f"{API_BASE}/api/v1/engine/chat",
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        return {"error": f"HTTP {e.code}: {e.read().decode()[:200]}"}
    except Exception as e:
        return {"error": str(e)}


def engine_status(persona_id: str, user_id: str) -> dict:
    """GET /api/v1/engine/status"""
    url = f"{API_BASE}/api/v1/engine/status?persona_id={persona_id}&user_id={user_id}"
    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


def engine_personas() -> dict:
    """GET /api/v1/engine/personas"""
    try:
        with urllib.request.urlopen(f"{API_BASE}/api/v1/engine/personas", timeout=10) as resp:
            return json.loads(resp.read())
    except Exception as e:
        return {"error": str(e)}


# ═══════════════════════════════════════════════════════════
# Layer 1: Structural Correctness
# ═══════════════════════════════════════════════════════════

SIGNAL_KEYS = ["directness", "vulnerability", "playfulness", "initiative", "depth", "warmth", "defiance", "curiosity"]
DRIVE_KEYS = ["connection", "novelty", "expression", "safety", "play"]


def test_layer1():
    print("\n" + "═" * 70)
    print("  LAYER 1: STRUCTURAL CORRECTNESS (REST API)")
    print("═" * 70)
    passed = 0
    total = 0

    # 1.1 Chat returns valid response
    total += 1
    print("\n  1.1 Basic chat (luna via REST)...")
    t0 = time.time()
    r = engine_chat("luna", "e2e_rest_test", "你好，今天心情怎么样？")
    latency = int((time.time() - t0) * 1000)
    if "error" in r:
        print(f"      ❌ Error: {r['error']}")
    else:
        ok = bool(r.get("reply")) and len(r["reply"]) > 5
        print(f"      {'✅' if ok else '❌'} reply: {len(r.get('reply', ''))}字, latency: {latency}ms")
        print(f"      回复: {r['reply'][:80]}")
        if ok: passed += 1

    # 1.2 All 8D signals present and in [0,1]
    total += 1
    signals = r.get("signals", {})
    sig_ok = all(k in signals for k in SIGNAL_KEYS) and all(0 <= signals.get(k, -1) <= 1 for k in SIGNAL_KEYS)
    sig_str = " ".join(f"{k[:3]}={signals.get(k, 0):.2f}" for k in SIGNAL_KEYS)
    print(f"      {'✅' if sig_ok else '❌'} 8D signals: {sig_str}")
    if sig_ok: passed += 1

    # 1.3 All 5D drives present and in [0,1]
    total += 1
    ds = r.get("drive_state", {})
    db = r.get("drive_baseline", {})
    drv_ok = all(k in ds for k in DRIVE_KEYS) and all(0 <= ds.get(k, -1) <= 1 for k in DRIVE_KEYS)
    drv_str = " ".join(f"{k[:3]}={ds.get(k, 0):.2f}" for k in DRIVE_KEYS)
    print(f"      {'✅' if drv_ok else '❌'} 5D drives: {drv_str}")
    if drv_ok: passed += 1

    # 1.4 Neural network internals (24D hidden + 25D input)
    total += 1
    hidden = r.get("hidden_activations", [])
    inp = r.get("input_vector", [])
    nn_ok = len(hidden) == 24 and len(inp) == 25
    print(f"      {'✅' if nn_ok else '❌'} NN: hidden={len(hidden)}D, input={len(inp)}D")
    if nn_ok: passed += 1

    # 1.5 Temperature, frustration, reward, relationship present
    total += 1
    temp = r.get("temperature", -1)
    frust = r.get("frustration", -1)
    rel = r.get("relationship", {})
    meta_ok = temp >= 0 and frust >= 0 and isinstance(rel, dict)
    print(f"      {'✅' if meta_ok else '❌'} temp={temp:.4f} frust={frust:.4f} rel={rel}")
    if meta_ok: passed += 1

    # 1.6 Monologue present
    total += 1
    mono = r.get("monologue", "")
    mono_ok = len(mono) > 3
    print(f"      {'✅' if mono_ok else '❌'} monologue: {mono[:80]}")
    if mono_ok: passed += 1

    # 1.7 Age, turn_count, session_id
    total += 1
    age = r.get("age", 0)
    tc = r.get("turn_count", 0)
    sid = r.get("session_id", "")
    id_ok = age > 0 and tc > 0 and len(sid) > 0
    print(f"      {'✅' if id_ok else '❌'} age={age} turn_count={tc} session_id={sid}")
    if id_ok: passed += 1

    # 1.8 Status endpoint works for same session
    total += 1
    st = engine_status("luna", "e2e_rest_test")
    st_ok = st.get("alive") is True
    print(f"      {'✅' if st_ok else '❌'} status: alive={st.get('alive')}")
    if st_ok: passed += 1

    # 1.9 Personas endpoint returns engine_params
    total += 1
    ps = engine_personas()
    ps_ok = not ps.get("error") and len(ps.get("personas", [])) > 0
    if ps_ok:
        p0 = ps["personas"][0]
        has_ep = "engine_params" in p0 and "drive_baseline" in p0
        print(f"      {'✅' if has_ep else '❌'} personas: {len(ps['personas'])} loaded, engine_params={'✅' if has_ep else '❌'}")
        if has_ep: passed += 1
    else:
        print(f"      ❌ personas error: {ps.get('error')}")

    print(f"\n  Layer 1 Result: {passed}/{total} passed")
    return passed, total


# ═══════════════════════════════════════════════════════════
# Layer 2: Personality Differentiation (Human Review)
# ═══════════════════════════════════════════════════════════

LAYER2_MATRIX = [
    ("luna",  "日常", "今天天气好好，你在做什么？"),
    ("luna",  "情感", "我最近心情不好，感觉很孤独"),
    ("luna",  "冲突", "你说的不对，我不同意"),
    ("iris",  "日常", "今天天气好好，你在做什么？"),
    ("iris",  "情感", "我最近心情不好，感觉很孤独"),
    ("iris",  "冲突", "你说的不对，我不同意"),
]


def test_layer2():
    print("\n" + "═" * 70)
    print("  LAYER 2: PERSONALITY DIFFERENTIATION (Human Review)")
    print("═" * 70)
    print("  ⚠️  以下输出需人工判断独白质量和角色区分度")
    print("  Luna=ENTP(直接/大胆)  vs  Iris=INFP(温柔/诗意)")

    results = []
    for persona_id, ptype, prompt in LAYER2_MATRIX:
        uid = f"e2e_l2_{persona_id}"
        r = engine_chat(persona_id, uid, prompt)
        results.append((persona_id, ptype, prompt, r))

        if "error" in r:
            print(f"\n  ❌ {persona_id}/{ptype}: {r['error']}")
            continue

        sig = r.get("signals", {})
        sig_top3 = sorted(sig.items(), key=lambda x: abs(x[1] - 0.5), reverse=True)[:3]
        sig_str = " ".join(f"{k[:3]}={v:.2f}" for k, v in sig_top3)

        print(f"\n  ┌─ {persona_id.upper()} | {ptype} | \"{prompt}\"")
        print(f"  │ 【独白】{r.get('monologue', '(未返回)')[:120]}")
        print(f"  │ 【回复】{r['reply'][:120]}")
        print(f"  │ 信号: {sig_str} | 温度: {r.get('temperature', 0):.3f}")
        print(f"  └─")

    # Cross-persona comparison
    print("\n  ─── 质量检查清单 ───")
    print("  □ Luna(ENTP) 回复是否更直接/调皮？")
    print("  □ Iris(INFP) 回复是否更温柔/诗意？")
    print("  □ 独白是否为第一人称情绪性感受（非对话摘要）？")
    print("  □ 冲突场景下两人反应是否有明显区别？")

    # Signal comparison for same scenario
    print("\n  ─── 信号对比（同一场景不同角色）──")
    for ptype in ["日常", "情感", "冲突"]:
        pair = [(pid, r) for pid, pt, _, r in results if pt == ptype and "error" not in r]
        if len(pair) == 2:
            (p1, r1), (p2, r2) = pair
            for sig_key in ["directness", "warmth", "defiance", "vulnerability"]:
                v1 = r1.get("signals", {}).get(sig_key, 0)
                v2 = r2.get("signals", {}).get(sig_key, 0)
                diff = v1 - v2
                marker = "⬆" if abs(diff) > 0.1 else "≈"
                print(f"  {ptype:4s} | {sig_key:14s} | {p1}={v1:.2f}  {p2}={v2:.2f}  Δ={diff:+.2f} {marker}")

    return results


# ═══════════════════════════════════════════════════════════
# Layer 3: Multi-turn State Evolution
# ═══════════════════════════════════════════════════════════

def test_layer3():
    print("\n" + "═" * 70)
    print("  LAYER 3: MULTI-TURN STATE EVOLUTION")
    print("═" * 70)
    passed = 0
    total = 0

    uid = "e2e_l3_multiturn"
    prompts = [
        "你好！第一次见面，我叫小明",
        "你刚才说的很有道理，能展开聊聊吗？",
        "我觉得我们聊得很开心，你觉得呢？",
    ]

    turns = []
    for i, msg in enumerate(prompts, 1):
        print(f"\n  ── Turn {i}/3: \"{msg}\" ──")
        r = engine_chat("luna", uid, msg)
        if "error" in r:
            print(f"      ❌ Error: {r['error']}")
            turns.append(None)
            continue

        turns.append(r)
        rel = r.get("relationship", {})
        print(f"      回复: {r['reply'][:80]}")
        print(f"      temp={r['temperature']:.4f}  reward={r['reward']:+.4f}  age={r['age']}")
        print(f"      relationship: depth={rel.get('relationship_depth', rel.get('depth', 0)):.3f}")

    valid_turns = [t for t in turns if t is not None]
    if len(valid_turns) < 3:
        print(f"\n  ❌ Only {len(valid_turns)}/3 turns completed")
        return 0, 4

    # 3.1 Age increases across turns
    total += 1
    ages = [t["age"] for t in valid_turns]
    age_ok = ages[-1] > ages[0]
    print(f"\n  3.1 {'✅' if age_ok else '❌'} age progression: {ages}")
    if age_ok: passed += 1

    # 3.2 Turn count increases
    total += 1
    tcs = [t["turn_count"] for t in valid_turns]
    tc_ok = tcs[-1] > tcs[0]
    print(f"  3.2 {'✅' if tc_ok else '❌'} turn_count progression: {tcs}")
    if tc_ok: passed += 1

    # 3.3 Signals change (not frozen — NN processes each turn differently)
    total += 1
    sig1 = valid_turns[0].get("signals", {})
    sig3 = valid_turns[2].get("signals", {})
    sig_changed = any(
        abs(sig1.get(k, 0) - sig3.get(k, 0)) > 0.01 for k in SIGNAL_KEYS
    )
    print(f"  3.3 {'✅' if sig_changed else '⚠️'} signals evolved: T1 vs T3 differ={sig_changed}")
    if sig_changed: passed += 1

    # 3.4 Relationship depth ≥ 0 (should be accumulating)
    total += 1
    rel3 = valid_turns[2].get("relationship", {})
    depth3 = rel3.get("relationship_depth", rel3.get("depth", 0))
    depth_ok = depth3 >= 0
    print(f"  3.4 {'✅' if depth_ok else '❌'} final relationship depth={depth3:.4f}")
    if depth_ok: passed += 1

    print(f"\n  Layer 3 Result: {passed}/{total} passed")
    return passed, total


# ═══════════════════════════════════════════════════════════
# Main
# ═══════════════════════════════════════════════════════════

def main():
    print("╔══════════════════════════════════════════════════════════════╗")
    print("║  OpenClaw REST API — 3-Layer E2E Benchmark                 ║")
    print("║  Endpoints: /api/v1/engine/{chat,status,personas}          ║")
    print("╚══════════════════════════════════════════════════════════════╝")

    # Verify server is up
    try:
        urllib.request.urlopen(f"{API_BASE}/api/status", timeout=5)
    except Exception:
        print(f"\n❌ Server not running at {API_BASE}")
        print("   Start with: .venv/bin/python -m uvicorn main:app --port 8800")
        sys.exit(1)

    p1, t1 = test_layer1()
    test_layer2()
    p3, t3 = test_layer3()

    total_pass = p1 + p3
    total_tests = t1 + t3

    print("\n" + "═" * 70)
    print(f"  SUMMARY: {total_pass}/{total_tests} automated tests passed")
    print(f"  Layer 2 (personality): requires human review above")
    print("═" * 70)

    if total_pass < total_tests:
        sys.exit(1)


if __name__ == "__main__":
    main()
