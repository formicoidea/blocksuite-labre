import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  PivotRecordPickerExtension,
  READING_PROPOSAL_WIDGET,
  ReadingManager,
} from '@labre/affine/blocks/surface';
import type { ExtensionType } from '@labre/store';
import type { BlockFlags } from '@labre/affine/flags';
import {
  PivotPropertiesExtension,
  type PivotProperty,
  TranslationExtension,
} from '@labre/affine/shared/services';
import { readElementTags } from '@labre/affine/std/gfx';
import { EDGELESS_TOOLBAR_WIDGET } from '@labre/affine/widgets/edgeless-toolbar';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { computed } from '@preact/signals-core';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * MF3 end to end: the proposal panel a click opens, in a real editor.
 *
 * The unit suites own the five readings, the Wardley declaration and the drift
 * trigger. This one owns what only a real editor can answer: that the entry is
 * reachable from ONE click on a composite component, that the panel it opens
 * says what the map says, that Escape puts it away — and, the one that matters,
 * that all of it leaves the document byte-identical.
 */

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

/** See `wardley-validation-bubble.spec.ts`: the viewport persists per doc id. */
const VIEWPORT_STORAGE_KEY = 'blocksuite:doc:home:edgelessViewport';

function forgetStoredViewport() {
  localStorage.removeItem(VIEWPORT_STORAGE_KEY);
  sessionStorage.removeItem(VIEWPORT_STORAGE_KEY);
}

describe('the reversed reading of a Wardley component', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let unmount: (() => void) | null = null;

  const addMap = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
    });

  /** A component whose centre sits in the "Product" phase. */
  const addComponent = (xywh = '[871,441,18,18]') =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const addLabel = (xywh = '[900,441,120,26]') =>
    service.surface.addElement({
      type: 'text',
      text: 'Brewing tea',
      role: 'wardley:label',
      xywh,
    });

  const groupOf = (...ids: string[]) =>
    service.surface.addElement({
      type: 'group',
      children: Object.fromEntries(ids.map(id => [id, true])),
    });

  /** The element toolbar; its actions render into `editor-toolbar`'s LIGHT DOM. */
  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  /**
   * The reading entry, by the testid the toolbar derives from an action id —
   * `renderActionItem` keeps the last dot-separated segment of
   * `y1.element-reading`.
   */
  const readButton = () =>
    toolbar()?.querySelector('[data-testid="element-reading"]') ?? null;

  const widget = () => root.widgetComponents[READING_PROPOSAL_WIDGET];
  const query = (selector: string) =>
    widget()?.shadowRoot?.querySelector(selector) ?? null;
  const panel = () => query('[data-testid="reading-panel"]');
  const field = (testid: string) => query(`[data-testid="${testid}"]`);

  const manager = () => service.std.get(ReadingManager);

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  const select = async (...ids: string[]) => {
    service.gfx.selection.set({ elements: ids, editing: false });
    await settle();
  };

  const snapshot = () => Y.encodeStateAsUpdate(window.doc.spaceDoc);

  const mount = async (
    flags?: BlockFlags,
    extensions: ExtensionType[] = []
  ) => {
    forgetStoredViewport();
    const cleanup = await setupEditor(
      'edgeless',
      extensions,
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

  test('one click on a composite component offers the reading', async () => {
    addMap();
    const group = groupOf(addComponent(), addLabel());
    await select(group);

    // A single click selects the GROUP; the role lives on the node, and the
    // entry resolves through the group exactly as the qualification dropdown
    // does.
    expect(readButton()).not.toBeNull();
  });

  test('a plain shape is neutral, and offers nothing', async () => {
    const shape = service.surface.addElement({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[100,100,60,60]',
    });
    await select(shape);

    expect(readButton()).toBeNull();
  });

  test('the panel opens on the click and says what the map says', async () => {
    addMap();
    const component = addComponent();
    const label = addLabel();
    const group = groupOf(component, label);
    await select(group);

    clickElement(readButton()!);
    await settle();

    expect(panel()).not.toBeNull();
    expect(field('reading-node-type')?.textContent).toContain('component');
    // Read off the map's own zones, not off a number in the reading code.
    expect(field('reading-phase')?.textContent).toContain('Product');
    // Carried nothing, proposes nothing.
    expect(field('reading-nature-empty')).not.toBeNull();
  });

  test('opening and closing it a hundred times writes nothing', async () => {
    addMap();
    const component = addComponent();
    await select(component);
    const before = snapshot();

    for (let i = 0; i < 100; i++) {
      manager().open(component);
      manager().close();
    }
    await settle();

    // The whole arbitration, in one assertion: a reading is a read.
    expect(snapshot()).toEqual(before);
    expect(service.surface.getElementById(component)!.yMap.has('tags')).toBe(
      false
    );
  });

  test('with no host picker there is nothing to link with', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    manager().open(component);
    await settle();

    // The library cannot choose a document. With no picker registered the
    // affordance is HIDDEN rather than disabled — a button that opens nothing
    // is worse than no button.
    expect(field('reading-record')).not.toBeNull();
    expect(field('reading-link-record')).toBeNull();
  });

  test('the host’s picker is what turns the proposal into a binding', async () => {
    unmount?.();
    unmount = null;
    await mount(undefined, [
      PivotRecordPickerExtension({ pick: async () => 'pivot-payments' }),
    ]);

    addMap();
    const component = addComponent();
    await select(component);
    manager().open(component);
    await settle();

    const link = field('reading-link-record') as HTMLElement | null;
    expect(link).not.toBeNull();
    // Before the click, nothing is bound: rendering the proposal wrote nothing.
    expect(
      service.surface.getElementById(component)!.pivotDocId
    ).toBeUndefined();

    clickElement(link!);
    await settle();

    // …and the confirmation went through the existing `pivot.bind` rung.
    expect(service.surface.getElementById(component)!.pivotDocId).toBe(
      'pivot-payments'
    );
  });

  /**
   * A pivot record whose `nature` property is an ordinary host multi-select:
   * the options are the words a human typed, not the framework's value ids.
   */
  const recordSaying = (nature: string[]): ExtensionType =>
    PivotPropertiesExtension(
      {
        properties$: (docId: string) =>
          computed(() => ({
            status: 'ready' as const,
            snapshot: {
              docId,
              title: 'Payments',
              properties: [
                {
                  key: 'nature',
                  label: 'Nature',
                  value: { kind: 'tags' as const, value: nature },
                },
              ] as PivotProperty[],
            },
          })),
      },
      { hoverFields: ['nature', 'phase'] }
    );

  test('confirming the record’s nature writes the framework’s id', async () => {
    unmount?.();
    unmount = null;
    await mount(undefined, [recordSaying(['Activity'])]);

    addMap();
    const component = addComponent();
    service.surface.updateElement(component, { pivotDocId: 'pivot-payments' });
    await select(component);
    manager().open(component);
    await settle();

    const confirm = field('reading-confirm-nature') as HTMLElement | null;
    expect(confirm).not.toBeNull();
    // The button says the human word, because that is the label of the value…
    expect(confirm!.textContent).toContain('Activity');

    clickElement(confirm!);
    await settle();

    // …and what it WRITES is the value id the tag def describes. Writing
    // "Activity" would put a value nothing describes into the document: the
    // naming line would vanish, the qualification dropdown would show a raw id,
    // and every rule indexed on the nature would stop matching.
    expect(readElementTags(service.surface.getElementById(component)!)).toEqual(
      {
        'wardley:nature': ['wardley:nature/activity'],
      }
    );
  });

  test('a word the framework does not describe is named, not offered', async () => {
    unmount?.();
    unmount = null;
    await mount(undefined, [recordSaying(['Bogus'])]);

    addMap();
    const component = addComponent();
    service.surface.updateElement(component, { pivotDocId: 'pivot-payments' });
    await select(component);
    manager().open(component);
    await settle();

    // A sentence, and no button beside it: the honest thing to say about a word
    // this framework has no value for.
    expect(field('reading-nature-unknown')?.textContent).toContain('Bogus');
    expect(field('reading-confirm-nature')).toBeNull();
    // …and no drift either, ever: a difference of alphabet is not a difference
    // of opinion.
    service.surface.updateElement(component, { xywh: '[300,441,18,18]' });
    await wait(400);
    await settle();
    expect(field('reading-drift')).toBeNull();
  });

  test('a picker that throws SYNCHRONOUSLY reads as a cancel', async () => {
    unmount?.();
    unmount = null;
    await mount(undefined, [
      PivotRecordPickerExtension({
        pick: () => {
          throw new Error('the host picker exploded');
        },
      }),
    ]);

    addMap();
    const component = addComponent();
    await select(component);
    manager().open(component);
    await settle();

    clickElement(field('reading-link-record') as HTMLElement);
    await settle();

    // The contract says a picker MUST NOT throw; the only line of defence
    // behind that sentence has to cover the synchronous case too, or the throw
    // escapes a lit event handler as an unhandled error.
    expect(panel()).not.toBeNull();
    expect(
      service.surface.getElementById(component)!.pivotDocId
    ).toBeUndefined();
  });

  /** An activity named the English way, open in a host serving `language`. */
  const openNamedActivity = async (language: string) => {
    unmount?.();
    unmount = null;
    await mount(undefined, [
      TranslationExtension({ t: () => undefined, language }),
    ]);

    addMap();
    const component = addComponent();
    const label = addLabel();
    service.surface.updateElement(component, {
      tags: { 'wardley:nature': ['wardley:nature/activity'] },
    });
    groupOf(component, label);
    await select(component);
    manager().open(component);
    await settle();
  };

  test('the naming suggestion is silent on a board served in French', async () => {
    await openNamedActivity('fr');

    // The Wardley motif is the English gerund and says so (`lang: 'en'`). On a
    // board named in French it is out of scope, and an out-of-scope suggestion
    // is worse than none — it is confident.
    expect(field('reading-naming')).toBeNull();
  });

  test('…and speaks when the host serves English, `en-GB` included', async () => {
    await openNamedActivity('en-GB');

    // In scope — and the PRIMARY subtag is what counts: no framework has a
    // naming motif that holds in `en-GB` and not in `en-US`.
    const naming = field('reading-naming') as HTMLElement | null;
    expect(naming).not.toBeNull();
    expect(naming!.querySelector('[data-conforms="true"]')).not.toBeNull();
  });

  /**
   * The PO recette of 02/08/2026, point 1 and its second pass: the panel came
   * back rendering BEHIND the contextual toolbar, and then at a 480px measure
   * that lined up with nothing. It is now anchored to the EDITOR — above the
   * senior button bar, at the bar's own width, in a layer above every toolbar
   * (ADR 0011) — rather than floating beside the element it is about.
   */
  describe('where the panel sits', () => {
    /** `auto` is not a number, and a panel must beat it too. Treat it as 0. */
    const zOf = (element: Element) => {
      const value = getComputedStyle(element).zIndex;
      return value === 'auto' ? 0 : Number.parseInt(value, 10);
    };

    const openOnAComponent = async (xywh?: string) => {
      addMap();
      const component = addComponent(xywh);
      await select(component);
      manager().open(component);
      await settle();
      return component;
    };

    /** The senior button bar itself — the visible box, not the widget's slab. */
    const seniorBar = () =>
      (
        root.widgetComponents[EDGELESS_TOOLBAR_WIDGET] as unknown as
          | HTMLElement
          | undefined
      )?.shadowRoot?.querySelector<HTMLElement>(
        '.edgeless-toolbar-container'
      ) ?? null;

    /** Resize the editor and let the toolbar settle at its new tool count. */
    const resizeEditorTo = async (width: string) => {
      const app = window.editor.parentElement as HTMLElement;
      app.style.width = width;
      await settle();
      await settle();
    };

    test('it renders above the contextual toolbar and the bottom one', async () => {
      await openOnAComponent();
      expect(panel()).not.toBeNull();

      // The HOST is where the contest is decided: every widget host is a
      // sibling in `.widgets-container`, and `affine-toolbar-widget` declares
      // no stacking context of its own, so `editor-toolbar`'s z-index competes
      // at that level.
      const host = widget() as unknown as HTMLElement;
      const reading = zOf(host);

      const contextual = toolbar();
      expect(contextual).not.toBeNull();
      expect(reading).toBeGreaterThan(zOf(contextual!));

      const bottom = root.widgetComponents[
        EDGELESS_TOOLBAR_WIDGET
      ] as unknown as HTMLElement | undefined;
      expect(bottom).not.toBeUndefined();
      expect(reading).toBeGreaterThan(zOf(bottom!));
    });

    test('…and nothing between it and the widgets layer caps that', async () => {
      await openOnAComponent();

      // `.widgets-container` has `contain: layout`, so a host nested inside
      // another widget would be capped at THAT widget's z-index however large
      // its own. Being a direct child is the whole of the guarantee.
      const host = widget() as unknown as HTMLElement;
      expect(host.parentElement?.classList.contains('widgets-container')).toBe(
        true
      );
    });

    test('it takes the senior bar’s width, and sits just above it', async () => {
      await openOnAComponent();

      const box = panel()!.getBoundingClientRect();
      const editor = root.getBoundingClientRect();
      const bar = seniorBar()!.getBoundingClientRect();

      // Inside the viewport, on all four sides.
      expect(box.left).toBeGreaterThanOrEqual(editor.left);
      expect(box.right).toBeLessThanOrEqual(editor.right);
      expect(box.top).toBeGreaterThanOrEqual(editor.top);
      expect(box.bottom).toBeLessThanOrEqual(editor.bottom);

      // The PO's two red rules: the panel's edges ARE the bar's edges.
      expect(box.left).toBeCloseTo(bar.left, 0);
      expect(box.right).toBeCloseTo(bar.right, 0);
      expect(box.width).toBeCloseTo(bar.width, 0);

      // Above it, and clear of it: the buttons underneath stay usable.
      expect(box.bottom).toBeLessThanOrEqual(bar.top);
      expect(bar.top - box.bottom).toBeLessThan(24);
    });

    test('…at both window sizes, because the bar is measured and not guessed', async () => {
      await openOnAComponent();

      const measure = () => {
        const box = panel()!.getBoundingClientRect();
        const bar = seniorBar()!.getBoundingClientRect();
        return { box, bar };
      };

      // Wide: the toolbar sits at its 900px cap, so the bar is at its widest.
      await resizeEditorTo('1400px');
      const wide = measure();
      expect(wide.box.width).toBeCloseTo(wide.bar.width, 0);
      expect(wide.box.left).toBeCloseTo(wide.bar.left, 0);

      // Narrow enough that the bar is squeezed by `max-width: calc(100% -
      // 128px)` and changes width under the panel. A fixed 480px would survive
      // the first assertion and fail this one — which is the whole point.
      await resizeEditorTo('620px');
      const narrow = measure();
      expect(narrow.box.width).toBeCloseTo(narrow.bar.width, 0);
      expect(narrow.box.left).toBeCloseTo(narrow.bar.left, 0);
      expect(narrow.box.width).toBeLessThan(wide.box.width);
    });

    test('it does not follow the element it is about', async () => {
      const component = await openOnAComponent('[871,441,18,18]');
      const before = panel()!.getBoundingClientRect();

      // The old bubble hung off the element's top-right corner. This one is
      // anchored to the editor, so moving the subject right across the map
      // leaves the panel exactly where it was.
      service.surface.updateElement(component, { xywh: '[100,100,18,18]' });
      await settle();

      const after = panel()!.getBoundingClientRect();
      expect(after.left).toBeCloseTo(before.left, 0);
      expect(after.bottom).toBeCloseTo(before.bottom, 0);
    });

    test('its title is pinned outside the box that scrolls', async () => {
      await openOnAComponent();

      const header = query('[data-testid="anchored-panel-header"]');
      const body = query('[data-testid="anchored-panel-body"]');
      expect(header).not.toBeNull();
      expect(body).not.toBeNull();

      // The reading's own title goes in the header slot, and the fields — the
      // part that can outgrow the panel — in the scrolling one. A title
      // rendered as the body's first line is what used to scroll away.
      expect(header!.querySelector('.reading-title')).not.toBeNull();
      expect(body!.querySelector('.reading-title')).toBeNull();
      expect(
        body!.querySelector('[data-testid="reading-node-type"]')
      ).not.toBeNull();

      expect(getComputedStyle(body!).overflowY).toBe('auto');
      expect(getComputedStyle(header!).overflowY).not.toBe('auto');
    });

    test('it wears the senior bar’s own corner radius', async () => {
      await openOnAComponent();

      // The bar draws its corners with `smooth-corner`, which takes the radius
      // as a property rather than as CSS — so the reference is READ off the bar
      // instead of restated here, and a toolbar redesign moves both or fails
      // this test.
      const smooth = seniorBar()!.closest('smooth-corner') as
        | (HTMLElement & { borderRadius: number })
        | null;
      expect(smooth).not.toBeNull();

      // Same family of chrome, same corner — the reasoning that took
      // `edgeless-slide-menu` from 8 to 16 in #199, applied to the panel that
      // floats over the very same bar.
      expect(getComputedStyle(panel()!).borderTopLeftRadius).toBe(
        `${smooth!.borderRadius}px`
      );
      expect(getComputedStyle(panel()!).borderTopLeftRadius).toBe('16px');
    });
  });

  /**
   * The PO recette of 02/08/2026, point 2: the same typed edges as the
   * relations, said the way a value chain is read — from the bottom up.
   */
  describe('the value flow section', () => {
    const addDependency = (consumer: string, provider: string) =>
      service.surface.addElement({
        type: 'connector',
        role: 'wardley:dependency',
        source: { id: consumer },
        target: { id: provider },
      });

    /** A named component: the circle carries the role, the text the name. */
    const named = (name: string, xywh: string, labelXywh: string) => {
      const node = service.surface.addElement({
        type: 'wardleyNode',
        kind: 'component',
        role: 'wardley:component',
        xywh,
      });
      const label = service.surface.addElement({
        type: 'text',
        text: name,
        role: 'wardley:label',
        xywh: labelXywh,
      });
      groupOf(node, label);
      return node;
    };

    const lines = () =>
      Array.from(
        widget()?.shadowRoot?.querySelectorAll(
          '[data-testid="reading-value-flow-line"]'
        ) ?? []
      ).map(line => line.textContent?.replace(/\s+/g, ' ').trim() ?? '');

    test('the value runs UP, from the supplier to the consumer', async () => {
      addMap();
      const tea = named('Brewing tea', '[871,441,18,18]', '[900,441,120,26]');
      const kettle = named('Kettle', '[871,700,18,18]', '[900,700,120,26]');
      const cup = named('Cup of tea', '[871,150,18,18]', '[900,150,120,26]');
      // ADR 0010: `source` is the consumer, `target` is what it needs.
      addDependency(tea, kettle);
      addDependency(cup, tea);

      await select(tea);
      manager().open(tea);
      await settle();

      expect(field('reading-value-flow')).not.toBeNull();
      // One sentence per typed edge, both sides at once — and the direction is
      // the OPPOSITE of the dependency arrow, which is the entire point.
      expect(lines()).toEqual([
        'Value flows up from Kettle to Brewing tea',
        'Value flows up from Brewing tea to Cup of tea',
      ]);
    });

    test('with no typed link there is no section at all', async () => {
      addMap();
      const alone = named('Brewing tea', '[871,441,18,18]', '[900,441,120,26]');
      await select(alone);
      manager().open(alone);
      await settle();

      // An empty "Value flow" heading states nothing anyone wants; the
      // relations field already says in words that no link touches this
      // component.
      expect(field('reading-relations')).not.toBeNull();
      expect(field('reading-value-flow')).toBeNull();
    });

    test('the host’s catalogue owns the words', async () => {
      unmount?.();
      unmount = null;
      await mount(undefined, [
        TranslationExtension({
          t: key =>
            key === 'com.labre.reading.value-flow'
              ? 'La valeur remonte de'
              : key === 'com.labre.reading.value-flow.to'
                ? 'vers'
                : key === 'com.labre.reading.field.value-flow'
                  ? 'Flux de valeur'
                  : undefined,
        }),
      ]);

      addMap();
      const tea = named('Brewing tea', '[871,441,18,18]', '[900,441,120,26]');
      const kettle = named('Kettle', '[871,700,18,18]', '[900,700,120,26]');
      addDependency(tea, kettle);

      await select(tea);
      manager().open(tea);
      await settle();

      // Two slots, so a catalogue can put the halves where its own grammar
      // wants them; the English fallback is only what a silent host gets.
      expect(field('reading-value-flow')?.textContent).toContain(
        'Flux de valeur'
      );
      expect(lines()).toEqual(['La valeur remonte de Kettle vers Brewing tea']);
    });
  });

  test('Escape puts the panel away', async () => {
    addMap();
    const component = addComponent();
    await select(component);

    manager().open(component);
    await settle();
    expect(panel()).not.toBeNull();

    service.std.host.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })
    );
    await settle();

    expect(panel()).toBeNull();
  });

  test('the flag takes the reading away, and leaves the map drawn', async () => {
    unmount?.();
    unmount = null;
    await mount({ wardley: false } as BlockFlags);

    addMap();
    const component = addComponent();
    await select(component);

    // No profile is registered, so there is no entry and nothing to open —
    // while the map and the component are still on the board, still selectable
    // (ADR 0009).
    expect(readButton()).toBeNull();
    expect(manager().profiles).toHaveLength(0);
    expect(service.surface.getElementById(component)).not.toBeNull();
  });
});
