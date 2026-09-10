# ADR-004: Synthetic-beta AI egress to DeepSeek for non-sensitive content only

- Status: Accepted for the synthetic beta (D-05, product-owner delegation 2026-09-09)
- Date: 2026-09-09

## Context

Finding HC-15 (plans/260909-1834-healthcare-whole-system-audit-remediation/reports/audit-findings.md)
recorded a contract contradiction: `supabase/tests/test_render_blueprint_contract.py`
asserted the Render AI service must keep `AI_PROVIDER=local`, while both Render
blueprints (`render.yaml`, `render-free-beta.yaml`) selected `deepseek`. The
suite ran 41 pass / 1 fail / 54 subtests. The audit could not label either side
correct until the data-egress decision existed.

The release target is a synthetic portfolio beta, not a real-patient system.
The AI service already ships layered guardrails that make a narrow remote
provider acceptable for non-sensitive content:

- `apps/ai-service/app/llm.py` — `contains_prompt_injection()` and
  `context_contains_unsafe_data()` force unsafe or injected context to local
  handling; triage requests requiring clinical judgment stay local
  (`triage_requires_local`) and remote answers fall back with
  `provenance="local_fallback"`.
- `apps/ai-service/app/config.py` — patient egress is double opt-in
  (`ai_patient_chat_remote_enabled` and `ai_chat_remote_provider_enabled`
  default `False`; the Spring provenance gate is the second opt-in),
  `remote_ai_synthetic_only=True`, `remote_ai_kill_switch=True`, and the
  remote allowlist is provider- and host-pinned
  (`remote_ai_provider_allowlist="deepseek"`,
  `remote_ai_https_host_allowlist="api.deepseek.com"`).
- `apps/ai-service/app/chatbot.py` — requests that do not assert the
  synthetic-beta posture are refused (`CHAT_REMOTE_SYNTHETIC_REQUIRED`, 403)
  and unsafe context returns `INSUFFICIENT_EVIDENCE` instead of egressing.
- `apps/ai-service/app/providers.py` — unknown/remote-unavailable providers
  fail closed into deterministic local answers.

## Decision

Product-owner decision D-05 (plan.md, "Scope Challenge and Rulings"):

- Synthetic-beta AI egress MAY use DeepSeek for NON-SENSITIVE synthetic/guest
  content only.
- Allowed data classes: public operational catalog content, guest
  hospital-support/triage conversation, and synthetic demo-patient content.
- Disallowed data classes: authenticated patient clinical records, real PHI,
  legally signed clinical documents, payment/accounting data. Authenticated
  patient clinical data MUST NOT egress to the cloud provider; patient-chat
  egress stays disabled by the default-off flags above.
- Guardrails are part of this decision and must stay in place: the
  prompt-injection defense, the unsafe-context/PII shield that refuses to
  egress patient data, the provider/host allowlist, the kill switch, the
  synthetic-only gate, and the local deterministic fail-closed fallback
  (`EMBEDDING_PROVIDER=local` in the blueprints; local fallback provenance).
- The Render blueprints may therefore select `AI_PROVIDER=deepseek` under the
  synthetic-beta posture, and the Supabase deployment contract test asserts
  the allowed set `{deepseek, local}` instead of a `local`-only literal.

## Consequences

- `supabase/tests/test_render_blueprint_contract.py` now encodes the policy:
  the AI provider must be in `{deepseek, local}` and the fail-closed posture
  fields (`EMBEDDING_PROVIDER=local`, `REMOTE_AI_KILL_SWITCH=true`,
  `AI_PATIENT_CHAT_REMOTE_ENABLED=false`, `REMOTE_AI_SYNTHETIC_ONLY=true`)
  must stay set; whole-file equality between `render.yaml` and
  `render-free-beta.yaml` keeps both blueprints in agreement.
- Embeddings remain local; `supabase/tests/big_data_vector_contract.sql`
  already expects `embedding_provenance='local_provider'` and is unchanged.
- Flipping `REMOTE_AI_KILL_SWITCH`, enabling patient-chat egress, widening the
  provider/host allowlist beyond DeepSeek, or extending the allowed data
  classes each require a new ADR and re-run of the contract suite. The test
  suite must never be weakened merely to make the blueprint green.
- This remains a synthetic-beta posture: no production healthcare compliance,
  no real-patient traffic, and no claim that the hosted provider call itself
  is proven by static tests.

## References

- plans/260909-1834-healthcare-whole-system-audit-remediation/plan.md (D-05)
- plans/260909-1834-healthcare-whole-system-audit-remediation/phase-09-supabase-recovery.md
- docs/deployment-beta.md (hosted AI posture)
- docs/LOCAL_RUNBOOK.md (local run posture, patient chat)
