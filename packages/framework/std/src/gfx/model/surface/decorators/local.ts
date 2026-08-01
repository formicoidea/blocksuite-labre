import type { GfxPrimitiveElementModel } from '../element-model.js';
import { getDecoratorState } from './common.js';
import { convertProps } from './convert.js';
import { getDerivedProps, updateDerivedProps } from './derive.js';

const localPropsSetSymbol = Symbol('localProps');

/**
 * The set of prop names declared with `@local()` on an element class.
 *
 * Mirrors `getFieldPropsSet` (see `./field.js`) for the non-synced half of the
 * accessor surface. Together the two sets are the only reliable answer to "does this
 * element class declare an accessor for this key" — `key in element` is not:
 * it also matches methods, getter-only derived props (`x`, `w`, `group`, …)
 * and internal instance fields.
 *
 * The set is keyed on the most derived prototype and filled by the decorator's
 * `init`, which runs for every accessor (base and derived) during the first
 * construction of an element of that class.
 */
export function getLocalPropsSet(target: unknown): Set<string | symbol> {
  const proto = Object.getPrototypeOf(target);
  if (!Object.hasOwn(proto, localPropsSetSymbol)) {
    proto[localPropsSetSymbol] = new Set();
  }

  return proto[localPropsSetSymbol] as Set<string | symbol>;
}

/**
 * A decorator to mark the property as a local property.
 *
 * The local property act like it is a field property, but it's not synced to the Y map.
 * Updating local property will also trigger the `elementUpdated` slot of the surface model
 */
export function local<V, T extends GfxPrimitiveElementModel>() {
  return function localDecorator(
    _target: ClassAccessorDecoratorTarget<T, V>,
    context: ClassAccessorDecoratorContext
  ) {
    const prop = context.name;

    return {
      init(this: T, v: V) {
        getLocalPropsSet(this).add(prop);
        this._local.set(prop, v);

        return v;
      },
      get(this: T) {
        return this._local.get(prop);
      },
      set(this: T, originalValue: unknown) {
        const isCreating = getDecoratorState(this.surface)?.creating;
        const oldValue = this._local.get(prop);
        // When state is creating, the value is considered as default value
        // hence there's no need to convert it
        const newVal = isCreating
          ? originalValue
          : convertProps(prop, originalValue, this);

        const derivedProps = getDerivedProps(prop, originalValue, this);

        this._local.set(prop, newVal);

        // During creating, no need to invoke an update event and derive another update
        if (!isCreating) {
          updateDerivedProps(derivedProps, this);

          this._onChange({
            props: {
              [prop]: newVal,
            },
            oldValues: {
              [prop]: oldValue,
            },
            local: true,
          });
        }
      },
    } as ClassAccessorDecoratorResult<T, V>;
  };
}
