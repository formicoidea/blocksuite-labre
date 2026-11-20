import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESERVED_EDGELESS_KEYS } from '@labre/affine-block-root';
import {
  type AnyCommandDescriptor,
  canonicalCombo,
  type FrameworkId,
} from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The framework chord prefixes (`docs/adr/0055`), held by tests because the
 * keymap engine enforces none of it.
 *
 * A framework spells its prefix twice: as its own package constant, which
 * builds its chords through `frameworkChord`, and as
 * `FrameworkDescriptor.chordPrefix` in `frameworks.ts`, which the package
 * cannot import. Nothing at runtime compares the two, and nothing at runtime
 * notices a prefix that shadows a single-key tool: `resolveKeymap` only
 * reports two ids on the SAME combo, and `bindKeymap`'s "a single binding on
 * the prefix wins" sees its own keymap only, while the tool letters are bound
 * by a different one (`edgeless-keyboard.ts`, the toolbar buttons). A chord
 * on `t` would have changed what the Text tool's `t` does, silently; that is
 * the collision this file exists to refuse.
 *
 * It replaces the two chord tests of `registry.unit.spec.ts`, which assumed
 * every prefix was unique: the two DDD boards share `d` by product decision.
 */
const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/shortcuts → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

/**
 * The prefixes MEANT to be shared, and by whom. The only entry is the product
 * owner's "DDD: `d`", over the two DDD boards that ship chords; a third
 * framework landing on `d`, or any other accidental share, fails below.
 */
const SHARED_PREFIXES: Record<string, readonly FrameworkId[]> = {
  d: ['ddd-context-map', 'ddd-core-domain'],
};

/**
 * Bare letters a toolbar button binds on the edgeless root for itself, through
 * its own `bindHotKey` — outside `edgeless-keyboard.ts`, so outside
 * `RESERVED_EDGELESS_KEYS` and its mirror test. Mirrored against the sources
 * by the last test of this file.
 */
const TOOLBAR_BARE_KEYS = [
  { key: 'm', file: 'packages/affine/gfx/mindmap/src/toolbar/mindmap-menu.ts' },
  {
    key: 'm',
    file: 'packages/affine/gfx/mindmap/src/toolbar/mindmap-tool-button.ts',
  },
  {
    key: 's',
    file: 'packages/affine/gfx/shape/src/draggable/shape-draggable.ts',
  },
] as const;

/**
 * Every raw `keydown` listener in the canvas packages — a listener the keymap
 * engine never sees, so neither `RESERVED_EDGELESS_KEYS` nor a command's
 * defaults can tell a prefix it is taken. Each entry names the letters it acts
 * on alone, and whether it acts on them ONLY while a canvas element is in edit
 * mode: a prefix never arms then (`canRunFromKeyboard` in
 * `command-registry.ts`), so such a letter may also be a prefix.
 *
 * The last test walks the sources: a NEW file with a raw `keydown` listener
 * fails until it is listed here, which is when somebody has to read which
 * letters it takes.
 */
const RAW_KEYDOWN_LISTENERS: readonly {
  file: string;
  letters: readonly string[];
  whileEditing?: true;
  why: string;
}[] = [
  {
    file: 'packages/affine/blocks/root/src/edgeless/edgeless-keyboard.ts',
    letters: [],
    why: 'Space through the dispatcher, the event type read in _space',
  },
  {
    file: 'packages/affine/gfx/bpmn/src/element-view.ts',
    letters: [],
    why: 'Enter / Escape on its own name input',
  },
  {
    file: 'packages/affine/gfx/c4/src/element-view.ts',
    letters: [],
    why: 'Enter / Escape on its own name input',
  },
  {
    file: 'packages/affine/gfx/shape/src/element-view.ts',
    letters: ['b'],
    whileEditing: true,
    why: 'polygon vertex edit (selection editing): b toggles Bézier smoothing',
  },
  {
    file: 'packages/affine/gfx/shape/src/polygon-tool.ts',
    letters: [],
    why: 'Escape / Enter while a polygon is being drawn',
  },
  {
    file: 'packages/affine/gfx/shape/src/text/edgeless-shape-text-editor.ts',
    letters: [],
    why: 'on its own contenteditable',
  },
  {
    file: 'packages/affine/gfx/template/src/toolbar/template-panel.ts',
    letters: [],
    why: 'stops propagation out of its own panel',
  },
  {
    file: 'packages/affine/widgets/edgeless-selected-rect/src/edgeless-element-link.ts',
    letters: [],
    why: 'on its own input',
  },
  {
    file: 'packages/affine/widgets/edgeless-toolbar/src/catalogue/artefact-catalogue-widget.ts',
    letters: [],
    why: 'Escape while the catalogue is open',
  },
  {
    file: 'packages/affine/widgets/edgeless-toolbar/src/draggable/draggable-element.controller.ts',
    letters: [],
    why: 'Escape while dragging from the toolbar',
  },
  {
    file: 'packages/affine/widgets/edgeless-toolbar/src/selection-pane/selection-pane-widget.ts',
    letters: [],
    why: 'Escape while the pane is open; its rename input',
  },
  {
    file: 'packages/affine/widgets/slash-menu/src/slash-menu-popover.ts',
    letters: [],
    why: 'a popover over a text being typed',
  },
];

/** The folders whose raw `keydown` listeners can meet a canvas chord. */
const CANVAS_SOURCE_DIRS = [
  'packages/affine/gfx',
  'packages/affine/widgets',
  'packages/affine/blocks/root/src/edgeless',
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '__tests__'].includes(entry.name)) continue;
      yield* sourceFiles(path);
    } else if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
      yield path;
    }
  }
}

const commands = getCommands();

/** Every single keystroke bound on the canvas, canonical (`shift-p`, `ctrl-z`). */
function singleKeys(): Set<string | null> {
  return new Set<string | null>([
    ...RESERVED_EDGELESS_KEYS.map(k => canonicalCombo([k])),
    ...TOOLBAR_BARE_KEYS.map(({ key }) => canonicalCombo([key])),
    ...RAW_KEYDOWN_LISTENERS.filter(l => !l.whileEditing).flatMap(l =>
      l.letters.map(letter => canonicalCombo([letter]))
    ),
    ...commands.flatMap(c =>
      [c.defaultKeys.mac, c.defaultKeys.other]
        .filter(keys => keys.length === 1)
        .map(keys => canonicalCombo(keys))
    ),
  ]);
}
const isFrameworkOwned = (c: AnyCommandDescriptor) => c.owner !== 'core';
const hasKeys = (c: AnyCommandDescriptor) =>
  c.defaultKeys.mac.length > 0 || c.defaultKeys.other.length > 0;
const chords = commands.filter(c => isFrameworkOwned(c) && hasKeys(c));
const prefixOf = (id: FrameworkId) =>
  FRAMEWORK_DESCRIPTORS.find(d => d.id === id)?.chordPrefix;

describe('framework chord prefixes', () => {
  /**
   * The allocation itself, so a moved letter is a reviewed diff. Event
   * Storming is on `o` because the requested `t` is the Text tool (product
   * owner's choice); `c4` has none because nobody asked for one.
   */
  test('the allocated prefixes are the decided ones', () => {
    expect(
      Object.fromEntries(FRAMEWORK_DESCRIPTORS.map(d => [d.id, d.chordPrefix]))
    ).toEqual({
      wardley: 'w',
      edgy: 'g',
      'cynefin-estuarine': 'y',
      bpmn: 'b',
      'ddd-event-storming': 'o',
      c4: undefined,
      'ddd-core-domain': 'd',
      'ddd-context-map': 'd',
      uml: 'u',
    });
  });

  test('a framework chord is its declared prefix then one key, on both platforms', () => {
    for (const command of chords) {
      const prefix = prefixOf(command.owner as FrameworkId);
      expect(prefix, `${command.owner} has chords but no prefix`).toBeTruthy();
      expect(command.defaultKeys.mac, command.id).toEqual(
        command.defaultKeys.other
      );
      expect(command.defaultKeys.other.length, command.id).toBe(2);
      expect(command.defaultKeys.other[0], command.id).toBe(prefix);
    }
  });

  test('a declared prefix has a chord behind it', () => {
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      expect(
        chords.some(c => c.owner === id),
        `${id} allocates "${chordPrefix}" for nothing`
      ).toBe(true);
    }
  });

  test('a prefix is shared only where the sharing is declared', () => {
    const owners = new Map<string, FrameworkId[]>();
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      owners.set(chordPrefix, [...(owners.get(chordPrefix) ?? []), id]);
    }
    for (const [prefix, ids] of owners) {
      if (ids.length === 1) continue;
      expect(
        [...ids].sort(),
        `"${prefix}" is shared by ${ids.join(', ')}`
      ).toEqual([...(SHARED_PREFIXES[prefix] ?? [])].sort());
    }
    // …and a declared share still holds: no stale entry in the table above.
    for (const [prefix, ids] of Object.entries(SHARED_PREFIXES)) {
      expect(owners.get(prefix)?.sort(), prefix).toEqual([...ids].sort());
    }
  });

  test('second keys are unique within a prefix, across every framework sharing it', () => {
    const seen = new Map<string, string>();
    for (const command of chords) {
      const combo = command.defaultKeys.other.join(' ');
      expect(seen.get(combo), `${command.id} reuses "${combo}"`).toBe(
        undefined
      );
      seen.set(combo, command.id);
    }
  });

  test('a second key is one lowercase letter or digit', () => {
    // Accepts `c` or `7`; rejects `C` (a Shift stroke the chord matcher reads
    // as `Shift-C`), `Mod-c` and `Escape`.
    const SECOND_KEY = /^[a-z0-9]$/;
    for (const command of chords) {
      expect(command.defaultKeys.other[1], command.id).toMatch(SECOND_KEY);
    }
  });

  /**
   * THE registry of single keys taken on the canvas, as one list a reviewer
   * reads: the edgeless keyboard's tools, the toolbar buttons' own hotkeys, a
   * raw listener's letters outside an edit mode, and every command's one-key
   * default (`l`, the Templates panel, ADR 0055). A new bare letter shows up
   * here as a reviewed diff, and no prefix can take one of them.
   */
  test('the bare letters taken on the canvas are the decided ones', () => {
    const letters = [...singleKeys()]
      .filter((k): k is string => k !== null && /^[a-z0-9]$/.test(k))
      .sort();
    expect(letters).toEqual(
      ['c', 'e', 'f', 'h', 'k', 'l', 'm', 'n', 'p', 's', 't', 'v'].sort()
    );
  });

  test('no prefix is a single-key shortcut', () => {
    const singles = singleKeys();
    for (const { id, chordPrefix } of FRAMEWORK_DESCRIPTORS) {
      if (chordPrefix === undefined) continue;
      expect(
        singles.has(canonicalCombo([chordPrefix])),
        `${id}'s prefix "${chordPrefix}" is already a single-key shortcut`
      ).toBe(false);
    }
  });

  test('no chord collides with any other registered shortcut', () => {
    const boundBy = new Map<string, string[]>();
    for (const c of commands) {
      for (const keys of new Set([
        c.defaultKeys.mac.join(' '),
        c.defaultKeys.other.join(' '),
      ])) {
        if (!keys) continue;
        const combo = `${c.scope}:${canonicalCombo(keys.split(' '))}`;
        boundBy.set(combo, [...(boundBy.get(combo) ?? []), c.id]);
      }
    }
    for (const command of chords) {
      const combo = `${command.scope}:${canonicalCombo(command.defaultKeys.other)}`;
      expect(boundBy.get(combo), combo).toEqual([command.id]);
    }
  });

  test('the toolbar bare keys are really bound where this file says', () => {
    for (const { key, file } of TOOLBAR_BARE_KEYS) {
      // Accepts the binding line `          m: () => {`; rejects `  m: 1,`
      // outside an arrow and `mode: () =>`.
      const binding = new RegExp(`^\\s+${key}: (\\(\\)|ctx) =>`, 'm');
      expect(readFileSync(join(ROOT, file), 'utf8'), file).toMatch(binding);
    }
  });

  test('every raw keydown listener of the canvas packages is listed', () => {
    const found = CANVAS_SOURCE_DIRS.flatMap(dir => [
      ...sourceFiles(join(ROOT, dir)),
    ])
      // Accepts `addEventListener('keydown', …)` and `@keydown=${…}`;
      // rejects the word in prose, such as "a keydown event".
      .filter(path => /'keydown'|@keydown=/.test(readFileSync(path, 'utf8')))
      .map(path => relative(ROOT, path).split('\\').join('/'))
      .sort();
    expect(found).toEqual(RAW_KEYDOWN_LISTENERS.map(l => l.file).sort());
  });

  /**
   * A keyboard binding runs only where its descriptor says it can
   * (`canRunFromKeyboard`): a framework command that PLACES or ARMS a drawing
   * writes, so it declares `'editable'` and a read-only document neither runs
   * it nor arms its prefix. `'always'` let `w c` throw "Cannot add element in
   * readonly mode" from the keyboard.
   */
  test('every framework artefact or tool declares it writes', () => {
    for (const command of commands) {
      if (!isFrameworkOwned(command)) continue;
      if (command.kind !== 'artefact' && command.kind !== 'tool') continue;
      expect(command.availability, command.id).toBe('editable');
    }
  });
});
