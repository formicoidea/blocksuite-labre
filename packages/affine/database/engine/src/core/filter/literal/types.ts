import type { MenuConfig } from '@labre/affine-components/context-menu';
import type { ReadonlySignal } from '@preact/signals-core';

import type { TypeInstance, ValueTypeOf } from '../../logical/type.js';
import { type Wording } from '../../utils/wording.js';

export type CreateLiteralItemsConfig = <
  Type extends TypeInstance = TypeInstance,
>(
  config: LiteralItemsConfig<Type>
) => LiteralItemsConfig<Type>;

export type LiteralItemsConfig<Type extends TypeInstance = any> = {
  type: Type;
  getItems: (
    type: Type,
    value: ReadonlySignal<ValueTypeOf<Type> | undefined>,
    onChange: (value: ValueTypeOf<Type>) => void,
    /** The words of the filter's editor; English when absent. */
    wording?: Wording
  ) => MenuConfig[];
};
