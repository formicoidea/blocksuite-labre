import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { BlockFlags } from '@labre/affine/flags';
import { AffineSchemas } from '@labre/affine/schemas';
import { replaceIdMiddleware } from '@labre/affine/shared/adapters';
import {
  TelemetryExtension,
  type TelemetryEventMap,
} from '@labre/affine/shared/services';
import type { SurfaceBlockModel } from '@labre/affine/std/gfx';
import { readElementTags } from '@labre/affine/std/gfx';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { Schema, Transformer, type Store } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * MF3 end to end: what KIND of thing a Wardley component is.
 *
 * The unit suites own the merge rules, the write helper and the publisher. This
 * one owns what only a real editor can answer — that the dropdown is reachable
 * from ONE click on a composite component, that the DOCUMENT is what remembers
 * the choice, that an unqualified element writes nothing at all, and that the
 * qualification survives a duplicate, an export and a reload.
 */

const NATURE = 'wardley:nature';
const DATA = 'wardley:nature/data';
const PRACTICE = 'wardley:nature/practice';

/** Native-shaped click: composed, so it crosses the widget's shadow boundary. */
function clickElement(element: Element) {
  const rect = element.getBoundingClientRect();
  const init = {
    bubbles: true,
    composed: true,
    cancelable: true,
    clientX: rect.x + rect.width / 2,
    clientY: rect.y + rect.height / 2,
    pointerId: 1,
    isPrimary: true,
  };
  element.dispatchEvent(new PointerEvent('pointerdown', init));
  element.dispatchEvent(new PointerEvent('pointerup', init));
  element.dispatchEvent(new MouseEvent('click', init));
}

/** See the note in `wardley-validation-bubble.spec.ts`: the viewport persists. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

type TrackedEvent = {
  name: keyof TelemetryEventMap;
  props: Record<string, unknown>;
};

describe('the nature of a Wardley component', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let tracked!: TrackedEvent[];
  let unmount: (() => void) | null = null;

  const addComponent = (xywh = '[100,100,60,60]') =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const addLabel = (xywh = '[170,110,120,26]') =>
    service.surface.addElement({
      type: 'text',
      text: 'Payments',
      role: 'wardley:label',
      xywh,
    });

  const addAnchor = (xywh = '[400,100,60,60]') =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'anchor',
      role: 'wardley:anchor',
      xywh,
    });

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;
  const toolbarQuery = (selector: string) =>
    toolbar()?.querySelector(selector) ?? null;

  /** The dropdown host, in the toolbar's own DOM. */
  const tagsEntry = () => toolbarQuery('[data-testid="element-tags-entry"]');
  /** Its trigger, which `editor-menu-button` renders into its shadow root. */
  const tagsButton = () =>
    tagsEntry()?.shadowRoot?.querySelector(
      '[data-testid="element-tags-button"]'
    ) ?? null;
  const options = () =>
    Array.from(
      toolbar()?.querySelectorAll('[data-testid="element-tag-option"]') ?? []
    );
  const option = (valueId: string) =>
    options().find(el => (el as HTMLElement).dataset.valueId === valueId) ??
    null;

  const model = (id: string) => service.surface.getElementById(id)!;

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await wait(0);
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  /** Group the ids exactly as the senior menu does, and return the group id. */
  const groupOf = (...ids: string[]) =>
    service.surface.addElement({
      type: 'group',
      children: Object.fromEntries(ids.map(id => [id, true])),
    });

  /** Select something and pick a nature from its toolbar, as a user would. */
  const pick = async (selectionId: string, valueId: string) => {
    await select(selectionId);
    expect(tagsButton()).not.toBeNull();
    expect(option(valueId)).not.toBeNull();
    clickElement(option(valueId)!);
    await settle();
  };

  const roundTrip = async () => {
    const transformer = () =>
      new Transformer({
        schema: new Schema().register(AffineSchemas),
        blobCRUD: window.collection.blobSync,
        docCRUD: {
          create: (docId: string) =>
            window.collection.createDoc(docId).getStore({ id: docId }),
          get: (docId: string) =>
            window.collection.getDoc(docId)?.getStore({ id: docId }) ?? null,
          delete: (docId: string) => window.collection.removeDoc(docId),
        },
        middlewares: [replaceIdMiddleware(window.collection.idGenerator)],
      });

    const snapshot = transformer().docToSnapshot(window.doc);
    expect(snapshot).toBeTruthy();
    const reloaded = (await transformer().snapshotToDoc(snapshot!)) as Store;
    return reloaded.getModelsByFlavour(
      'affine:surface'
    )[0] as SurfaceBlockModel;
  };

  const mount = async (flags?: BlockFlags) => {
    forgetStoredViewport();
    tracked = [];
    const cleanup = await setupEditor(
      'edgeless',
      [
        TelemetryExtension({
          track: (name, props) =>
            tracked.push({
              name,
              props: props as unknown as Record<string, unknown>,
            }),
        }),
      ],
      flags ? { flags } : undefined
    );
    unmount = cleanup;
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
  };

  beforeEach(async () => {
    await mount();
    return () => {
      unmount?.();
      unmount = null;
    };
  });
  afterEach(() => forgetStoredViewport());

  describe('reachability', () => {
    test('the dropdown offers the four natures on a selected component', async () => {
      const component = addComponent();
      await select(component);

      expect(tagsButton()).not.toBeNull();
      expect(options().map(el => (el as HTMLElement).dataset.valueId)).toEqual([
        'wardley:nature/activity',
        DATA,
        PRACTICE,
        'wardley:nature/knowledge',
      ]);
    });

    test('each of the four is pictured, in a real assembly', async () => {
      // The PO asked for the four choices to be imaged (recette of 02/09/2026),
      // and this is the only test that exercises the whole seam at once: the
      // pack names an icon KEY (it is data, and may ship as JSON), the
      // framework registers the drawings with `IconTableExtension`, and the
      // dropdown resolves one against the other through DI. A unit test can pin
      // either half; only a mounted editor pins that they meet.
      const component = addComponent();
      await select(component);

      const drawn = options().map(el =>
        el.querySelector('[data-testid="element-tag-option-icon"] svg')
      );
      expect(drawn.filter(Boolean)).toHaveLength(4);
    });

    test('ONE click on a composite component reaches it', async () => {
      // What the senior menu actually builds: an ellipse and a free text,
      // grouped. A single click selects the GROUP, which carries no role — and
      // both members DO carry one, so "the roled member" would be ambiguous.
      // Only the node is something a nature is a fact about.
      const group = groupOf(addComponent(), addLabel());
      await select(group);

      expect(tagsButton()).not.toBeNull();
      expect(options()).toHaveLength(4);
    });

    test('an anchor has no nature, and no dropdown', async () => {
      // A user / need has a demand, not a nature — which is why `wardley:anchor`
      // is deliberately not a specialisation of `wardley:component`.
      await select(addAnchor());

      expect(tagsEntry()).toBeNull();
    });

    test('a plain shape is neutral, and stays neutral', async () => {
      const shape = service.surface.addElement({
        type: 'shape',
        shapeType: 'rect',
        xywh: '[600,100,100,100]',
      });
      await select(shape);

      // Absent `role` means neutral, full stop — never "infer one from the
      // shape type". A rectangle is a rectangle.
      expect(tagsEntry()).toBeNull();
    });

    test('a multi-selection has no honest current value', async () => {
      await select(addComponent(), addComponent('[200,200,60,60]'));

      expect(tagsEntry()).toBeNull();
    });
  });

  describe('the document is what remembers', () => {
    test('an unqualified component writes no key at all', async () => {
      const component = addComponent();
      await select(component);

      // The whole no-migration argument: an element that is never qualified is
      // byte-identical to one created before the field existed.
      expect(model(component).yMap.has('tags')).toBe(false);
      expect(model(component).serialize()).not.toHaveProperty('tags');
    });

    test('picking a nature writes it, and the trigger names it', async () => {
      const component = addComponent();
      await pick(component, DATA);

      expect(readElementTags(model(component))).toEqual({ [NATURE]: [DATA] });
      // Readable without opening anything.
      expect(tagsButton()?.textContent).toContain('Data');
    });

    test('picking through a group writes on the NODE, not on the group', async () => {
      const node = addComponent();
      const group = groupOf(node, addLabel());
      await pick(group, PRACTICE);

      expect(readElementTags(model(node))).toEqual({ [NATURE]: [PRACTICE] });
      // The group is scaffolding; the qualification belongs to the artefact.
      expect(model(group).yMap.has('tags')).toBe(false);
    });

    test('a single-valued tag replaces rather than accumulates', async () => {
      const component = addComponent();
      await pick(component, DATA);
      await pick(component, PRACTICE);

      // A component is ONE of the four. Where practitioners disagree, the
      // disagreement is the finding — it must not hide inside the element.
      expect(readElementTags(model(component))).toEqual({
        [NATURE]: [PRACTICE],
      });
    });

    test('picking the same nature again clears it, key and all', async () => {
      const component = addComponent();
      await pick(component, DATA);
      await pick(component, DATA);

      expect(readElementTags(model(component))).toEqual({});
      // Back to costing nothing — no empty map syncing to every peer forever.
      expect(model(component).yMap.has('tags')).toBe(false);
    });

    test('one pick is one undo, and it moves no geometry', async () => {
      const component = addComponent();
      await select(component);
      window.doc.captureSync();
      service.surface.updateElement(component, { xywh: '[500,500,60,60]' });
      await settle();

      await pick(component, DATA);
      window.doc.undo();
      await settle();

      expect(readElementTags(model(component))).toEqual({});
      // `captureSync()` runs BEFORE the write, so the qualification is its own
      // undo step and the drag that preceded it is untouched.
      expect(model(component).xywh).toBe('[500,500,60,60]');
    });
  });

  describe('it survives the round trips', () => {
    test('duplicate carries the qualification, with a map of its own', async () => {
      const component = addComponent();
      await pick(component, DATA);

      const { id: _id, ...props } = model(component).serialize();
      const copy = service.surface.addElement(props as never);
      await settle();

      // Declared on the BASE class, and rebuilt by `_propsToY`: without either,
      // the copy would look right in this session and be empty after a reload.
      expect(readElementTags(model(copy))).toEqual({ [NATURE]: [DATA] });
      expect(model(copy).tags).not.toBe(model(component).tags);
    });

    test('export and reload keep it', async () => {
      const component = addComponent();
      await pick(component, DATA);

      const surface = await roundTrip();
      const reloaded = surface.elementModels.find(
        el => el.role === 'wardley:component'
      )!;

      // The snapshot transformer round-trips any `Y.Map`-valued prop
      // generically — it is not special-cased for mindmap.
      expect(readElementTags(reloaded)).toEqual({ [NATURE]: [DATA] });
    });
  });

  describe('gating', () => {
    test('the flag gates the TOOLING, never the stored qualification', async () => {
      const component = addComponent();
      await pick(component, DATA);
      const serialized = model(component).serialize();

      unmount?.();
      await mount({ wardley: false } as BlockFlags);

      const reborn = service.surface.addElement(serialized as never);
      await settle();
      await select(reborn);

      // No pack seeded, so no dropdown — qualifying is tooling…
      expect(tagsEntry()).toBeNull();
      // …and the element still loads, still paints, and keeps every id it was
      // written with, unread, until the flag comes back.
      expect(readElementTags(model(reborn))).toEqual({ [NATURE]: [DATA] });
    });
  });

  describe('telemetry', () => {
    test('one pick is one FrameworkElementPromoted on the tag rung', async () => {
      const component = addComponent();
      await pick(component, DATA);

      const promotions = tracked.filter(
        e => e.name === 'FrameworkElementPromoted'
      );
      expect(promotions).toHaveLength(1);
      expect(promotions[0].props).toMatchObject({
        framework: 'wardley',
        rung: 'tag',
        direction: 'promote',
        role: 'wardley:component',
        elementCount: 1,
      });
      // Ids only: the chosen VALUE is board content and never crosses.
      expect(JSON.stringify(promotions[0].props)).not.toContain(DATA);
    });

    test('clearing is a demotion', async () => {
      const component = addComponent();
      await pick(component, DATA);
      await pick(component, DATA);

      const promotions = tracked.filter(
        e => e.name === 'FrameworkElementPromoted'
      );
      expect(promotions).toHaveLength(2);
      expect(promotions[1].props).toMatchObject({ direction: 'demote' });
    });
  });
});
