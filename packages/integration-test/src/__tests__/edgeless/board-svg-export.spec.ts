import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  type BoardSvgExportOptions,
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
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
import { getRegisteredCommands, runCommand } from '@labre/affine/std';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { Bound } from '@labre/global/gfx';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test, vi } from 'vitest';

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

  /** An export with every part switched on, which always has a board to draw. */
  const render = (
    board: FrameworkBackgroundElementModel,
    options?: Partial<BoardSvgExportOptions>
  ) => {
    const out = renderBoardSvg(edgeless.std, board, {
      ...DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
      ...options,
    });
    expect(out, 'nothing was drawn').not.toBeNull();
    return out!;
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

    const { svg, bound } = render(boardById(mapA));
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

    const { svg } = render(boardById(id));
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

    const { svg } = render(boardById(diagram));
    const doc = parse(svg);

    expect(textsOf(doc).some(text => text.includes('Checkout'))).toBe(true);
    const dashed = [...doc.querySelectorAll('path')].filter(
      path =>
        path.getAttribute('stroke-dasharray') === UML_LIFELINE_DASH.join(',')
    );
    expect(dashed, svg.slice(0, 400)).toHaveLength(1);
  });

  /**
   * A map pasted into a slide must keep its colours. svgcanvas wrote the
   * Wardley area's `#c6dbfc40`, the pipeline's `#ffffff99` and the shape
   * renderer's `transparent` verbatim; none is an SVG 1.1 paint, and
   * PowerPoint's importer replaced each with its own theme colour. Every
   * fill, stroke and stop must now be a colour SVG 1.1 reads, or `none`, or a
   * reference to a gradient.
   */
  test('every paint in a Wardley export is static SVG 1.1', async () => {
    const surface = surfaceModel();
    const map = addMap(0);
    await addNamed('Alpha', 300, 400);
    surface.addElement(
      wardleyNodeProps('area', {
        xywh: new Bound(200, 300, 400, 200).serialize(),
      })
    );
    surface.addElement(
      wardleyNodeProps('pipeline', {
        xywh: new Bound(700, 300, 300, 40).serialize(),
      })
    );
    surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      filled: false,
      strokeStyle: StrokeStyle.None,
      xywh: new Bound(1100, 300, 100, 100).serialize(),
    });
    await wait();

    const { svg } = render(boardById(map));
    const doc = parse(svg);

    const STATIC_PAINT =
      /^(none|#[0-9a-f]{3}|#[0-9a-f]{6}|rgb\(\d+,\d+,\d+\)|url\(#[^)]+\)|[a-z]+)$/i;
    const paints = [...doc.querySelectorAll('*')].flatMap(node =>
      ['fill', 'stroke', 'stop-color']
        .map(name => node.getAttribute(name))
        .filter((value): value is string => value !== null)
    );

    expect(paints.length).toBeGreaterThan(0);
    expect(svg).not.toContain('transparent');
    expect(paints.filter(paint => !STATIC_PAINT.test(paint))).toEqual([]);
    // The area's wash, at the alpha its 8-digit hex carried.
    const area = [...doc.querySelectorAll('[fill="rgb(198,219,252)"]')];
    expect(area.length, svg.slice(0, 400)).toBeGreaterThan(0);
    expect(Number(area[0].getAttribute('fill-opacity'))).toBeCloseTo(
      0x40 / 255,
      5
    );
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
    const own = parse(render(boardById(fragment)).svg);
    expect(textsOf(own).some(text => text.includes('loop'))).toBe(true);
    expect(textsOf(own).some(text => text.includes('Checkout'))).toBe(false);

    const { svg } = render(boardById(diagram));
    const texts = textsOf(parse(svg));
    expect(texts.some(text => text.includes('Checkout'))).toBe(true);
    expect(texts.some(text => text.includes('loop'))).toBe(true);
  });

  /* ── The export options (ADR 0025, amendment of 2026-10-04) ─────────── */

  /**
   * What the text tool creates by default: an `affine:edgeless-text` BLOCK,
   * drawn in the DOM — which is why "my texts are not exported" was the
   * complaint. It is now redrawn into the file as vector text.
   */
  const addEdgelessText = (words: string, x: number, y: number) => {
    const surfaceId = surfaceModel().id;
    const id = edgeless.service.crud.addBlock(
      'affine:edgeless-text',
      { xywh: new Bound(x, y, 300, 40).serialize() },
      surfaceId
    );
    expect(id).toBeTruthy();
    window.doc.addBlock('affine:paragraph', { text: new Text(words) }, id!);
    return id!;
  };

  /**
   * Every file the export hands the browser, without letting the browser have
   * it: `downloadBlob` goes through `URL.createObjectURL`, which is where the
   * blob is still a blob.
   */
  const captureDownloads = () => {
    const files: Blob[] = [];
    const create = vi
      .spyOn(URL, 'createObjectURL')
      .mockImplementation(object => {
        files.push(object as Blob);
        return 'blob:captured';
      });
    const revoke = vi
      .spyOn(URL, 'revokeObjectURL')
      .mockImplementation(() => {});
    return {
      files,
      restore: () => {
        create.mockRestore();
        revoke.mockRestore();
      },
    };
  };

  const WORDS = 'Loose words beside the map';
  const CAPTION = 'Plain caption';

  test('an edgeless text on the board reaches the file as vector text', async () => {
    const map = addMap(0);
    await addNamed('Alpha', 200, 400);
    addEdgelessText(WORDS, 600, 300);
    await wait();

    const texts = textsOf(parse(render(boardById(map)).svg));
    expect(texts.some(text => text.includes(WORDS))).toBe(true);

    const without = textsOf(
      parse(render(boardById(map), { texts: false }).svg)
    );
    expect(without.some(text => text.includes(WORDS))).toBe(false);
    // The framework's own label is a framework element, not an "other text".
    expect(without.some(text => text.includes('Alpha'))).toBe(true);
  });

  /**
   * The file stacks what the canvas stacks. An edgeless text is a block, and
   * the export used to paint every text block after every canvas element, so a
   * shape drawn over a text came out under it.
   */
  test('an edgeless text under a shape exports under it', async () => {
    const map = addMap(0);
    const below = addEdgelessText(WORDS, 600, 300);
    const cover = surfaceModel().addElement({
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      xywh: new Bound(580, 280, 360, 100).serialize(),
    });
    const above = addEdgelessText(CAPTION, 600, 500);
    await wait();

    const doc = parse(render(boardById(map)).svg);
    const groupOf = (id: string) => {
      const group = doc.querySelector(`[data-labre-id="${id}"]`);
      expect(group, id).not.toBeNull();
      return group!;
    };
    const follows = (a: string, b: string) =>
      (groupOf(a).compareDocumentPosition(groupOf(b)) &
        Node.DOCUMENT_POSITION_PRECEDING) !==
      0;
    expect(follows(cover, below), 'the shape paints over the older text').toBe(
      true
    );
    expect(follows(above, cover), 'the newer text paints over the shape').toBe(
      true
    );
  });

  test('an edgeless text keeps its rotation and its scale in the file', async () => {
    const map = addMap(0);
    const id = addEdgelessText(WORDS, 600, 300);
    // Scaled ×2 the way a corner resize does it (`font-size.ts`), turned 90°.
    edgeless.service.crud.updateElement(id, {
      scale: 2,
      rotate: 90,
      xywh: new Bound(600, 300, 600, 60).serialize(),
    });
    await wait();

    const node = [...parse(render(boardById(map)).svg).querySelectorAll('text')]
      .filter(text => text.textContent?.includes(WORDS))
      .at(0);
    const matrix = node
      ?.getAttribute('transform')
      ?.match(/matrix\(([^)]+)\)/)?.[1]
      .split(/[\s,]+/)
      .map(Number);
    // The block re-measures its own box from the DOM, so the box is read back.
    const [x, y, w, h] = Bound.deserialize(
      edgeless.service.crud.getElementById(id)!.xywh
    ).toXYWH();
    // translate(x, y) · rotate(90°) about the box's centre · scale(2)
    expect(matrix).toHaveLength(6);
    const [a, b, c, d, e, f] = matrix!;
    for (const [actual, expected] of [
      [a, 0],
      [b, 2],
      [c, -2],
      [d, 0],
      [e, x + w / 2 + h / 2],
      [f, y + h / 2 - w / 2],
    ]) {
      expect(actual).toBeCloseTo(expected, 3);
    }
  });

  /**
   * Depth-first through open shadow roots: the options menu is a popup in the
   * modal root, and each row is a custom element with its own shadow.
   */
  const deepQuery = <T extends Element>(
    from: ParentNode,
    selector: string
  ): T | null => {
    const direct = from.querySelector<T>(selector);
    if (direct) return direct;
    for (const element of from.querySelectorAll('*')) {
      if (!element.shadowRoot) continue;
      const found = deepQuery<T>(element.shadowRoot, selector);
      if (found) return found;
    }
    return null;
  };

  const toolbarRow = () =>
    (
      edgeless.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const settle = async () => {
    await wait(250);
    await edgeless.updateComplete;
    await wait(0);
  };

  const click = (element: Element | null) => {
    expect(element).not.toBeNull();
    return userEvent.click(page.elementLocator(element as HTMLElement));
  };

  test('the "⋮" asks what to include, and "Other texts" off leaves the edgeless text out', async () => {
    const map = addMap(0);
    await addNamed('Alpha', 200, 400);
    addEdgelessText(WORDS, 600, 300);
    surfaceModel().addElement({
      type: 'text',
      text: CAPTION,
      xywh: new Bound(600, 500, 200, 26).serialize(),
    });
    await wait();

    const downloads = captureDownloads();
    try {
      edgeless.gfx.selection.set({ elements: [map], editing: false });
      await settle();

      const entry = toolbarRow()?.querySelector<HTMLElement>(
        '[data-toolbar-action-id="z.z-export-svg"]'
      );
      await click(entry?.closest('editor-menu-button') ?? null);
      await settle();
      await click(entry ?? null);
      await settle();

      // Nothing is written until the reader says Export.
      expect(downloads.files).toHaveLength(0);
      const texts = deepQuery<HTMLElement>(
        document.body,
        '[data-testid="export-svg-option-texts"]'
      );
      await click(texts?.querySelector('toggle-switch') ?? null);
      await click(
        deepQuery(document.body, '[data-testid="export-svg-confirm"]')
      );
      await settle();

      expect(downloads.files).toHaveLength(1);
      const svg = await downloads.files[0].text();
      const written = textsOf(parse(svg));
      expect(written.some(text => text.includes(WORDS))).toBe(false);
      // A plain CANVAS text is an "other text" too, and was drawn before.
      expect(written.some(text => text.includes(CAPTION))).toBe(false);
      expect(written.some(text => text.includes('Alpha'))).toBe(true);

      // The choice is remembered for the next export of the session.
      await click(entry?.closest('editor-menu-button') ?? null);
      await settle();
      await click(entry ?? null);
      await settle();
      const reopened = deepQuery<HTMLElement>(
        document.body,
        '[data-testid="export-svg-option-texts"]'
      )?.querySelector<HTMLElement & { on: boolean }>('toggle-switch');
      expect(reopened?.on).toBe(false);
      await userEvent.keyboard('{Escape}');
    } finally {
      downloads.restore();
    }
  });

  test('nothing left to draw writes no file', async () => {
    const map = addMap(0);
    await addNamed('Alpha', 200, 400);
    edgeless.gfx.selection.set({ elements: [map], editing: false });

    const downloads = captureDownloads();
    try {
      // The board and its own artefacts are all there is.
      runCommand(
        edgeless.std,
        exportCommand(),
        { surface: 'palette', source: 'shortcut' },
        { framework: false }
      );
      expect(downloads.files).toHaveLength(0);

      // The palette and the agent pass nothing, and get everything.
      runCommand(edgeless.std, exportCommand(), {
        surface: 'palette',
        source: 'shortcut',
      });
      expect(downloads.files).toHaveLength(1);
    } finally {
      downloads.restore();
    }
  });
});
