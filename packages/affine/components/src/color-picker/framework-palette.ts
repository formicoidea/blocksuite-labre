/**
 * The framework palettes a colour picker offers as a CAROUSEL, and the rule
 * that decides which page it opens on (`docs/adr/0027`).
 *
 * Three pieces, in dependency order:
 *
 * 1. **The seam** — {@link FrameworkPaletteExtension}, registered from a
 *    framework's FLAG-GATED view extension. Offering hues is TOOLING, so a
 *    framework switched off disappears from the carousel while every colour it
 *    ever wrote stays exactly where it is (`docs/adr/0009`).
 * 2. **The resolver** — {@link frameworkOfElement}: which framework a selected
 *    element belongs to, from what the document already says.
 * 3. **The builder** — {@link frameworkPaletteGroups}: the carousel a toolbar
 *    hands the picker, base palette first and never hidden (DESIGN.md, "The
 *    Coexisting Palettes Rule").
 *
 * Nothing here is written to a document: a picked swatch is still a plain
 * stored colour value, and `packages/affine/model` is untouched.
 */
import {
  ConnectorElementModel,
  FrameworkBackgroundElementModel,
  type Palette,
} from '@labre/affine-model';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';
import {
  type BlockStdScope,
  FRAMEWORK_IDS,
  type FrameworkId,
  frameworkOfRole,
} from '@labre/std';
import {
  type GfxController,
  GfxControllerIdentifier,
  type GfxModel,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import { PALETTE_GROUP_DEFAULT } from '../translations.js';
import type { NamedPalette } from './types.js';

/**
 * A framework's contribution to the carousel: its own name and its own hues.
 *
 * `palettes` is the framework's existing `*_PALETTE_LIST` — the same array its
 * node toolbar already seeds its picker with — so registering one is a
 * one-liner in the view extension and no palette is restated.
 */
export type FrameworkPalette = {
  framework: FrameworkId;
  /** The framework's own name, as the carousel prints it. */
  labelWording: ChromeWording;
  palettes: NamedPalette[];
};

/**
 * A framework registers its palette here, and nothing else registers one.
 * Multi-instance, keyed by {@link FrameworkPalette.framework}, exactly like
 * `TemplateCategoryIdentifier` (`gfx/template/src/contribute.ts`): two
 * extensions claiming the same framework collide at set-up
 * (`DuplicateServiceDefinitionError`) rather than showing the page twice.
 */
export const FrameworkPaletteIdentifier =
  createIdentifier<FrameworkPalette>('FrameworkPalette');

/**
 * Register a framework's palette. Call it from `setup()` of the FLAG-GATED
 * view extension, beside the senior tool:
 *
 * ```ts
 * context.register(FrameworkPaletteExtension(WARDLEY_FRAMEWORK_PALETTE));
 * ```
 */
export function FrameworkPaletteExtension(
  ...palettes: FrameworkPalette[]
): ExtensionType {
  return {
    setup: di => {
      for (const palette of palettes) {
        di.addImpl(
          FrameworkPaletteIdentifier(palette.framework),
          () => palette
        );
      }
    },
  };
}

/** One page of the carousel. */
export type PaletteGroup = {
  /** {@link BASE_PALETTE_KEY} for the editor's own palette, else a `FrameworkId`. */
  key: string;
  /** Already resolved through the host's catalogue — ready to print. */
  label: string;
  palettes: readonly Palette[];
};

/** The whole carousel, plus the page it opens on. */
export type PaletteCarousel = {
  groups: PaletteGroup[];
  activeKey: string;
};

/** The key of the page that is never a framework's and never hidden. */
export const BASE_PALETTE_KEY = 'default';

/** The role an element carries, for the models that can carry one. */
function roleOf(model: { role?: string }): string | undefined {
  return model.role;
}

/** Width × height of an element's bound — how "smallest board" is measured. */
function area(model: { elementBound: { w: number; h: number } }): number {
  const { w, h } = model.elementBound;
  return w * h;
}

/**
 * The smallest framework board whose bound CONTAINS this element's.
 *
 * Smallest, so a C4 container boundary drawn inside a C4 board — or any board
 * nested in another — wins over the sheet it sits on: the nearer frame is the
 * one an author is working in. A board never answers about itself.
 */
function containingBoard(
  gfx: GfxController,
  model: GfxModel
): FrameworkBackgroundElementModel | undefined {
  const bound = model.elementBound;
  let best: FrameworkBackgroundElementModel | undefined;

  for (const element of gfx.surface?.elementModels ?? []) {
    if (!(element instanceof FrameworkBackgroundElementModel)) continue;
    if (element.id === model.id) continue;
    if (!element.elementBound.contains(bound)) continue;
    if (!best || area(element) < area(best)) best = element;
  }

  return best;
}

/**
 * A node's framework: what it says about itself, else what it was dropped on.
 *
 * Kept apart from {@link frameworkOfElement} so a connector's endpoints are
 * resolved without recursing back into the connector branch.
 */
function frameworkOfNode(
  gfx: GfxController,
  model: GfxModel
): FrameworkId | undefined {
  const own = frameworkOfRole(roleOf(model));
  if (own) return own;

  const board = containingBoard(gfx, model);
  return board ? frameworkOfRole(roleOf(board)) : undefined;
}

/** The single value shared by every item, or `undefined` if they disagree. */
function unanimous<T>(values: readonly T[]): T | undefined {
  return new Set(values).size === 1 ? values[0] : undefined;
}

/**
 * Which framework this element belongs to, read off the document.
 *
 * Three tiers, checked in order:
 *
 * 1. **Its own role's namespace.** A role id is `<framework>:<role>`, so a
 *    Wardley component says `wardley` and a Wardley map says it too — boards
 *    carry roles like everything else.
 * 2. **For a connector, its ends.** A link is drawn between artefacts and
 *    belongs to what it links; a plain connector stamps no role of its own.
 *    Both ends must agree, otherwise the link crosses two notations and the
 *    board below gets the last word.
 * 3. **The smallest board that contains it.** A native shape dropped on a
 *    Wardley map is being used as part of that map, whatever it stamps.
 *
 * `undefined` — a neutral element on the bare canvas — means "no framework",
 * and the carousel then simply opens on the base palette.
 */
export function frameworkOfElement(
  gfx: GfxController,
  model: GfxModel
): FrameworkId | undefined {
  const own = frameworkOfRole(roleOf(model));
  if (own) return own;

  if (model instanceof ConnectorElementModel) {
    const ends = [model.source?.id, model.target?.id]
      .map(id => (id ? gfx.getElementById(id) : null))
      .filter((end): end is GfxModel => !!end)
      .map(end => frameworkOfNode(gfx, end))
      .filter((id): id is FrameworkId => !!id);
    const fromEnds = unanimous(ends);
    if (fromEnds) return fromEnds;
  }

  const board = containingBoard(gfx, model);
  return board ? frameworkOfRole(roleOf(board)) : undefined;
}

/**
 * The framework a whole selection belongs to — the one they all share, or
 * `undefined` as soon as two of them disagree. A picker serving a mixed
 * selection has no framework of origin to open on, so it opens on the base
 * palette, which is true of every element in it.
 */
export function frameworkOfSelection(
  gfx: GfxController,
  models: readonly GfxModel[]
): FrameworkId | undefined {
  if (!models.length) return undefined;
  return unanimous(models.map(model => frameworkOfElement(gfx, model)));
}

/**
 * The carousel a contextual toolbar hands its colour picker.
 *
 * The base palette is page one and is ALWAYS there (DESIGN.md, "The Coexisting
 * Palettes Rule"); the frameworks whose tooling is on follow, in
 * {@link FRAMEWORK_IDS} order so the pages read the same way on every board.
 * `activeKey` is the framework of the selection when that framework is on the
 * carousel, else the base palette.
 */
export function frameworkPaletteGroups(
  std: BlockStdScope,
  models: readonly GfxModel[],
  basePalettes: readonly Palette[]
): PaletteCarousel {
  const contributed = [
    ...std.provider.getAll(FrameworkPaletteIdentifier).values(),
  ].sort(
    (a, b) =>
      FRAMEWORK_IDS.indexOf(a.framework) - FRAMEWORK_IDS.indexOf(b.framework)
  );

  const groups: PaletteGroup[] = [
    {
      key: BASE_PALETTE_KEY,
      label: translateKey(std, ...PALETTE_GROUP_DEFAULT),
      palettes: basePalettes,
    },
    ...contributed.map(palette => ({
      key: palette.framework,
      label: translateKey(std, ...palette.labelWording),
      palettes: palette.palettes,
    })),
  ];

  const origin = frameworkOfSelection(std.get(GfxControllerIdentifier), models);
  const activeKey = groups.some(group => group.key === origin)
    ? (origin as string)
    : BASE_PALETTE_KEY;

  return { groups, activeKey };
}
