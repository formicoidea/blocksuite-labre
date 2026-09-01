import { bpmnCommands } from '@labre/affine-gfx-bpmn';
import { bpmnCommandsManifest } from '@labre/affine-gfx-bpmn/commands-manifest';
import { c4Commands } from '@labre/affine-gfx-c4';
import { c4CommandsManifest } from '@labre/affine-gfx-c4/commands-manifest';
import { cynefinEstuarineCommands } from '@labre/affine-gfx-cynefin-estuarine';
import { cynefinEstuarineCommandsManifest } from '@labre/affine-gfx-cynefin-estuarine/commands-manifest';
import { contextMapCommands } from '@labre/affine-gfx-ddd-context-map';
import { contextMapCommandsManifest } from '@labre/affine-gfx-ddd-context-map/commands-manifest';
import { coreDomainCommands } from '@labre/affine-gfx-ddd-core-domain';
import { coreDomainCommandsManifest } from '@labre/affine-gfx-ddd-core-domain/commands-manifest';
import { eventStormingCommands } from '@labre/affine-gfx-ddd-event-storming';
import { eventStormingCommandsManifest } from '@labre/affine-gfx-ddd-event-storming/commands-manifest';
import { edgyCommands } from '@labre/affine-gfx-edgy';
import { edgyCommandsManifest } from '@labre/affine-gfx-edgy/commands-manifest';
import { wardleyCommands } from '@labre/affine-gfx-wardley';
import { wardleyCommandsManifest } from '@labre/affine-gfx-wardley/commands-manifest';
import {
  type AnyCommandDescriptor,
  FRAMEWORK_IDS,
  type FrameworkId,
  type ShortcutManifestEntry,
  toShortcutManifestEntry,
} from '@labre/std';
import { transformSync } from 'esbuild';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'vitest';

import { getShortcutManifest } from '../../shortcuts.js';

/**
 * The `./commands-manifest` contract (issue #181).
 *
 * Each framework bundle publishes its commands TWICE: once whole, on the main
 * entry, and once as the six data fields a Settings › Shortcuts pane needs. The
 * second copy exists so a host can list names and chords without importing the
 * first — a `CommandDescriptor` holds its `run`, so the main entry drags the
 * framework's whole action graph (import/export machinery, surface and gfx deep
 * paths) into the chunk of a pane that draws static rows.
 *
 * A second copy is a copy, so it is pinned in both directions:
 *
 * - EQUALITY — row for row, `toShortcutManifestEntry` over the real commands
 *   must equal the shipped manifest. Add or rename a command and this says
 *   exactly what to write.
 * - DATA-ONLY — the module's source may carry type-only imports and nothing
 *   else. Reaching for `./commands.js` would keep the equality green while
 *   silently restoring the megabytes the subpath exists to avoid.
 *   `scripts/build-bundles.mjs` asserts the same thing at release time; this is
 *   the copy that fails in CI, before a bundle is ever built.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/commands → the gfx packages are here.
const GFX = join(HERE, '..', '..', '..', '..', 'gfx');

interface Case {
  id: FrameworkId;
  dir: string;
  commands: AnyCommandDescriptor[];
  manifest: ShortcutManifestEntry[];
}

const CASES: Case[] = [
  {
    id: 'wardley',
    dir: 'wardley',
    commands: wardleyCommands,
    manifest: wardleyCommandsManifest,
  },
  {
    id: 'edgy',
    dir: 'edgy',
    commands: edgyCommands,
    manifest: edgyCommandsManifest,
  },
  {
    id: 'cynefin-estuarine',
    dir: 'cynefin-estuarine',
    commands: cynefinEstuarineCommands,
    manifest: cynefinEstuarineCommandsManifest,
  },
  {
    id: 'bpmn',
    dir: 'bpmn',
    commands: bpmnCommands,
    manifest: bpmnCommandsManifest,
  },
  { id: 'c4', dir: 'c4', commands: c4Commands, manifest: c4CommandsManifest },
  {
    id: 'ddd-event-storming',
    dir: 'ddd-event-storming',
    commands: eventStormingCommands,
    manifest: eventStormingCommandsManifest,
  },
  {
    id: 'ddd-core-domain',
    dir: 'ddd-core-domain',
    commands: coreDomainCommands,
    manifest: coreDomainCommandsManifest,
  },
  {
    id: 'ddd-context-map',
    dir: 'ddd-context-map',
    commands: contextMapCommands,
    manifest: contextMapCommandsManifest,
  },
];

test('every framework that owns commands publishes a manifest', () => {
  expect(CASES.map(c => c.id).sort()).toEqual([...FRAMEWORK_IDS].sort());
});

describe.each(CASES)(
  '$id ./commands-manifest',
  ({ dir, commands, manifest }) => {
    test('is the projection of the real commands, row for row', () => {
      expect(manifest).toEqual(commands.map(toShortcutManifestEntry));
    });

    test('carries no `run`, no `params`, no handler', () => {
      for (const entry of manifest) {
        expect(Object.keys(entry).sort()).toEqual(
          expect.arrayContaining([
            'defaultKeys',
            'id',
            'labelKey',
            'owner',
            'scope',
          ])
        );
        expect(entry).not.toHaveProperty('run');
        expect(entry).not.toHaveProperty('params');
        expect(entry).not.toHaveProperty('handler');
      }
    });

    test('its source module imports nothing at runtime', () => {
      // Asked of the TYPE-STRIPPED code: after the strip a type-only import is
      // gone, so anything left is a runtime one — and `import { … } from
      // './commands.js'` spread over several lines, the mistake actually worth
      // catching, is invisible to a line-wise regex on the source text.
      const { code } = transformSync(
        readFileSync(join(GFX, dir, 'src', 'commands-manifest.ts'), 'utf8'),
        { loader: 'ts', format: 'esm' }
      );
      expect(
        code.match(/(?:from|import)\s*\(?\s*['"][^'"]+['"]/g),
        'runtime imports in a data-only module'
      ).toBe(null);
    });
  }
);

/**
 * The other half of the seam: what core still ships. A framework's rows are
 * stripped out of `@formicoidea/labre-core` at bundle time, so the host builds
 * the full panel by concatenating core's manifest with the bundles it enables —
 * and the two halves must be the same shape, carrying the same fields.
 */
test('core rows and framework rows are one shape, labelFallback included', () => {
  const core = getShortcutManifest(
    Object.fromEntries(FRAMEWORK_IDS.map(id => [id, false]))
  );
  expect(core.length).toBeGreaterThan(0);
  expect(core.every(entry => entry.owner === 'core')).toBe(true);
  // The regression #181 names: `toEntry` used to drop `labelFallback`, so a
  // host with no catalogue rendered raw i18n keys for these rows.
  expect(
    core.filter(entry => entry.labelFallback !== undefined).length
  ).toBeGreaterThan(0);
  expect(
    getShortcutManifest().filter(entry => entry.owner === 'wardley')
  ).toEqual(wardleyCommandsManifest);
});
