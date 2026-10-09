import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { FrameBlockModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import { describe, expect, expectTypeOf, test } from 'vitest';

import {
  type AnyCommandDescriptor,
  armArtefact,
  type CommandInvocation,
  createFramePreview,
  fitToModel,
  frameCommands,
  frameList,
  getCommandIcon,
  getCommandsForSurface,
  getRegisteredCommands,
  type ReorderFramesParams,
  reorderFramesParams,
  runCommand,
  selectionPaneTree,
  type SelectionPaneNode,
  selectModels,
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

describe('@labre/affine/host-panels keeps its 0.46 shape', () => {
  test('the 0.46 calls typecheck, and no return gains null', () => {
    expectTypeOf(hostCalls).toBeFunction();
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
    // The zod schema and the frame descriptors are data a host passes back
    // to `runCommand`; anything else that is not a function is state, which
    // the façade does not hold (ADR 0034 §4).
    const data = Object.keys(facade)
      .filter(name => typeof facade[name] !== 'function')
      .sort();
    expect(data).toEqual(['frameCommands', 'reorderFramesParams']);

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
