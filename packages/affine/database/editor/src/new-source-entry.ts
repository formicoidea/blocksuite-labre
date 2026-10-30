import {
  foldForSearch,
  type Menu,
  menu,
  type MenuConfig,
  type MenuOptions,
} from '@labre/affine-components/context-menu';
import {
  type ChromeWording,
  type DataSourcePickerSourceNameVerdict,
  type DataSourcePickerSourceNaming,
  translateKey,
} from '@labre/affine-shared/services';
import { PlusIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { computed, type Signal, signal } from '@preact/signals-core';
import { html } from 'lit';
import { styleMap } from 'lit/directives/style-map.js';

import {
  SOURCE_NAME_CREATE,
  SOURCE_NAME_EMPTY,
  SOURCE_NAME_OK,
  SOURCE_NAME_PLACEHOLDER,
  SOURCE_NAME_TAKEN,
  SOURCE_SEARCH_CREATE,
  SOURCE_SEARCH_PLACEHOLDER,
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

/**
 * The search field of a menu that lists sources (labre recette of 2.1): the
 * menu's own type-to-search, shown from the start so the list reads as
 * searchable.
 */
export function sourceSearch(
  std: BlockStdScope | undefined
): MenuOptions['search'] {
  return {
    placeholder: std
      ? translateKey(std, ...SOURCE_SEARCH_PLACEHOLDER)
      : SOURCE_SEARCH_PLACEHOLDER[1],
  };
}

// Per menu: the host's names are read once it opens (`suggest`), since
// `check` answers against the names the last `suggest` read.
const namesRead = new WeakMap<Menu, Signal<boolean>>();

function namesReadFor(parent: Menu, naming: DataSourcePickerSourceNaming) {
  let read$ = namesRead.get(parent);
  if (!read$) {
    const created$ = signal(false);
    read$ = created$;
    namesRead.set(parent, created$);
    Promise.resolve()
      .then(() => naming.suggest())
      .catch(console.error)
      .finally(() => {
        created$.value = true;
      });
  }
  return read$.value;
}

/**
 * "Create source “typed”" at the end of a searched list of sources (labre
 * recette of 2.1): drawn while the search holds a name no listed source
 * bears (case and accents folded); it creates that name at once, the search
 * having been the naming step. When the host refuses the name (a source of
 * another database bears it), the entry stays, disabled, worded with the
 * host's verdict: hidden, it left "No results" and no reason (labre recette
 * of 2.2). Absent without the host's naming: an unnamed source would not be
 * the one the entry announces.
 */
export function typedSourceEntry(
  std: BlockStdScope | undefined,
  naming: DataSourcePickerSourceNaming | undefined,
  listed: readonly string[],
  entry: NewSourceEntry
): MenuConfig {
  return parent => {
    if (!naming) return;
    const typed = parent.searchName$.value;
    const name = typed.trim();
    if (!name) return;
    const key = foldForSearch(name);
    if (listed.some(title => foldForSearch(title.trim()) === key)) return;
    if (!namesReadFor(parent, naming)) return;
    const verdict = verdictOf(naming, name);
    if (verdict !== 'ok') {
      return html`<div
        role="status"
        aria-disabled="true"
        data-testid="${entry.testId}-typed"
        data-verdict=${verdict}
        style=${styleMap({
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px',
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--affine-text-disable-color)',
          cursor: 'default',
        })}
      >
        ${PlusIcon()}
        <span style="color: var(--affine-error-color)"
          >${std
            ? translateKey(std, ...VERDICT_WORDING[verdict])
            : VERDICT_WORDING[verdict][1]}</span
        >
      </div>`;
    }
    // The typed text verbatim, so the menu's own search keeps the entry.
    const params = { name: typed };
    return menu.action({
      name: std
        ? translateKey(std, ...SOURCE_SEARCH_CREATE, params)
        : SOURCE_SEARCH_CREATE[1].replace('{{name}}', typed),
      prefix: PlusIcon(),
      testId: `${entry.testId}-typed`,
      select: () => entry.create(name),
    })(parent);
  };
}
