import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * What the properties panel is asked to show (ADR 0035 §9b): one panel with a
 * typed request, like the artefact catalogue's `open(owner)`.
 *
 * - `page`: the property sheet of one document — the button beside the title
 *   band's "+" sends it, under the page title and in the note header alike.
 * - `source`: the properties of one data source of a database, as a view
 *   shows them. Declared now so the host's `open` is written once against the
 *   whole union; the library sends it from the database view bar and the view
 *   settings when they ship (ADR 0035, issue B10), never before.
 *
 * The union only widens: a new scope is a new member, and an existing member
 * never gains a required field.
 */
export type PropertiesPanelRequest =
  | { scope: 'page'; docId: string }
  | {
      scope: 'source';
      docId: string;
      blockId: string;
      sourceId: string;
      /**
       * The database `sourceId` belongs to, only when the view reads a
       * source of another database than its block's (the view's stored
       * `databaseId`, ADR 0035 amendment of 2026-10-30). Absent: the
       * block's own database, as before 2.4.
       */
      databaseId?: string;
      viewId?: string;
    };

/**
 * The properties panel (ADR 0035 §9b), shaped as every panel seam of
 * ADR 0034 §1: two verbs, nothing else. The host draws the panel where it
 * wants it (the Labre app, in its left sidebar); the library never mounts one
 * and keeps no "is it open" state, so a second `open` with another request
 * retargets the host's panel rather than toggling anything here.
 *
 * Absent or `null`, the title band draws no panel button: a button that opens
 * nothing is a lie. A database's properties stay reachable through the
 * data-view's own properties popover.
 */
export interface PropertiesPanelService {
  /** Show the panel for `request`. */
  open(request: PropertiesPanelRequest): void;
  /** Put it away. Writes nothing. */
  close(): void;
}

export const PropertiesPanelProvider = createIdentifier<PropertiesPanelService>(
  'LabrePropertiesPanel'
);

/**
 * Host seam: the host's properties panel, or `null` to say there is none.
 *
 * `di.override`, like `OutlinePanelExtension`, so a later registration always
 * wins and registering twice never throws at boot.
 */
export function PropertiesPanelExtension(
  service: PropertiesPanelService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through the factory on purpose: `getOptional` then
      // reports the panel as absent, which is the whole "no button" story.
      di.override(
        PropertiesPanelProvider,
        () => service as PropertiesPanelService
      );
    },
  };
}
