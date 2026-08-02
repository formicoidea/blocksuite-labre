import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ValidationManager } from '@labre/affine/blocks/surface';
import {
  connectorToolbarConfig,
  EdgeDirectionManager,
  invertibleEdges,
} from '@labre/affine/gfx/connector';
import type { ConnectorElementModel } from '@labre/affine/model';
import { ConnectorMode } from '@labre/affine/model';
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
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

  const invert = (elementIds: string[]) => {
    const command = getRegisteredCommands(edgeless.std).find(
      candidate => candidate.id === 'edge.invert-direction'
    );
    expect(command, 'edge.invert-direction is not registered').toBeTruthy();
    runCommand(
      edgeless.std,
      command!,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
      { elementIds }
    );
  };

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

  test('reversing a CURVED connector leaves the drawn curve where it was', async () => {
    addMap();
    const consumer = addNode(400, 200);
    const provider = addNode(900, 700);
    const edge = addDependency(consumer, provider, ConnectorMode.Curve);
    await wait(100);

    const pathOf = (id: string) =>
      (
        service.surface.getElementById(id) as ConnectorElementModel
      ).absolutePath.map(point => [point[0], point[1]] as [number, number]);

    const before = pathOf(edge);
    expect(before.length).toBeGreaterThan(1);

    invert([edge]);
    await wait(100);

    // The path is walked from the other end now, so it is the REVERSE of the
    // same shape. `curveControlPoint` is an absolute pass-through point and the
    // tangents are symmetric under a P0 ↔ P3 exchange — "mirroring" it would
    // move the curve, which is the change this assertion forbids.
    const after = pathOf(edge).reverse();

    expect(after.length).toBe(before.length);
    after.forEach((point, i) => {
      expect(point[0]).toBeCloseTo(before[i][0], 3);
      expect(point[1]).toBeCloseTo(before[i][1], 3);
    });
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

    // ...and the DOM half says the sentence: the role's own verb, resolved
    // through the host's catalogue, next to the line the chevron marks.
    const widget = edgeless.querySelector('affine-edge-direction-widget');
    expect(widget).toBeTruthy();
    await wait(50);
    const verb = widget!.shadowRoot?.querySelector(
      '[data-testid="edge-direction-verb"]'
    );
    expect(verb?.textContent?.trim()).toBe('depends on');

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
