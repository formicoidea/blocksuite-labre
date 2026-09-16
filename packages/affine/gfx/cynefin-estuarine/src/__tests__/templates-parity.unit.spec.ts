import {
  snapshotFromAction,
  type TemplateCategory,
} from '@labre/affine-gfx-template';
import { TextFitMode } from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { TranslationProvider } from '@labre/affine-shared/services';
import type { BlockStdScope, CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { cynefinEstuarineCommands } from '../commands';
import { ESTUARINE_ROLE } from '../estuarine/roles';
import { estuarineHexagonProps } from '../presets';
import {
  cynefinTemplateCategory,
  estuarineTemplateCategory,
} from '../templates';

/**
 * The guard the palette never had: **a template must be what its command
 * draws.**
 *
 * The three artefacts of this senior button were written out by hand in June
 * 2026 and the toolbox kept moving — #52 gave the hexagon a `textFitMode`, #55
 * doubled `HEX_SIZE` from 60 to 120 — and nothing compared the two. The
 * existing `estuarine-roles.unit.spec.ts` reads the ROLE on both sides, which
 * is why the drift it could not see went on for three months: a background
 * drawn at scale 1 against a button drawing it at 1.2, hexagons with no fit
 * mode, and captions positioned by a `+64` computed for the old hexagon, which
 * #55 turned into a name drawn INSIDE the shape it names.
 *
 * So: every single-artefact template is DERIVED (`templateFromCommand` runs the
 * command against a recording surface), and this file re-runs the command and
 * compares. The two COMPOSITIONS cannot derive — a sorting board and a
 * constraint map are arrangements no one command draws — so they are checked on
 * COMPOSITION instead: the same presets, and the captions below their hexagons.
 */

type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  role?: string;
  shapeType?: string;
  xywh?: string;
  textFitMode?: string;
  color?: string;
};

/**
 * The invocation a derived template is recorded under.
 *
 * Any value does: these commands hand the `GfxController` to their action and
 * read nothing else off the invocation. Spelled out rather than cast, so the
 * day one does the failure is a comparison rather than a crash.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The two templates written by hand, and why each one is: neither the four-way
 * sorting board nor a map carrying three named constraints is what any single
 * button draws.
 */
const HAND_AUTHORED = ['Decision sorting', 'Constraint map'];

function eager(category: TemplateCategory) {
  const shipped = category.templates;
  if (typeof shipped === 'function') {
    throw new Error(`the ${category.name} category is expected to be eager`);
  }
  return shipped;
}

const templates = [
  ...eager(cynefinTemplateCategory),
  ...eager(estuarineTemplateCategory),
];

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const mapNamed = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

const boxOf = (element: RawElement) =>
  JSON.parse(element.xywh ?? '[0,0,0,0]') as [number, number, number, number];

describe('the Cynefin / Estuarine palettes cover the toolbox', () => {
  const artefacts = cynefinEstuarineCommands.filter(
    command => command.kind === 'artefact'
  );

  it('ships one derived template per artefact command', () => {
    expect(artefacts.length).toBeGreaterThan(0);
    for (const command of artefacts) {
      const derived = templates.filter(
        template => template.commandId === command.id
      );
      expect(
        derived.map(template => template.name),
        `templates for ${command.id}`
      ).toHaveLength(1);
    }
  });

  it('names every template that is NOT derived', () => {
    const free = templates
      .filter(template => template.commandId === undefined)
      .map(template => template.name);
    expect([...free].sort()).toEqual([...HAND_AUTHORED].sort());
  });
});

describe('every derived template is what its command draws', () => {
  for (const template of templates) {
    if (template.commandId === undefined) continue;
    const command = cynefinEstuarineCommands.find(
      entry => entry.id === template.commandId
    );

    it(`${template.name} re-runs identically`, () => {
      expect(command, template.commandId).toBeDefined();
      expect(template.content).toEqual(
        snapshotFromAction(
          std => command!.run(std, INVOCATION),
          template.name ?? 'Template'
        )
      );
    });
  }
});

describe('Constraint map is composed of the same presets', () => {
  const elements = mapNamed('Constraint map');
  const hexagons = Object.entries(elements).filter(
    ([, element]) => element.shapeType === 'polygon'
  );
  const captions = Object.entries(elements).filter(
    ([, element]) => element.type === 'text'
  );

  it('draws every constraint from `estuarineHexagonProps`', () => {
    expect(hexagons).toHaveLength(3);
    for (const [id, element] of hexagons) {
      const preset = estuarineHexagonProps({ xywh: element.xywh ?? '' });
      expect(
        {
          type: element.type,
          shapeType: element.shapeType,
          role: element.role,
          textFitMode: element.textFitMode,
        },
        id
      ).toEqual({
        type: preset['type'],
        shapeType: preset['shapeType'],
        role: preset['role'],
        textFitMode: preset['textFitMode'],
      });
      // The half of the notation the palette had lost: a constraint behaves
      // like a post-it — fixed hex, the text shrinks inside it.
      expect(element.textFitMode, id).toBe(TextFitMode.Contained);
    }
  });

  /**
   * The #55 regression, spelled out: `HEX_SIZE` went 60 → 120 while `caption()`
   * kept a literal `+64`, so every name was drawn on top of the hexagon it
   * names. A caption belongs entirely BELOW its hexagon's box.
   */
  it('writes every name below the hexagon it names', () => {
    expect(captions).toHaveLength(3);
    for (const [id, caption] of captions) {
      const [cx, cy, cw, ch] = boxOf(caption);
      const centre = cx + cw / 2;

      // The one it names: the hexagon it is centred on.
      const named = hexagons.filter(([, hexagon]) => {
        const [hx, , hw] = boxOf(hexagon);
        return Math.abs(hx + hw / 2 - centre) < 1;
      });
      expect(
        named.map(([hexId]) => hexId),
        `the hexagon ${id} names`
      ).toHaveLength(1);
      const [hexId, hexagon] = named[0];
      const [, hy, , hh] = boxOf(hexagon);
      expect(cy, `${id} must start below ${hexId}`).toBeGreaterThanOrEqual(
        hy + hh
      );

      // And no name may land on any hexagon at all.
      for (const [otherId, other] of hexagons) {
        const [ox, oy, ow, oh] = boxOf(other);
        const overlaps =
          ox < cx + cw && cx < ox + ow && oy < cy + ch && cy < oy + oh;
        expect(overlaps, `${id} is drawn over ${otherId}`).toBe(false);
      }
    }
  });

  it('lays itself on a map the size the toolbox draws', () => {
    const composed = Object.values(elements).filter(
      element => element.type === 'estuarine'
    );
    expect(composed).toHaveLength(1);
    expect(composed[0].role).toBe(ESTUARINE_ROLE.map);

    // Not the constants: the DERIVED template, which is the action's own
    // output. The two used to differ by the 1.2 the button applies.
    const drawn = Object.values(mapNamed('Estuarine map'));
    expect(drawn).toHaveLength(1);
    expect(boxOf(composed[0]).slice(2)).toEqual(boxOf(drawn[0]).slice(2));
  });
});

/**
 * R33: the text the two hand-authored compositions write (the sorting board's
 * sticky notes, the constraint map's names) is nobody's artefact, so it is the
 * shared notation scale's ink and not a near-black of this module's own.
 */
describe('the hand-authored templates write their text in the shared ink', () => {
  for (const name of HAND_AUTHORED) {
    it(name, () => {
      const inked = Object.values(mapNamed(name)).filter(
        element => element.color !== undefined
      );
      expect(inked.length).toBeGreaterThan(0);
      for (const element of inked) {
        expect(element.color).toBe(NOTATION_NEUTRALS.ink);
      }
    });
  }
});

/**
 * The two hand-authored compositions speak the inserting editor's language:
 * their seeds (the sorting board's four domain names, the map's three
 * constraint captions) go through the translation seam at placement, exactly
 * like a derived template's (ADR 0016).
 */
describe('the hand-authored templates localize their seeds', () => {
  const hostWith = (t?: (key: string) => string | undefined) =>
    ({
      getOptional: (id: unknown) =>
        id === TranslationProvider && t ? { t } : null,
    }) as unknown as BlockStdScope;

  const findByName = (name: string) => {
    const found = templates.find(template => template.name === name);
    if (!found) throw new Error(`no template named "${name}"`);
    return found;
  };

  for (const name of HAND_AUTHORED) {
    it(`${name}: without a provider, localize returns exactly the content`, () => {
      const template = findByName(name);
      expect(JSON.stringify(template.localize!(hostWith()))).toBe(
        JSON.stringify(template.content)
      );
    });
  }

  it('Decision sorting: a fake provider changes every sticky caption', () => {
    const template = findByName('Decision sorting');
    const fr: Record<string, string> = {
      'com.labre.cynefin-estuarine.seed.probe-learn': 'Sonder et apprendre',
      'com.labre.cynefin-estuarine.seed.expert-analysis': 'Analyse experte',
      'com.labre.cynefin-estuarine.seed.act-now': 'Agir maintenant',
      'com.labre.cynefin-estuarine.seed.known-issue': 'Problème connu',
    };
    const localized = elementsOf({
      ...template,
      content: template.localize!(hostWith(key => fr[key])),
    });
    const captions = Object.values(localized)
      .map(el => (el as { text?: { delta?: { insert?: string }[] } }).text)
      .filter((text): text is { delta?: { insert?: string }[] } => !!text)
      .map(text => text.delta?.[0]?.insert);
    expect(captions.sort()).toEqual(Object.values(fr).sort());
  });

  it('Constraint map: a fake provider changes every hexagon caption', () => {
    const template = findByName('Constraint map');
    const fr: Record<string, string> = {
      'com.labre.cynefin-estuarine.seed.policy': 'Politique',
      'com.labre.cynefin-estuarine.seed.habit': 'Habitude',
      'com.labre.cynefin-estuarine.seed.budget': 'Budget FR',
    };
    const localized = elementsOf({
      ...template,
      content: template.localize!(hostWith(key => fr[key])),
    });
    const captions = Object.entries(localized)
      .filter(([, el]) => el.type === 'text')
      .map(
        ([, el]) =>
          (el as unknown as { text?: { delta?: { insert?: string }[] } }).text
            ?.delta?.[0]?.insert
      );
    expect(captions.sort()).toEqual(Object.values(fr).sort());
  });
});
