# Matt Skills Curated routing contract

This repository uses **Matt Skills Curated** as the preferred runtime workflow catalog for engineering-agent work.

The repository does **not** vendor the skill bodies. The installed/runtime skill package is the source for each `skill.md`; this file only defines when Avkroken agents should route to those skills and how that routing interacts with repository rules.

## Precedence

1. Current live provider/runtime state when the task depends on external state.
2. Repository `AGENTS.md`, project-context, architecture, security, operations, ADRs, tests, and versioned configuration.
3. The originating issue/specification and explicit user instructions.
4. Matt Skills Curated workflow guidance.
5. Older notes, exports, chats, or assumptions.

A skill may structure the work, but it may not override repository security boundaries, provider permissions, required checks, or documented architecture.

## Routing invariants

- If the user explicitly names `@Matt Skills Curated` or a packaged skill, honor that route unless it conflicts with a harder repository/safety constraint.
- If the task is ambiguous or spans multiple engineering phases, use `engineering-workflow-guide` to select the narrowest effective specialist.
- If the specialist is obvious, invoke it directly; do not add ceremony by routing through meta-skills first.
- Use **one primary skill per lifecycle phase**. Chain skills only when the work crosses a real phase boundary.
- Never invent or paraphrase a missing skill body. If a named skill is unavailable in the current runtime, say so and continue with repository-native rules rather than fabricating instructions.
- Do not copy the 42 skill definitions into this repository. Keep this routing contract small and let the runtime package own the skill implementation.
- Human-only dashboard, MFA, billing, or credential navigation belongs in `wizard`; agent-capable CLI/API work should be executed directly instead of pushed onto a human.
- Material implementation must finish with repository-native validation and a `code-review` pass against a pinned merge base and the originating spec/issue.
- Pull requests are not merge-ready while required checks, unresolved review threads, active change requests, merge conflicts, or declared external deployment checks remain unresolved.

## Catalog drift gate

The version-controlled catalog snapshot is `docs/agents/matt-skills-catalog.txt`.

Before routing non-trivial work through Matt Skills Curated, an agent that can inspect the installed plugin catalog must compare the current `skills://plugins/matt-skills-curated/*` names against that snapshot.

- **Exact match:** proceed normally.
- **New, renamed, or removed runtime skills:** treat this routing contract as stale; read the changed packaged skill definitions and update the snapshot/routing contract before relying on the changed route.
- **Runtime catalog cannot be inspected:** continue with repository-native rules and only use skill definitions that are actually available; do not assume the snapshot proves runtime availability.

Repository CI cannot inspect the ChatGPT plugin runtime. It verifies internal consistency between the snapshot, routing document, and triage mapping. Runtime-vs-snapshot drift is an agent preflight responsibility.

## Canonical lifecycle routes

| Situation | Preferred route |
|---|---|
| Fuzzy or under-specified feature | `grill-with-docs` → `to-spec` → `to-tickets` → `implement` |
| Concrete approved implementation | `implement` |
| Behavior change or bug fix with a stable seam | `tdd` |
| Hard/intermittent bug or regression | `diagnosing-bugs` → `tdd` |
| Technical/API fact finding | `research` |
| Pull request or branch review | `code-review` |
| Module/API seam design | `codebase-design` |
| Broad architectural survey/refactor | `improve-codebase-architecture` |
| Domain terminology / ADR work | `domain-modeling` |
| Manual dashboard / credential prerequisite | `wizard` |
| Repeatable operational or approval loop | `workflow-designer` |
| Merge/rebase conflict | `resolving-merge-conflicts` |
| Destructive/history-rewriting Git operation | `git-safety-guardrails` |
| Large multi-session migration | `wayfinder` |
| Session transfer | `handoff` |
| Completed-session improvement pass | `retro` |

## Full packaged catalog

All packaged skills remain available when their trigger matches:

### Engineering, planning, and review

- `engineering-workflow-guide` — route ambiguous/multi-phase engineering work.
- `grill-me` — focused requirements/decision interview.
- `grill-with-docs` — requirements interview with durable domain/ADR capture.
- `grilling` — adversarial thinking interview.
- `to-questionnaire` — external stakeholder unknowns into a questionnaire.
- `to-spec` — settled requirements into a buildable technical specification.
- `to-tickets` — approved spec into dependency-linked implementation tickets.
- `wayfinder` — map large multi-session efforts.
- `prototype` — throwaway design/state/UI experiment.
- `research` — primary-source technical research.
- `domain-modeling` — ubiquitous language, context, and ADRs.
- `implement` — scoped implementation from an approved plan/spec.
- `implement-spec` — full ticketed specification across isolated implementation streams.
- `tdd` — red/green/refactor behavior work.
- `diagnosing-bugs` — evidence-first root-cause diagnosis.
- `code-review` — two-axis standards/spec review.
- `codebase-design` — deep module and interface seams.
- `improve-codebase-architecture` — architecture survey and deepening opportunities.
- `setup-ts-deep-modules` — TypeScript package boundaries and cycle rules.
- `migrate-to-shoehorn` — replace unsafe TS test fixture casts.
- `setup-pre-commit` — Husky/lint-staged quality gates.
- `resolving-merge-conflicts` — intent-preserving conflict resolution.
- `git-safety-guardrails` — destructive Git protection.
- `setup-engineering-workflows` — tracker/domain/agent-workflow setup.
- `triage` — classify and prepare external reports/requests.

### Operations and agent execution

- `wizard` — human-only dashboard/credential setup.
- `workflow-designer` — recurring operational/review workflows.
- `goal` — autonomous unattended goal contracts.
- `j-space` — deep multi-step cognitive workspace.
- `handoff` — portable session state.
- `retro` — improve agent environment and workflow after completed work.

### AI, ML, and data

- `ai-engineering` — production ML/LLM system design and deployment.
- `ml-best-practices` — statistical ML, evaluation, feature engineering, confidence intervals.
- `ai-data-remediation` — semantic anomaly clustering and self-healing data pipelines.

### Agent authoring, teaching, and writing

- `writing-for-agents` — agent-facing instructions, AGENTS files, and context pointers.
- `skill-conductor` — author/evaluate/package skills.
- `teach` — interactive technical learning.
- `wait-what` — re-pitch a confusing explanation from simpler assumptions.
- `scaffold-exercises` — course/workshop exercise scaffolding.
- `writing-fragments` — collect raw writing material.
- `writing-shape` — turn fragments/research into structured drafts.
- `writing-beats` — develop long-form writing beat by beat.

## Phase completion

Before declaring an engineering phase complete:

- read the repository-native instructions for the affected area;
- verify the current branch is based on the intended default branch and does not overwrite concurrent work;
- run the narrowest relevant tests while iterating and the full required gate before handoff/merge;
- review the final diff against both repository standards and the originating requirement;
- read the complete PR review state, including outdated threads, before merge;
- keep secrets, tokens, private keys, credential values, and private payloads out of code, docs, logs, issues, PRs, and chat.
