plans/261008-mobile-rail-selection/plan.md

Current phase: 01; next step: release isolation and commit. Exit: scoped owner-authored branch, protected-main CI/merge, exact deployed evidence.
Baseline: dbcd153e, no tracked WIP; inherited untracked files preserved. No task-owned server running; existing Playwright MCP processes are outside this task and retained.
Root cause: aria-current is correct, but unconditional primary CTA paint competes with pale selected styling. Reversible repair: share solid-green selected style and remove booking-only paint/raised layout.

Verification: original CSS 7 PASS/3 FAIL desired-state tests; repaired CSS 11 PASS/0 FAIL/0 SKIP. New tap-state test initially sampled the transition frame; wait for actual settled paint added, targeted then full suite passed. No runtime code repair beyond CSS required.
Actual local Next navigation PASS at 320/375/390/430, zero runtime errors; inspected local-doctors-375.png, equal >=44px targets. Streaming shell replacement initially interrupted screenshot and exposed hidden old tree; harness uses exactly one visible rail and viewport clipping. Source application semantics unchanged.
Independent code-reviewer PASS 9/10, no findings; independently reran 11 tests and diff-check. CSS SHA256 0AEA133E9F984A7A0B4EDEEDD51D45134AE18C2A38F3AAE8AD8E0489BA98C10B; tests 44149805581FFB1DC9D46EA9DF981F2679C6A7B5544CBECAA6508C71DE70565B. Package build/live unobserved at review checkpoint.
Docs impact: user intent and stateful evidence recorded here with executable test pointers; no existing evergreen navigation authority found, no new ADR/governance surface.
