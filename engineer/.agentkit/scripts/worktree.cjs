#!/usr/bin/env node
/**
 * Backward-compatible wrapper for worktree CLI.
 *
 * Canonical implementations:
 *   Source bundle:   engineer/skills/ak-worktree/scripts/worktree.cjs
 *   Installed kit:   .claude/skills/ak-worktree/scripts/worktree.cjs
 */

const fs = require('node:fs');
const path = require('node:path');

const candidates = [
  path.resolve(__dirname, '../../skills/ak-worktree/scripts/worktree.cjs'),
  path.resolve(__dirname, '../../.claude/skills/ak-worktree/scripts/worktree.cjs')
];

const canonical = candidates.find((candidate) => fs.existsSync(candidate));

if (!canonical) {
  throw new Error(`Cannot locate ak-worktree implementation. Checked:\n${candidates.join('\n')}`);
}

require(canonical);
