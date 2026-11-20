import { ViewExtensionManager } from '@labre/affine-ext-loader';
import {
  type SeniorTool,
  SeniorToolIdentifier,
} from '@labre/affine-widget-edgeless-toolbar';
import { Container } from '@labre/global/di';
import type { BlockComponent } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';
import { getTranslationKeyManifest } from '../../translations.js';

/**
 * GUARD — every senior tool of the edgeless toolbar can name its button
 * (#679).
 *
 * The toolbar names the button of a senior tool with the label the tool
 * declares: `labelKey`, resolved through the host's catalogue, with `name` as
 * its English fallback — for a framework, its display name. Read from the real
 * registry with every flag on, so a framework or a core tool registered
 * tomorrow is in it without an edit here.
 *
 * What it would catch:
 * - a senior tool with no key: its button would be named in English whatever
 *   the host's language, and a new framework could ship that way;
 * - a `name` that is not its key's declared fallback: without a catalogue the
 *   button would be named one way and its tooltip another;
 * - two senior tools with the same name: two buttons nobody can tell apart;
 * - a framework whose senior tool is not named after its descriptor.
 *
 * The quick tools choose their wording as they render (Select or Hand), so the
 * rendered row — every button named, no two alike — is held by the
 * integration spec `edgeless/edgeless-toolbar-a11y.spec.ts`.
 */

/** A block whose host has no catalogue: every wording falls back. */
const block = {
  std: { getOptional: () => null },
  store: { readonly: false },
} as unknown as BlockComponent;

function seniorTools(): Map<string, SeniorTool> {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(extension => extension.setup(container));
  const builders = container.provider().getAll(SeniorToolIdentifier);
  return new Map(
    Array.from(builders, ([id, build]) => [
      id,
      build({
        block,
        gfx: {} as GfxController,
        toolbarContainer: document.createElement('div'),
      }),
    ])
  );
}

const tools = seniorTools();
const fallbacks = new Map(
  getTranslationKeyManifest().map(({ key, fallback }) => [key, fallback])
);

describe('the senior tools name their buttons', () => {
  test('the registry has the senior row the toolbar draws', () => {
    expect(tools.size).toBeGreaterThan(FRAMEWORK_DESCRIPTORS.length);
  });

  test.each(Array.from(tools))(
    '%s declares a translatable label whose fallback is its name',
    (_id, tool) => {
      expect(tool.name.trim()).not.toBe('');
      expect(tool.labelKey, 'a key the host can translate').toBeTruthy();
      expect(fallbacks.get(tool.labelKey!)).toBe(tool.name);
    }
  );

  test('no two senior tools share a name', () => {
    const names = Array.from(tools.values(), tool => tool.name);
    expect(new Set(names).size).toBe(names.length);
  });

  test.each(FRAMEWORK_DESCRIPTORS)(
    '$id names its senior button after its descriptor',
    ({ id, labelKey, labelFallback }) => {
      const tool = tools.get(id);
      expect(tool, `${id} registers a senior tool`).toBeDefined();
      expect(tool!.labelKey).toBe(labelKey);
      expect(tool!.name).toBe(labelFallback);
    }
  );
});
