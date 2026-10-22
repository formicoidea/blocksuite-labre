import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FrameBlockModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';
import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  type AnyCommandDescriptor,
  armArtefact,
  type CommandFile,
  type CommandInvocation,
  createFramePreview,
  createPanelReorderDrag,
  fitToModel,
  frameCommands,
  formatPropertyValue,
  frameList,
  getCommandIcon,
  getCommandsForSurface,
  getRegisteredCommands,
  getViewActions,
  getViewExports,
  isPropertyValueEmpty,
  type PanelDragPoint,
  type PanelReorderDrag,
  panelReorderGap,
  type PropertiesPanelRequest,
  type PropertiesPanelService,
  type ReorderFramesParams,
  reorderFramesParams,
  runCommand,
  runCommandAsync,
  runViewAction,
  selectionPaneCommands,
  selectionPaneTree,
  type SelectionPaneNode,
  selectModels,
  type ViewAction,
  type ViewActionResult,
  type TitleBandProperty,
  type TitleBandService,
  type TitleBandSheetState,
  type ThreadMark,
  ThreadMarksExtension,
  type ThreadMarksService,
  type ThreadOpenRequest,
  type ThreadTextRange,
  threadExcerpt,
} from '../host-panels.js';
import { ROOT } from './translations/source-files.js';

/**
 * `@labre/affine/host-panels` keeps its 0.46 shape (ADR 0034 §4).
 *
 * The façade is what a host's own panel calls — its slide list, its
 * catalogue, its selection pane. A host typechecks those calls against it on
 * every upgrade, so a minor may only WIDEN it: a new optional parameter, a new
 * export; never a renamed function, a new required parameter, or a return
 * that gains `null` (docs/lessons.md 33 — `renderBoardSvg` once gained a
 * `| null` in a minor and a host's `.svg` stopped compiling). `hostCalls`
 * below is the 0.46 calls, verbatim, typechecked by `yarn build` (tests
 * included) and never run; a change that breaks one fails the build here
 * before it fails a host.
 *
 * The other two tests hold what the ADR promises about the module's nature: no
 * class and no stateful object (every export but two data constants is a plain
 * function), and no Lit type named, so a host that renders its panel without
 * Lit can type its calls.
 */

/** The 0.46 calls, verbatim. Compiles or the build fails; never invoked. */
const hostCalls = (
  std: BlockStdScope,
  gfx: GfxController,
  artefact: AnyCommandDescriptor
) => {
  const invocation: CommandInvocation = {
    surface: 'catalogue',
    source: 'toolbar:general',
  };
  const params: ReorderFramesParams = { ids: ['frame-a'], before: null };
  const reorder = frameCommands.find(c => c.id === 'canvas.frame.reorder');
  if (reorder) runCommand(std, reorder, invocation, params);

  const frames: FrameBlockModel[] = frameList(std);
  const preview: HTMLElement = createFramePreview(std, frames[0]);
  const sized: HTMLElement = createFramePreview(std, frames[0], {
    width: 280,
    height: 166,
    fillScreen: false,
  });
  preview.append(sized);
  selectModels(
    std,
    frames.map(frame => frame.id)
  );
  const fitted: boolean = fitToModel(std, 'frame-a');
  const padded: boolean = fitToModel(std, 'frame-a', [24, 24, 24, 24]);

  const registered: AnyCommandDescriptor[] = getRegisteredCommands(std);
  const listed: AnyCommandDescriptor[] = getCommandsForSurface(
    std,
    'wardley',
    'catalogue'
  );
  const icon = getCommandIcon(std, artefact.iconKey);
  armArtefact(gfx, 'wardley', artefact);

  const rows: SelectionPaneNode[] = selectionPaneTree(std).value;
  const parsed = reorderFramesParams.safeParse(params);

  return { fitted, padded, registered, listed, icon, rows, parsed };
};

/**
 * The 0.47 view actions (ADR 0034, amendment of 2026-10-13): what a host's
 * header menu reads and runs. Same contract from here on — compiles or the
 * build fails; never invoked.
 */
const viewMenuCalls = async (std: BlockStdScope) => {
  const actions: ViewAction[] = getViewActions(std);
  const canvas: ViewAction[] = getViewActions(std, 'edgeless');
  const [first] = actions;
  const label: string = first?.label ?? '';
  const section: string = first?.section ?? '';
  const checked: boolean | undefined = first?.checked;
  const disabled: boolean | undefined = first?.disabled;
  const result: ViewActionResult = await runViewAction(
    std,
    'canvas.export.png'
  );
  const file: CommandFile | undefined = result.file;
  const blob: Blob | undefined = file?.blob;
  const name: string | undefined = file?.filename;
  const reorder = frameCommands.find(c => c.id === 'canvas.frame.reorder');
  if (reorder) {
    await runCommandAsync(std, reorder, {
      surface: 'view-menu',
      source: 'context-menu',
    });
  }
  return { canvas, label, section, checked, disabled, blob, name };
};

/**
 * The 0.50 exports of a view (ADR 0034, amendment of 2026-10-14): what a
 * host's one "Export…" menu reads. Same rule: compiles or the build fails.
 */
const viewExportCalls = (std: BlockStdScope) => {
  const exports: ViewAction[] = getViewExports(std);
  const page: ViewAction[] = getViewExports(std, 'page');
  const params: Record<string, string | number> | undefined =
    exports[0]?.labelParams;
  return { exports, page, params };
};

/**
 * The 0.57 slide list (recette 1, P0-1.2 to P0-1.4): a fluid preview, the
 * panels' drag-to-reorder controller, and the frame rename a host runs from
 * page mode too. Same rule: compiles or the build fails; never invoked.
 */
const slideListCalls = (
  std: BlockStdScope,
  frame: FrameBlockModel,
  list: HTMLElement,
  rows: () => HTMLElement[]
) => {
  const fluid: HTMLElement = createFramePreview(std, frame, { fluid: true });
  const drag: PanelReorderDrag = createPanelReorderDrag<string | null>({
    readonly: () => std.store.readonly,
    rows,
    bounds: () => list,
    onPickUp: (_press: PanelDragPoint) => {},
    dropAt: gap => rows()[gap]?.dataset.frameId ?? null,
    onMove: () => {},
    onDrop: before => {
      const reorder = frameCommands.find(c => c.id === 'canvas.frame.reorder');
      if (reorder) {
        runCommand(
          std,
          reorder,
          { surface: 'contextual-toolbar', source: 'toolbar:general' },
          { ids: [frame.id], before }
        );
      }
    },
    onEnd: () => {},
    mask: { host: () => document.body, className: 'mask' },
  });
  const gap: number = panelReorderGap([], 0);
  const rename = selectionPaneCommands.find(
    c => c.id === 'canvas.frame.rename'
  );
  if (rename) {
    runCommand(
      std,
      rename,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
      { id: frame.id, title: 'Intro' }
    );
  }
  const swallowed: boolean = drag.consumeSwallowedClick();
  drag.dispose();
  return { fluid, gap, swallowed };
};

/**
 * The 0.47 calls of a host's properties panel (ADR 0035 §9b, §11), verbatim:
 * the sheet it hands the title band, the panel it opens on request, and the
 * chip text it reuses. Same rule as above: compiles or the build fails.
 */
const propertiesPanelCalls = (
  sheet: TitleBandSheetState,
  service: TitleBandService
) => {
  const panel: PropertiesPanelService = {
    open: (request: PropertiesPanelRequest) => {
      if (request.scope === 'page') return request.docId;
      return [request.docId, request.blockId, request.sourceId, request.viewId];
    },
    close: () => {},
  };
  const property: TitleBandProperty = {
    id: 'status',
    namespace: 'workspace',
    name: 'Status',
    type: 'select',
    data: { options: [{ id: 'a', value: 'Doing', color: 'var(--x)' }] },
    value: 'a',
    readonly: false,
  };
  const text: string = formatPropertyValue(property);
  const localized: string = formatPropertyValue(property, 'fr-FR');
  const empty: boolean = isPropertyValueEmpty(property);
  const written: Promise<void> = service.set('doc', property.id, null);
  const ready = sheet.status === 'ready' ? sheet.properties : [];
  return { panel, text, localized, empty, written, ready };
};

/**
 * The thread-marks seam's host side (ADR 0038, 0.52): what the Labre app
 * registers and what it receives. Same rule: a minor only widens it.
 */
const threadMarksCalls = (
  marks$: ReadonlySignal<readonly ThreadMark[]>,
  std: BlockStdScope
) => {
  const service: ThreadMarksService = {
    marks$,
    openThread: (request: ThreadOpenRequest) => {
      void [
        request.docId,
        request.targetType,
        request.targetId,
        request.excerpt,
        request.range?.start,
      ];
    },
  };
  const registered: ExtensionType = ThreadMarksExtension(service);
  const none: ExtensionType = ThreadMarksExtension(null);
  const mark: ThreadMark = {
    targetType: 'element',
    targetId: 'e1',
    count: 2,
    unread: true,
  };
  const excerpt: string = threadExcerpt(std, {
    targetType: 'block',
    targetId: 'b1',
  });
  // The text-range amendment widens the seam: an opaque range, optional on
  // both sides.
  const range: ThreadTextRange = { start: 's', end: 'e' };
  const ranged: ThreadMark = { ...mark, targetType: 'block', range };
  const quote: string = threadExcerpt(std, {
    targetType: 'block',
    targetId: 'b1',
    range,
  });
  return { registered, none, mark, excerpt, ranged, quote };
};

describe('@labre/affine/host-panels keeps its 0.46 shape', () => {
  test('the 0.46 calls typecheck, and no return gains null', () => {
    expectTypeOf(hostCalls).toBeFunction();
    expectTypeOf(viewMenuCalls).toBeFunction();
    expectTypeOf(viewExportCalls).toBeFunction();
    expectTypeOf(slideListCalls).toBeFunction();
    expectTypeOf(getViewExports).returns.toEqualTypeOf<ViewAction[]>();
    expectTypeOf(getViewActions).returns.toEqualTypeOf<ViewAction[]>();
    expectTypeOf(runViewAction).returns.toEqualTypeOf<
      Promise<ViewActionResult>
    >();
    expectTypeOf(propertiesPanelCalls).toBeFunction();
    expectTypeOf(threadMarksCalls).toBeFunction();
    expectTypeOf(threadExcerpt).returns.toEqualTypeOf<string>();
    expectTypeOf(formatPropertyValue).returns.toEqualTypeOf<string>();
    expectTypeOf(isPropertyValueEmpty).returns.toEqualTypeOf<boolean>();
    expectTypeOf(fitToModel).returns.toEqualTypeOf<boolean>();
    expectTypeOf(frameList).returns.toEqualTypeOf<FrameBlockModel[]>();
    expectTypeOf(selectModels).returns.toEqualTypeOf<void>();
    expectTypeOf(createFramePreview).returns.toMatchTypeOf<HTMLElement>();
    expectTypeOf(getRegisteredCommands).returns.toEqualTypeOf<
      AnyCommandDescriptor[]
    >();
    expectTypeOf(getCommandsForSurface).returns.toEqualTypeOf<
      AnyCommandDescriptor[]
    >();
    expectTypeOf(runCommand).returns.toEqualTypeOf<void>();
  });

  test('the façade exports functions, and two data constants', async () => {
    const facade: Record<string, unknown> = await import('../host-panels.js');
    // The zod schema and the frame and pane descriptors are data a host
    // passes back to `runCommand` (the pane's carry `canvas.frame.rename`);
    // anything else that is not a function is state, which the façade does
    // not hold (ADR 0034 §4).
    const data = Object.keys(facade)
      .filter(name => typeof facade[name] !== 'function')
      .sort();
    expect(data).toEqual([
      'frameCommands',
      'reorderFramesParams',
      'selectionPaneCommands',
    ]);

    const classes = Object.keys(facade).filter(
      name =>
        typeof facade[name] === 'function' &&
        /^class\b/.test(Function.prototype.toString.call(facade[name]))
    );
    expect(classes).toEqual([]);
  });

  test('names no Lit type', () => {
    const source = readFileSync(
      join(ROOT, 'packages/affine/all/src/host-panels.ts'),
      'utf8'
    );
    expect(source).not.toMatch(/from\s+['"]lit(\/[^'"]*)?['"]/);
    expect(source).not.toMatch(/\bTemplateResult\b/);
  });
});
