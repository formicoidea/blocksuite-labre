import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  getCommandIcon,
  getCommandsForSurface,
  runCommand,
} from '@labre/affine/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The registration side of the command registry, on a real editor: what the
 * senior sub-menu draws is what `CommandExtension` registered, and clicking a
 * button is `runCommand` — no artefact list anywhere in the Lit component.
 * See `docs/adr/0008`.
 */
describe('command registry on the canvas', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    return cleanup;
  });

  const menuCommands = (owner: 'wardley' | 'bpmn' | 'ddd-context-map') =>
    getCommandsForSurface(edgeless.std, owner, 'senior-menu');

  test('the wardley toolbox is registered whole — the 13 that used to be menu-only included', () => {
    const ids = menuCommands('wardley').map(c => c.id);
    expect(ids).toHaveLength(13);
    // The six that existed ONLY as buttons before PF3, invisible to the
    // shortcut manifest and therefore to Settings › Shortcuts.
    expect(ids).toContain('wardley.addMarket');
    expect(ids).toContain('wardley.addEcosystem');
    expect(ids).toContain('wardley.addAnchor');
    expect(ids).toContain('wardley.addOpportunityBackground');
  });

  test('the sub-menu component enumerates the registry, not a list of its own', () => {
    // The Lit shell is `EdgelessCommandMenu`, whose render() maps
    // `this.commands` one button per command. Reading the getter off a live
    // instance is what proves the wiring: a hard-coded button list would not
    // move when the registry does.
    const Ctor = customElements.get('edgeless-wardley-menu')!;
    const menu = new Ctor() as HTMLElement & {
      edgeless: unknown;
      commands: { id: string; iconKey?: string; labelFallback?: string }[];
    };
    menu.edgeless = edgeless;

    expect(menu.commands.map(c => c.id)).toEqual(
      menuCommands('wardley').map(c => c.id)
    );
    // Every command's `iconKey` resolves through the lib-side icon registry —
    // the accessor that keeps templates out of both manifests.
    for (const command of menu.commands) {
      expect(
        getCommandIcon(edgeless.std, command.iconKey),
        command.id
      ).toBeTruthy();
      expect(command.labelFallback, command.id).toBeTruthy();
    }
  });

  test('invoking a command through the registry creates the artefact', async () => {
    const command = menuCommands('bpmn').find(c => c.id === 'bpmn.addPool')!;
    runCommand(edgeless.std, command, {
      surface: 'senior-menu',
      source: 'toolbar:general',
    });
    await wait();

    expect(
      edgeless.surface.model.getElementsByType('bpmnPool').length
    ).toBe(1);
  });

  test('a keyless command is still invocable — the point of the registry', async () => {
    const command = menuCommands('ddd-context-map').find(
      c => c.id === 'ddd-context-map.addBoundedContext'
    )!;
    expect(command.defaultKeys).toEqual({ mac: [], other: [] });

    runCommand(edgeless.std, command, {
      surface: 'palette',
      source: 'toolbar:general',
    });
    await wait();

    expect(
      edgeless.surface.model.elementModels.some(m => m.type === 'shape')
    ).toBe(true);
  });
});
