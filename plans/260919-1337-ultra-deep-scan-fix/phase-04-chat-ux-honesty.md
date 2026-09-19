---
phase: 4
title: "Chat UX honesty (P2 backlog)"
status: pending
priority: P1
effort: "3-4h"
dependencies: [1, 3]
---

# Phase 4: Chat UX honesty (P2 backlog)

## Overview
Make the assistant honest about what the user is seeing: label fallback answers, keep quota exact, support cancel/retry, and keep wait-stage messaging coherent.

## Requirements
- Functional: fallback answers visibly labelled as offline guidance (D3); quota decremented exactly once per successful AI answer; in-flight request cancellable; retry respects policy.
- Non-functional: no new design system; Flat UI tokens; WCAG contrast for the label.

## Architecture
`FloatingHealthAssistant` renders the existing `provenance`/`safety_action` contract — add a small "offline guidance" state keyed on `local_fallback` instead of styling it as a normal answer. Quota hook stays server-authoritative.

## Related Code Files
- Modify: `apps/frontend/components/FloatingHealthAssistant.tsx`, `apps/frontend/components/useChatWaitStage.ts`, `apps/frontend/app/patient/chat/**` (quota call site)
- Test: `apps/frontend/tests/floating-assistant.test.mjs`, new quota regression test (AC12)

## Implementation Steps
1. **Fix `AssistantProvider.tsx:64`** — it currently returns `null` for `INSUFFICIENT_EVIDENCE`, so today's production fallback renders with NO label at all. Make `local_fallback` render a calm muted chip **above the answer text inside the bubble** (reuse the existing `data-provenance="local_fallback"` span, moved from the meta footer to the leading edge). Never apply to the EMERGENCY variant (its alarm block is intentional).
2. **Rewrite the BFF fallback copy** (`healthcare-bff.ts:171`) — "Tôi chưa có đủ thông tin đã xác thực…" is engineering jargon a patient cannot parse. Approved options (Advisor): A) chip "Hướng dẫn tạm thời" + "Chưa thể trả lời bằng AI lúc này. Đây là hướng dẫn tạm thời; vui lòng thử lại sau." — or B) "Gợi ý tạm thời — chưa phải trả lời AI. Nhấn 'Thử lại' để nhận câu trả lời đầy đủ." Pair the label with a one-tap "Thử lại" (AC15).
3. Verify quota decrement call site — only after successful answer; add regression test (AC12).
4. Cancel in-flight AI request (AbortController) + policy-conform retry.
5. Align `useChatWaitStage` (client-side timers) with Phase 1b's final budget table: stages must cover the full 35s window so the input is visibly alive (AC2).
6. Greeting behavior regression: server-authoritative greetings preserved (merged commit 9773f95).

## Success Criteria
- [ ] AC6 frontend suite green, AC7 typecheck+lint green
- [ ] AC12 quota regression test green
- [ ] AC13 fallback label visible on production screenshots (desktop + mobile)
- [ ] AC15 BFF copy rewrite landed; no "thông tin đã xác thực" jargon remains

## Risk Assessment
Label could alarm users → copy reviewed by Advisor; quota logic touches billing-adjacent path → server contract unchanged, tests-first.
