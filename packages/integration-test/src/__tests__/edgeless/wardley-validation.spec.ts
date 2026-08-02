import {
  OverlayIdentifier,
  resolveViolationAnchors,
  ValidationManager,
} from '@labre/affine/blocks/surface';
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { beforeEach, describe, expect, test } from 'vitest';

import { FontFamily, type GroupElementModel } from '@labre/affine/model';
import { createGroupCommand, ungroupCommand } from '@labre/affine/gfx/group';
import { getFontString, getTextWidth } from '@labre/affine/gfx/text';
import { Text } from '@labre/store';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The bench the width approximation is judged on: 28 names, chosen to include
 * the ones that BREAK an average — words of nothing but thin letters, words of
 * nothing but wide ones, acronyms, spaces, accents and full-width scripts —
 * and not only the plausible ones that happen to be near the mean.
 */
const BENCH_NAMES = [
  'ERP',
  'CRM',
  'MDM',
  'iOS',
  'Customer',
  'Cloud',
  'Compute',
  'Power',
  'Platform',
  'Genesis',
  'Product',
  'Commodity',
  'Facturation',
  'Référentiel client',
  'Custom-built',
  'Payment gateway',
  'API gateway',
  'Data centre',
  'Data lake',
  'utility',
  'visibility',
  'flexibility',
  'liability',
  'little',
  'lifeline',
  'a b c d e f',
  'WWWWWWWWWW',
  '付款',
];

/**
 * The engine's own width formula, spelled out here rather than exported: this
 * test exists to catch the day the two stop agreeing, and importing the table
 * would make it agree with itself. Mirrors `TEXT_ADVANCE` / `charAdvance` in
 * `blocks/surface/src/extensions/validation.ts`.
 */
function declaredWidth(text: string, fontSize: number): number {
  const advance = (char: string) => {
    if (" .,:;!|'`()[]{}/\\-ilIj".includes(char)) return 0.26;
    if ('ftr"*'.includes(char)) return 0.35;
    if ('mwMW@%'.includes(char)) return 0.85;
    const code = char.charCodeAt(0);
    if (code >= 0x2e80) return 1;
    if (code >= 65 && code <= 90) return 0.62;
    return 0.53;
  };
  let em = 0;
  for (const char of text) em += advance(char);
  return em * fontSize;
}

/**
 * The engine end to end: a real editor, real DI, the real Wardley rules
 * registered by their flag-gated view extension, and the reactive violation
 * list a host panel subscribes to.
 *
 * The unit suites cover the rules' logic; this covers the WIRING — that the
 * manager mounts, finds the surface, sees the registered rules and reacts to
 * document changes.
 *
 * ## Ported off the pilot rule (PF13, 01/08/2026)
 *
 * Every test below used to drag a component off the map. That rule is gone —
 * it existed only to have something for the machinery to carry — so the
 * fixture is now a CHANGE ARROW pointing the wrong way (W1): the same shape of
 * subject (one element, one finding, attributable to one map) behind a rule a
 * Wardley practitioner actually asked for. Not one property of the pipework
 * lost its test in the move.
 */
describe('wardley validation on the canvas', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let validation!: ValidationManager;

  /**
   * A map on the STRICT profile — since PF9 the default (`wardley.sketch`)
   * demotes every rule to `audit`, which raises findings the engine reports and
   * the canvas deliberately never draws.
   */
  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh: '[0,0,1600,900]',
    });

  /** A map authored before `wardley:map` existed: same type, no role. */
  const addLegacyBackground = () =>
    service.surface.addElement({ type: 'wardley', xywh: '[0,0,1600,900]' });

  /**
   * A change arrow occupying `xywh`, pointing BACK towards genesis — one W1
   * finding, wherever it sits.
   */
  const addBackwardsArrow = (xywh: string) => {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    return service.surface.addElement({
      type: 'connector',
      role: 'wardley:change-arrow',
      source: { position: [x + w, y + h / 2] },
      target: { position: [x, y + h / 2] },
    });
  };

  /** The same arrow, the right way round: nothing to report. */
  const addForwardArrow = (xywh: string) => {
    const [x, y, w, h] = JSON.parse(xywh) as number[];
    return service.surface.addElement({
      type: 'connector',
      role: 'wardley:change-arrow',
      source: { position: [x, y + h / 2] },
      target: { position: [x + w, y + h / 2] },
    });
  };

  /** Group the given elements, exactly as the Wardley toolbox does. */
  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  /** Where the overlay would actually draw, given the current violations. */
  const markBounds = () =>
    resolveViolationAnchors(
      validation.violations$.value,
      service.surface
    ).map(anchor => anchor.bound);

  /** Past the manager's re-evaluation debounce. */
  const settle = () => wait(250);

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    service = getDocRootBlock(window.doc, window.editor, 'edgeless').service;
    validation = service.std.get(ValidationManager);

    return cleanup;
  });

  test('the wardley rules are registered and the engine is live', () => {
    // Flag on (default) => the rules reached the container, so the manager
    // subscribed instead of short-circuiting.
    expect(validation.violations$.value).toEqual([]);
    expect(
      service.std.getOptional(OverlayIdentifier('validation'))
    ).toBeTruthy();
  });

  test('a change arrow pointing back towards genesis raises a violation', async () => {
    addBackground();
    const id = addBackwardsArrow('[300,300,40,40]');
    await settle();

    const violations = validation.violations$.value;
    expect(violations).toHaveLength(1);
    expect(violations[0]).toMatchObject({
      ruleId: 'wardley.change-arrow-against-evolution',
      elementIds: [id],
      severity: 'warning',
      messageKey:
        'com.labre.wardley.validation.change-arrow-against-evolution',
    });
  });

  test('a change arrow pointing towards commodity raises nothing', async () => {
    addBackground();
    addForwardArrow('[300,300,40,40]');
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });

  test('the violation clears when the arrow is turned round', async () => {
    addBackground();
    const id = addBackwardsArrow('[300,300,40,40]');
    await settle();
    expect(validation.violations$.value).toHaveLength(1);

    service.surface.updateElement(id, {
      source: { position: [300, 320] },
      target: { position: [340, 320] },
    });
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });

  test('a map authored without the role frames nothing, and is not backfilled', async () => {
    addLegacyBackground();
    addBackwardsArrow('[300,300,40,40]');
    await settle();

    // No retro-violation on an older document: it stays a sketch.
    expect(validation.violations$.value).toEqual([]);
    const background = service.surface.getElementsByType('wardley')[0];
    expect(background.role).toBeUndefined();
  });

  /**
   * PO acceptance: a Wardley artefact made from the toolbox is a GROUP —
   * {node, label}, {arrow, label}. Marking the bare member collided with the
   * group's selection rect and was unreadable, so the mark anchors on the
   * enclosing group.
   *
   * Evaluation is untouched — the violation still names the element carrying
   * the role, because its position is what the rule is about. Only the drawing
   * moves.
   */
  describe('the mark anchors on the enclosing group', () => {
    test('a grouped violating element is marked on its group', async () => {
      addBackground();
      const nodeId = addBackwardsArrow('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();

      // The violation itself is unchanged: the arrow, never the group.
      expect(validation.violations$.value[0].elementIds).toEqual([nodeId]);

      // ...but the mark is drawn on the group, which spans arrow AND label.
      const group = service.surface.getElementById(groupId)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(group.elementBound.serialize());
      // Wider than the bare arrow — that is the whole point of the change.
      expect(markBounds()[0].w).toBeGreaterThan(40);
    });

    test('two violating members of one group share a single mark', async () => {
      addBackground();
      const a = addBackwardsArrow('[3000,3000,40,40]');
      const b = addBackwardsArrow('[3100,3000,40,40]');
      groupOf([a, b]);
      await settle();

      // Two violations, one bracket.
      expect(validation.violations$.value).toHaveLength(2);
      expect(markBounds()).toHaveLength(1);
    });

    test('an ungrouped violating element is marked on itself', async () => {
      addBackground();
      const id = addBackwardsArrow('[3000,3000,40,40]');
      await settle();

      const element = service.surface.getElementById(id)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(
        element.elementBound.serialize()
      );
    });

    test('dissolving the group brings the mark back to the element', async () => {
      addBackground();
      const nodeId = addBackwardsArrow('[3000,3000,40,40]');
      const labelId = service.surface.addElement({
        type: 'text',
        xywh: '[3050,3000,120,24]',
        text: new Text('Payments'),
      });
      const groupId = groupOf([nodeId, labelId]);
      await settle();
      expect(markBounds()[0].w).toBeGreaterThan(40);

      // Ungroup exactly as the group toolbar does. Anchors are resolved at
      // paint time, so nothing has to be invalidated for the mark to fall
      // back onto the element.
      service.std.command.exec(ungroupCommand, {
        group: service.surface.getElementById(groupId) as GroupElementModel,
      });

      const node = service.surface.getElementById(nodeId)!;
      expect(markBounds()).toHaveLength(1);
      expect(markBounds()[0].serialize()).toBe(node.elementBound.serialize());
    });
  });

  test('a neutral element is never evaluated, wherever it sits', async () => {
    addBackground();
    // A generalist square far off the map: no role, so no message.
    service.surface.addElement({ type: 'shape', xywh: '[3000,3000,40,40]' });
    await settle();

    expect(validation.violations$.value).toEqual([]);
  });

  /**
   * The two families W1 does not exercise, on a real canvas.
   *
   * Their logic is unit tested against stand-ins; what only the editor can
   * answer is that they read the same geometry the user sees — a routed
   * `absolutePath` on a real connector, a `Bound.deserialize` on a real
   * `xywh` — and that the machinery around them (exceptions, profiles) works
   * on them BY CONSTRUCTION, without a line of family-specific plumbing.
   */
  describe('the other two families reach the canvas too', () => {
    /** A dependency across the second phase transition of a 1600-wide map. */
    const addLink = (from: [number, number], to: [number, number]) =>
      service.surface.addElement({
        type: 'connector',
        role: 'wardley:dependency',
        source: { position: from },
        target: { position: to },
      });

    const addInertia = (cx: number, cy: number) =>
      service.surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        role: 'wardley:inertia',
        xywh: `[${cx - 4},${cy - 22},8,44]`,
      });

    const addNode = (xywh: string) =>
      service.surface.addElement({
        type: 'wardleyNode',
        kind: 'component',
        role: 'wardley:component',
        xywh,
      });

    test('W2 flags an inertia bar that is on no dependency', async () => {
      addBackground();
      addLink([400, 450], [900, 450]);
      const bar = addInertia(700, 200);
      await settle();

      const violations = validation.violations$.value;
      expect(violations).toHaveLength(1);
      expect(violations[0]).toMatchObject({
        ruleId: 'wardley.inertia-off-transition',
        elementIds: [bar],
      });
    });

    /**
     * A Wardley label, exactly as the toolbox makes one: a 120-unit box
     * whatever the name in it measures.
     */
    const addLabel = (text: string, x: number, y: number) =>
      service.surface.addElement({
        type: 'text',
        role: 'wardley:label',
        // A plain string, exactly as the Wardley toolbox writes one: the model
        // turns it into the `Y.Text` the renderer reads.
        text,
        fontFamily: FontFamily.Inter,
        fontSize: 18,
        textAlign: 'left',
        xywh: `[${x},${y},120,26]`,
      });

    /**
     * The PO's acceptance capture, end to end, and the one thing a unit test
     * cannot check: that the ink the RULE measures is the ink the RENDERER
     * draws.
     *
     * The engine measures no text — a canvas in the evaluation path would make
     * the verdict depend on which fonts a host has loaded — so it approximates:
     * characters × fontSize × a declared ratio. This is where that
     * approximation meets the real font, on a real canvas, with the real
     * renderer's own measurement to compare against.
     */
    test('the ink the rule measures is the ink the renderer draws', async () => {
      const font = getFontString({
        fontStyle: 'normal',
        fontWeight: '400',
        fontSize: 18,
        fontFamily: FontFamily.Inter,
      });
      const worst = { over: 0, under: 0, overName: '', underName: '' };
      for (const name of BENCH_NAMES) {
        const drawn = getTextWidth(name, font);
        const declared = declaredWidth(name, 18);
        const error = (declared - drawn) / drawn;
        console.info(
          `[W3] "${name}": drawn ${drawn.toFixed(1)} u, ` +
            `declared ${declared.toFixed(1)} u ` +
            `(${(error * 100).toFixed(0)} %)`
        );
        if (error > worst.over) {
          worst.over = error;
          worst.overName = name;
        }
        if (error < worst.under) {
          worst.under = error;
          worst.underName = name;
        }

        // ±15 % on EVERY name of the bench, not on the average of it: an
        // average is exactly what the first version of this geometry was, and
        // a bench of five names all made of wide letters is exactly how it got
        // through. The wide end is what turns into a false positive, so it is
        // the one that matters — and 15 % of a short name is a few units, the
        // scale `minPenetration` is calibrated on.
        expect(declared, `${name} reads too wide`).toBeLessThan(drawn * 1.15);
        expect(declared, `${name} reads too narrow`).toBeGreaterThan(
          drawn * 0.85
        );
      }
      console.info(
        `[W3] worst over-estimate ${(worst.over * 100).toFixed(1)} % ` +
          `("${worst.overName}"), worst under ${(worst.under * 100).toFixed(1)} % ` +
          `("${worst.underName}") over ${BENCH_NAMES.length} names`
      );

      addBackground();
      addLabel('ERP', 400, 400);
      // A dependency running down the blank right-hand half of that box —
      // through the element, nowhere near the letters.
      addLink([480, 300], [480, 500]);
      await settle();

      expect(validation.violations$.value).toEqual([]);
    });

    test('...and a link drawn through the word itself is still flagged', async () => {
      addBackground();
      const label = addLabel('ERP', 400, 400);
      const link = addLink([410, 300], [410, 500]);
      await settle();

      const violations = validation.violations$.value;
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('wardley.overlapping-artefacts');
      expect(violations[0].elementIds.sort()).toEqual([label, link].sort());
    });

    test('W3 flags two overlapping nodes, naming the pair', async () => {
      addBackground();
      const a = addNode('[400,400,18,18]');
      const b = addNode('[404,400,18,18]');
      await settle();

      const violations = validation.violations$.value;
      expect(violations).toHaveLength(1);
      expect(violations[0].ruleId).toBe('wardley.overlapping-artefacts');
      expect(violations[0].elementIds.sort()).toEqual([a, b].sort());
    });

    test('an exception works on a W3 pair, with no plumbing of its own', async () => {
      addBackground();
      addNode('[400,400,18,18]');
      addNode('[404,400,18,18]');
      await settle();

      // PF8 knows nothing about pairs: it excuses the elements a finding
      // indicts, and a pair finding indicts two. Both get written, and the
      // finding reads as excused — no family-specific code anywhere.
      const written = validation.setException(
        validation.violations$.value,
        'element',
        true
      );
      await settle();

      expect(written).toHaveLength(2);
      expect(validation.violations$.value[0].exemption).toBe('element');
    });

    test('the sketch profile silences all three, by construction', async () => {
      // A map with NO profile key: the default, which every map ever drawn is
      // on. PF9 knows nothing about the new families either — it re-judges
      // whatever a rule raised, per background.
      service.surface.addElement({
        type: 'wardley',
        role: 'wardley:map',
        xywh: '[0,0,1600,900]',
      });
      addBackwardsArrow('[300,300,40,40]');
      addLink([400, 450], [900, 450]);
      addInertia(700, 200);
      addNode('[400,400,18,18]');
      addNode('[404,400,18,18]');
      await settle();

      const violations = validation.violations$.value;
      // Reported to the engine seam — a host panel and a report see them…
      expect(new Set(violations.map(v => v.ruleId)).size).toBe(3);
      // …and every one of them is `audit`, so the canvas says nothing at all.
      expect(violations.every(v => v.severity === 'audit')).toBe(true);
    });
  });
});
