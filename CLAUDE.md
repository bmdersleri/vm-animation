# CLAUDE.md

Claude Code-specific supplement. [`AGENTS.md`](AGENTS.md) is the primary,
harness-agnostic agent contract — it is imported at the end of this file; this
file only covers where Claude Code differs from it.

## What's different for Claude Code

- **Methodology skill** — the user-level `dev-methodology` skill
  (`/dev-methodology`) lists the stages, gates and ledger rules this repository
  follows; `/dev-methodology init` re-checks the adoption and adds only missing
  pieces.
- **superpowers plugin required** — the methodology invokes its skills
  (brainstorming, writing-plans, using-git-worktrees,
  subagent-driven-development, test-driven-development,
  requesting-code-review, finishing-a-development-branch,
  verification-before-completion).
- **Tool modules:**
  - rtk: Bash output proxy, applied by a hook.
  - CodeGraph: `.codegraph/` index; use `codegraph_explore` before grep.
  - Remember: `.remember/` handoff notes; `.remember/remember.md` is the session handoff.
  - Serena MCP: `.serena/` project data (ignored).

## Agent contract

Claude Code does not load `AGENTS.md` on its own; it is imported here.

@AGENTS.md
