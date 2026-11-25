/**
 * `DocDisplayMetaService`'s public caches keep the type they had before
 * ADR 0057, and code written against them keeps compiling.
 *
 * #746 stopped the service building the default store of every linked
 * document it names: its caches are keyed by document id now, in private
 * members. `iconMap` and `titleMap` stay public with their old types,
 * deprecated and empty, so the change ships in a minor (a public type only
 * widens there). This spec would catch them changing type: the declarations
 * below are written exactly as before ADR 0057, and `yarn build` typechecks
 * tests.
 */
import type { Store } from '@labre/store';
import type { Signal } from '@preact/signals-core';
import type { TemplateResult } from 'lit';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { DocDisplayMetaService } from '../../services/doc-display-meta-service.js';

/** The two caches as the service declared them before ADR 0057. */
type IconMapBefore = WeakMap<Store, Signal<TemplateResult>>;
type TitleMapBefore = WeakMap<Store, Signal<string>>;

describe('DocDisplayMetaService caches, as declared before ADR 0057', () => {
  it('iconMap and titleMap keep their types', () => {
    expectTypeOf<
      DocDisplayMetaService['iconMap']
    >().toEqualTypeOf<IconMapBefore>();
    expectTypeOf<
      DocDisplayMetaService['titleMap']
    >().toEqualTypeOf<TitleMapBefore>();
    // A host's read, as written before: it compiles, and finds nothing.
    const read = (
      service: Pick<DocDisplayMetaService, 'titleMap'>,
      store: Store
    ) => service.titleMap.get(store);
    expect(read({ titleMap: new WeakMap() }, {} as Store)).toBeUndefined();
  });
});
