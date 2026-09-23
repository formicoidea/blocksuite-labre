---
name: Labre editor library
description: Markdown + whiteboard editor for enterprise transformation architects — quiet AFFiNE-derived chrome around standard-faithful framework notations.
colors:
  accent-borrowed-blue: '#1E96EB'
  labre-accent: '#2563EB'
  link-deep-blue: '#1E67AF'
  processing-blue: '#2776FF'
  success-green: '#10CB86'
  error-red: '#EB4335'
  ink: '#121212'
  ink-muted: '#8E8D91'
  ink-disabled: '#A9A9AD'
  icon-graphite: '#77757D'
  placeholder-grey: '#C0BFC1'
  quote-bar-grey: '#C2C1C5'
  paper: '#FFFFFF'
  overlay-paper: '#FBFBFC'
  surface-secondary: '#F4F4F5'
  surface-tertiary: '#EEEEEE'
  code-surface: '#F7F8FA'
  hairline: '#E3E2E4'
  canvas-grid: '#E6E6E6'
  hover-veil: 'rgba(0, 0, 0, 0.04)'
  tooltip-black: '#000000'
  notation-ink: '#1F2328'
  notation-divider: '#9AA0A6'
  notation-card-border: '#E3E2E4'
  notation-legend-border: '#CFD2D6'
  edgy-identity: '#00EA4E'
  edgy-architecture: '#034CEE'
  edgy-experience: '#FF0056'
  edgy-organisation: '#00CAF4'
  edgy-brand: '#FFA500'
  edgy-product: '#CF00FF'
  c4-person: '#08427B'
  c4-system: '#1168BD'
  c4-container: '#438DD5'
  c4-component: '#85BBF0'
  c4-boundary: '#444444'
  bpmn-event-start: '#43A06B'
  bpmn-event-end: '#CF5648'
  notation-frame-ink: '#3B3D42'
  notation-label: '#6B7280'
  canvas-highlighter: '#84CFFF4D'
typography:
  headline-1:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '32px'
    fontWeight: 700
    lineHeight: 'calc(1em + 8px)'
    letterSpacing: '-0.02em'
  headline-2:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '26px'
    fontWeight: 600
    lineHeight: 'calc(1em + 10px)'
    letterSpacing: '-0.02em'
  headline-3:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '20px'
    fontWeight: 600
    lineHeight: 'calc(1em + 8px)'
    letterSpacing: '-0.02em'
  title:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '18px'
    fontWeight: 600
    lineHeight: 'calc(1em + 8px)'
    letterSpacing: '-0.015em'
  body:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '15px'
    fontWeight: 400
    lineHeight: 'calc(1em + 8px)'
  label:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '14px'
    fontWeight: 400
    lineHeight: 'calc(1em + 8px)'
  caption:
    fontFamily: 'Inter, Source Sans 3, Poppins, apple-system, BlinkMacSystemFont, Helvetica Neue, Tahoma, Arial, sans-serif'
    fontSize: '12px'
    fontWeight: 400
    lineHeight: 'calc(1em + 8px)'
  code:
    fontFamily: 'IBM Plex Mono, Space Mono, Consolas, Menlo, Monaco, Courier, monospace'
    fontSize: '15px'
    fontWeight: 400
  numeric:
    fontFamily: 'Roboto Mono, Noto Sans Mono, apple-system, sans-serif'
    fontSize: '14px'
    fontWeight: 400
rounded:
  hairline: '2px'
  sm: '4px'
  md: '8px'
  lg: '12px'
spacing:
  xs: '4px'
  sm: '8px'
  md: '12px'
  lg: '16px'
  paragraph: '8px'
  editor-width: '944px'
components:
  icon-button:
    backgroundColor: 'transparent'
    textColor: '{colors.icon-graphite}'
    rounded: '{rounded.sm}'
    padding: '4px'
  icon-button-hover:
    backgroundColor: '{colors.hover-veil}'
  icon-button-active:
    textColor: '{colors.accent-borrowed-blue}'
  icon-button-disabled:
    textColor: '{colors.ink-disabled}'
  editor-toolbar:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.md}'
    padding: '0 6px'
    height: '36px'
  menu-panel:
    backgroundColor: '{colors.overlay-paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '8px'
    width: '180px'
  menu-item:
    backgroundColor: 'transparent'
    textColor: '{colors.ink}'
    typography: '{typography.label}'
    rounded: '{rounded.sm}'
    padding: '4px'
  menu-item-hover:
    backgroundColor: '{colors.hover-veil}'
  menu-input:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.ink}'
    rounded: '{rounded.sm}'
    padding: '4px 6px'
  framework-board-card:
    backgroundColor: '{colors.paper}'
    textColor: '{colors.notation-frame-ink}'
    rounded: '{rounded.lg}'
---

# Design System: Labre editor library

## Overview

**Creative North Star: "Quiet Chrome, Loud Notation"**

The editor has two layers. The **chrome** (toolbars, menus, icon buttons, popovers, the page itself) is AFFiNE's visual system as it stands, delivered by `@toeverything/theme` 1.1.15 with no Labre overrides. It is neutral grey on white, 4px corners, Inter at 15px, and one borrowed blue for interaction. It follows the app theme (`data-theme="light" | "dark"`) and stays out of the way: controls appear on selection, sit in a single 36px row, and hold back when nothing is selected.

The **notation** (EDGY, C4, BPMN, Wardley, Event Storming, DDD, Cynefin) is where the colour lives. Each framework paints with the colours of its own standard or stencil, fixed in model units and fixed in both themes. A C4 container is `#438DD5` on every screen and in every export, because a diagram is a document that has to read the same in a slide deck as it does in the editor.

**Labre's identity is the frameworks themselves.** The chrome is deliberately not where Labre sets itself apart. What it offers is the set of framework notations it draws faithfully and lets you combine on one canvas. Design effort goes into the notations, and the chrome only has to stay out of their way.

This file describes the system **as it is**. It records the incumbent implementation; it is not a target. The chrome's accent is inherited from upstream and is expected to be replaced (see The Borrowed Blue Rule).

**Key Characteristics:**

- Neutral, low-contrast chrome: greys and hairlines, with the accent kept to selection, focus and active states.
- Framework notations keep the colours of their standard and ignore the app theme.
- Compact, fixed-height controls (36px toolbar, 4px-padded icon buttons, 4px corners).
- Flat document surfaces; shadows only on floating panels.
- Light/dark switching comes from the upstream theme's CSS variables, never from per-component colour logic.

## Colors

Several palettes on one canvas: an achromatic chrome with one blue accent, the base canvas palette for free drawing, and one palette per framework notation. The base canvas palette and the framework palettes coexist by design. A board can carry an EDGY facet, a C4 container and a free pastel sticky side by side.

### Primary

- **Borrowed Blue** (accent-borrowed-blue): the only interaction colour in the chrome: selection marquee border, active icons, focused inputs, primary buttons, emphasis text. Inherited from AFFiNE (`--affine-brand-color`, `--affine-primary-color`, `--affine-v2-button-primary`). Its focus-ring form is `rgba(30, 150, 235, 0.3)` at 2px.
- **Labre Accent** (labre-accent): the accent Labre chose for itself, and the only one it owns. It paints the direction chip of every typed connector — the verb revealed along a link on hover and on selection — in every framework (`LABRE_ACCENT`, `packages/affine/shared/src/consts/accent.ts`). Distinct from the Borrowed Blue on purpose: a chip carries white text, and `#2563EB` gives it 5.17:1 where `#1E96EB` gives 3.17:1. It is a JS constant rather than a token because the canvas and the marks drawn over it resolve their colours in JS and never read a CSS variable.
- **Link Deep Blue** (link-deep-blue): inline links in prose (`--affine-link-color`).

### Secondary

- **Processing Blue** (processing-blue): in-progress status only (`--affine-processing-color`).
- **Success Green** (success-green): success status (`--affine-success-color`).
- **Error Red** (error-red): errors _and_ warnings. Upstream uses the same value for both (`--affine-error-color`, `--affine-warning-color`), so a warning currently looks like an error.

### Neutral

- **Ink** (ink): primary text and toolbar glyphs (`--affine-text-primary-color`).
- **Ink Muted** (ink-muted): secondary text, metadata, captions.
- **Ink Disabled** (ink-disabled): disabled text and disabled icon-button glyphs.
- **Icon Graphite** (icon-graphite): default icon colour and panel text (`--affine-icon-color`).
- **Placeholder Grey** (placeholder-grey): empty-block placeholders.
- **Quote Bar Grey** (quote-bar-grey): the quote block's left rule.
- **Paper** (paper): the page and the default background of every framework board card.
- **Overlay Paper** (overlay-paper): menus and popovers, a hair off-white so they separate from the page.
- **Surface Secondary / Tertiary** (surface-secondary, surface-tertiary): filled controls, wells and bands.
- **Code Surface** (code-surface): code block background.
- **Hairline** (hairline): borders and dividers. Border and divider share one value.
- **Canvas Grid** (canvas-grid): the edgeless canvas dot/line grid.
- **Hover Veil** (hover-veil): the single hover treatment for every transparent control: a 4% black wash, never a colour.

### Notation palettes

The hues belong to the frameworks, not to the chrome. They live in each module's `consts.ts` (or `background.ts`) under `packages/affine/gfx/*`. The neutrals are shared (see below).

- **EDGY facets** (edgy-identity, edgy-architecture, edgy-experience, edgy-organisation, edgy-brand, edgy-product): the six EDGY facet hues, saturated and taken from the EDGY standard, with white pictos and separators.
- **C4 elements** (c4-person → c4-component): the stencil's blue ladder, darkest for a person and palest for a component, with a darker border one step down from each fill. White text on the first three, black on the component. Boundaries and relationships are drawn in **C4 Boundary** (c4-boundary) with square corners, taken from the stencil.
- **BPMN** (bpmn-event-start, bpmn-event-end): a green start event and a red end event. Tasks, gateways, sequence and message flows and associations are drawn in the shared Ink on white. Pool frames and participant names are in Frame Ink, and the participant strip in Band.
- **Wardley**: a charcoal axis, grey labels, and four pale-blue evolution bands (`#F7FAFF → #DDE8F4`) on a white card with a hairline border. Wardley is the reference for every notation's neutrals.
- **Cynefin / Estuarine**: the inks of the official SVGs, kept as they are.
- **Canvas palette**: free shapes, connectors, notes and brush strokes use upstream's edgeless palette (`--affine-v2-edgeless-palette-{light,medium,heavy}-*`, e.g. medium blue `#84CFFF`, medium grey `#929292` for connectors). The highlighter is medium blue at 30% (canvas-highlighter). It coexists with every framework palette.

### Notation neutrals

A single scale, `NOTATION_NEUTRALS` (`packages/affine/shared/src/consts/notation.ts`), taken from the Wardley map. Every framework reads its neutrals from it, Wardley included:

- **Ink** (notation-ink): artefact strokes, text inside and under artefacts, labels, legend text, default connectors.
- **Frame Ink** (notation-frame-ink): background structure such as axes, frame lines, board titles, pool frames and names.
- **Label Grey** (notation-label): secondary labels on backgrounds, tick labels.
- **Divider Grey** (notation-divider): dashed dividers, BPMN group strokes, secondary strokes.
- **Card** (paper) and **Card Border** (notation-card-border): the white board card and its hairline.
- **Legend Border** (notation-legend-border): the frame and separators of auto-legends.
- **No tinted bands.** Strips on board backgrounds (the BPMN participant strip, the C4 title band, generic template columns) are plain Card white, set apart by their divider line. Only the Wardley map keeps a tint, its four-step evolution gradient, because there the gradient carries meaning.

Greys that carry a meaning are not neutrals and stay put: C4 external elements (out of scope), Core Domain grey zones, the DDD "future position" dot. Stencil-sourced neutrals stay too: C4 `#444444`, the EDGY base-shape ink `#262626` (official pictograms), and the Cynefin/Estuarine official inks. The DDD Aggregate canvas keeps its own blue-greys.

### Named Rules

**The Borrowed Blue Rule.** The accent `#1E96EB` is AFFiNE's, not Labre's, and it is due to be replaced. Always reach it through a token (`cssVarV2('button/primary')`, `var(--affine-primary-color)`), never as a literal hex, so the re-skin is a token change. Don't give it any new brand meaning in the meantime.

**The Standard-Fidelity Rule.** A framework's notation hues, and any neutral its standard or stencil prescribes, match that source exactly and never follow the app theme, dark mode included. A diagram looks the same in every theme, export and host. If a prescribed colour differs from the published standard, that is a bug.

**The Wardley Neutrals Rule.** Every neutral a standard doesn't prescribe (inks, greys, borders, card fills, bands) comes from `NOTATION_NEUTRALS`, whose reference is the Wardley map. Don't write a neutral hex in a framework module. A new framework picks its neutrals from the scale and brings only its hues.

**The Untouched Data Rule.** Changing a neutral never rewrites a document. Backgrounds (boards, axes, frames, bands) are painted at render time and follow the scale immediately. Colours stored on user elements (nodes, connectors, legends, inserted templates) are user data: they keep their stored value, and only new elements take the new default. Code that recognises an element by its colour must keep accepting the old value.

**The Coexisting Palettes Rule.** The base canvas palette and every framework palette are available together. No framework hides or replaces the base palette, and a framework palette is never trimmed to fit another. Each palette keeps its own hues. Only the neutrals are shared (see The Wardley Neutrals Rule).

Coexisting means reachable, so every contextual colour picker on the canvas is a **carousel**: one page per active palette, named above the swatch grid, the base palette always page one and never hidden. The name is the panel's title — Ink, 500, on the same left edge as the section labels and the swatch grid, compact and followed by its chevron, its hover pill bleeding outward so the text never leaves that edge — and it is a button that swaps the swatch grid for an inline list of the pages, each row its name on that same edge beside a right-aligned strip of its own swatches, the page in force ticked. A wheel anywhere over the picker pages one step at a time, wrapping. The picker opens on the palette of the selected element's framework of origin — its own role's namespace, else a connector's two ends, else the smallest framework board containing it — and on the base palette when the element belongs to no framework or the selection is mixed. A framework whose tooling is switched off contributes no page, because offering hues is tooling; the colours it already painted are content and do not move. Nothing is written to the document but a plain colour value (ADR 0027).

**The Distinct Accent Rule.** The chrome accent is reserved for interaction (selection, focus, active states) and has to stay recognisable against every notation hue. Chrome never borrows a notation hue, and a notation never borrows the accent. Known conflict: today's Borrowed Blue (`#1E96EB`, hue about 246°) sits in the same hue family as the C4 blue ladder (`#1168BD`, `#438DD5`) and the base palette's medium blue (`#84CFFF`), so a selection on a C4 diagram reads weakly. The replacement accent must come from a hue family that no notation palette uses, and a new framework palette must not settle next to the accent's hue.

## Typography

**Display Font:** none (the editor has no display tier)
**Body Font:** Inter (with Source Sans 3, Poppins, system sans)
**Label/Mono Font:** IBM Plex Mono for code (with Space Mono, Consolas, Menlo); Roboto Mono for tabular numbers

**Character:** One humanist sans for everything. It is a writing tool's type: dense, even, unornamented. The upper levels carry the hierarchy with clear size steps, the lower levels with weight.

### Hierarchy

The scale lives in `HEADING_SCALE` (`packages/affine/shared/src/consts/heading.ts`). Labre owns it; the upstream `--affine-font-h-*` variables no longer drive document headings. Paragraph styles, inline code, the callout emoji and the slash-menu previews derive from it. The hover affordances (the drag-handle grabber, the collapse chevron and the heading-level icon) keep their upstream tuning, because what matters is that they line up with each other, not with the text line.

- **Doc title** (700, 40px, 50px line): the page title, above the scale.
- **Headline 1** (700, 32px, calc(1em + 8px), -0.02em): 18px space above.
- **Headline 2** (600, 26px, calc(1em + 10px), -0.02em): 14px space above.
- **Headline 3** (600, 20px, calc(1em + 8px), -0.02em): 12px space above.
- **Headlines 4–6** (600, 18 / 16 / 15px, -0.015em): minor headings, 12px space above. H6 is the size of body text and is set apart by weight alone.
- **Inline code in a heading**: the heading's size minus 3px, like code in body text.
- **Body** (400, 15px, calc(1em + 8px)): prose and list items; 8px paragraph spacing; 944px editor column.
- **Label** (400, 14px): toolbar labels, menu items, panel text (`--affine-font-sm`, applied by `fontSMStyle`).
- **Caption** (400, 12px): sub-labels under icon-button labels, shortcuts, metadata (`--affine-font-xs`).

Framework labels on the canvas don't use this scale. They use fixed sizes in **model units** set in each module's `consts.ts` (Wardley's prominent labels are 18), so they scale with zoom like the rest of the drawing.

### Named Rules

**The Title-Ratio Rule.** From the doc title down to H3, each level is about 1.25 times smaller than the one above (40 → 32 → 26 → 20). H1 must always stay clearly below the title. Change the scale only in `HEADING_SCALE`, never in a consumer.

**The One Family Rule.** Inter for all chrome and prose. Mono families are only for code and numerals. Don't bring in a display face.

**The Model-Unit Rule.** Text drawn on the canvas as part of a notation is sized in fixed model units, not in the chrome's CSS scale, so it zooms with the diagram and exports at the same proportions.

## Layout

In page mode, prose flows in a single 944px column (`--affine-editor-width`) with 8px between paragraphs and larger top margins on headings (18 / 14 / 12px). In edgeless mode the canvas has no layout grid beyond its visual grid (canvas-grid). Framework boards set out their own geometry (axes, bands, lanes) in fixed model units.

Chrome spacing uses a 4px base: 4px icon padding, 8px gaps between toolbar entries and inside panels, 6px toolbar side padding, 12px menu input padding. Floating toolbars are placed with floating-ui, with a 10px viewport margin, and flip rather than overflow.

**The One-Row Rule.** The editor toolbar is always exactly one 36px row. When space runs out, entries drop to icon-only and then move into the "⋮" overflow menu. The toolbar never wraps onto a second row, so it never shifts under the cursor.

## Elevation & Depth

The system is hybrid. Document surfaces (the page, the canvas, framework boards) are flat, with depth shown by hairlines (and, on a Wardley map, its evolution bands). Floating chrome sits above them with layered, neutral shadows. There is no tinted or coloured shadow anywhere.

### Shadow Vocabulary

- **Overlay** (`box-shadow: 0px 1px 6px 0px rgba(0,0,0,.16), 0px 8px 14px 0px rgba(0,0,0,.08)`): editor toolbar and floating panels (`--affine-overlay-shadow`, `--affine-overlay-panel-shadow`).
- **Menu** (`box-shadow: 0px 10px 18px rgba(0,0,0,.14), 0px -1px 12px rgba(0,0,0,.08)`): dropdown menus.
- **Button** (`box-shadow: 0px 0px 1px 0px rgba(0,0,0,.12), 0px 1px 5px 0px rgba(0,0,0,.12)`): small raised controls sitting on the canvas.
- **Popover** (`box-shadow: 0px 0px 30px rgba(75,75,75,.2), 0px 0px 4px rgba(75,75,75,.3)`): larger popovers.
- **Shadow 1–3** (`0 0 4px / 12px / 20px rgba(66,65,73,.14 / .18 / .22)`): the upstream ambient steps.
- **Active ring** (`box-shadow: 0px 0px 0px 2px rgba(30,150,235,.3)`): focus/active ring on inputs.

### Named Rules

**The Flat-Page Rule.** Anything that belongs to the document (blocks, notes, framework cards) stays flat. Only chrome that floats above the document gets a shadow.

## Shapes

The corners are small and consistent. 4px is the house radius, used about twice as often as any other value in the library: icon buttons, menu items, menu panels, inputs and raised canvas controls. 8px is for the editor toolbar and larger containers, 12px for grouped menus and popovers (`--affine-popover-radius`), and 2px for hairline details. Borders are hairlines: 1px, or 0.5px on the toolbar panel's inside border.

Notations have their own form language, taken from their standards. C4 boundaries and relationships use **square** corners and 1–1.5px `#444444` strokes, following the stencil. BPMN tasks are rounded and events are circles, as the standard requires. Framework board cards are rounded rectangles with a hairline border: 10px on Wardley, 12px on C4, Event Storming and Context Map, 16px on the EDGY board, 6px on a BPMN pool.

## Motion

The chrome moves at one tempo, about 240ms, which is what upstream had already settled on by hand (the edgeless toolbar, the popper menus, the toast, the date picker). There is one shared curve, `SPRING_EASING` = `cubic-bezier(0.34, 1.56, 0.64, 1)` (easeOutBack) with `springEasing`/`springDuration` for `css` templates, in `packages/affine/shared/src/styles/motion.ts`: travel, a small overshoot, settle. It came from the senior toolbar's "pop upright" and is now the library's only elastic easing — reuse it rather than adding a second.

Paging a colour picker's palette carousel uses it: the swatch grids (both of them, together, in the shape picker) and the name slide in from the right for the next page and from the left for the previous one, and the inline list of pages scales in the same way. Motion is CSS only — a keyed re-render plus a direction attribute, so a burst of wheel events restarts the animation instead of queueing behind it — and it never takes the pointer: a swatch stays clickable mid-flight. Every animated block is wrapped in `reducedMotionStyle`, so `prefers-reduced-motion: reduce` gets the end state with no travel.

**The One Curve Rule.** An overshoot belongs to a transform that has room to overshoot (a slide, a scale, a rotation), never to a colour or to a value that must not be passed. Anything else eases with the platform's `ease` at the same tempo.

## Components

### Icon Buttons

The main control. Compact and transparent at rest; it responds to the pointer but never shouts.

- **Shape:** 4px corners (`{rounded.sm}`), 4px padding, sized per call site (`--button-width`/`--button-height`).
- **Default:** transparent background, Icon Graphite glyph.
- **Hover:** Hover Veil wash, applied only on devices with real hover (`@media (hover: hover)`).
- **Active (toggled):** Borrowed Blue glyph (`icon/activated`). Alternatively, per `activeMode`, a border or a Hover Veil background.
- **Disabled:** transparent, Ink Disabled glyph, clicks swallowed.
- **Label:** optional 14px label and 12px sub-label beside the icon.

### Editor Toolbar

The floating selection toolbar.

- **Shape:** 8px corners, 0.5px inside border (`layer/insideBorder/border`), 0 6px padding, exactly 36px tall.
- **Background / Shadow:** overlay panel background (`layer/background/overlayPanel`) with the Overlay shadow. A `data-without-bg` variant drops the border, background and shadow.
- **Content:** entries 8px apart at natural width, never squeezed; overflow goes into a "⋮" menu (see The One-Row Rule).
- **Theming:** the toolbar sets its own light/dark variables from the upstream `combinedLight/DarkCssVariables`, so it renders correctly even when portalled outside the themed tree.

### Menus

- **Panel:** Overlay Paper, 4px corners, 8px padding, 180px minimum width, Overlay shadow. Grouped sections use 4px padding and 12px corners.
- **Items:** 4px padding and corners, 14px Inter, Hover Veil on hover. Larger rows use 11px 8px padding.
- **Input:** 4px corners, 4px 6px padding; on focus, a 2px Borrowed Blue ring at 30%.

### Tooltips

Black (`tooltip-black`) with white text, optionally showing the keyboard shortcut (`tooltip-content-with-shortcut`).

### Framework Board (signature component)

The white card that frames a framework's canvas: Card fill and Card Border from `NOTATION_NEUTRALS`, white strips set apart by a divider (Wardley alone adds its evolution gradient), and a title in Frame Ink. It is painted at render time, so it always follows the scale. The frameworks draw their elements on this card. It is the point where quiet chrome ends and loud notation starts.

## Do's and Don'ts

### Do:

- **Do** reach every chrome colour, radius, shadow and font through the upstream tokens (`cssVar`, `cssVarV2`, `unsafeCSSVar(V2)`, `var(--affine-*)`). The library has no design tokens of its own yet.
- **Do** use Hover Veil (`rgba(0,0,0,.04)`) as the only hover treatment on transparent controls, gated by `@media (hover: hover)`.
- **Do** keep controls at 4px corners and 4px padding, and panels at 8px gaps.
- **Do** copy notation hues (and any neutral the standard prescribes) from the published standard or stencil into the module's `consts.ts`, and cite the source in a comment, as C4 and EDGY already do.
- **Do** take every other neutral from `NOTATION_NEUTRALS` (Wardley reference): ink, frame ink, label grey, divider, card, card border, legend border. Board strips stay white.
- **Do** size canvas labels in fixed model units, so the notation zooms and exports faithfully.
- **Do** keep document surfaces flat and keep shadows for floating chrome.

### Don't:

- **Don't** hardcode `#1E96EB` (or any chrome hex). The accent is inherited and due to be replaced, and a literal would block the re-skin.
- **Don't** make a framework notation follow the app theme or dark mode. Standard fidelity comes first.
- **Don't** use a notation hue (EDGY green, C4 blue, BPMN red) in the chrome, and don't use the chrome accent inside a notation.
- **Don't** let the editor toolbar wrap onto a second row or squeeze entries. Overflow goes into the "⋮" menu.
- **Don't** add a display typeface or a second sans. Inter plus the two mono families is the full set.
- **Don't** add coloured or tinted shadows.
- **Don't** write a neutral hex in a framework module, and don't migrate colours stored on user elements when the scale changes.
- **Don't** change heading sizes anywhere but `HEADING_SCALE`.

### Deferred (known, not yet addressed)

- **Accessibility**: secondary text `#8E8D91` on white is about 3.3:1, below AA. White EDGY pictos on the green, cyan and orange facets fall below 3:1. Errors and warnings share one red.
- **Dark mode on the canvas**: framework boards stay white cards on the dark ground. This follows from the fidelity rules but has not been designed as such.
