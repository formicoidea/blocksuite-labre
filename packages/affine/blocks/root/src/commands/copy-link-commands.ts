/**
 * `doc.copyLink` — put the current document's URL on the clipboard, anchored on
 * whatever is selected.
 *
 * The library does not know what a document's address looks like: routing is
 * the host's, and the seam for it — `GenerateDocUrlProvider` — has shipped
 * since AFFiNE with **no consumer at all** on either side. This command is the
 * consumer, and the counterpart of the paste path that already turns a host URL
 * back into an inline reference (`ParseDocUrlProvider`, read by
 * `adapters/middlewares/paste.ts`). Copy here, paste there, and the round trip
 * closes without the library ever spelling a URL.
 *
 * It lives in the registry rather than in the host chrome because ADR 0008
 * makes a command the single source for its keystroke, its palette entry and
 * its Settings › Shortcuts row. A host-side button would be reachable from none
 * of the three, and would not fire while the focus is inside the editor.
 *
 * Default chord `Mod-Alt-l` (product decision, PR #401 — the gesture users
 * already know from Notion). NOT `Mod-l`: `Ctrl+L` / `Cmd+L` is the browser's
 * address bar and never reaches the page, so a default on it would silently do
 * nothing on the web. `scope: 'global'` so it fires in page mode and on the
 * canvas alike.
 *
 * **`navigator.clipboard` can be absent, not merely refusing.** The Clipboard
 * API is a secure-context feature: over plain `http://` on anything but
 * `localhost`, and in a cross-origin iframe with no `clipboard-write`
 * permission, the `clipboard` property is `undefined` altogether — so reaching
 * for `writeText` throws a synchronous `TypeError` out of `run` rather than
 * returning a promise to reject. That is checked before anything is announced:
 * no copy, no toast, no telemetry, one `console.error` saying why. Announcing a
 * copy that never happened is the one failure mode worse than doing nothing.
 *
 * A clipboard that EXISTS and then rejects (permission denied at the moment of
 * writing) is a different case and is left as it is: the promise is caught, and
 * the toast has already been shown — the same optimistic behaviour the inline
 * link toolbar has always had, kept deliberately so the two copy-a-link
 * gestures do not answer differently.
 */
import {
  DocModeProvider,
  GenerateDocUrlProvider,
  NotificationProvider,
  TOAST_LINK_COPIED,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import type { ReferenceParams } from '@labre/affine-model';
import {
  BlockSelection,
  SurfaceSelection,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandDescriptor,
} from '@labre/std';

/**
 * Where the link points INSIDE the document, read off the live selection.
 *
 * `mode` is not decoration: the reader of these params
 * (`extractSearchParams`, `adapters/middlewares/paste.ts`) only looks at
 * `blockIds` / `elementIds` once it has found a valid `mode` in the query
 * string, so an anchor emitted without one is dropped on the way back in. When
 * no `DocModeProvider` is registered the anchor is therefore left out entirely
 * rather than written in a form nothing can read — the link still opens the
 * document, which is the honest degradation.
 *
 * Canvas before prose: a surface selection and a block selection can coexist in
 * the store (selecting a note on the canvas leaves the page's own selection
 * behind), and on the canvas the element IS what the user pointed at.
 *
 * A caret is deliberately NOT an anchor. `TextSelection` exists the whole time
 * somebody is typing, so reading it would mean every copy silently points at a
 * paragraph instead of the document — the opposite of what an unsolicited
 * keystroke should do.
 */
function anchorOf(std: BlockStdScope): ReferenceParams | undefined {
  const mode = std.getOptional(DocModeProvider)?.getEditorMode();
  if (!mode) return undefined;

  const elementIds = std.selection
    .filter(SurfaceSelection)
    .flatMap(selection => selection.elements);
  if (elementIds.length) return { mode, elementIds };

  const blockIds = std.selection
    .filter(BlockSelection)
    .map(selection => selection.blockId);
  if (blockIds.length) return { mode, blockIds };

  return { mode };
}

/**
 * The seam, or nothing. Read through `getOptional` like every other host seam,
 * and reported as UNAVAILABLE rather than as a silent no-op: a palette entry
 * that copies nothing and a shortcut that does nothing are both worse than an
 * entry that is not there (`docs/integrate/04-host-seams.md`, step 2 of "How to
 * add a seam").
 */
const canCopyDocLink = (std: BlockStdScope) =>
  !!std.getOptional(GenerateDocUrlProvider);

const copyDocLink: CommandDescriptor = {
  id: 'doc.copyLink',
  owner: 'core',
  kind: 'action',
  // `com.labre.command.*` like the other keyless-by-intent core commands, not
  // `com.labre.keyboardShortcuts.*`: this one is a capability that happens to
  // carry a default chord, and the shortcut namespace would file it as a
  // keymap row for a translator.
  labelKey: 'com.labre.command.doc.copy-link',
  labelFallback: 'Copy document link',
  descriptionKey: 'com.labre.command.doc.copy-link.description',
  descriptionFallback:
    'Copy a link to this document, anchored on the selection, so it can be ' +
    'pasted into a text as a reference.',
  keywords: ['link', 'url', 'share', 'reference'],
  surfaces: ['palette', 'agent'],
  scope: 'global',
  defaultKeys: { mac: ['Mod-Alt-l'], other: ['Mod-Alt-l'] },
  // Copying an address is legitimate in a read-only document, so nothing here
  // is gated on `editable`; the only precondition is the seam, which is not
  // expressible in the serializable union and therefore rides on `when`.
  availability: 'always',
  when: canCopyDocLink,
  run: (std, invocation) => {
    // The load-bearing half of the gate: `runCommand` consults neither
    // `availability` nor `when`, so the palette and the agent reach `run`
    // directly — the same arbitration `tag.set` records.
    const generator = std.getOptional(GenerateDocUrlProvider);
    if (!generator) return;

    const params = anchorOf(std);
    const url = generator.generateDocUrl(std.store.id, params);
    // A host may decline — an unsaved document, one it does not route. Nothing
    // is copied and nothing is announced.
    if (!url) return;

    // Not a promise rejection: outside a secure context the property itself is
    // `undefined`, so this would be a synchronous `TypeError` thrown out of
    // `run` — and `runCommand` only catches what a returned promise rejects
    // with, so it would surface as an unhandled error taking the keystroke
    // down with it. Nothing announced, one line saying why.
    if (!navigator.clipboard) {
      console.error(
        'doc.copyLink: no clipboard API — a secure context (https, or ' +
          'localhost) is required, and an iframe needs `clipboard-write`.'
      );
      return;
    }

    navigator.clipboard.writeText(url).catch(console.error);

    std
      .getOptional(NotificationProvider)
      ?.toast(translateKey(std, ...TOAST_LINK_COPIED));

    // Self-emitted rather than declared through `CommandDescriptor.telemetry`:
    // that field routes the bottleneck's reporter onto the three framework
    // CREATION events and requires a `FrameworkId`, and this command creates
    // nothing and belongs to no framework. `CopiedLink` is the event the two
    // other copy-a-link sites already emit (the inline link toolbar, the
    // iframe embed toolbar); reusing it keeps "links copied" one series.
    // Ids never cross: the document id and the anchored ids stay here.
    std.getOptional(TelemetryProvider)?.track('CopiedLink', {
      page: params?.mode === 'edgeless' ? 'whiteboard editor' : 'doc editor',
      segment: 'editor',
      module: invocation.surface,
      control: invocation.source,
      type: params?.elementIds?.length
        ? 'element'
        : params?.blockIds?.length
          ? 'block'
          : 'document',
      result: 'success',
    });
  },
};

export const copyLinkCommands: AnyCommandDescriptor[] = [copyDocLink];
