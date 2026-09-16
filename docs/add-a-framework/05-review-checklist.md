# Review checklist

**What a reviewer, human or AI, checks before merging a framework or a
change to one. Paste it in the PR and tick.**

## Contract

- [ ] The flag gates tooling only. The render half is registered
      unconditionally; a stored board paints with the flag off.
- [ ] The two providers are registered in `all/src/extensions/view.ts`,
      render half first, gated half right after.
- [ ] Models extend `FrameworkBackgroundElementModel` and `ShapeElementModel`;
      no copied overrides.
- [ ] New fields default to `undefined` or are documented in an ADR with
      their loadability story. Enum values are append-only.
- [ ] `FrameworkId`, flag key, descriptor id, command owner: one spelling.
      `telemetryKey` is set and, for an existing framework, unchanged.

## Declarations

- [ ] Every command has `iconKey`, `labelKey` with fallback, `surfaces`,
      `category`, `telemetry`. The board command has `board: true`.
- [ ] The descriptor's `iconKey` (`<segment>.toolbar`) is registered in the
      framework's icon table, pointing at the senior button's 56×56 glyph.
- [ ] At most 14 senior-menu nominations. Import in the sub-menu, export on
      the board toolbar.
- [ ] Roles are `my:<local>`, kebab-case, `as const satisfies`. Edge roles
      declare a direction.
- [ ] Presets are the only source of sizes and fonts. Labels are free text
      grouped with the shape.
- [ ] R33: neutrals come from `NOTATION_NEUTRALS`; no neutral hex in the
      module (previews, glyphs and templates included) outside a stencil
      exception; identity colours (a colour code recognises a stored element
      by) stay literal.
- [ ] Rules name a `backgroundRole`; the default profile is the most
      permissive; no rule uses `blocking-overridable`.
- [ ] Every user-visible string is a `com.labre.*` key in `translations.ts`.
- [ ] `commands-manifest.ts` matches `commands.ts`.

## Tests

- [ ] Unit specs for models, actions, roles, commands manifest, templates
      parity, and each optional layer shipped.
- [ ] An integration spec on the canvas.
- [ ] All `packages/affine/all/src/__tests__` suites green (registry,
      board-role, reading-coverage, template-categories-gating,
      senior-row-order, translations manifest).
- [ ] `yarn build` green (typecheck includes tests).

## Hygiene

- [ ] Comments and identifiers in English; docblocks say why and cite the
      ADR or issue.
- [ ] No `customElements.define` outside `effects.ts`.
- [ ] No telemetry emission in `actions.ts`.
- [ ] No deep import from another framework; shared code goes to
      `affine/blocks/surface` or a shared package.
- [ ] `ponytail:` on every deliberate shortcut.
- [ ] A changeset. Commit scope `edgeless`.

## Product

- [ ] Senior button with its own icon, in descriptor order.
- [ ] Board picked by its border, under its artefacts, resize toggle on its
      toolbar.
- [ ] Each artefact moves, connects, morphs, copies and undoes like a shape.
- [ ] Legend, export, rules: present, or their absence recorded in an ADR.
