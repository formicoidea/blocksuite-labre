import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
// Straight off the framework package, as the neighbouring wardley specs do:
// `@labre/affine` re-exports the blocks, not the framework modules.
import { WARDLEY_AREA_SIZE, WARDLEY_ROLE } from '@labre/affine-gfx-wardley';
import {
  DEFAULT_POLYGON_VERTICES,
  GroupElementModel,
  ShapeElementModel,
  WardleyNodeElementModel,
} from '@labre/affine/model';
import {
  ToolbarContext,
  ToolbarRegistryIdentifier,
} from '@labre/affine/shared/services';
import {
  getCommandsForSurface,
  getRegisteredCommands,
  runCommand,
} from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { pointerdown, pointerup, wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Areas — the zones of the map, drawn from the sub-menu into a real document.
 *
 * The unit suite owns the presets, the legend row and the silence the OWM
 * export reports. What only a real editor can answer is what a user actually
 * gets, and here that is three things nothing else can check.
 *
 * That a zone lands BEHIND the map it covers: the surface paints in index
 * order, so an area added after a component would sit on top of it — a wash
 * over the drawing, and every click meant for that component eaten. The paint
 * order is read back off the layer manager, which is the list the canvas
 * actually draws from.
 *
 * That the name really is the zone's own inner text: created empty, opened by a
 * double-click, and typed into without the boundary moving a pixel.
 *
 * And that the vertex editor reaches the one artefact it is meant for. A zone's
 * corners are the point of choosing the polygon; an accelerator's outline IS
 * the notation, and dragging a barb would turn a statement about the climate
 * into a grey blob.
 */
describe('drawing areas from the Wardley sub-menu', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** Run one of the commands the way the sub-menu runs it. */
  const run = async (id: string) => {
    const command = getRegisteredCommands(edgeless.std).find(c => c.id === id);
    expect(command, id).toBeDefined();
    runCommand(edgeless.std, command!, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();
  };

  /** The zones on the surface, in document order. */
  const areas = () =>
    surfaceModel().elementModels.filter(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'area'
    );

  /** Draw one zone and hand it back. */
  const draw = async (id: string) => {
    await run(id);
    const drawn = areas();
    expect(drawn).toHaveLength(1);
    return drawn[0];
  };

  /* ── What one click produces ─────────────────────────────────────────── */

  test.each([
    ['wardley.addAreaRect', 'rect'],
    ['wardley.addAreaPolygon', 'polygon'],
  ] as const)('%s draws one loose zone', async (id, shape) => {
    const area = await draw(id);

    expect(area.kind).toBe('area');
    expect(area.role).toBe(WARDLEY_ROLE.area);
    expect(area.shapeType).toBe(shape);

    // ONE element and no group, which is what separates this artefact from
    // every other one on the palette: a zone's name lives inside it, so there
    // is no text element beside it to be grouped with.
    expect(area.group).toBeNull();
    expect(
      surfaceModel().elementModels.filter(
        model => model instanceof GroupElementModel
      )
    ).toHaveLength(0);

    const [, , w, h] = area.deserializedXYWH;
    expect([w, h]).toEqual([
      WARDLEY_AREA_SIZE[shape].w,
      WARDLEY_AREA_SIZE[shape].h,
    ]);
    // Peace light at ~60 % opacity over a thin Peace rim: the components
    // underneath have to stay readable through the wash.
    expect(area.fillColor).toBe('#c6dbfc99');
    expect(area.strokeColor).toBe('#5b9cf6');
    expect(area.strokeWidth).toBe(1);
    expect(area.filled).toBe(true);
    // Nameless, so the editor a double-click opens starts on an empty line.
    expect(area.text).toBeUndefined();
  });

  test('the polygon arrives with the editor’s own default outline', async () => {
    const area = await draw('wardley.addAreaPolygon');

    expect(area.vertices).toEqual(DEFAULT_POLYGON_VERTICES);
    expect(area.isClosed).toBe(true);
    // …and a fresh array in the document, not the module literal every other
    // polygon in the editor would then share.
    expect(area.vertices).not.toBe(DEFAULT_POLYGON_VERTICES);
  });

  test('the rectangle writes square corners and no outline', async () => {
    const area = await draw('wardley.addAreaRect');

    expect(area.radius).toBe(0);
    expect(area.vertices).toBeUndefined();
  });

  /* ── Behind the map it covers ────────────────────────────────────────── */

  test('a zone drawn after a component lands behind it', async () => {
    await run('wardley.addComponent');
    const component = surfaceModel().elementModels.find(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'component'
    )!;

    const area = await draw('wardley.addAreaRect');

    // The paint order the canvas actually draws from, not the creation order:
    // the layer manager sorts canvas elements by index, nesting included.
    const painted = edgeless.gfx.layer.canvasElements.map(el => el.id);
    expect(painted.indexOf(area.id)).toBeLessThan(
      painted.indexOf(component.id)
    );
    // …and below the group the component was drawn as, which is the element
    // the reorder actually ranked against.
    const group = component.group as GroupElementModel;
    expect(group).toBeTruthy();
    expect(painted.indexOf(area.id)).toBeLessThan(painted.indexOf(group.id));
  });

  /* ── The name is the zone's own text ─────────────────────────────────── */

  /** A model point, as the pointer helpers take it. */
  const at = (x: number, y: number) => {
    const [vx, vy] = edgeless.gfx.viewport.toViewCoord(x, y);
    return { x: vx, y: vy };
  };

  /** A real double-click, driven through the host so the routing is tested. */
  const doubleClick = async (p: { x: number; y: number }) => {
    const host = window.editor.host as HTMLElement;
    pointerdown(host, p);
    pointerup(host, p);
    pointerdown(host, p);
    pointerup(host, p);
    await wait();
  };

  const shapeEditor = () =>
    edgeless.querySelector('edgeless-shape-text-editor') as
      | (HTMLElement & {
          inlineEditor?: {
            insertText: (
              range: { index: number; length: number },
              text: string
            ) => void;
          };
          inlineEditorContainer?: HTMLElement;
        })
      | null;

  test('a double-click names the zone without resizing it', async () => {
    const area = await draw('wardley.addAreaRect');
    const [x, y, w, h] = area.deserializedXYWH;

    // Near the top-left corner rather than the centre, which is where the name
    // is written — and inside the zone either way.
    await doubleClick(at(x + w / 4, y + h / 4));

    expect(shapeEditor()).not.toBeNull();
    expect(edgeless.gfx.selection.editing).toBe(true);
    expect(edgeless.gfx.selection.selectedIds).toEqual([area.id]);

    const editor = shapeEditor()!;
    expect(editor.inlineEditor).toBeTruthy();
    editor.inlineEditor!.insertText({ index: 0, length: 0 }, 'Zone A');
    await wait();

    editor.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    editor.inlineEditorContainer?.dispatchEvent(
      new FocusEvent('blur', { bubbles: false })
    );
    await wait();
    await wait();

    expect(area.text?.toString()).toBe('Zone A');
    // `TextFitMode.Overflow`: a zone is a boundary drawn around real
    // components, so a name must never push it out and swallow one.
    expect(area.deserializedXYWH.slice(2)).toEqual([w, h]);
  });

  /* ── The vertex editor, and who may reach it ─────────────────────────── */

  /**
   * The toolbar context a click on these elements would carry.
   *
   * The registry's two signals are written here rather than waited for: they
   * are what the toolbar widget sets when the selection changes, and driving
   * them keeps this about WHICH ACTION is offered rather than about the
   * widget's render timing.
   */
  const select = (flavour: string, ...models: ShapeElementModel[]) => {
    edgeless.gfx.selection.set({
      elements: models.map(model => model.id),
      editing: false,
    });
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    registry.flavour$.value = flavour;
    registry.elementsMap$.value = new Map([[flavour, models]]);
    return new ToolbarContext(edgeless.std);
  };

  /** Whether the flavour's toolbar offers vertex editing for that selection. */
  const offersVertexEditing = (
    flavour: string,
    ...models: ShapeElementModel[]
  ) => {
    const ctx = select(flavour, ...models);
    const config = edgeless.std
      .get(ToolbarRegistryIdentifier)
      .getModuleBy(flavour);
    expect(config, flavour).toBeTruthy();
    const action = config!.actions.find(a => a.id === 'f1.edit-vertices');
    if (!action) return false;
    const when = action.when;
    return typeof when === 'function' ? when(ctx) : when !== false;
  };

  const WARDLEY_NODE_FLAVOUR = 'affine:surface:wardleyNode';

  test('a polygon zone is offered the vertex editor', async () => {
    // The whole point of choosing the polygon over the rectangle: its outline
    // has to follow the components it groups.
    const area = await draw('wardley.addAreaPolygon');
    expect(offersVertexEditing(WARDLEY_NODE_FLAVOUR, area)).toBe(true);
  });

  test('a rectangular zone is not — it has no vertices to move', async () => {
    const area = await draw('wardley.addAreaRect');
    expect(offersVertexEditing(WARDLEY_NODE_FLAVOUR, area)).toBe(false);
  });

  test('an accelerator is not, even taken out of its group', async () => {
    await run('wardley.addAccelerator');
    const arrow = surfaceModel().elementModels.find(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'accelerator'
    )!;
    expect(arrow.shapeType).toBe('polygon');

    // Grouped with its name, so the shape action's own `when` already declines
    // — but the gate is on `kind === 'area'`, so it declines for the reason
    // that matters: the direction of this arrow IS the notation.
    expect(offersVertexEditing(WARDLEY_NODE_FLAVOUR, arrow)).toBe(false);
  });

  test('a Porter’s-forces glyph is not either', async () => {
    await run('wardley.addPorter');
    const circle = surfaceModel().elementModels.find(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel && model.kind === 'porter'
    )!;

    expect(offersVertexEditing(WARDLEY_NODE_FLAVOUR, circle)).toBe(false);

    // …and neither are its four arrows, which are `wardleyNode` POLYGONS of
    // kind `porter` carrying no role — the glyph's own wiring. They land on
    // this very toolbar, so without the `kind === 'area'` gate they would be
    // offered a gesture that can only deform the notation.
    const arrows = surfaceModel().elementModels.filter(
      (model): model is WardleyNodeElementModel =>
        model instanceof WardleyNodeElementModel &&
        model.kind === 'porter' &&
        model.shapeType === 'polygon'
    );
    expect(arrows).toHaveLength(4);
    // The action IS on this row — the gate is what declines it, not an absence.
    const registry = edgeless.std.get(ToolbarRegistryIdentifier);
    expect(
      registry
        .getModuleBy(WARDLEY_NODE_FLAVOUR)!
        .actions.map(action => action.id)
    ).toContain('f1.edit-vertices');
    expect(offersVertexEditing(WARDLEY_NODE_FLAVOUR, arrows[0])).toBe(false);
  });

  /* ── The row and the catalogue ───────────────────────────────────────── */

  test('both nominate the row and both are in the catalogue', () => {
    const nominated = getCommandsForSurface(
      edgeless.std,
      'wardley',
      'senior-menu'
    ).map(c => c.id);
    expect(nominated).toContain('wardley.addAreaRect');
    expect(nominated).toContain('wardley.addAreaPolygon');

    const catalogue = getCommandsForSurface(
      edgeless.std,
      'wardley',
      'catalogue'
    ).map(c => c.id);
    expect(catalogue).toContain('wardley.addAreaRect');
    expect(catalogue).toContain('wardley.addAreaPolygon');
  });

  test('the catalogue files them under a section of their own', () => {
    const areasSection = getCommandsForSurface(
      edgeless.std,
      'wardley',
      'catalogue'
    ).filter(c => c.category === 'areas');
    expect(areasSection.map(c => c.id)).toEqual([
      'wardley.addAreaRect',
      'wardley.addAreaPolygon',
    ]);
  });
});
