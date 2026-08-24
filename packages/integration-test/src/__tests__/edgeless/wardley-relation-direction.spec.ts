import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ValidationManager } from '@labre/affine/blocks/surface';
import {
  connectorToolbarConfig,
  EdgeDirectionManager,
  invertibleEdges,
} from '@labre/affine/gfx/connector';
import type { ConnectorElementModel } from '@labre/affine/model';
import { ConnectorMode } from '@labre/affine/model';
import {
  getRegisteredCommands,
  runCommand,
  toShortcutDescriptor,
  type AnyCommandDescriptor,
} from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * `docs/adr/0010` end to end, on a real editor.
 *
 * The unit suites cover the convention (`gfx/wardley`), the family (W4) and the
 * two pure halves of the mechanisms. What only a live board can show is the
 * round trip the ADR names as its own acceptance: **a link drawn upside-down
 * raises a violation, reversing it clears the violation, and undoing puts both
 * back in one step.**
 *
 * It also covers what M2 is made of and a unit test cannot reach: the reveal
 * reacts to SELECTION, and it stays silent on an edge that binds nothing.
 */
describe('the direction of a wardley dependency', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let service!: EdgelessRootBlockComponent['service'];
  let validation!: ValidationManager;

  /** Past the validation manager's 120 ms re-evaluation debounce. */
  const settle = () => wait(250);

  /** A map on the STRICT profile: the default demotes every rule to `audit`. */
  const addMap = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      validationProfile: 'wardley.strict',
      xywh: '[0,0,1600,900]',
    });

  const addNode = (x: number, y: number) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      shapeType: 'ellipse',
      xywh: `[${x - 9},${y - 9},18,18]`,
    });

  /**
   * A component and its NAME — a circle plus a free text carrying the label
   * role, the two held in one group. That composition is what the reveal reads
   * its two names out of, and it is how the product actually draws a component:
   * `addNode` alone is an unnamed dot.
   */
  const addNamedNode = (x: number, y: number, name: string) => {
    const node = addNode(x, y);
    const label = service.surface.addElement({
      type: 'text',
      text: name,
      role: 'wardley:label',
      xywh: `[${x + 12},${y - 13},120,26]`,
    });
    service.surface.addElement({
      type: 'group',
      children: { [node]: true, [label]: true },
    });
    return node;
  };

  /** A dependency: `consumer` needs `provider`. */
  const addDependency = (
    consumer: string,
    provider: string,
    mode = ConnectorMode.Straight
  ) =>
    service.surface.addElement({
      type: 'connector',
      role: 'wardley:dependency',
      mode,
      source: { id: consumer },
      target: { id: provider },
    });

  const w4 = () =>
    validation.violations$.value.filter(
      violation => violation.ruleId === 'wardley.provider-above-consumer'
    );

  /** The registered command, as every surface reaches it. */
  const invertCommand = (): AnyCommandDescriptor => {
    const command = getRegisteredCommands(edgeless.std).find(
      candidate => candidate.id === 'edge.invert-direction'
    );
    expect(command, 'edge.invert-direction is not registered').toBeTruthy();
    return command!;
  };

  /** Select on the canvas — which is what every real call site acts on. */
  const select = (...elements: string[]) =>
    service.selection.set({ elements, editing: false });

  /**
   * The four ways a user reaches the inversion, invoked EXACTLY as the product
   * invokes them.
   *
   * The first three pass no arguments at all — that is the whole point. A
   * command whose `run` parsed its argument as it arrived was a silent no-op
   * from every one of them, and a test that helpfully passed `{ elementIds }`
   * exercised the one shape nothing in the library produces.
   */
  const invokers = {
    /** The contextual toolbar entry: its own `run(ctx)`, not a copy of it. */
    toolbar() {
      const group = connectorToolbarConfig.actions.find(
        action => action.id === 'c.endpoint-style'
      ) as { actions: { id: string; run?: (ctx: unknown) => void }[] };
      const entry = group.actions.find(
        action => action.id === 'b.invert-direction'
      )!;
      entry.run!({
        std: edgeless.std,
        getSurfaceModelsByType: () => service.selection.selectedElements,
      });
    },
    /** The palette / catalogue: `runCommand` with an invocation and nothing else. */
    palette() {
      runCommand(edgeless.std, invertCommand(), {
        surface: 'palette',
        source: 'context-menu',
      });
    },
    /** A keystroke, through the descriptor the keymap actually installs. */
    shortcut() {
      const handled = toShortcutDescriptor(invertCommand()).handler(
        edgeless.std
      )({
        get: () => ({ event: { preventDefault: () => {} } }),
      } as never);
      expect(handled, 'the shortcut handler refused the keystroke').toBe(true);
    },
    /** A host or an agent, which is the only caller that names its targets. */
    withIds(elementIds: string[]) {
      runCommand(
        edgeless.std,
        invertCommand(),
        { surface: 'agent', source: 'ai' },
        { elementIds }
      );
    },
  };

  const invert = (elementIds: string[]) => invokers.withIds(elementIds);

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgeless.service;
    validation = service.std.get(ValidationManager);

    return cleanup;
  });

  test('a link drawn upside-down is flagged, reversing it clears it', async () => {
    addMap();
    // The consumer BELOW what it needs: the value chain says the opposite of
    // what the map means.
    const consumer = addNode(400, 700);
    const provider = addNode(800, 200);
    const edge = addDependency(consumer, provider);
    await settle();

    const [violation] = w4();
    expect(violation).toBeTruthy();
    // The relation and both of its ends: neither node alone is at fault, and
    // the edge is named because reversing it is one of the two ways out.
    expect(violation.elementIds.sort()).toEqual(
      [edge, consumer, provider].sort()
    );

    invert([edge]);
    await settle();

    expect(w4()).toEqual([]);
    const model = service.surface.getElementById(edge) as ConnectorElementModel;
    expect(model.source.id).toBe(provider);
    expect(model.target.id).toBe(consumer);
  });

  test('the inversion is ONE undo step, and undoing brings the finding back', async () => {
    addMap();
    const consumer = addNode(400, 700);
    const provider = addNode(800, 200);
    const edge = addDependency(consumer, provider);
    await settle();
    expect(w4()).toHaveLength(1);

    invert([edge]);
    await settle();
    expect(w4()).toEqual([]);

    edgeless.std.store.undo();
    await settle();

    const model = service.surface.getElementById(edge) as ConnectorElementModel;
    // Both ends AND both styles come back together: one gesture, one step.
    expect(model.source.id).toBe(consumer);
    expect(model.target.id).toBe(provider);
    expect(w4()).toHaveLength(1);
  });

  test.each([
    ['the contextual toolbar', () => invokers.toolbar()],
    ['the palette', () => invokers.palette()],
    ['a keystroke', () => invokers.shortcut()],
  ])('reverses from %s, on the selection and with no arguments', async (
    _name,
    invoke
  ) => {
    addMap();
    const consumer = addNode(400, 700);
    const provider = addNode(800, 200);
    const edge = addDependency(consumer, provider);
    select(edge);
    await wait(50);

    invoke();
    await wait(50);

    const model = service.surface.getElementById(edge) as ConnectorElementModel;
    expect(model.source.id).toBe(provider);
    expect(model.target.id).toBe(consumer);
  });

  test('a mixed selection reverses the typed edges and leaves the rest alone', async () => {
    addMap();
    const consumer = addNode(400, 700);
    const provider = addNode(800, 200);
    const typed = addDependency(consumer, provider);
    const neutral = service.surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { id: provider },
    });
    select(typed, neutral);
    await wait(50);

    // The entry appears — `some`, not `every`: lassoing two connectors used to
    // take the affordance away entirely, showing neither this nor the arrowhead
    // swap it replaces.
    invokers.toolbar();
    await wait(50);

    const typedModel = service.surface.getElementById(
      typed
    ) as ConnectorElementModel;
    const neutralModel = service.surface.getElementById(
      neutral
    ) as ConnectorElementModel;
    expect(typedModel.source.id).toBe(provider);
    // The neutral connector is not part of the gesture: its two ends carry no
    // claim, so there is nothing about it to reverse.
    expect(neutralModel.source.id).toBe(consumer);
    expect(neutralModel.target.id).toBe(provider);
  });

  test('reversing a CURVED connector leaves the drawn curve where it was', async () => {
    addMap();
    const consumer = addNode(400, 200);
    const provider = addNode(900, 700);
    // A control point WELL off the chord's midpoint (which would be [650, 450]):
    // an asymmetric curve is the only fixture that can catch a "mirrored"
    // control point, and comparing two straight chords proves nothing at all.
    const edge = service.surface.addElement({
      type: 'connector',
      role: 'wardley:dependency',
      mode: ConnectorMode.Curve,
      curveControlPoint: [520, 640],
      source: { id: consumer },
      target: { id: provider },
    });
    await wait(100);

    /**
     * The curve as DRAWN, not as stored: a curved connector keeps its whole
     * shape in two points carrying tangents (`absOut` on the first, `absIn` on
     * the second), so reading the bare coordinates gives the chord and would
     * hold for any pair of endpoints. Sampled the way the validation engine
     * samples it.
     */
    const cubicAt = (
      p0: number[],
      c0: number[],
      c1: number[],
      p1: number[],
      t: number
    ): [number, number] => {
      const u = 1 - t;
      const a = u * u * u;
      const b = 3 * u * u * t;
      const c = 3 * u * t * t;
      const d = t * t * t;
      return [
        a * p0[0] + b * c0[0] + c * c1[0] + d * p1[0],
        a * p0[1] + b * c0[1] + c * c1[1] + d * p1[1],
      ];
    };
    const SAMPLES = 64;
    const drawnPath = (id: string): [number, number][] => {
      const path = (service.surface.getElementById(id) as ConnectorElementModel)
        .absolutePath;
      const points: [number, number][] = [];
      for (let i = 1; i < path.length; i++) {
        const from = path[i - 1];
        const to = path[i];
        const c0 = (from.absOut as number[] | undefined) ?? from;
        const c1 = (to.absIn as number[] | undefined) ?? to;
        for (let s = 0; s <= SAMPLES; s++) {
          points.push(cubicAt(from, c0, c1, to, s / SAMPLES));
        }
      }
      return points;
    };

    const before = drawnPath(edge);
    expect(before.length).toBe(SAMPLES + 1);
    // The fixture is honest only if the curve really departs from its chord.
    const chordMid = [(400 + 900) / 2, (200 + 700) / 2];
    const drawnMid = before[SAMPLES / 2];
    expect(Math.hypot(drawnMid[0] - chordMid[0], drawnMid[1] - chordMid[1]))
      .toBeGreaterThan(100);

    invert([edge]);
    await wait(100);

    // Walked from the other end now, so it is the REVERSE of the same shape.
    // `curveControlPoint` is an ABSOLUTE pass-through point at t = 0.5 and the
    // tangent formulas are symmetric under a P0 ↔ P3 exchange — "mirroring" it
    // would visibly move the curve, which is the change this forbids.
    const after = drawnPath(edge).reverse();

    expect(after.length).toBe(before.length);
    let worst = 0;
    after.forEach((point, i) => {
      worst = Math.max(
        worst,
        Math.hypot(point[0] - before[i][0], point[1] - before[i][1])
      );
    });
    // Floating-point noise, not a redrawn curve.
    expect(worst).toBeLessThan(1e-9);
  });

  test('selecting a typed edge reveals its direction; a free-ended one does not', async () => {
    const reveal = service.std.get(EdgeDirectionManager);
    addMap();
    const consumer = addNode(400, 200);
    const provider = addNode(900, 700);
    const bound = addDependency(consumer, provider);
    const floating = service.surface.addElement({
      type: 'connector',
      role: 'wardley:dependency',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { position: [1200, 300] },
    });
    await wait(50);

    service.selection.set({ elements: [bound], editing: false });
    await wait(50);
    expect(reveal.revealed$.value).toEqual([bound]);
    expect(reveal.revealedEdges().map(edge => edge.role.id)).toEqual([
      'wardley:dependency',
    ]);

    // ...and the DOM half says the sentence. With neither end named there are
    // no names to put in it, so it reads as the bare verb — a half-sentence,
    // never a blank where a name was promised.
    const widget = edgeless.querySelector('affine-edge-direction-widget');
    expect(widget).toBeTruthy();
    await wait(50);
    const label = widget!.shadowRoot?.querySelector(
      '[data-testid="edge-direction-label"]'
    );
    expect(label?.textContent?.trim()).toBe('depends on');

    // An edge bound to nothing relates nothing, so it says nothing — the same
    // guard W4 applies before it judges anything.
    service.selection.set({ elements: [floating], editing: false });
    await wait(50);
    expect(reveal.revealed$.value).toEqual([]);

    // ...and a generalist connector is not a typed edge at all.
    const neutral = service.surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { id: provider },
    });
    service.selection.set({ elements: [neutral], editing: false });
    await wait(50);
    expect(reveal.revealed$.value).toEqual([]);
  });

  /**
   * The PO's acceptance of 02/08/2026, point 5.
   *
   * The reveal used to be two marks that covered each other: a canvas chevron
   * at the tip of the link, and a horizontal `depends on` tooltip that landed
   * on the same tip (the "middle" of a two-point path is its last point). It is
   * one mark now — the whole sentence, turned onto the line, ending in a point
   * aimed at the provider:
   *
   *     Kettle | depends on > Electricity
   */
  test('the reveal reads ALONG the link, pointing at the provider', async () => {
    addMap();
    // A down-and-right diagonal: 45° on screen, and the only angle at which a
    // horizontal label would obviously be wrong.
    const consumer = addNamedNode(400, 200, 'Kettle');
    const provider = addNamedNode(900, 700, 'Electricity');
    const edge = addDependency(consumer, provider);
    await wait(50);

    // As a lit element: the tag map that carries `updateComplete` is declared
    // in the connector package's own `effects.ts`, which this one never imports.
    const widget = edgeless.querySelector(
      'affine-edge-direction-widget'
    )! as Element & { updateComplete: Promise<unknown> };
    const label = async () => {
      await wait(50);
      await widget.updateComplete;
      return widget.shadowRoot?.querySelector(
        '[data-testid="edge-direction-label"]'
      ) as HTMLElement | null;
    };
    /** The `rotate()` and `scale()` the widget wrote, in degrees and factors. */
    const transform = (element: HTMLElement) => {
      const { transform: value } = element.style;
      const rotate = /rotate\(([-\d.]+)deg\)/.exec(value);
      const scale = /scale\(([-\d.]+)\)/.exec(value);
      expect(rotate, `no rotation in "${value}"`).toBeTruthy();
      expect(scale, `no scale in "${value}"`).toBeTruthy();
      return { degrees: Number(rotate![1]), scale: Number(scale![1]) };
    };

    service.selection.set({ elements: [edge], editing: false });
    const shown = await label();
    expect(shown).toBeTruthy();

    // The whole sentence, in the order it is read: who needs, the role's verb,
    // what is needed. The two names come out of the DOCUMENT — the grouped
    // label beside each circle — and only the verb out of the vocabulary.
    expect(shown!.textContent?.trim()).toBe('Kettle depends on Electricity');

    // Turned onto the segment it sits on, not laid flat across it.
    expect(transform(shown!).degrees).toBeCloseTo(45, 0);
    // And the point is on the box's far end, which is the end facing the
    // provider.
    expect(shown!.dataset.arrow).toBe('end');

    // It sits on the MIDDLE of the link, well clear of both tips: the bug the
    // PO photographed was a label on the tip, covering the mark beside it.
    const box = shown!.getBoundingClientRect();
    const centre = [box.left + box.width / 2, box.top + box.height / 2];
    const model = service.surface.getElementById(edge) as ConnectorElementModel;
    const path = model.absolutePath;
    const tips = [path[0], path[path.length - 1]].map(point =>
      service.viewport.toViewCoord(point[0], point[1])
    );
    for (const [tipX, tipY] of tips) {
      expect(
        Math.hypot(centre[0] - tipX, centre[1] - tipY),
        'the label is sitting on a tip of the link'
      ).toBeGreaterThan(60);
    }

    // M3 turns the box over: the sentence swaps its subject and its object,
    // and the point moves to the end that now faces the provider. The picture
    // and the data cannot disagree.
    invert([edge]);
    const reversed = await label();
    expect(reversed!.textContent?.trim()).toBe('Electricity depends on Kettle');
    expect(reversed!.dataset.arrow).toBe('start');
    // Still readable: the link now runs up-and-left, so the box is turned by
    // 180° and lands back at the same +45°.
    expect(transform(reversed!).degrees).toBeCloseTo(45, 0);
  });

  test('the sentence is in MODEL units — it zooms with the map', async () => {
    addMap();
    const consumer = addNamedNode(400, 200, 'Kettle');
    const provider = addNamedNode(900, 700, 'Electricity');
    const edge = addDependency(consumer, provider);
    service.selection.set({ elements: [edge], editing: false });
    await wait(50);

    // As a lit element: the tag map that carries `updateComplete` is declared
    // in the connector package's own `effects.ts`, which this one never imports.
    const widget = edgeless.querySelector(
      'affine-edge-direction-widget'
    )! as Element & { updateComplete: Promise<unknown> };
    const widthAt = async (zoom: number) => {
      service.viewport.setZoom(zoom);
      await wait(50);
      await widget.updateComplete;
      const label = widget.shadowRoot?.querySelector(
        '[data-testid="edge-direction-label"]'
      ) as HTMLElement;
      expect(label).toBeTruthy();
      expect(label.style.transform).toContain(`scale(${zoom})`);
      // The box is rotated, so this is the bounding box of a turned rectangle —
      // which is exactly as linear in the zoom as the rectangle is.
      return label.getBoundingClientRect().width;
    };

    const one = await widthAt(1);
    const half = await widthAt(0.5);
    const double = await widthAt(2);

    // A mark measured in screen pixels would be the same box at every zoom, and
    // would swallow the map at 25 %. The same rule the chevron it replaces
    // obeyed, and the one the validation marks obey.
    expect(half / one).toBeCloseTo(0.5, 1);
    expect(double / one).toBeCloseTo(2, 1);
  });

  test('the contextual toolbar swaps flip-direction for the inversion', async () => {
    addMap();
    const consumer = addNode(400, 200);
    const provider = addNode(900, 700);
    const typed = addDependency(consumer, provider);
    const neutral = service.surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { id: provider },
    });
    await wait(50);

    /** The two entries, found by id inside the endpoint-style group. */
    const entry = (id: string) => {
      const group = connectorToolbarConfig.actions.find(
        action => action.id === 'c.endpoint-style'
      ) as { actions: { id: string; when?: (ctx: unknown) => boolean }[] };
      const found = group.actions.find(action => action.id === id);
      expect(found, `toolbar entry ${id}`).toBeTruthy();
      return found!;
    };

    /** A toolbar context holding exactly one selected connector. */
    const contextFor = (elementId: string) => ({
      std: edgeless.std,
      getSurfaceModelsByType: () => [service.surface.getElementById(elementId)],
    });

    const flip = entry('b.flip-direction');
    const invertEntry = entry('b.invert-direction');

    // On a TYPED edge, `b.flip-direction` is a lie: it swaps the endpoint
    // STYLES and leaves `source`/`target` alone, so the picture and the data
    // would disagree. It disappears, and Reverse direction takes its place.
    expect(flip.when!(contextFor(typed))).toBe(false);
    expect(invertEntry.when!(contextFor(typed))).toBe(true);

    // On a generalist connector nothing changes: the two ends carry no claim,
    // so the arrowhead swap is honest and the inversion has no relation to act
    // on.
    expect(flip.when!(contextFor(neutral))).toBe(true);
    expect(invertEntry.when!(contextFor(neutral))).toBe(false);

    // A MIXED selection: the swap would still lie about the typed half, so it
    // stays hidden — and Reverse appears, acting on that half.
    const mixed = {
      std: edgeless.std,
      getSurfaceModelsByType: () => [
        service.surface.getElementById(typed),
        service.surface.getElementById(neutral),
      ],
    };
    expect(flip.when!(mixed)).toBe(false);
    expect(invertEntry.when!(mixed)).toBe(true);

    // A typed edge bound to nothing: no relation, so neither entry offers a
    // gesture that would do nothing when clicked.
    const floating = service.surface.addElement({
      type: 'connector',
      role: 'wardley:dependency',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { position: [1200, 300] },
    });
    await wait(50);
    expect(invertEntry.when!(contextFor(floating))).toBe(false);
    expect(invertibleEdges(edgeless.std, [floating])).toEqual([]);
  });

  test('the armed link tool shows its hint INSIDE the viewport', async () => {
    // M1: the sentence a user reads before they drag. It is pinned to the
    // editor viewport, not to the widget host — that host is a zero-sized box
    // at the origin, and positioning against it put the banner off screen twice
    // over (96 px above the top edge, half of it left of the left edge).
    const link = getRegisteredCommands(edgeless.std).find(
      command => command.id === 'wardley.linkTool'
    );
    expect(link, 'wardley.linkTool is not registered').toBeTruthy();
    runCommand(edgeless.std, link!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait(50);

    const widget = edgeless.querySelector('affine-edge-direction-widget');
    const hint = widget!.shadowRoot?.querySelector(
      '[data-testid="edge-direction-hint"]'
    );
    expect(hint, 'the armed tool shows no hint').toBeTruthy();
    expect(hint!.textContent?.trim()).toBe(
      'Drag from the component that has the need to what it needs.'
    );

    const box = hint!.getBoundingClientRect();
    const viewport = edgeless.getBoundingClientRect();
    // A real banner, not a one-word column: the box collapsed to its longest
    // word when it was sized against the zero-width host, which is how it grew
    // tall enough to fall out of the bottom of the screen.
    expect(box.width).toBeGreaterThan(200);
    expect(box.height).toBeLessThan(80);
    // Every edge of the banner inside every edge of the editor.
    expect(box.left).toBeGreaterThanOrEqual(viewport.left);
    expect(box.top).toBeGreaterThanOrEqual(viewport.top);
    expect(box.right).toBeLessThanOrEqual(viewport.right);
    expect(box.bottom).toBeLessThanOrEqual(viewport.bottom);
  });

  test('the inversion refuses everything that is not a typed edge', async () => {
    addMap();
    const consumer = addNode(400, 200);
    const provider = addNode(900, 700);
    const neutral = service.surface.addElement({
      type: 'connector',
      mode: ConnectorMode.Straight,
      source: { id: consumer },
      target: { id: provider },
    });
    await wait(50);

    // On a generalist connector the two ends are interchangeable labels: there
    // is no relation to invert, so the command has no target and the toolbar
    // keeps its own `b.flip-direction` instead.
    expect(invertibleEdges(edgeless.std, [neutral])).toEqual([]);
    expect(invertibleEdges(edgeless.std, [consumer])).toEqual([]);

    const model = service.surface.getElementById(
      neutral
    ) as ConnectorElementModel;
    invert([neutral]);
    await wait(50);
    expect(model.source.id).toBe(consumer);
    expect(model.target.id).toBe(provider);
  });
});
