import {
  ES_HOTSPOT,
  ES_STICKIES,
  SHADOW_COLOR,
  STICKY_RADIUS,
} from '@labre/affine-gfx-ddd-shared';
import {
  GroupElementModel,
  ShapeElementModel,
  ShapeType,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  ES_MORPH_FAMILIES,
  ES_STICKY_FACES,
  EVENT_STORMING_MORPH_SPEC,
  eventStormingFaceOfSticky,
  eventStormingMorphedLabel,
  eventStormingMorphProps,
  eventStormingStickyKind,
} from '../morph';
import {
  ES_ROLE,
  ES_STICKY_ROLE,
  type EventStormingStickyKind,
} from '../roles';

/**
 * What an Event Storming sticky may BECOME — the framework's half of the morph.
 *
 * The generic half (when the dropdown stands up, what one pick writes, that the
 * two composite hooks are honoured at all) is the surface package's; this file
 * is about the DATA and the three decisions only this framework can make: that
 * the family is the whole notation and not a hierarchy invented for the menu,
 * that the kind is read back out of the ROLE because it lives nowhere else, and
 * that the patch says exactly the five things that differ between two stickies.
 */

const EVERY_KIND: EventStormingStickyKind[] = [
  ...ES_STICKIES.map(preset => preset.kind),
  'hotspot',
];

describe('the one declared family', () => {
  it('holds every sticky kind, hotspot included, and nothing else', () => {
    expect(ES_MORPH_FAMILIES).toHaveLength(1);
    const [family] = ES_MORPH_FAMILIES;
    expect(family).toHaveLength(9);
    expect([...family].sort()).toEqual([...EVERY_KIND].sort());
  });

  it('reads in the order of the grammar, with the hotspot last', () => {
    // Declaration order is menu order, and it is the sub-menu's order: an actor
    // issues a command, a command lands on an aggregate, an aggregate raises an
    // event. A user meets one sequence in the menu that DRAWS stickies and the
    // same one in the menu that re-says them.
    expect(ES_MORPH_FAMILIES[0]).toEqual([
      ...ES_STICKIES.map(preset => preset.kind),
      'hotspot',
    ]);
  });

  it('puts the hotspot in the family rather than beside it', () => {
    // The diamond is a silhouette, not a rank: "this sticky is really a
    // question" is the single most common thing a workshop discovers, and a
    // hotspot excluded from the family would be the one morph the method
    // performs that the tool refused.
    expect(ES_MORPH_FAMILIES[0]).toContain('hotspot');
    expect(
      ES_STICKY_FACES.filter(face => face.shapeType === ShapeType.Diamond)
    ).toEqual([expect.objectContaining({ kind: 'hotspot' })]);
  });
});

describe('the kind, read back out of the role', () => {
  it('inverts the role table exactly', () => {
    for (const kind of EVERY_KIND) {
      expect(eventStormingStickyKind(shape(ES_STICKY_ROLE[kind]))).toBe(kind);
    }
    // Nine kinds, nine distinct roles — this table does not collapse the way
    // C4's does, so the telemetry always names the two claims that were swapped.
    expect(new Set(EVERY_KIND.map(kind => ES_STICKY_ROLE[kind])).size).toBe(9);
  });

  it('knows nothing about a sticky placed before the roles existed', () => {
    // The whole compat story: no role, no kind, no menu, and no backfill. A
    // morph that inferred the kind from a fill colour would be writing a claim
    // the workshop never made (promesse #71).
    expect(eventStormingStickyKind(shape(undefined))).toBeUndefined();
  });

  it('refuses every role that is not one of the nine', () => {
    // The board is the paper roll and the flow is an edge; neither is a sticky,
    // and `es:sticky` itself is the PARENT the rules are written on and not
    // something any element carries.
    for (const role of [
      ES_ROLE.board,
      ES_ROLE.flow,
      ES_ROLE.sticky,
      'wardley:component',
      'toString',
    ]) {
      expect(eventStormingStickyKind(shape(role))).toBeUndefined();
    }
  });
});

describe('the patch one kind is worth', () => {
  it('is the creation preset, restricted to what actually differs', () => {
    for (const preset of ES_STICKIES) {
      expect(eventStormingMorphProps(preset.kind)).toEqual({
        role: ES_STICKY_ROLE[preset.kind],
        // Derived from the very table `commands.ts` hands to `addSticky`, so
        // the palette and the morph cannot disagree about what a policy is.
        fillColor: preset.fill,
        color: preset.text,
        shapeType: ShapeType.Rect,
        radius: STICKY_RADIUS,
      });
    }
  });

  it('carries the hotspot own preset, diamond and unrounded', () => {
    // `addSticky` rounds a rect and leaves everything else sharp; a diamond
    // that kept the square's 6px would be a diamond with clipped points.
    expect(eventStormingMorphProps('hotspot')).toEqual({
      role: ES_STICKY_ROLE.hotspot,
      fillColor: ES_HOTSPOT.fill,
      color: ES_HOTSPOT.text,
      shapeType: ShapeType.Diamond,
      radius: 0,
    });
  });

  it('never carries type, xywh or text', () => {
    // The generic module strips all three whatever a spec returns; this is the
    // framework end of the same contract. `xywh` is the one a user would see:
    // an aggregate is BORN at 160 and a sticky somebody stretched is stretched
    // on purpose, so a morph keeps whatever room the author gave it.
    for (const kind of EVERY_KIND) {
      const props = eventStormingMorphProps(kind);
      expect(props).not.toHaveProperty('type');
      expect(props).not.toHaveProperty('xywh');
      expect(props).not.toHaveProperty('text');
      expect(Object.keys(props).sort()).toEqual([
        'color',
        'fillColor',
        'radius',
        'role',
        'shapeType',
      ]);
    }
  });

  it('is worth five keys because five is what moves', () => {
    // The claim behind the patch, stated as a test rather than assumed: the
    // colours, the role and the silhouette are the whole difference between two
    // stickies, and every other prop `addSticky` writes (`filled`,
    // `strokeColor`, `strokeWidth`, `shapeStyle`, `roughness`, the typography of
    // the contained label) is one value for all nine. The day a tenth sticky
    // lands with a preset of its own, this is the case that says so.
    const invariant = <T>(
      read: (face: (typeof ES_STICKY_FACES)[number]) => T
    ) => new Set(ES_STICKY_FACES.map(read)).size;
    // Two of the five genuinely move on every member…
    expect(invariant(face => face.fill)).toBe(9);
    expect(invariant(face => face.label)).toBe(9);
    // …and the silhouette moves on exactly one, which is why the shadow has to
    // follow it.
    expect(invariant(face => face.shapeType)).toBe(2);
  });
});

/**
 * The WORDS, when the face becomes something else.
 *
 * The timid rule, and the two branches are the whole of it: the notation's own
 * prompt follows the colour, and anything a human typed is theirs.
 */
describe('eventStormingMorphedLabel', () => {
  it('carries an untouched prompt across to the target own words', () => {
    // What a sticky nobody has written on still says — and what would otherwise
    // leave a blue sticky reading "Domain event".
    expect(
      eventStormingMorphedLabel('domainEvent', 'command', 'Domain event')
    ).toBe('Command');
    expect(eventStormingMorphedLabel('command', 'hotspot', 'Command')).toBe(
      'Hotspot'
    );
    // The one label that is not its kind spelled out: `system` is drawn, named
    // and morphed as "External system".
    expect(eventStormingMorphedLabel('policy', 'system', 'Policy')).toBe(
      'External system'
    );
    // Padding is not content: the prompt is read trimmed, as it is stored.
    expect(eventStormingMorphedLabel('actor', 'aggregate', '  Actor  ')).toBe(
      'Aggregate'
    );
  });

  it('leaves every word a human could have written', () => {
    // The PO's "the label is intact", stated as the cases that must survive: a
    // real name, the prompt with a word added, another kind's prompt, an
    // emptied sticky.
    for (const raw of [
      'Order placed',
      'Domain event (draft)',
      'Command',
      'domain event',
      '',
      '   ',
      null,
      undefined,
    ]) {
      expect(
        eventStormingMorphedLabel('domainEvent', 'command', raw)
      ).toBeNull();
    }
  });

  it('is a no-op when the kind does not actually move', () => {
    for (const kind of EVERY_KIND) {
      const label = ES_STICKY_FACES.find(face => face.kind === kind)!.label;
      expect(eventStormingMorphedLabel(kind, kind, label)).toBe(label);
    }
  });
});

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * A model built detached, the way the C4 morph suite builds one: the
 * `instanceof` gates the resolution runs are the shipped ones, and the handful
 * of accessors it reads are defined as plain values rather than driven through
 * a Yjs document that no unit test has.
 */
function detached<T>(
  Ctor: abstract new (...args: never[]) => T,
  props: Record<string, unknown>
): T {
  const element = Object.create(Ctor.prototype) as object;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  return element as T;
}

const shape = (role: string | undefined, extra: Record<string, unknown> = {}) =>
  detached(ShapeElementModel, {
    role,
    ...extra,
  }) as unknown as GfxPrimitiveElementModel;

const group = (children: unknown[]) =>
  detached(GroupElementModel, {
    childElements: children,
  }) as unknown as GfxPrimitiveElementModel;

/** A sticky as `addSticky` builds one: the neutral shadow, then the face. */
const sticky = (
  kind: EventStormingStickyKind,
  extra: Record<string, unknown> = {}
) => {
  const shadow = shape(undefined, {
    id: 'shadow',
    fillColor: SHADOW_COLOR,
    shapeType: ShapeType.Rect,
    radius: STICKY_RADIUS,
    isLocked: () => false,
    ...extra,
  });
  const face = shape(ES_STICKY_ROLE[kind], {
    id: 'face',
    fillColor: ES_STICKY_FACES.find(f => f.kind === kind)!.fill,
    isLocked: () => false,
    // Always defined, even as `undefined`: every `@field` accessor reads
    // through a `Y.Map` a detached model does not have, so a prop the hook
    // touches has to be shadowed by an own value or the getter throws.
    text: undefined,
    ...extra,
  });
  return { group: group([shadow, face]), shadow, face };
};

describe('resolving a selected group to its face', () => {
  it('finds the one shape the role lives on, and skips the shadow', () => {
    const { group: selected, face } = sticky('command');
    const resolved = eventStormingFaceOfSticky(selected);
    expect(resolved).toBe(face);
    expect(EVENT_STORMING_MORPH_SPEC.kindOf(resolved!)).toBe('command');
  });

  it('refuses a sticky placed before the roles existed', () => {
    // Two shapes, no role anywhere: a pre-WS5 sticky is a drawing, and the
    // dropdown never appears on one.
    expect(
      eventStormingFaceOfSticky(group([shape(undefined), shape(undefined)]))
    ).toBeUndefined();
  });

  it('refuses a plain group and anything that is not a group at all', () => {
    // A lasso somebody drew round two rectangles, an empty group, and a bare
    // shape — including a sticky face selected on its own, since what the
    // toolbar hands over is always the group.
    expect(eventStormingFaceOfSticky(group([]))).toBeUndefined();
    expect(
      eventStormingFaceOfSticky(shape(ES_STICKY_ROLE.command))
    ).toBeUndefined();
  });

  it('refuses a group holding two faces', () => {
    // Morphing "it" would mean picking one by document order, and the honest
    // answer to an ambiguous selection is none.
    expect(
      eventStormingFaceOfSticky(
        group([shape(ES_STICKY_ROLE.command), shape(ES_STICKY_ROLE.actor)])
      )
    ).toBeUndefined();
  });
});

/* ── What the rest of the sticky owes the change ───────────────────────── */

describe('afterMorph — the shadow follows the silhouette', () => {
  /** A surface that records what the hook writes, without a document. */
  const recorder = () => {
    const updateElement = vi.fn();
    return {
      surface: { updateElement, store: { transact: (fn: () => void) => fn() } },
      updateElement,
    };
  };

  it('turns the shadow into a diamond behind a hotspot', () => {
    const { surface, updateElement } = recorder();
    const { group: selected } = sticky('command', { surface });

    EVENT_STORMING_MORPH_SPEC.afterMorph!(selected, 'command', 'hotspot');

    // The one write, on the SHADOW: the face is the generic module's business
    // and has already been patched by the time this runs.
    expect(updateElement).toHaveBeenCalledTimes(1);
    expect(updateElement).toHaveBeenCalledWith('shadow', {
      shapeType: ShapeType.Diamond,
      radius: 0,
    });
  });

  it('turns it back into a rounded rect on the way out of a hotspot', () => {
    const { surface, updateElement } = recorder();
    const { group: selected } = sticky('hotspot', {
      surface,
      shapeType: ShapeType.Diamond,
      radius: 0,
    });

    EVENT_STORMING_MORPH_SPEC.afterMorph!(selected, 'hotspot', 'readModel');

    expect(updateElement).toHaveBeenCalledWith('shadow', {
      shapeType: ShapeType.Rect,
      radius: STICKY_RADIUS,
    });
  });

  it('writes nothing when the silhouette does not move', () => {
    // Seven of the nine kinds are the same square, so the overwhelmingly common
    // morph must not spend a write — nor an undo step — on the shadow.
    const { surface, updateElement } = recorder();
    const { group: selected } = sticky('command', { surface });

    EVENT_STORMING_MORPH_SPEC.afterMorph!(selected, 'command', 'domainEvent');

    expect(updateElement).not.toHaveBeenCalled();
  });

  it('leaves the shadow position alone', () => {
    // The offset is the author's geometry as much as the face's box is: the
    // patch names the silhouette and the rounding, and nothing else.
    const { surface, updateElement } = recorder();
    const { group: selected } = sticky('actor', { surface });

    EVENT_STORMING_MORPH_SPEC.afterMorph!(selected, 'actor', 'hotspot');

    const [, props] = updateElement.mock.calls[0] as [string, object];
    expect(Object.keys(props).sort()).toEqual(['radius', 'shapeType']);
  });

  it('rewrites the face own prompt, and never a word the author wrote', () => {
    const words = (value: string) => {
      const text = {
        toString: () => value,
        get length() {
          return value.length;
        },
        delete: vi.fn(),
        insert: vi.fn(),
      };
      return text;
    };

    const morph = (from: EventStormingStickyKind, label: string) => {
      const { surface } = recorder();
      const text = words(label);
      const { group: selected } = sticky(from, { surface, text });
      EVENT_STORMING_MORPH_SPEC.afterMorph!(selected, from, 'aggregate');
      return text;
    };

    // The untouched prompt follows the colour…
    expect(morph('command', 'Command').insert).toHaveBeenCalledWith(
      0,
      'Aggregate'
    );
    // …and everything a human could have typed is left exactly where it is.
    for (const written of ['Place order', 'Command of record', '']) {
      const text = morph('command', written);
      expect(text.insert).not.toHaveBeenCalled();
      expect(text.delete).not.toHaveBeenCalled();
    }
  });
});

describe('the spec handed to the generic module', () => {
  it('is declared on the GROUP, because that is what a click selects', () => {
    expect(EVENT_STORMING_MORPH_SPEC.modelType).toBe(GroupElementModel);
    expect(EVENT_STORMING_MORPH_SPEC.resolveTarget).toBe(
      eventStormingFaceOfSticky
    );
    expect(EVENT_STORMING_MORPH_SPEC.framework).toBe('ddd-event-storming');
  });

  it('reports the FACE role, which is the only role a sticky has', () => {
    for (const kind of EVERY_KIND) {
      expect(EVENT_STORMING_MORPH_SPEC.roleOf(kind)).toBe(ES_STICKY_ROLE[kind]);
    }
  });

  it('names and draws every kind from its own creation command', () => {
    // Reused rather than redrawn, so the dropdown says what the sub-menu entry
    // that draws one says — including the entry whose label is not its kind.
    expect(EVENT_STORMING_MORPH_SPEC.labelOf('system')).toEqual({
      key: 'com.labre.commands.ddd-event-storming.addSystem',
      fallback: 'External system',
    });
    expect(EVENT_STORMING_MORPH_SPEC.labelOf('domainEvent').fallback).toBe(
      'Domain event'
    );
    expect(EVENT_STORMING_MORPH_SPEC.labelOf('hotspot').fallback).toBe(
      'Hotspot'
    );
    for (const kind of EVERY_KIND) {
      expect(EVENT_STORMING_MORPH_SPEC.labelOf(kind).key).toBeTruthy();
      expect(EVENT_STORMING_MORPH_SPEC.iconOf(kind)).toBeTruthy();
    }
  });
});
