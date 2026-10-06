# Triage label roles

Matt Skills Curated's `triage` workflow uses five canonical **roles**. These roles are repository workflow semantics; GitHub labels are their preferred representation, not the source of truth.

| Canonical role | Preferred GitHub label | Meaning |
|---|---|---|
| `needs-triage` | `needs-triage` | Incoming issue/request has not yet been classified or verified. |
| `needs-info` | `needs-info` | Execution is blocked on information from the reporter or another stakeholder. |
| `ready-for-agent` | `ready-for-agent` | Scope, evidence, acceptance criteria, and dependencies are sufficient for an engineering agent to execute. |
| `ready-for-human` | `ready-for-human` | The next required action is human-only: product decision, provider dashboard/MFA, approval, or another non-agent step. |
| `wontfix` | `wontfix` | Request is intentionally declined or outside scope; the reason must be recorded. |

## Mapping rules

- Reuse an existing repository label that clearly represents the same role instead of creating a duplicate synonym.
- Do not rename, delete, recolor, or otherwise mutate existing labels merely to match these preferred names.
- If the preferred label is absent and provider label creation is not explicitly in scope, keep the canonical role in the triage brief/body and report the missing label as an operational gap.
- A missing label must never be interpreted as a missing workflow state.
- Security severity/type labels, Dependabot labels, product-area labels, and automation-specific labels are orthogonal to these five roles.
- Moving an issue to `ready-for-agent` requires a durable, executable brief; moving it to `ready-for-human` requires the exact human action and why the agent cannot perform it.
