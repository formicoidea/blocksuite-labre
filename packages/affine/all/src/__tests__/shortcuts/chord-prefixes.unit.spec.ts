import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

import { RESERVED_EDGELESS_KEYS } from '@labre/affine-block-root';
import {
  type AnyCommandDescriptor,
  canonicalCombo,
  type FrameworkId,
} from '@labre/std';
import * as ts from 'typescript';
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

/** Every `src` of the library: where a canvas key can be taken. */
const SOURCE_ROOTS = ['packages/affine', 'packages/framework'];

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

/** Library sources, repo-relative with forward slashes, tests excluded. */
const SOURCES = SOURCE_ROOTS.flatMap(dir => [...sourceFiles(join(ROOT, dir))])
  .map(path => relative(ROOT, path).split('\\').join('/'))
  .filter(path => path.includes('/src/'))
  .map(path => ({ path, text: readFileSync(join(ROOT, path), 'utf8') }));

/**
 * The `bindHotKey` calls whose keymap cannot be read: the one override that
 * forwards its argument. A NEW call passing a variable, a spread or a computed
 * key that is not a string fails until it is read and listed.
 */
const BIND_HOT_KEY_FORWARDERS = [
  'packages/affine/blocks/root/src/edgeless/edgeless-root-block.ts',
];

/** A property name read as the key it binds, or `undefined` when unreadable. */
function keyOf(name: ts.PropertyName): string | undefined {
  if (
    ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNoSubstitutionTemplateLiteral(name) ||
    ts.isNumericLiteral(name)
  ) {
    return name.text;
  }
  if (
    ts.isComputedPropertyName(name) &&
    (ts.isStringLiteral(name.expression) ||
      ts.isNoSubstitutionTemplateLiteral(name.expression))
  ) {
    return name.expression.text;
  }
  return undefined;
}

/**
 * Every `bindHotKey(…)` call of the library, read with the TypeScript parser
 * (the compiler `yarn build` runs): the file, the keys of its object literal
 * and whether all of them could be read. That is where the edgeless keyboard's
 * tools AND the toolbar buttons' own hotkeys (`m` the mind map, `s` the shape)
 * are bound, outside the shortcut manifest; a button that binds a new bare
 * letter shows up here however it is spelled (`y:`, `'y':`, `['y']:`, several
 * keys on one line), and a definition (`bindHotKey(keymap) { … }`) is not a call.
 */
function bindHotKeySites(): { file: string; keys: string[]; read: boolean }[] {
  const sites: { file: string; keys: string[]; read: boolean }[] = [];
  for (const { path, text } of SOURCES) {
    if (!text.includes('bindHotKey')) continue;
    const source = ts.createSourceFile(
      path,
      text,
      ts.ScriptTarget.Latest,
      true
    );
    const visit = (node: ts.Node) => {
      if (ts.isCallExpression(node)) {
        const callee = node.expression;
        const name = ts.isPropertyAccessExpression(callee)
          ? callee.name.text
          : ts.isIdentifier(callee)
            ? callee.text
            : undefined;
        if (name === 'bindHotKey') {
          const [keymap] = node.arguments;
          const keys: string[] = [];
          let read =
            keymap !== undefined && ts.isObjectLiteralExpression(keymap);
          if (keymap && ts.isObjectLiteralExpression(keymap)) {
            for (const property of keymap.properties) {
              const key = ts.isSpreadAssignment(property)
                ? undefined
                : keyOf(property.name);
              if (key === undefined) read = false;
              else keys.push(key);
            }
          }
          sites.push({ file: path, keys, read });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return sites;
}

/**
 * A key a `bindHotKey` takes alone: one character, optionally Shift-ed. A
 * modifier combo or a named key (`Escape`, `ArrowUp`) cannot be a prefix.
 */
const isBareKey = (key: string) => /^(Shift-)?.$/.test(key);

/**
 * Every raw `keydown` listener of the library — one the keymap engine never
 * sees, so neither a `bindHotKey` nor a command's defaults can tell a prefix
 * it is taken. Each entry names the bare letters it acts on (none needs a
 * modifier to be listed: a modified letter cannot be a prefix), whether it acts
 * on them ONLY while a canvas element is in edit mode (a prefix never arms
 * then, `canRunFromKeyboard`), and why it cannot meet a chord.
 *
 * A test walks every `src` of `packages/affine` and `packages/framework`: a
 * NEW file with a raw `keydown` listener fails until it is listed here, which
 * is when somebody has to read which letters it takes.
 */
const RAW_KEYDOWN_LISTENERS: readonly {
  file: string;
  letters: readonly string[];
  whileEditing?: true;
  why: string;
}[] = [
  {
    file: 'packages/affine/all/src/canvas-viewer.ts',
    letters: [],
    why: "the read-only viewer's own named keys; no letter",
  },
  {
    file: 'packages/affine/blocks/attachment/src/components/rename-model.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/blocks/attachment/src/html-view.ts',
    letters: [],
    why: 'on its own element (input, popup); no bare letter',
  },
  {
    file: 'packages/affine/blocks/embed/src/embed-iframe-block/components/embed-iframe-link-edit-popup.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/blocks/embed/src/embed-iframe-block/components/embed-iframe-link-input-popup.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/blocks/image/src/crop/crop-overlay.ts',
    letters: [],
    why: 'Escape / Enter, capture on document while an image is being cropped',
  },
  {
    file: 'packages/affine/blocks/note/src/note-edgeless-block.ts',
    letters: [],
    why: 'named keys on the note it belongs to; no letter',
  },
  {
    file: 'packages/affine/blocks/root/src/edgeless/edgeless-keyboard.ts',
    letters: [],
    why: 'Space through the dispatcher, the event type read in _space',
  },
  {
    file: 'packages/affine/blocks/surface/src/extensions/editor-anchored-panel.ts',
    letters: [],
    why: 'Escape on its own panel',
  },
  {
    file: 'packages/affine/blocks/surface/src/extensions/violation-detail-widget.ts',
    letters: [],
    why: 'on its own element (input, popup); no bare letter',
  },
  {
    file: 'packages/affine/blocks/surface/src/framework-background/background-view.ts',
    letters: [],
    why: "Enter / Escape on a board's title input",
  },
  {
    file: 'packages/affine/blocks/table/src/table-cell.ts',
    letters: [],
    why: 'Mod+A in a cell being edited (modifier required)',
  },
  {
    file: 'packages/affine/components/src/caption/block-caption.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/color-picker/color-panel.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/color-picker/color-picker.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/color-picker/palette-carousel.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/context-menu/input.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/context-menu/menu-renderer.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/date-picker/date-picker.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/embed-card-modal/embed-card-create-modal.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/embed-card-modal/embed-card-edit-modal.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/filterable-list/index.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/icon-picker/open-icon-picker.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/resource/status.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/size-dropdown-menu/dropdown-menu.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/slider/slider.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/components/src/toolbar/menu-button.ts',
    letters: [],
    why: 'a shared component on its own element (input, menu, picker); no bare letter',
  },
  {
    file: 'packages/affine/database/block/src/components/title/index.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/block/src/detail-panel/block-renderer.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/block/src/properties/link/cell-renderer.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/block/src/properties/rich-text/cell-renderer.ts',
    letters: [],
    why: 'Mod+B/I/U/S/E/A in a cell being edited (modifier required)',
  },
  {
    file: 'packages/affine/database/block/src/properties/title/text.ts',
    letters: [],
    why: 'Mod+A in a title being edited (modifier required)',
  },
  {
    file: 'packages/affine/database/engine/src/core/component/tags/multi-tag-select.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/core/property/standalone-cell.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/core/utils/drag.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/core/utils/wc-dnd/sensors/mouse.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/property-presets/number/cell-renderer.ts',
    letters: [],
    why: 'Mod+Z in a cell being edited (modifier required)',
  },
  {
    file: 'packages/affine/database/engine/src/property-presets/progress/cell-renderer.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/property-presets/text/cell-renderer.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/view-presets/table/mobile/group.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/view-presets/table/pc/group.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/presets/filter/filter.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/presets/search/search.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/presets/sort/sort.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/presets/table-add-row/add-row.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/presets/view-options/view-options.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/no-view/no-view.ts',
    letters: [],
    why: 'Enter / Space on its own "+" button, which has the focus (activateOnEnterOrSpace)',
  },
  {
    file: 'packages/affine/database/engine/src/widget-presets/tools/tools-view.ts',
    letters: [],
    why: 'inside a database view, cell or menu that has the focus; no bare letter',
  },
  {
    file: 'packages/affine/fragments/doc-title/src/doc-title.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/fragments/doc-title/src/title-band/title-band.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/fragments/frame-panel/src/card/frame-card-title.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
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
    why: 'keeps its own keystrokes; Escape closes it',
  },
  {
    file: 'packages/affine/inlines/latex/src/latex-node/latex-editor-menu.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/inlines/link/src/link-node/affine-link.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/inlines/link/src/link-node/link-popup/link-popup.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/inlines/reference/src/reference-node/reference-popup/reference-popup.ts',
    letters: [],
    why: 'a text or its popup, on its own element; no bare letter',
  },
  {
    file: 'packages/affine/rich-text/src/rich-text.ts',
    letters: [],
    why: 'Mod+Z in a text being edited (modifier required)',
  },
  {
    file: 'packages/affine/shared/src/utils/event.ts',
    letters: [],
    why: 'Ctrl+P / N / V helpers for popups over a text (modifier required)',
  },
  {
    file: 'packages/affine/shared/src/utils/panel-reorder-drag.ts',
    letters: [],
    why: 'on its own element (input, popup); no bare letter',
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
    file: 'packages/affine/widgets/edgeless-toolbar/src/edgeless-toolbar.ts',
    letters: [],
    why: 'ADR 0054: a capture on document only forgets the last keyboard press (takes no key, prevents nothing); _onMenuKeydown takes Escape, Tab, the arrows, Home / End, Enter / Space, never with a modifier, and only with the focus in a menu the row opened; a row button returns early, so letters reach the canvas',
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
    why: 'Ctrl+P / N in a popover over a text being typed (modifier required)',
  },
  {
    file: 'packages/framework/std/src/event/control/keyboard.ts',
    letters: [],
    why: 'the dispatcher itself: every binding goes through the keymaps',
  },
  {
    file: 'packages/framework/std/src/gfx/keyboard.ts',
    letters: [],
    why: 'tracks Shift and Space as held keys; no letter',
  },
  {
    file: 'packages/framework/std/src/inline/services/event.ts',
    letters: [],
    why: 'on its own element (input, popup); no bare letter',
  },
];

const commands = getCommands();

/**
 * Every handler added to the dispatcher's `keyDown` event outside a keymap
 * (`handleEvent('keyDown', …)`, `std.event.add('keyDown', …)`): a third channel,
 * beside `bindHotKey` and raw listeners, that no keymap can see. Each entry
 * names the bare letters it takes and the state they need: `editing` (a canvas
 * element in edit mode, where no prefix arms) or `selection` (a selection
 * state that runs before the shortcut keymap, so a prefix cannot arm there).
 * Only an entry with neither may not take a prefix letter. A NEW file with
 * such a handler fails until it is listed.
 */
const KEYDOWN_HANDLERS: readonly {
  file: string;
  letters: 'any' | readonly string[];
  needs?: 'editing' | 'selection';
  why: string;
}[] = [
  {
    file: 'packages/affine/blocks/root/src/edgeless/edgeless-keyboard.ts',
    letters: 'any',
    needs: 'selection',
    why: 'a printable key with ONE mind-map node selected starts editing it with that key; Space pans',
  },
  {
    file: 'packages/affine/database/engine/src/view-presets/table/pc/controller/hotkeys.ts',
    letters: 'any',
    needs: 'selection',
    why: 'a printable key with a table cell selected starts editing it',
  },
  {
    file: 'packages/affine/database/engine/src/view-presets/table/pc-virtual/controller/hotkeys.ts',
    letters: 'any',
    needs: 'selection',
    why: 'a printable key with a table cell selected starts editing it',
  },
  {
    file: 'packages/affine/gfx/connector/src/text/edgeless-connector-label-editor.ts',
    letters: [],
    needs: 'editing',
    why: "while a connector's label is edited",
  },
  {
    file: 'packages/affine/gfx/group/src/text/edgeless-group-title-editor.ts',
    letters: [],
    needs: 'editing',
    why: "while a group's title is edited",
  },
  {
    file: 'packages/affine/widgets/drag-handle/src/watchers/keyboard-event-watcher.ts',
    letters: [],
    why: 'only while a block is dragged; it prevents the default and consumes nothing',
  },
  {
    file: 'packages/affine/widgets/frame-title/src/edgeless-frame-title-editor.ts',
    letters: [],
    needs: 'editing',
    why: "while a frame's title is edited",
  },
  {
    file: 'packages/affine/widgets/slash-menu/src/widget.ts',
    letters: [],
    needs: 'editing',
    why: '`/` in a text being typed',
  },
  {
    file: 'packages/framework/std/src/event/control/keyboard.ts',
    letters: [],
    why: 'the keymap engine itself: every binding it adds is a keymap',
  },
];

/** Every single keystroke bound on the canvas, canonical (`shift-p`, `ctrl-z`). */
function singleKeys(): Set<string | null> {
  return new Set<string | null>([
    ...RESERVED_EDGELESS_KEYS.map(k => canonicalCombo([k])),
    ...KEYDOWN_HANDLERS.filter(h => !h.needs && h.letters !== 'any').flatMap(
      h => (h.letters as readonly string[]).map(l => canonicalCombo([l]))
    ),
    ...bindHotKeySites().flatMap(({ keys }) =>
      keys.filter(isBareKey).map(key => canonicalCombo([key]))
    ),
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

  test('a second key is one lowercase letter', () => {
    // Accepts `c`; rejects `C` (a Shift stroke the chord matcher reads as
    // `Shift-C`), `7` (Shift-ed on AZERTY), `Mod-c` and `Escape`.
    const SECOND_KEY = /^[a-z]$/;
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

  test('every bindHotKey of the library is read, or a known forwarder', () => {
    const sites = bindHotKeySites();
    expect(
      [...new Set(sites.filter(s => !s.read).map(s => s.file))].sort()
    ).toEqual([...BIND_HOT_KEY_FORWARDERS].sort());
    // …and the parser does read the bindings: the edgeless keyboard's tools
    // and the toolbar buttons' own letters come out of it.
    const bare = new Set(sites.flatMap(s => s.keys.filter(isBareKey)));
    for (const key of [...RESERVED_EDGELESS_KEYS, 'm', 's']) {
      expect(bare.has(key), key).toBe(true);
    }
  });

  test('every dispatcher keyDown handler of the library is listed', () => {
    const found = SOURCES
      // Accepts `handleEvent('keyDown', …)` and `std.event.add('keyDown', …)`
      // across a line break; rejects the raw DOM `'keydown'`.
      .filter(({ text }) =>
        /\b(handleEvent|add)\(\s*['"]keyDown['"]/.test(text)
      )
      .map(({ path }) => path)
      .sort();
    expect(found).toEqual(KEYDOWN_HANDLERS.map(h => h.file).sort());
    // A handler that takes letters with no state to gate them could hold a
    // prefix letter: none may.
    for (const handler of KEYDOWN_HANDLERS) {
      if (handler.needs) continue;
      expect(handler.letters, handler.file).toEqual([]);
    }
  });

  test('every raw keydown listener of the library is listed', () => {
    const found = SOURCES
      // Accepts `addEventListener('keydown', …)` and `@keydown=${…}`;
      // rejects the word in prose, such as "a keydown event".
      .filter(({ text }) => /'keydown'|@keydown=/.test(text))
      .map(({ path }) => path)
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
