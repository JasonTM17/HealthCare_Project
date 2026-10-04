---
name: healthcare-payment-deep-review
description: Independent read-only Admin payment approval/rejection, concurrency, authorization and patient-refresh audit.
agent: subagent_explore
---

Run in a fresh native read-only Explore context with backend/payment reviewer responsibility. Read .devin/agents/healthcare-reviewer.md and original project code-reviewer description when permitted. Report model unknown unless observable; no qualified model-family/production route claim.

Read reports/local-audit-expanded-scope.json first. Inspect frozen BankTransferPaymentService/repository/AdminPaymentController/admin UI and direct patient payment, DTO, audit, notification/email, invoice, demo/security guards and focused tests. No peer reports. R0: no writes, commands, service/database queries, real/fixture financial API mutation, credentials/private statement reads, peers, commits, push/deploy or deletion.

Trace submission/idempotency, approval/rejection/resubmission, duplicate verification, concurrent approve/reject and appointment cancellation, transaction/lock acquisition order, retry/audit/notification duplication, server ADMIN enforcement versus UI controls, exact amount/reference provenance and safe invoice issuance. Check whether a webhook/CSV merely queues review or can self-authorize PAID, and whether patient refresh/realtime reflects the committed decision. Distinguish simulated local state transitions from bank settlement, real refund or gateway evidence. Do not compose production queries or a financial/eval scoring configuration.

Return source-identity limits, grounded findings with severity/confidence/path/line/mechanism/abuse case, conflicting state transitions and exact existing Testcontainers/UI seam for execution confirmation. High-severity concurrency claims are hypotheses until a fresh deterministic schedule is executed by the controller/owned tester. No policy relaxation, real-money action, source editing or release approval.
