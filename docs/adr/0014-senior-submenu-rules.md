# ADR 0014 — The senior sub-menu obeys one set of rules, for every framework

- Status: accepted (August 2026)
- Deciders: Mathieu Jolly
- Relates to [ADR 0009](./0009-reversed-flag-contract.md) (flags gate tooling, never content)
  and [ADR 0012](./0012-framework-interchange-and-foreign-preservation.md) (interchange
  capabilities and their import commands)

## Context

Every framework's senior button opens the same sub-menu component
(`EdgelessCommandMenu`), fed by the same arbitration
(`selectSeniorMenuCommands` in `packages/framework/std/src/extension/command-registry.ts`).
During the interchange wave the question "which buttons does a framework's sub-menu show,
and who decides" was answered piecemeal — an eligibility ruling here, a nomination budget
there, an import-placement decision in a PR body. The rules were general in the code but
scattered in the record, and a reader comparing the Wardley row to the BPMN row could
reasonably wonder whether they played by different rules. They do not, and never may.

## Decision

The senior sub-menu is governed by six rules. They apply to every framework identically;
no framework negotiates a private variant.

- **R1 — One cap.** The sub-menu shows at most `SENIOR_MENU_CAP` (14) buttons. While the
  framework's catalogue holds ≤ 14 commands, every nominated command is shown as declared.
  Past the cap, the row is `SENIOR_MENU_RANKED_SLOTS` (13) arbitrated seats plus the
  permanent "More artefacts…" button opening the catalogue.
- **R2 — Eligibility is declared, never inferred.** Only a command whose descriptor
  declares `surfaces: ['senior-menu', …]` can ever occupy a seat. Usage cannot vote in a
  command that declined the row.
- **R3 — Seats are arbitrated by use, displayed in authored order.** Seven recency slots,
  six frequency slots, then the survivors are re-sorted into the author's declared order so
  buttons never jump around. On a cold start (no usage), the row is simply the authored
  head of the nomination list. A command the user reaches for earns its seat — this is how
  an import climbs into view.
- **R4 — The nomination budget is `CAP + 1` per framework.** The `+1` is the framework's
  native-format import (decision of 2026-08-28: interpreted imports of the framework's own
  format live in the senior sub-menu, because an import is where a board comes _from_).
  A test (`registry.unit.spec.ts`) fails on any further nomination: exceeding the budget is
  a curation decision the product owner makes deliberately, not a drift a diff review can
  miss.

  **Amendment 2026-09-03 (the curation decision R4 asked for).** Wardley reached the budget
  with `addPorter` and the two climate arrows (`addAccelerator`, `addDecelerator`) took it
  past: the product owner ruled that **every Wardley artefact nominates the row**, so the
  nomination budget no longer caps that framework. The row is untouched — 13 arbitrated
  seats plus "More artefacts…", still a cap of 14 (R1) — and the catalogue still lists
  everything, so what the ruling changes is only which artefacts are _eligible_ for a seat;
  recency and frequency (R3) decide who is shown. No curation of the nomination list, and
  no change to the cap.

- **R5 — Native format in the row, fallback in the catalogue.** A framework nominates the
  import of its own semantic format (`.bpmn` for BPMN, `.owm` for Wardley). Fallback
  imports (the visual-tier SVG sketch, and any future best-effort route) declare
  `catalogue` only — one click away behind "More artefacts…", never spending a seat the
  native route needs. Exports stay off the row entirely; their subject is a board the user
  already has, reached from its own contextual toolbar or the catalogue.
- **R6 — One mechanism.** All of the above lives in shared code
  (`selectSeniorMenuCommands`, `EdgelessCommandMenu`, the command registry). A framework
  contributes only data: its command descriptors. Any behaviour difference between two
  frameworks' sub-menus is a bug, not a policy.

## Consequences

- Comparing two frameworks' rows requires no per-framework knowledge: differences in what
  is _shown_ come only from their declared nominations, authored order and recorded usage.
- Adding a sixteenth nomination to a framework at the budget makes a test fail by design.
  The failure message is the request for a curation decision.
- A new framework gets all of this for free by declaring descriptors; it cannot opt out.
- The cold-start row favours drawing tools (authored head); import buttons surface through
  use. If product feedback shows imports need cold-start visibility, the lever is the
  authored order or a curation decision under R4 — not a mechanism change.
