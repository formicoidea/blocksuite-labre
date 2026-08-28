# ADR 0013 — Cynefin/Estuarine carries no validation rules, by design

- Status: accepted (August 2026)
- Deciders: Mathieu Jolly
- Relates to [ADR 0009](./0009-reversed-flag-contract.md) (flags gate tooling, never content)

## Context

Seven of the eight frameworks declare `rules.ts`, `profiles.ts` and `legend.ts`, and are
evaluated by the validation engine. `cynefin-estuarine` declares none of the three. Read as
an inventory gap, this looks like unfinished work — the 2026-08-28 backlog audit classified
it exactly that way.

It is not a gap. Wardley, BPMN, C4 and the DDD frameworks are **notations**: they have a
grammar, so a placement can be wrong and an engine can say so. Cynefin is a **sensemaking
frame**. Which domain a situation belongs to is the participant's judgement about their own
context; there is no external truth for a rule to check. Validating it would assert an
authority the frame explicitly refuses.

## Decision

`cynefin-estuarine` ships without `rules.ts`, `profiles.ts` or `legend.ts`, and is not
registered with the validation engine. Its existing `roles.ts` and `nudges.ts` stay:
roles carry identity, nudges are descriptive prompts, neither is normative.

## Consequences

- A Cynefin board draws no violation badge, no severity profile, no conformity panel.
  The absence is the feature.
- Framework coverage of the validation platform is 7/8 and complete at that number. An audit
  reporting "missing `rules.ts`" should be closed against this ADR.
- Revisit only for a rule about *form* rather than judgement — an element belonging to no
  domain, say. A rule about *where* something belongs stays out of scope permanently.
