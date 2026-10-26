/**
 * The special characters of a text (`text.invisibles.*`): the zero-width
 * spaces, word joiners and tag characters an AI text generator or a
 * "watermarking" tool leaves behind, invisible to the reader and carried
 * along by every copy.
 *
 * `owner: 'core'`, `scope: 'global'`: a paragraph is the same text in both
 * views, and a canvas label is text too. On the palette, the agent and the
 * host's view menu (`'view-menu'`, ADR 0034 amendment of 2026-10-13): the
 * library draws no menu of its own, a host lists them with `getViewActions`
 * and runs them through `runCommand`.
 *
 * Telemetry is emitted from the bodies, for `doc.copyLink`'s reason: the
 * counts are facts of the invocation and the commands belong to no framework
 * (see the telemetry README, "Special characters").
 */
import {
  InvisibleCharacters,
  NotificationProvider,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import {
  collectYTexts,
  stripInvisiblesFromYText,
} from '@labre/affine-shared/utils';
import type { AnyCommandDescriptor } from '@labre/std';
import { findInvisibleCharacters } from '@labre/std/inline';
import type { Store } from '@labre/store';

import { ROOT_TOAST_INVISIBLES_REMOVED } from '../translations.js';

/**
 * Code keeps its characters: a zero-width space in a string literal is the
 * program's business, not a watermark.
 */
const UNTOUCHED_FLAVOURS: ReadonlySet<string> = new Set(['affine:code']);

/**
 * Strip the invisible characters of every text of `store` — each block's
 * text, the title, table and database cells, and through the surface block
 * every canvas element's text, labels and titles — in ONE transaction, so one
 * undo puts them all back. Writes nothing on a read-only store, and nothing
 * when there is nothing to remove (no empty undo entry).
 *
 * `blockCount` counts blocks: the canvas is one, its elements live in the
 * surface block.
 */
export function removeInvisibleCharacters(store: Store): {
  count: number;
  blockCount: number;
} {
  if (store.readonly) return { count: 0, blockCount: 0 };
  const touched = store
    .getAllModels()
    .filter(model => !UNTOUCHED_FLAVOURS.has(model.flavour))
    .map(model => ({ model, texts: collectYTexts(model.yBlock) }))
    .filter(({ texts }) =>
      texts.some(text => findInvisibleCharacters(text.toString()).length > 0)
    );
  if (touched.length === 0) return { count: 0, blockCount: 0 };

  let count = 0;
  store.captureSync();
  store.transact(() => {
    for (const { texts } of touched) {
      for (const text of texts) count += stripInvisiblesFromYText(text);
    }
  });
  store.captureSync();
  return { count, blockCount: touched.length };
}

const removeInvisibles: AnyCommandDescriptor = {
  id: 'text.invisibles.remove',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.text.invisibles.remove',
  labelFallback: 'Remove invisible characters',
  descriptionKey: 'com.labre.command.text.invisibles.remove.description',
  descriptionFallback:
    'Remove the zero-width spaces, word joiners and other invisible characters AI tools leave in a text. Emoji, code and no-break spaces are kept.',
  category: 'text',
  keywords: ['invisible', 'watermark', 'zero-width', 'clean', 'AI'],
  surfaces: ['palette', 'agent', 'view-menu'],
  order: 3,
  scope: 'global',
  defaultKeys: { mac: [], other: [] },
  availability: 'editable',
  run: std => {
    const { count, blockCount } = removeInvisibleCharacters(std.store);
    std
      .getOptional(NotificationProvider)
      ?.toast(translateKey(std, ...ROOT_TOAST_INVISIBLES_REMOVED, { count }));
    if (count === 0) return;
    std
      .getOptional(TelemetryProvider)
      ?.track('InvisibleCharactersRemoved', { count, blockCount });
  },
};

/**
 * Show or hide the special characters for THIS viewer: a dot per space, an
 * arrow per tab, a degree sign per no-break space, a red mark per invisible
 * character, ↵ and ¶ at line ends (`InvisibleCharacters`, `v-text`).
 * Writes nothing to the document, so a reader may do it too.
 */
const toggleInvisibles: AnyCommandDescriptor = {
  id: 'text.invisibles.toggle',
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.text.invisibles.toggle',
  labelFallback: 'Show special characters',
  descriptionKey: 'com.labre.command.text.invisibles.toggle.description',
  descriptionFallback:
    'Show or hide spaces, tabs, no-break spaces, line ends and invisible characters on your screen only.',
  category: 'display',
  keywords: ['invisible', 'whitespace', 'pilcrow', 'formatting', 'marks'],
  surfaces: ['palette', 'agent', 'view-menu'],
  order: 2,
  scope: 'global',
  defaultKeys: { mac: [], other: [] },
  when: std => !!std.getOptional(InvisibleCharacters),
  // A signal read, so a menu that reads it inside an effect ticks and
  // unticks with the display, whoever flips it.
  checked: std => std.getOptional(InvisibleCharacters)?.visible$.value ?? false,
  run: std => {
    const display = std.getOptional(InvisibleCharacters);
    if (!display) return;
    // Toggled first: an optional call skips its arguments when there is no
    // telemetry provider.
    const visible = display.toggle();
    std
      .getOptional(TelemetryProvider)
      ?.track('InvisibleCharactersToggled', { visible });
  },
};

export const invisibleCharactersCommands: AnyCommandDescriptor[] = [
  toggleInvisibles,
  removeInvisibles,
];
