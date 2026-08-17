#!/usr/bin/env node
/**
 * Backward-compatible wrapper for worktree tests.
 *
 * Canonical test suites:
 *   Source bundle:   engineer/skills/ak-worktree/scripts/worktree.test.cjs
 *   Installed kit:   .claude/skills/ak-worktree/scripts/worktree.test.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  path.resolve(__dirname, '../../skills/ak-worktree/scripts/worktree.test.cjs'),
  path.resolve(__dirname, '../../.claude/skills/ak-worktree/scripts/worktree.test.cjs')
];

const canonical = candidates.find((candidate) => fs.existsSync(candidate));

if (!canonical) {
  throw new Error(`Cannot locate ak-worktree test suite. Checked:\n${candidates.join('\n')}`);
}

require(canonical);
