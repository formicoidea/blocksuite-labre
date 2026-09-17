import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  exportSvgToolbarConfig,
  renderBoardSvg,
} from '@labre/affine/blocks/surface';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import { UML_LIFELINE_DASH, UML_ROLE } from '@labre/affine-gfx-uml';
import {
  WARDLEY_BACKGROUND,
  WARDLEY_NODE_SIZE,
  WARDLEY_ROLE,
  wardleyCanonicalBox,
  wardleyNodeProps,
} from '@labre/affine-gfx-wardley';
import {
  FrameworkBackgroundElementModel,
  StrokeStyle,
  TextElementModel,
  WardleyBackgroundElementModel,
} from '@labre/affine/model';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import { getRegisteredCommands } from '@labre/affine/std';
import { Bound } from '@labre/global/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The generic SVG export (ADR 0025, rule R34).
 *
 * The unit suite owns the descriptor and the board table over plain stubs.
 * What only a real editor can answer is the claim the whole feature rests on:
 * that the CANVAS RENDERER, replayed into svgcanvas, actually produces a
 * parsable document for a real board with real elements on it — and that the
 * command and the "⋮" entry are offered where a user reaches them.
 *
 * Two Wardley maps side by side is the scoping fixture, for the reason
 * `wardley-export-owm.spec.ts` uses the same one: a board with a single map
 * exports the same bytes whether the scoping works or not.
 */
describe('exporting a board as SVG', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  const MAP_W = 1600;
  const MAP_H = 900;

  const addMap = (x: number) =>
    surfaceModel().addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(x, 0, MAP_W, MAP_H).serialize(),
    });

  /** A named component: the circle, and the free text that names it. */
  const addNamed = async (name: string, cx: number, cy: number) => {
    const surface = surfaceModel();
    surface.addElement(
      wardleyNodeProps('component', {
        xywh: wardleyCanonicalBox('component', cx, cy),
      })
    );
    const labelId = surface.addElement({
      type: 'text',
      text: name,
      role: WARDLEY_ROLE.label,
      xywh: new Bound(
        cx + WARDLEY_NODE_SIZE.component.w / 2 + 8,
        cy - 13,
        120,
        26
      ).serialize(),
    });
    await wait();

    const label = surface.getElementById(labelId);
    expect(label).toBeInstanceOf(TextElementModel);
    const box = label!.elementBound;
    label!.xywh = new Bound(
      cx + WARDLEY_NODE_SIZE.component.w / 2 + 8,
      cy - box.h / 2,
      box.w,
      box.h
    ).serialize();
    await wait();
  };

  /** The two maps, each with one named component wholly inside it. */
  const twoMaps = async () => {
    const mapA = addMap(0);
    const mapB = addMap(2000);
    await wait();
    await addNamed('Alpha', 200, 400);
    await addNamed('Bravo', 2200, 400);
    return { mapA, mapB };
  };

  const boardById = (id: string) => {
    const model = surfaceModel().getElementById(id);
    expect(model).toBeInstanceOf(FrameworkBackgroundElementModel);
    return model as FrameworkBackgroundElementModel;
  };

  /** Parse an export, refusing anything a browser would refuse. */
  const parse = (svg: string) => {
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    expect(doc.querySelector('parsererror'), svg.slice(0, 400)).toBeNull();
    return doc;
  };

  const exportCommand = () => {
    const command = getRegisteredCommands(edgeless.std).find(
      c => c.id === 'export.svg'
    );
    expect(command, 'export.svg is not registered').toBeDefined();
    return command!;
  };

  const WARDLEY_FLAVOUR = 'affine:surface:wardley';
  const EXPORT_SVG_MODULE = 'custom:affine:surface:*#export-svg';

  /**
   * The toolbar context a click on the map would carry. The registry's two
   * signals are written here rather than waited for: they are what the toolbar
   * widget sets when the selection changes, and driving them keeps this about
   * WHICH ACTION is offered rather than about the widget's render timing.
   */
  const select = (...ids: string[]) => {
    edgeless.gfx.selection.set({ elements: ids, editing: false });
    const models = ids
      .map(id => surfaceModel().getElementById(id))
      .filter(
        (model): model is WardleyBackgroundElementModel =>
          model instanceof WardleyBackgroundElementModel
      );
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    registry.flavour$.value = WARDLEY_FLAVOUR;
    registry.elementsMap$.value = new Map([[WARDLEY_FLAVOUR, models]]);
    return new ToolbarContext(edgeless.std);
  };

  test('renders the selected board, and nothing of the one beside it', async () => {
    const { mapA } = await twoMaps();

    const { svg, bound } = renderBoardSvg(edgeless.std, boardById(mapA));
    const doc = parse(svg);

    // A document, not a fragment: a file a browser can open on its own.
    expect(doc.documentElement.tagName.toLowerCase()).toBe('svg');
    expect(doc.documentElement.getAttribute('viewBox')).toBeTruthy();
    expect(bound.w).toBeGreaterThan(0);
    expect(bound.h).toBeGreaterThan(0);

    const texts = [...doc.querySelectorAll('text')].map(
      node => node.textContent ?? ''
    );
    expect(texts.some(text => text.includes('Alpha'))).toBe(true);
    // The neighbouring map's component is outside this board's frame, so it is
    // outside the file — the scoping claim, said in the one place it shows.
    expect(texts.some(text => text.includes('Bravo'))).toBe(false);
  });

  test('the command needs a selected board, and the "⋮" offers it', async () => {
    const { mapA } = await twoMaps();
    const command = exportCommand();

    // Nothing selected: the entry withdraws rather than greying.
    edgeless.gfx.selection.clear();
    expect(command.when?.(edgeless.std)).toBe(false);

    edgeless.gfx.selection.set({ elements: [mapA], editing: false });
    expect(command.when?.(edgeless.std)).toBe(true);

    // The module is registered under the wildcard slot WITH its owner suffix —
    // the bare key belongs to the exception toolbar — and `modulesFor` still
    // hands it to the row drawn for that flavour.
    const modules = edgeless.std
      .get(ToolbarRegistryIdentifier)
      .modulesFor('custom:affine:surface:*');
    expect(modules.map(module => module.id.variant)).toContain(
      EXPORT_SVG_MODULE
    );

    const when = exportSvgToolbarConfig.when;
    expect(when(select(mapA))).toBe(true);

    edgeless.gfx.selection.clear();
    edgeless.std.get(ToolbarRegistryIdentifier).elementsMap$.value = new Map();
    expect(when(new ToolbarContext(edgeless.std))).toBe(false);
  });

  /**
   * The browser half of R34: every board kind, not just the one that happened
   * to be written first. Each is created by its persisted TYPE alone — no
   * framework preset, no props — because that is exactly the claim under test:
   * a board is a `FrameworkBackgroundElementModel`, and nothing else about it
   * is the export's business.
   */
  const BOARD_TYPES = [
    'wardley',
    'bpmnPool',
    'c4Board',
    'c4Boundary',
    'contextMap',
    'coreDomain',
    'eventStorming',
    'cynefin',
    'estuarine',
    'edgy',
    'edgyBoard',
    'umlDiagram',
    'umlSubject',
    'umlPartition',
    'umlRegion',
    'umlFragment',
  ] as const;

  test.each(BOARD_TYPES)('%s exports a parsable SVG', async type => {
    const id = surfaceModel().addElement({
      type,
      xywh: new Bound(0, 0, 1200, 800).serialize(),
    });
    await wait();

    const { svg } = renderBoardSvg(edgeless.std, boardById(id));
    expect(svg.length, type).toBeGreaterThan(0);
    const doc = parse(svg);
    expect(doc.documentElement.getAttribute('viewBox'), type).toBeTruthy();
  });

  /** Every text node of an export, as the reader of the file sees it. */
  const textsOf = (doc: Document) =>
    [...doc.querySelectorAll('text')].map(node => node.textContent ?? '');

  /**
   * A sequence diagram with a lifeline in it. The lifeline's dashed spine was
   * the first glyph to read the dash back (`getLineDash`), which svgcanvas
   * 2.6.0 does not implement — so the whole export threw and nothing
   * downloaded. The spine must now reach the file, dashed.
   */
  test('a sequence diagram with a lifeline exports, spine included', async () => {
    const surface = surfaceModel();
    const diagram = surface.addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'sd',
      name: 'Checkout',
      xywh: '[0,0,1400,900]',
    });
    surface.addElement({
      type: 'umlNode',
      kind: 'lifeline',
      role: UML_ROLE.lifeline,
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      xywh: '[200,100,16,600]',
    });
    await wait();

    const { svg } = renderBoardSvg(edgeless.std, boardById(diagram));
    const doc = parse(svg);

    expect(textsOf(doc).some(text => text.includes('Checkout'))).toBe(true);
    const dashed = [...doc.querySelectorAll('path')].filter(
      path =>
        path.getAttribute('stroke-dasharray') === UML_LIFELINE_DASH.join(',')
    );
    expect(dashed, svg.slice(0, 400)).toHaveLength(1);
  });

  /**
   * UML nests frames inside the diagram frame by design (a subject, a
   * partition, a region, a fragment), and they are backgrounds too. The export
   * used to drop every background but the selected one; a frame that lies
   * wholly inside the exported one is part of its picture and stays.
   */
  test('a diagram frame exports the frame nested inside it', async () => {
    const surface = surfaceModel();
    const diagram = surface.addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind: 'sd',
      name: 'Checkout',
      xywh: '[0,0,1400,900]',
    });
    const fragment = surface.addElement({
      type: 'umlFragment',
      role: UML_ROLE.fragment,
      operator: 'loop',
      name: '[items left]',
      xywh: '[150,180,420,260]',
    });
    await wait();

    // The fragment on its own is a board too, and its export does not drag
    // the diagram frame around it along.
    const own = parse(renderBoardSvg(edgeless.std, boardById(fragment)).svg);
    expect(textsOf(own).some(text => text.includes('loop'))).toBe(true);
    expect(textsOf(own).some(text => text.includes('Checkout'))).toBe(false);

    const { svg } = renderBoardSvg(edgeless.std, boardById(diagram));
    const texts = textsOf(parse(svg));
    expect(texts.some(text => text.includes('Checkout'))).toBe(true);
    expect(texts.some(text => text.includes('loop'))).toBe(true);
  });
});
