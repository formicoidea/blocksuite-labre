import {
  type Menu,
  menu,
  type MenuConfig,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  type DataSourcePickerSourceNameVerdict,
  type DataSourcePickerSourceNaming,
  translateKey,
} from '@labre/affine-shared/services';
import { PlusIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { computed, signal } from '@preact/signals-core';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import {
  SOURCE_NAME_CREATE,
  SOURCE_NAME_EMPTY,
  SOURCE_NAME_OK,
  SOURCE_NAME_PLACEHOLDER,
  SOURCE_NAME_TAKEN,
} from './translations.js';

export interface NewSourceEntry {
  name: string;
  testId: string;
  /** Create, with the trimmed name when the host names its sources. */
  create: (sourceName: string | undefined) => void;
}

/** The name as an argument only when there is one: a host without naming is called as in 2.0. */
export const named = (sourceName: string | undefined): [] | [string] =>
  sourceName === undefined ? [] : [sourceName];

const VERDICT_WORDING: Record<
  DataSourcePickerSourceNameVerdict,
  ChromeWording
> = {
  ok: SOURCE_NAME_OK,
  taken: SOURCE_NAME_TAKEN,
  empty: SOURCE_NAME_EMPTY,
};

function verdictOf(
  naming: DataSourcePickerSourceNaming,
  name: string
): DataSourcePickerSourceNameVerdict {
  try {
    return naming.check(name);
  } catch (error) {
    console.error(error);
    return 'empty';
  }
}

/**
 * Every entry that creates a source (ADR 0035 amendment of 2026-10-30):
 * "New source", "New database", "With a new source", "New empty source".
 * Without the host's `sourceName` it creates at once, as in 2.0. With it,
 * it opens a step in the same cascade (a sub-menu, as renaming a select
 * option does): the field on the host's suggestion, the host's verdict
 * under it, "Create". Only `'ok'` creates; Enter is "Create".
 */
export function newSourceEntry(
  std: BlockStdScope | undefined,
  naming: DataSourcePickerSourceNaming | undefined,
  entry: NewSourceEntry
): MenuConfig {
  if (!naming) {
    return menu.action({
      name: entry.name,
      prefix: PlusIcon(),
      testId: entry.testId,
      select: () => entry.create(undefined),
    });
  }
  const t = (wording: ChromeWording) =>
    std ? translateKey(std, ...wording) : wording[1];
  return parent => {
    const suggested$ = signal<string | undefined>(undefined);
    const typed$ = signal<string | undefined>(undefined);
    const name$ = computed(() => typed$.value ?? suggested$.value ?? '');
    let asked = false;
    // Never written while the step draws (a computed): always a microtask.
    const ask = () => {
      asked = true;
      Promise.resolve()
        .then(() => naming.suggest())
        .then(
          name => {
            suggested$.value = name;
          },
          error => {
            console.error(error);
            suggested$.value = '';
          }
        );
    };
    const create = () => {
      const name = name$.peek();
      if (verdictOf(naming, name) !== 'ok') return false;
      entry.create(name.trim());
      return true;
    };
    const field: MenuConfig = (step: Menu) => {
      if (!asked) ask();
      if (suggested$.value === undefined) return;
      return menu.input({
        initialValue: suggested$.value,
        placeholder: t(SOURCE_NAME_PLACEHOLDER),
        onChange: value => {
          typed$.value = value;
        },
        onEnter: () => {
          if (!create()) return false;
          step.options.onComplete?.();
          return true;
        },
      })(step);
    };
    const verdict: MenuConfig = () => {
      if (suggested$.value === undefined) return;
      const value = verdictOf(naming, name$.value);
      return html`<div
        role="status"
        data-testid="${entry.testId}-verdict"
        data-verdict=${value}
        style=${styleMap({
          padding: '0 6px',
          fontSize: '12px',
          lineHeight: '20px',
          color:
            value === 'ok'
              ? 'var(--affine-text-secondary-color)'
              : 'var(--affine-error-color)',
        })}
      >
        ${t(VERDICT_WORDING[value])}
      </div>`;
    };
    return menu.subMenu({
      name: entry.name,
      prefix: PlusIcon(),
      testId: entry.testId,
      options: {
        testId: `${entry.testId}-naming`,
        // Each opening of the step starts again from a new suggestion.
        onClose: () => {
          asked = false;
          suggested$.value = undefined;
          typed$.value = undefined;
        },
        items: [
          field,
          verdict,
          menu.action({
            name: t(SOURCE_NAME_CREATE),
            testId: `${entry.testId}-create`,
            hide: () => suggested$.value === undefined,
            select: () => (create() ? undefined : false),
          }),
        ],
      },
    })(parent);
  };
}
