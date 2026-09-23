# ADR 0029 — The editor ships Labre's accent

- Status: **accepted** (2026-09-23)
- Deciders: Mathieu Jolly (arbitration 2026-09-23, on the recette of PR #400)
- Milestone: chantier « bleu AFFiNE → bleu Labre », lot J2
- Related ADRs: [0003](0003-telemetry-at-the-seam.md) (the same shape: the
  library ships a default, the host injects its own through one seam),
  [0009](0009-reversed-flag-contract.md) (flags gate tooling, never content —
  the accent is neither, it is chrome and is never gated).
- Related: `DESIGN.md` (The Labre Accent Rule, which this ADR writes, replacing
  The Borrowed Blue Rule), PR #400 (lot J1: every literal of the borrowed blue
  routed through a token), PR #395 (`LABRE_ACCENT`, the constant).

## Context

`DESIGN.md` recorded the chrome's accent as **borrowed**: `#1E96EB` is
AFFiNE's, inherited with the fork, "expected to be replaced". The rule attached
to it (The Borrowed Blue Rule) said only _how_ to hold it — always through a
token, never as a literal — so that the day a replacement was chosen, the
re-skin would be a token change. Lot J1 (PR #400) made that true: 61 literals
across 42 files now reach the accent through `--affine-primary-color`, and the
canvas, which cannot read a CSS variable, reaches it through
`getChromeAccentColor`.

Three facts then decided the shape of the replacement.

**1. The library owns no colour value.** It declares variable NAMES
(`shared/src/theme/css-variables.ts`) and nothing else. Every value comes from
`@toeverything/theme`, whose stylesheet the HOST loads
(`docs/integrate/01-install.md`). So "the library ships an accent" is not a
matter of changing a constant: the library has no constant to change.

**2. A host override does not reach the editor.** The recette of PR #400 found
this the hard way. Setting `--affine-primary-color` on `<html>` changes
nothing, because the upstream stylesheet declares the whole variable set three
times — on `:root`, on `[data-theme='light']` and on `[data-theme='dark']` —
and a host (this repo's own playground included) puts `data-theme` on the
viewport DIV that wraps the editor. That rule re-declares the accent BELOW
`<html>`, so the inherited override is shadowed for everything inside the
editor, while menus portalled onto `document.body` still see it: half the
chrome one colour, half the other.

**3. The canvas reads JS, not CSS.** `ThemeService.getCssVariableColor` looks
the value up in `combinedLightCssVariables` / `combinedDarkCssVariables`, two
tables frozen at compile time. No stylesheet, of the host's or of ours, can
move them.

The product owner settled the value on 2026-09-23: the Labre accent is
`#2563eb`, for the whole editor — chrome and canvas — in both themes. That is
the blue that entered the repository with PR #203 as the Wardley "needs" chip,
the only blue in this library ever chosen rather than inherited, and the only
one that carries white text at AA (5.17:1, against the borrowed blue's 3.17:1).

## Decision

**The library re-points the upstream accent onto `LABRE_ACCENT`, for both
surfaces, from one value, with one seam for the host.**

1. **One value.** `LABRE_ACCENT = '#2563eb'`
   (`affine/shared/src/consts/accent.ts`). Nothing else in the repository
   states the accent.

2. **A derived override, not a hand-written theme.**
   `affine/shared/src/theme/accent.ts` reads the upstream tables, finds every
   variable whose value carries the upstream accent — in any spelling, `#hex`,
   `#hexaa`, `rgb()`, `rgba()`, inside a compound value like a box-shadow — and
   restates that entry with `LABRE_ACCENT`, keeping the alpha. About forty
   variables per theme, none of them listed by hand, so a theme bump that adds
   an accent-coloured token is covered the day it lands. The upstream accent is
   never spelled out either: it is read back as the value of
   `--affine-primary-color`.

3. **Installed where the upstream sheet declares the same variables.**
   `ChromeAccentWatcher` (a `LifeCycleWatcher`, registered unconditionally in
   `affine/foundation/src/view.ts`) adopts a constructed stylesheet into the
   editor's document on `mounted`. Its selectors mirror upstream's —
   `:root, [data-theme='light']` and `[data-theme='dark']` — which is what
   makes it survive fact 2: it applies at `<html>` AND at the viewport div the
   host scopes the theme on. `adoptedStyleSheets` cascade after the document's
   own stylesheets, so the override wins at equal specificity without an
   `!important`.

4. **The same value on the canvas.** `ThemeService.getCssVariableColor` applies
   the same re-pointing to what it reads from the JS tables. Chrome and canvas
   therefore cannot drift apart, which is the property lot J1 was written to
   obtain and this lot has to keep.

5. **One host seam.** `ChromeAccentExtension('#rrggbb')` sets the accent for an
   editor; `ThemeService` and the stylesheet both read it. One value, both
   surfaces.

## Consequences

- **`DESIGN.md` is amended.** The Borrowed Blue Rule is replaced by **The Labre
  Accent Rule**: the accent is `#2563eb`, it is the library's, it is still only
  ever reached through a token (`var(--affine-primary-color)`,
  `cssVarV2(…)`) or, on the canvas, through `getChromeAccentColor` /
  `ThemeService`. `brand-hex.unit.spec.ts` keeps enforcing that no module
  spells the _borrowed_ accent out; nothing but `accent.ts` spells out the new
  one.
- **The Distinct Accent Rule is amended too, and its conflict accepted.** That
  rule asked for a hue family no notation uses. `#2563eb` is still blue (hue
  about 220°), so it still sits near the C4 ladder (`#1168BD`, `#438DD5`) and
  the canvas palette's medium blue (`#84CFFF`). The PO accepted that: the
  accent is darker and more saturated than either, the contrast complaint that
  motivated the rule is answered (5.17:1), and leaving the blue family would
  cost every framework a review of its own palette. The rule now reads as a
  constraint on NEW notation palettes — a framework must not settle next to the
  accent — rather than as a promise about the accent.
- **A host gets the accent for free.** No stylesheet, no configuration. A host
  with its own brand registers `ChromeAccentExtension`. An override written in
  plain CSS is possible (an inline declaration on the `[data-theme]` element,
  or an `!important` rule) but only moves the DOM, so it is documented as the
  wrong tool: it re-creates the two-accent editor.
- **One document, one accent.** The stylesheet is adopted per document, so two
  editors on the same page with different `ChromeAccentExtension` values are
  not a supported configuration; the last mounted wins. No host needs this
  today, and making the override per-editor would mean giving up the single
  sheet that reaches body-level portals.
- **Stored colours do not move.** The re-pointing is applied to chrome
  variables only. `model/src/themes/utils.ts`, which resolves the palettes a
  document STORES on its elements, is deliberately untouched — no
  `--affine-palette-*` variable carries the accent, and a unit test pins that
  (`DESIGN.md`, The Untouched Data Rule).
- **Residue, accepted and named.** Upstream also ships colours _derived_ from
  its accent without being it: `--affine-link-color` (`#1E67AF` light,
  `#78BEFF` dark) and, in dark only, `--affine-v2-text-emphasis` (`#29a3fa`),
  `--affine-v2-loading-foreground` and `--affine-v2-toggle-background`
  (`#0077cb`), `--affine-blue-600` and `--affine-primary-color-04`
  (`rgba(52, 116, 173, …)`). They are not the accent, so the rule above leaves
  them; they stay upstream's blue. Re-deriving a Labre shade for each is a
  design decision, not a mechanical one, and it is out of this lot.

## Alternatives considered

- **Ask the host for a stylesheet (lot J3 alone).** Rejected: fact 3. It cannot
  reach the canvas, and the editor would show two accents — the defect the
  recette of PR #400 surfaced.
- **A `--labre-accent` indirection**, where the library maps every accent token
  to `var(--labre-accent)` and defaults it at `:where(:root)` so a host beats it
  with one plain CSS declaration. Attractive for the DOM, and rejected for the
  same reason: a CSS-only override would move the chrome and leave the canvas
  behind, which is exactly the split this ADR exists to prevent. The seam moves
  both or neither.
- **Fork or patch `@toeverything/theme`.** Rejected: it contradicts the
  upstream policy in `CLAUDE.md` (targeted cherry-picks, never a fork of the
  published scope) and creates a permanent merge debt for a change that is
  forty variables wide.
- **Hand-list the variables to override.** Rejected: the list drifts on every
  theme bump, silently, and the drift is invisible until someone notices a blue
  that does not match.
