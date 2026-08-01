import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  exceptionsAnchoredOn,
  grantException,
  hasException,
  ValidationManager,
  VIOLATION_DETAIL_WIDGET,
  VIOLATION_EMPHASIS_MS,
} from '@labre/affine/blocks/surface';
import { createGroupCommand, ungroupCommand } from '@labre/affine/gfx/group';
import type { GroupElementModel } from '@labre/affine/model';
import {
  DocModeExtension,
  type DocModeProvider,
} from '@labre/affine/shared/services';
import type { GfxPrimitiveElementModel } from '@labre/affine/std/gfx';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Revoking an exception from the element's contextual toolbar, and the grey
 * badge that used to do the job going away (PF8, PO acceptance of 01/08).
 *
 * Two halves, tested where each one lives:
 *
 * - **which element answers for an exception** — the anchor rule the canvas
 *   mark already follows, applied to real groups, real ungrouping and a real
 *   framework background. That is `ValidationManager.revocableExceptionsOn`,
 *   and it is what the toolbar entry's `when` asks;
 * - **the canvas going quiet** — an excused finding no longer draws anything.
 *
 * The entry's own wiring (label, telemetry, single-selection gate) is unit
 * tested in `packages/affine/blocks/surface/.../validation-toolbar.unit.spec.ts`
 * against a stubbed context: turning a `ToolbarModuleConfig` into a button is
 * BlockSuite's toolbar machinery, which no spec in this repo drives.
 */

const RULE_ID = 'wardley.component-outside-map';

/**
 * Tell the editor it is in edgeless mode, so the element toolbar renders at
 * all — `DocModeService.getEditorMode()` otherwise answers `null`, which
 * `ToolbarContext` reads as `page` and takes its early return on. Same reason
 * and same shape as `wardley-validation-profiles.spec.ts`.
 */
const edgelessMode = DocModeExtension({
  getEditorMode: () => 'edgeless',
  setEditorMode: () => {},
  getPrimaryMode: () => 'edgeless',
  setPrimaryMode: () => {},
  togglePrimaryMode: () => 'edgeless',
  onPrimaryModeChange: () =>
    ({ unsubscribe: () => {} }) as ReturnType<
      DocModeProvider['onPrimaryModeChange']
    >,
});

/** Native-shaped click: composed, so it crosses a shadow boundary. */
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

describe('revoking an exception from the element that answers for it', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let root!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;
  let unmount: (() => void) | null = null;

  /**
   * A map on the STRICT profile (PF9): the default `sketch` demotes the pilot
   * rule to `audit`, which is reported but deliberately invisible on the
   * canvas — and an affordance that is never drawn cannot be tested for going
   * away.
   */
  const addBackground = () =>
    service.surface.addElement({
      type: 'wardley',
      role: 'wardley:map',
      xywh: '[0,0,1600,900]',
      validationProfile: 'wardley.strict',
    });

  const addComponent = (xywh: string) =>
    service.surface.addElement({
      type: 'wardleyNode',
      kind: 'component',
      role: 'wardley:component',
      xywh,
    });

  const addLabel = (xywh: string, text: string) =>
    service.surface.addElement({ type: 'text', xywh, text: new Text(text) });

  const groupOf = (ids: string[]) => {
    const [, result] = service.std.command.exec(createGroupCommand, {
      elements: ids,
    });
    return result.groupId as string;
  };

  const model = (id: string) =>
    service.surface.getElementById(id)! as GfxPrimitiveElementModel;

  const widget = () => root.widgetComponents[VIOLATION_DETAIL_WIDGET];
  const queryAll = (selector: string) =>
    Array.from(widget()?.shadowRoot?.querySelectorAll(selector) ?? []);
  const badges = () => queryAll('[data-testid="violation-badge"]');
  const bracketHits = () => queryAll('[data-testid="violation-bracket-hit"]');
  const bubble = () =>
    widget()?.shadowRoot?.querySelector('[data-testid="violation-bubble"]') ??
    null;

  const settle = async () => {
    await wait(250);
    await root.updateComplete;
    await widget()?.updateComplete;
    await wait(0);
  };

  /** Age every live mark past its window, so the badge is due. */
  const age = async () => {
    validation.timeline.clear();
    validation.timeline.sync(
      validation.violations$.value.filter(
        violation =>
          violation.severity !== 'audit' && violation.exemption === undefined
      ),
      performance.now() - VIOLATION_EMPHASIS_MS - 1
    );
    widget()?.requestUpdate();
    await settle();
  };

  const violationOf = (elementId: string) =>
    validation.violations$.value.find(violation =>
      violation.elementIds.includes(elementId)
    );

  /** What the toolbar entry's `when` asks, on the real manager. */
  const revocableOn = (id: string) =>
    validation.revocableExceptionsOn(model(id));

  /**
   * The element toolbar the selection raises. Its actions render into the
   * `editor-toolbar` element's LIGHT DOM.
   */
  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;
  const toolbarQuery = (selector: string) =>
    toolbar()?.querySelector(selector) ?? null;

  /**
   * The revoke entry, by the testid the toolbar derives from an action id —
   * `renderActionItem` keeps the last dot-separated segment.
   */
  const revokeEntry = () =>
    toolbarQuery('[data-testid="validation-revoke-exception"]');
  /** PF9's Validation dropdown, registered by the framework on its own slot. */
  const validationEntry = () =>
    toolbarQuery('[data-testid="validation-toolbar-entry"]');

  const select = async (id: string) => {
    service.gfx.selection.set({ elements: [id], editing: false });
    await settle();
  };

  const mount = async (flags?: Record<string, boolean>) => {
    const cleanup = await setupEditor(
      'edgeless',
      [edgelessMode],
      flags ? { flags } : undefined
    );
    unmount = cleanup;
    root = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = root.service;
    service.std.event.active = true;
    validation = service.std.get(ValidationManager);
  };

  beforeEach(async () => {
    await mount();
    return () => {
      unmount?.();
      unmount = null;
    };
  });

  afterEach(() => {
    localStorage.removeItem('blocksuite:doc:home:edgelessViewport');
    sessionStorage.removeItem('blocksuite:doc:home:edgelessViewport');
  });

  describe('which element carries the entry', () => {
    test('a lone element answers for its own exception', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(id), RULE_ID);
      validation.evaluate();

      const anchored = revocableOn(id);
      expect(anchored).toHaveLength(1);
      expect(anchored[0].ruleId).toBe(RULE_ID);
      expect(anchored[0].element.id).toBe(id);
    });

    test('the enclosing group answers for its member, not the member', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = addLabel('[3050,3000,120,24]', 'Payments');
      const groupId = groupOf([nodeId, labelId]);
      await settle();
      grantException(model(nodeId), RULE_ID);
      validation.evaluate();

      // The whole Wardley component — what the senior menu built, and what the
      // user thinks of as "the thing" — carries the entry.
      const onGroup = revocableOn(groupId);
      expect(onGroup).toHaveLength(1);
      expect(onGroup[0].element.id).toBe(nodeId);
      // Drilling into the group and selecting the bare node offers nothing:
      // exactly one element answers for an exception.
      expect(revocableOn(nodeId)).toEqual([]);
    });

    test('dissolving the group hands the entry back to the element', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      const labelId = addLabel('[3050,3000,120,24]', 'Payments');
      const groupId = groupOf([nodeId, labelId]);
      await settle();
      grantException(model(nodeId), RULE_ID);
      validation.evaluate();
      expect(revocableOn(nodeId)).toEqual([]);

      service.std.command.exec(ungroupCommand, {
        group: service.surface.getElementById(groupId) as GroupElementModel,
      });
      await settle();

      // Resolved on demand, exactly like the canvas mark: nothing to invalidate.
      expect(revocableOn(nodeId)).toHaveLength(1);
    });

    test('the background answers for the map-wide arbitration on it', async () => {
      const mapId = addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(mapId), RULE_ID);
      validation.evaluate();
      expect(violationOf(nodeId)?.exemption).toBe('map');

      const anchored = revocableOn(mapId);
      expect(anchored).toHaveLength(1);
      expect(anchored[0].element.id).toBe(mapId);
      // The node it excuses carries nothing of its own, so it offers nothing.
      expect(revocableOn(nodeId)).toEqual([]);
    });

    test('an element carrying no exception offers nothing', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();

      expect(violationOf(id)).toBeTruthy();
      // In violation, but nobody has arbitrated: there is nothing to take back.
      expect(revocableOn(id)).toEqual([]);
    });
  });

  describe('what revoking does', () => {
    test('restores the violation, live', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(id), RULE_ID);
      validation.evaluate();
      expect(violationOf(id)?.exemption).toBe('element');

      const revoked = validation.revokeExceptionsOn(model(id));

      expect(revoked).toEqual([
        {
          ruleId: RULE_ID,
          framework: 'wardley',
          scope: 'element',
          elementCount: 1,
        },
      ]);
      expect(violationOf(id)?.exemption).toBeUndefined();
      // The key is gone from the document, not blanked.
      expect(model(id).yMap.has('validationExceptions')).toBe(false);
    });

    test('settles every member of a group in one gesture', async () => {
      addBackground();
      const a = addComponent('[3000,3000,40,40]');
      const b = addComponent('[3100,3000,40,40]');
      const groupId = groupOf([a, b]);
      await settle();
      grantException(model(a), RULE_ID);
      grantException(model(b), RULE_ID);
      validation.evaluate();

      const revoked = validation.revokeExceptionsOn(model(groupId));

      expect(revoked).toEqual([
        {
          ruleId: RULE_ID,
          framework: 'wardley',
          scope: 'element',
          elementCount: 2,
        },
      ]);
      expect(hasException(model(a), RULE_ID)).toBe(false);
      expect(hasException(model(b), RULE_ID)).toBe(false);
    });

    test('reports the map scope when it is the background that carried it', async () => {
      const mapId = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(mapId), RULE_ID);
      validation.evaluate();

      expect(validation.revokeExceptionsOn(model(mapId))).toEqual([
        {
          ruleId: RULE_ID,
          framework: 'wardley',
          scope: 'map',
          elementCount: 1,
        },
      ]);
    });

    test('writes nothing when there is nothing to take back', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();

      expect(validation.revokeExceptionsOn(model(id))).toEqual([]);
    });
  });

  describe('the canvas goes quiet', () => {
    test('an excused finding draws no marker at all', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      await age();
      expect(badges()).toHaveLength(1);

      grantException(model(id), RULE_ID);
      validation.evaluate();
      await settle();

      // The finding is still REPORTED — zero hidden violations (PF8.3) — but
      // the board stops arguing with a decision the user made on purpose. The
      // grey badge that used to sit here is gone for good.
      expect(validation.violations$.value).toHaveLength(1);
      expect(violationOf(id)?.exemption).toBe('element');
      expect(badges()).toHaveLength(0);
      expect(bracketHits()).toHaveLength(0);
      expect(bubble()).toBeNull();
    });

    test('a live finding beside it keeps its amber badge', async () => {
      addBackground();
      const excused = addComponent('[3000,3000,40,40]');
      const other = addComponent('[4000,3000,40,40]');
      await settle();
      grantException(model(excused), RULE_ID);
      validation.evaluate();
      await settle();
      await age();

      const remaining = badges();
      expect(remaining).toHaveLength(1);
      expect((remaining[0] as HTMLElement).dataset.anchorId).toBe(other);
      // No grey state left anywhere: the attribute went with the badge.
      expect((remaining[0] as HTMLElement).dataset.exempted).toBeUndefined();
    });

    test('revoking brings the marker back', async () => {
      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(id), RULE_ID);
      validation.evaluate();
      await settle();
      expect(badges()).toHaveLength(0);

      validation.revokeExceptionsOn(model(id));
      await settle();
      await age();

      expect(badges()).toHaveLength(1);
    });
  });

  /**
   * The two validation entries come from two DIFFERENT toolbar slots — this one
   * from `custom:affine:surface:*` (the surface block, for any element), PF9's
   * Validation dropdown from `custom:affine:surface:wardley` (the framework's
   * flag-gated view extension, for its own background). `renderToolbar`
   * concatenates the actions of every matching slot, so a selected map must
   * offer both.
   */
  describe('sharing the map’s toolbar with the Validation dropdown', () => {
    test('a map carrying an exception offers Validation AND Revoke', async () => {
      const mapId = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(mapId), RULE_ID);
      validation.evaluate();

      await select(mapId);

      // Wildcard slot and framework slot, merged onto one element.
      expect(validationEntry()).not.toBeNull();
      expect(revokeEntry()).not.toBeNull();
      expect(revokeEntry()?.getAttribute('aria-label')).toBe(
        'Revoke exception'
      );
    });

    test('the map offers Validation alone until an exception exists', async () => {
      const mapId = addBackground();
      addComponent('[3000,3000,40,40]');
      await settle();

      await select(mapId);

      // The framework's own entry does not depend on an arbitration; mine does.
      expect(validationEntry()).not.toBeNull();
      expect(revokeEntry()).toBeNull();
    });

    test('revoking from the map’s toolbar clears the map-wide arbitration', async () => {
      const mapId = addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(mapId), RULE_ID);
      validation.evaluate();
      expect(violationOf(nodeId)?.exemption).toBe('map');

      await select(mapId);
      clickElement(revokeEntry()!);
      await settle();

      expect(hasException(model(mapId), RULE_ID)).toBe(false);
      expect(violationOf(nodeId)?.exemption).toBeUndefined();
      // Gone from the toolbar with the arbitration it took back; Validation
      // stays, because it never depended on one.
      expect(revokeEntry()).toBeNull();
      expect(validationEntry()).not.toBeNull();
    });

    test('a plain element offers Revoke and no Validation', async () => {
      addBackground();
      const nodeId = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(nodeId), RULE_ID);
      validation.evaluate();

      await select(nodeId);

      // The wildcard slot reaches every element; the framework's slot is its
      // background's alone.
      expect(revokeEntry()).not.toBeNull();
      expect(validationEntry()).toBeNull();
    });
  });

  describe('the framework flag', () => {
    test('offers nothing to revoke when the framework is off', async () => {
      unmount?.();
      await mount({ wardley: false });

      addBackground();
      const id = addComponent('[3000,3000,40,40]');
      await settle();
      grantException(model(id), RULE_ID);
      await settle();

      // The exception is still in the document — it is data, and a tooling flag
      // never touches data (PF8.6) — but with no rule registered there is
      // nothing to arbitrate on, so the entry has nothing to offer.
      expect(hasException(model(id), RULE_ID)).toBe(true);
      expect(exceptionsAnchoredOn(model(id), service.surface)).toHaveLength(1);
      expect(validation.ruleOf(RULE_ID)).toBeUndefined();
      expect(revocableOn(id)).toEqual([]);
      expect(validation.revokeExceptionsOn(model(id))).toEqual([]);
    });
  });
});
