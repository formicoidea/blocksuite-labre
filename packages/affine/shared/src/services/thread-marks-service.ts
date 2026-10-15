import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * What a mark sits on (ADR 0038): a block, in either view, or a canvas element
 * no block backs (a shape, a connector, a group, a framework board). The id is
 * the one the library already gives it: a block id, an element id.
 */
export type ThreadMarkTargetType = 'block' | 'element';

/**
 * One marked target of the mounted document, as the host computes it. Ids and
 * counters only: the library never learns what the host attaches to a target,
 * who wrote it or what it says.
 *
 * `count` is how many the host has on that target (a mark at `0` or below is
 * not drawn); `unread` turns the mark to the accent colour.
 */
export interface ThreadMark {
  targetType: ThreadMarkTargetType;
  targetId: string;
  count: number;
  unread: boolean;
}

/**
 * What the library hands the host when someone clicks a mark or "Discuss"
 * (`com.labre.thread.discuss`) in a block or element toolbar.
 *
 * `excerpt` is computed here because the library knows the content: the
 * block's text (its descendants' for a container such as a note), a canvas
 * element's label as the selection pane reads it, else the kind of target.
 * Whitespace is collapsed and it is cut to at most 280 characters, an
 * ellipsis included (`THREAD_EXCERPT_MAX`). It is a snapshot for the host to
 * store beside its anchor; the library keeps no copy.
 */
export interface ThreadOpenRequest {
  docId: string;
  targetType: ThreadMarkTargetType;
  targetId: string;
  excerpt: string;
}

/** The longest excerpt `openThread` is ever handed, in code points. */
export const THREAD_EXCERPT_MAX = 280;

/**
 * The "has a thread" seam (ADR 0038): the host owns the discussions, the
 * library marks what the host says is marked and asks the host to open one.
 *
 * Nothing is written to the document, ever: no prop, no id in the content, no
 * write on load. That is why it is not `CommentProvider`, which writes
 * `block.props.comments` and ignores canvas elements.
 *
 * Absent or `null`: no mark is drawn and no toolbar offers "Discuss".
 */
export interface ThreadMarksService {
  /**
   * The marks of the mounted document. Read reactively: a new array
   * repaints the marks. An id the editor cannot find (a deleted block, an
   * element of the other view) is ignored, never an error.
   */
  marks$: ReadonlySignal<readonly ThreadMark[]>;
  /** Open (or start) the discussion on a target. Writes nothing here. */
  openThread(request: ThreadOpenRequest): void;
}

export const ThreadMarksProvider =
  createIdentifier<ThreadMarksService>('LabreThreadMarks');

/**
 * Host seam: the host's thread marks, or `null` to say there are none.
 *
 * `di.override`, like every panel seam, so a later registration wins and
 * registering twice never throws at boot.
 */
export function ThreadMarksExtension(
  service: ThreadMarksService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through the factory on purpose: `getOptional` then
      // reports the seam as absent, which is the whole "no mark, no button"
      // story.
      di.override(ThreadMarksProvider, () => service as ThreadMarksService);
    },
  };
}
