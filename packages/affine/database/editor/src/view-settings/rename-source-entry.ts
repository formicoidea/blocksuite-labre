import {
  foldForSearch,
  type Menu,
  menu,
  type MenuConfig,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  type DataSourcePickerRenameResult,
  type DataSourcePickerSourceNaming,
  translateKey,
} from '@labre/affine-shared/services';
import { EditIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { styleMap } from '@labre/global/lit';

import {
  namesReadFor,
  VERDICT_WORDING,
  verdictOf,
} from '../new-source-entry.js';
import {
  SOURCE_NAME_EMPTY,
  SOURCE_NAME_PLACEHOLDER,
  SOURCE_RENAME_ENTRY,
  SOURCE_RENAME_FAILED,
} from '../translations.js';

export interface RenameSourceTarget {
  /** The source's name as stored, read each time the step opens ('' when untitled). */
  currentName: () => string;
  /** The host's verb, bound to the view's database and source. */
  rename: (name: string) => Promise<DataSourcePickerRenameResult>;
  /** The host's naming rule, to warn while typing; its verb still decides. */
  naming: DataSourcePickerSourceNaming | undefined;
}

const TEST_ID = 'data-source-picker-rename-source';

/**
 * "Rename source", first in the view settings' "Source" list (issue #576,
 * ADR 0035 amendment of 2026-11-04): a step in the same cascade, as
 * `newSourceEntry` names a new source, opening on the current name. The
 * library writes nothing; the host's `renameSource` renames and its lists
 * follow.
 *
 * Saved on Enter ONLY. The context menu's input calls `onComplete` and
 * blurs on Escape, and the property rename saves on blur, so Escape saves
 * there; here Escape must cancel, so neither `onComplete` nor `onBlur` is
 * given. An unchanged name closes the step without a call; an empty one is
 * refused before the host is asked. While the host answers, the field is
 * dimmed and a second Enter is ignored; a refusal shows the host's message
 * under the field, a rejection a generic one; an answer arriving after the
 * step closed changes nothing.
 */
export function renameSourceEntry(
  std: BlockStdScope,
  target: RenameSourceTarget
): MenuConfig {
  const t = (wording: ChromeWording) => translateKey(std, ...wording);
  return parent => {
    const typed$ = signal<string | undefined>(undefined);
    const refusal$ = signal<string | undefined>(undefined);
    const pending$ = signal(false);
    let opened: string | undefined;
    const original = () => (opened ??= target.currentName());
    const name$ = computed(() => typed$.value ?? original());

    // Never rejects: every outcome, a throwing host included, is caught here.
    const ask = async (step: Menu, name: string) => {
      pending$.value = true;
      refusal$.value = undefined;
      try {
        const result = await target.rename(name);
        if (step.closed) return;
        if (result.ok) {
          step.close();
          return;
        }
        refusal$.value = result.message || t(SOURCE_RENAME_FAILED);
      } catch (error) {
        console.error(error);
        if (!step.closed) refusal$.value = t(SOURCE_RENAME_FAILED);
      } finally {
        pending$.value = false;
      }
    };

    const save = (step: Menu) => {
      if (pending$.peek()) return;
      const name = name$.peek().trim();
      if (name === original().trim()) {
        step.close();
        return;
      }
      if (!name) {
        refusal$.value = t(SOURCE_NAME_EMPTY);
        return;
      }
      void ask(step, name);
    };

    const field: MenuConfig = step =>
      menu.input({
        initialValue: original(),
        placeholder: t(SOURCE_NAME_PLACEHOLDER),
        style: pending$.value ? { opacity: '0.5', pointerEvents: 'none' } : {},
        onChange: value => {
          typed$.value = value;
          refusal$.value = undefined;
        },
        onEnter: () => {
          save(step);
          // The step closes itself once the host has answered.
          return false;
        },
      })(step);

    // The host's refusal, else its naming rule's early warning. The source's
    // own name, case and accents aside, is never warned about: a rule that
    // counts every live source would call it taken.
    const status: MenuConfig = step => {
      const message = refusal$.value ?? warning(step);
      if (!message) return;
      return html`<div
        role="status"
        data-testid="${TEST_ID}-status"
        style=${styleMap({
          padding: '0 6px',
          fontSize: '12px',
          lineHeight: '20px',
          color: 'var(--affine-error-color)',
        })}
      >
        ${message}
      </div>`;
    };
    const warning = (step: Menu) => {
      const { naming } = target;
      const name = name$.value;
      if (!naming || typed$.value === undefined) return;
      if (foldForSearch(name.trim()) === foldForSearch(original().trim())) {
        return;
      }
      if (!namesReadFor(step, naming)) return;
      const verdict = verdictOf(naming, name);
      return verdict === 'ok' ? undefined : t(VERDICT_WORDING[verdict]);
    };

    return menu.subMenu({
      name: t(SOURCE_RENAME_ENTRY),
      prefix: EditIcon(),
      testId: TEST_ID,
      options: {
        testId: `${TEST_ID}-step`,
        // Each opening starts again from the name as it is now.
        onClose: () => {
          opened = undefined;
          typed$.value = undefined;
          refusal$.value = undefined;
        },
        items: [field, status],
      },
    })(parent);
  };
}
